import { createHash } from "node:crypto";
import { aggregateMetric, dataValueStatus, type DataStatus, type MetricAggregationRow, type MetricAggregationRule } from "../metric-aggregation";
import type { AiDraftRequest, AiEvidenceCandidate, AiGroundingContext, AiIndicator, AiSource, AiWorkspace } from "./types";

const MAX_SOURCES = 40;
const MAX_CONTEXT_CHARACTERS = 30_000;
const MAX_EXCERPT = 3_800;
const SCOPES = ["Scope 1", "Scope 2", "Scope 3"] as const;
type Row = Record<string, unknown>;

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const text = (value: unknown, limit = 500) => typeof value === "string" ? value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, limit) : "";
const sourceId = (kind: AiSource["kind"], ...parts: unknown[]) => `${kind}-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16)}`;
const periodYear = (value: unknown) => {
  const period = text(value, 32);
  return /^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(period) ? Number(period.slice(0, 4)) : null;
};
const date = (value: unknown) => {
  const raw = text(value, 32);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw ? raw : null;
};
const detailNumber = (value: unknown): number | null => {
  if (finite(value)) return value;
  if (typeof value === "string" && value.trim() && /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value.trim())) {
    const parsed = Number(value);
    if (finite(parsed)) return parsed;
  }
  return null;
};

function relevance(question: string, value: string) {
  const haystack = value.toLocaleLowerCase();
  const tokens = [...new Set(question.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])].slice(0, 24);
  let score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 2 : 0), 0);
  if (/온실가스|탄소|배출|scope/i.test(question) && /온실가스|탄소|배출|scope/i.test(value)) score += 3;
  return score;
}

function metricRow(row: Row, value: unknown = row.value): MetricAggregationRow {
  return {
    company: text(row.company, 160), site: text(row.site, 160) || undefined,
    period: text(row.period, 32), value: finite(value) ? value : null,
    dataStatus: row.dataStatus as DataStatus | undefined,
    description: text(row.description),
    numerator: finite(row.numerator) ? row.numerator : null,
    denominator: finite(row.denominator) ? row.denominator : null,
  };
}

function ruleFor(indicator: AiIndicator, workspace: AiWorkspace, detail?: NonNullable<AiIndicator["detailItems"]>[number]): MetricAggregationRule {
  const unit = detail?.unit ?? indicator.unit;
  const saved = workspace.indicators.find(row => row.id === indicator.id);
  // Percentages/intensities must never inherit a plain sum rule, including a FIXED parent's rule.
  const ratio = unit.includes("%") || unit.includes("/") || (!detail && indicator.organizationAggregation === "비율");
  return {
    unit, aggregation: detail?.aggregation ?? indicator.aggregation,
    organizationAggregation: ratio ? "비율" : indicator.organizationAggregation === "비율" ? "합계" : indicator.organizationAggregation,
    ...(finite(saved?.ratioMultiplier) && saved.ratioMultiplier > 0 ? { ratioMultiplier: saved.ratioMultiplier } : {}),
  };
}

/** Only the already-authorized server workspace is accepted. No client facts or file contents are trusted here. */
export function buildAiGrounding(workspace: AiWorkspace, indicators: AiIndicator[], request: AiDraftRequest): AiGroundingContext {
  const warnings: string[] = [];
  const candidates: AiSource[] = [];
  const evidenceBySource = new Map<string, AiEvidenceCandidate>();
  const factIds = new Set<string>();
  const warning = (message: string) => { if (warnings.length < 40 && !warnings.includes(message)) warnings.push(text(message, 450)); };
  const add = (source: AiSource, isFact = false) => {
    const normalized = { ...source, title: text(source.title, 180), excerpt: text(source.excerpt, MAX_EXCERPT) };
    if (!candidates.some(item => item.id === normalized.id)) candidates.push(normalized);
    if (isFact) factIds.add(normalized.id);
  };
  if (!Number.isInteger(request.year) || request.year < 1900 || request.year > 2200) return { sources: [], warnings: ["조회 연도가 올바르지 않습니다."], evidenceCandidates: [], hasFacts: false };
  const company = text(request.company, 160);
  const companies = Object.keys(workspace.organizations);
  const inCompany = (value: unknown) => {
    const name = text(value, 160);
    return !!name && (company ? name === company : !companies.length || companies.includes(name));
  };
  const scopeLabel = company || "접근 가능한 법인 전체";
  const years = [request.year, request.year - 1];
  const activeIndicators = indicators.filter(indicator => indicator.active !== false && (request.indicatorId === undefined || indicator.id === request.indicatorId));

  if (request.mode === "guide") {
    const indicator = activeIndicators.find(item => item.id === request.indicatorId);
    if (!indicator) warning("선택한 사용 중 지표를 찾을 수 없습니다. 비활성 지표의 정의는 사용하지 않습니다.");
    else {
      const missing = ["definition", "boundary", "formula", "dataSource", "evidenceExample"].filter(key => !text(indicator[key as keyof AiIndicator]));
      if (missing.length) warning(`지표 정의의 일부 항목이 미작성입니다: ${missing.join(", ")}. 빈 정의나 기준을 임의로 채우지 않습니다.`);
      add({
        id: sourceId("indicator", indicator.id), kind: "indicator", title: `${indicator.code} ${indicator.name}`, view: "indicators",
        excerpt: JSON.stringify({
          지표코드: indicator.code, 지표명: indicator.name, 영역: indicator.category, 단위: indicator.unit,
          수집주기: indicator.cycle, 기간집계: indicator.aggregation ?? "미지정", 조직집계: indicator.organizationAggregation ?? "미지정",
          정의: text(indicator.definition) || "미작성", 집계범위: text(indicator.boundary) || "미작성",
          산식: text(indicator.formula) || "미작성", 원천자료: text(indicator.dataSource) || "미작성",
          증빙예시: text(indicator.evidenceExample) || "미작성", 관련기준: indicator.frameworks.slice(0, 12),
          세부항목: indicator.detailItems?.slice(0, 30).map(item => ({ key: item.key, label: item.label, unit: item.unit, aggregation: item.aggregation })),
          주의: "저장된 지표 정의와 작성 안내만 사용합니다. 지표 작성상태는 실제 제출실적이나 정책 시행의 증거가 아닙니다.",
        }),
      }, true);
    }
  } else {
    warning("수치는 접근 가능한 법인과 조회연도·전년의 확정 자료만 집계합니다. 등록된 확정 자료의 집계이며 모든 수집대상·기간이 완료됐다는 뜻은 아닙니다.");
    const activities = workspace.records.filter(row => row.active !== false && inCompany(row.company) && years.includes(periodYear(row.period) ?? -1));
    const confirmed = activities.filter(row => row.status === "확정");
    if (activities.length > confirmed.length) warning(`검토·작성 중 온실가스 자료 ${activities.length - confirmed.length}건은 실적 근거에서 제외했습니다.`);
    for (const year of years) for (const scope of SCOPES) {
      const rows = confirmed.filter(row => periodYear(row.period) === year && row.scope === scope);
      if (!rows.length) continue;
      const ids = rows.map(row => row.id).filter(id => typeof id === "number" || typeof id === "string");
      const duplicateIds = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
      if (duplicateIds.size) warning(`${year}년 ${scope}: 동일 자료 ID가 중복되어 ${duplicateIds.size}개 자료를 집계에서 제외했습니다.`);
      const kept = rows.filter(row => !duplicateIds.has(row.id as number | string));
      // Preserve original activity quantities independently of calculated emissions.
      const usageGroups = new Map<string, Row[]>();
      for (const row of kept) {
        if (!("usage" in row) && !text(row.unit, 80)) continue;
        const key = JSON.stringify([text(row.company, 160), text(row.category, 160), text(row.source, 160), text(row.unit, 80)]);
        usageGroups.set(key, [...(usageGroups.get(key) ?? []), row]);
      }
      for (const [key, usageRows] of usageGroups) {
        const [legalCompany, category, source, unit] = JSON.parse(key) as string[];
        let usage = 0, count = 0, missingUsage = 0, estimatedUsage = 0;
        const periods: string[] = [];
        for (const row of usageRows) {
          const state = dataValueStatus({ value: finite(row.usage) ? row.usage : null, dataStatus: row.dataStatus as DataStatus | undefined });
          if (state === "not_applicable") continue;
          if (!unit || state === "missing" || !finite(row.usage) || row.usage < 0 || (row.dataStatus === "zero" && row.usage !== 0)) { missingUsage++; continue; }
          usage += row.usage; count++;
          if (state === "estimated") estimatedUsage++;
          periods.push(text(row.period, 32));
        }
        if (!Number.isFinite(usage)) { warning(`${year}년 ${scope} 사용량 합계가 숫자 범위를 벗어났습니다.`); continue; }
        if (missingUsage) warning(`${legalCompany} ${year}년 ${source || category} 사용량: 미입력·단위 누락·오류 ${missingUsage}건 제외. 집계가 불완전합니다.`);
        add({ id: sourceId("activity", year, scope, "usage", key), kind: "activity", company: legalCompany, period: String(year), view: "inventory",
          title: `${legalCompany} · ${year}년 ${scope} ${category} ${source} 사용량·활동량`,
          excerpt: JSON.stringify({ 구분: "배출량 산출에 입력한 원천 사용량·활동량", 법인: legalCompany, 연도: year, Scope: scope,
            항목: category, 배출원: source, 사용량: count ? usage : null, 단위: unit || null, 집계자료수: count,
            미입력또는오류: missingUsage, 추정값: estimatedUsage, 등록기간: [...new Set(periods)].sort(),
            주의: "사용량은 탄소배출량과 다른 값입니다. 법인·항목·배출원·단위별 확정자료만 합산했습니다. 전력과 열은 구분하며 다른 지표의 동일 사용량을 중복 합산하지 않습니다. 등록기간 외 누락 여부는 별도 확인합니다." }),
        }, count > 0);
      }
      let sum = 0, valid = 0, missing = 0, estimated = 0, zero = 0, notApplicable = 0;
      const byCompany = new Map<string, number>();
      for (const row of kept) {
        const state = dataValueStatus({ value: finite(row.emissions) ? row.emissions : null, dataStatus: row.dataStatus as DataStatus | undefined });
        if (state === "not_applicable") { notApplicable++; continue; }
        if (state === "missing" || !finite(row.emissions) || row.emissions < 0 || (row.dataStatus === "zero" && row.emissions !== 0)) { missing++; continue; }
        sum += row.emissions; valid++;
        if (state === "estimated") estimated++;
        if (state === "zero") zero++;
        const name = text(row.company, 160);
        byCompany.set(name, (byCompany.get(name) ?? 0) + row.emissions);
      }
      if (missing) warning(`${year}년 ${scope}: 미입력·잘못된 배출량 ${missing}건은 제외했으므로 집계가 불완전합니다.`);
      if (estimated) warning(`${year}년 ${scope}: 추정값 ${estimated}건을 포함합니다.`);
      if (notApplicable) warning(`${year}년 ${scope}: 해당 없음 ${notApplicable}건은 배출량 합계에서 제외했습니다.`);
      if (zero) warning(`${year}년 ${scope}: 실제 0으로 집계한 자료가 ${zero}건 있습니다. 미입력과 구분합니다.`);
      if (!Number.isFinite(sum)) { warning(`${year}년 ${scope}: 합계가 처리 가능한 숫자 범위를 벗어났습니다.`); continue; }
      add({ id: sourceId("activity", company, year, scope), kind: "activity", company: company || undefined, period: String(year), view: "inventory",
        title: `${scopeLabel} · ${year}년 ${scope} 확정 배출량`,
        excerpt: JSON.stringify({ 범위: scopeLabel, 연도: year, Scope: scope, 배출량: valid ? sum : null, 단위: "tCO₂e", 확정자료수: rows.length, 집계자료수: valid,
          미입력또는오류: missing, 추정값: estimated, 실제0: zero, 해당없음: notApplicable, 중복ID: duplicateIds.size,
          법인별집계: [...byCompany].map(([법인, 배출량]) => ({ 법인, 배출량 })), 주의: "자료가 없는 Scope·연도는 0으로 간주하지 않습니다. 동일 경계·기간의 완전성은 별도 확인해야 합니다." }),
      }, valid > 0);
    }

    const metricRows = workspace.metricSubmissions.filter(row => row.active !== false && inCompany(row.company) && years.includes(periodYear(row.period) ?? -1));
    const orderedIndicators = [...activeIndicators].sort((a, b) => relevance(request.question, `${b.name} ${b.code} ${b.definition}`) - relevance(request.question, `${a.name} ${a.code} ${a.definition}`) || a.id - b.id);
    for (const indicator of orderedIndicators) {
      const matching = metricRows.filter(row => row.indicatorId === indicator.id);
      const approved = matching.filter(row => row.status === "확정");
      if (matching.length > approved.length) warning(`${indicator.name}: 미확정 제출자료 ${matching.length - approved.length}건은 근거에서 제외했습니다.`);
      for (const year of years) {
        const rows = approved.filter(row => periodYear(row.period) === year);
        if (!rows.length) continue;
        const fixed = indicator.inputTemplate === "FIXED";
        const fallbackDetails = [...new Map(rows.flatMap(row => Array.isArray(row.detailRows) ? row.detailRows.flatMap(raw => {
          if (!raw || typeof raw !== "object") return [];
          const values = (raw as Row).values as Row | undefined;
          const key = text(values?.detailKey, 160);
          return key ? [[key, { key, label: text(values?.label) || key, unit: text(values?.unit, 80) || indicator.unit, aggregation: indicator.aggregation ?? "합계" as const }] as const] : [];
        }) : [])).values()];
        const details = fixed ? (indicator.detailItems?.length ? indicator.detailItems : fallbackDetails) : [undefined];
        if (fixed && !details.length) warning(`${indicator.name} ${year}년: 고정 세부항목이 없어 부모값을 실적으로 사용하지 않습니다.`);
        for (const detail of details) {
          let repeatedDetail = false;
          const input = rows.map(row => {
            if (!detail) return metricRow(row);
            const found = (Array.isArray(row.detailRows) ? row.detailRows : []).filter(raw => !!raw && typeof raw === "object" && text((raw as Row).values && ((raw as Row).values as Row).detailKey, 160) === detail.key);
            if (found.length > 1) repeatedDetail = true;
            const value = found.length === 1 ? detailNumber(((found[0] as Row).values as Row)?.amount) : null;
            // A missing FIXED amount stays missing even if its parent's placeholder value is zero.
            // FIXED rows have an amount per key, not a numerator/denominator per key.
            // The parent's ratio basis cannot be applied to unrelated detail fields.
            return { ...metricRow(row, value), numerator: null, denominator: null };
          });
          const rule = ruleFor(indicator, workspace, detail);
          const result = aggregateMetric(rule, input, { year });
          const groupFacts = result.groups.map(group => {
            const ratio = rule.organizationAggregation === "비율"
              ? aggregateMetric(rule, input.filter(row => row.company === group.company && (row.site ?? "") === (group.site ?? "")), { year })
              : null;
            return { 법인: group.company, 사업장: group.site ?? "", 값: ratio ? ratio.value : group.value, 기간: group.periods,
              ...(ratio ? { 분자: ratio.numerator ?? null, 분모: ratio.denominator ?? null } : {}) };
          });
          const label = `${indicator.name}${detail ? ` · ${detail.label}` : ""} ${year}년`;
          for (const message of result.warnings) warning(`${label}: ${message}`);
          if (repeatedDetail) warning(`${label}: 같은 세부항목이 한 제출자료에 중복되어 해당 값을 사용하지 않았습니다.`);
          if (result.zeroCount) warning(`${label}: 실제 0 ${result.zeroCount}건을 미입력과 구분했습니다.`);
          add({ id: sourceId("metric", company, indicator.id, detail?.key ?? "total", year), kind: "metric", company: company || undefined, period: String(year), view: "metric-collection",
            title: `${scopeLabel} · ${label}`,
            excerpt: JSON.stringify({ 지표코드: indicator.code, 지표명: indicator.name, 세부항목: detail?.label ?? null, 범위: scopeLabel, 연도: year,
              집계값: result.value, 단위: rule.unit, 기간집계: rule.aggregation ?? "합계", 조직집계: rule.organizationAggregation ?? "합계",
              분자: result.numerator ?? null, 분모: result.denominator ?? null, 미입력: result.missingCount, 추정값: result.estimatedCount,
              실제0: result.zeroCount, 해당없음: result.notApplicableCount, 집계경고: result.warnings,
              회사사업장별값: groupFacts,
              주의: fixed ? "고정 세부값만 집계했습니다. 부모 제출값은 실적이 아닙니다." : "확정 제출값의 집계이며 정책 시행·성과 원인을 증명하지 않습니다." }),
          }, result.value !== null);
        }
      }
    }

    for (const target of workspace.targets) {
      const targetCompany = text(target.company, 160);
      if (target.active === false || target.status !== "승인" || (company ? targetCompany !== company : targetCompany !== "그룹 전체" && !inCompany(targetCompany))) continue;
      if (!finite(target.baselineYear) || !finite(target.targetYear) || target.baselineYear > request.year || target.targetYear < request.year) continue;
      const annual = Array.isArray(target.annualTargets) ? target.annualTargets.filter(value => value && typeof value === "object" && years.includes(Number((value as Row).year))).map(value => {
        const row = value as Row;
        return { 연도: row.year, 예상배출량: finite(row.projectedEmissions) ? row.projectedEmissions : null, 목표배출량: finite(row.targetEmissions) ? row.targetEmissions : null, 목표감축량: finite(row.targetReduction) ? row.targetReduction : null };
      }) : [];
      add({ id: sourceId("target", target.id, targetCompany), kind: "target", title: `${targetCompany} · 승인 목표 ${text(target.name, 160)}`, company: targetCompany, period: `${target.baselineYear}~${target.targetYear}`, view: "targets",
        excerpt: JSON.stringify({ 구분: "승인된 목표·계획이며 달성 실적이 아님", 법인: targetCompany, 기준연도: target.baselineYear, 목표연도: target.targetYear,
          대상Scope: Array.isArray(target.scopes) ? target.scopes.map(scope => text(scope, 32)) : [], 기준배출량: finite(target.baselineEmissions) ? target.baselineEmissions : null,
          목표배출량: finite(target.targetEmissions) ? target.targetEmissions : null, 감축률: finite(target.reductionRate) ? target.reductionRate : null,
          승인일: text(target.approvedAt, 32) || "기록 없음", 조회연도별계획: annual,
          주의: targetCompany === "그룹 전체" ? "그룹 목표를 특정 법인의 목표나 접근 가능한 일부 법인의 달성률로 적용하지 않습니다." : "목표 수치를 실제 감축 실적으로 서술하지 않습니다." }),
      }, true);
    }

    const today = new Date().toISOString().slice(0, 10);
    for (const evidence of workspace.evidence) {
      const organization = text(evidence.organization, 160);
      if (evidence.active === false || evidence.status !== "승인" || !["일반", "사내한"].includes(text(evidence.securityLevel, 16))) continue;
      if (company ? organization !== company : organization && !inCompany(organization)) continue;
      const expires = text(evidence.expiresAt, 32), issued = text(evidence.issuedDate, 32);
      if ((expires && (!date(expires) || expires < today)) || (issued && (!date(issued) || issued > today))) continue;
      if (request.indicatorId !== undefined) {
        const selected = activeIndicators.find(item => item.id === request.indicatorId);
        const links = Array.isArray(evidence.linkedIndicators) ? evidence.linkedIndicators : [];
        if (!selected || !links.some(link => link === selected.code || link === selected.name || link === selected.id || String(link) === String(selected.id))) continue;
      }
      const id = sourceId("evidence", evidence.id, organization, evidence.version);
      add({ id, kind: "evidence", title: text(evidence.title, 180) || text(evidence.fileName, 180) || "승인 문서 메타데이터", company: organization || undefined, period: issued || undefined, view: "evidence",
        excerpt: JSON.stringify({ 구분: "승인 문서의 메타데이터만 있음·원문 미확인", 문서명: text(evidence.title), 유형: text(evidence.documentType, 80), 법인: organization || "공통·적용범위 확인 필요",
          발행일: issued || "미지정", 만료일: expires || "미지정", 버전: text(evidence.version, 80), 파일명: text(evidence.fileName, 180),
          관련지표: Array.isArray(evidence.linkedIndicators) ? evidence.linkedIndicators.slice(0, 12) : [],
          주의: "파일 이름·승인 상태·메타데이터는 정책 시행, 교육 실시, 실제 성과의 증명이 아닙니다. 원문을 실제로 읽기 전에는 해당 사실을 확정하지 않습니다." }),
      });
      if (finite(evidence.id) && Number.isInteger(evidence.id) && text(evidence.storagePath, 1_500) && text(evidence.fileName, 180)) evidenceBySource.set(id, {
        id: evidence.id, sourceId: id, fileName: text(evidence.fileName, 180), storagePath: text(evidence.storagePath, 1_500),
      });
    }
    if (candidates.some(source => source.kind === "evidence")) warning("증빙은 승인·유효·비기밀 문서의 메타데이터만 제공합니다. 사용자 권한으로 원문을 실제로 읽은 경우에만 그 내용이 추가 근거가 됩니다.");
  }

  const ranked = [...candidates].sort((a, b) => relevance(request.question, `${b.title} ${b.excerpt}`) - relevance(request.question, `${a.title} ${a.excerpt}`)
    || Number(factIds.has(b.id)) - Number(factIds.has(a.id)) || a.id.localeCompare(b.id));
  const sources: AiSource[] = [];
  const evidenceCandidates: AiEvidenceCandidate[] = [];
  for (const source of ranked) {
    if (sources.length >= MAX_SOURCES) break;
    const candidate = evidenceBySource.get(source.id);
    const nextEvidence = candidate ? [...evidenceCandidates, candidate] : evidenceCandidates;
    if (JSON.stringify({ sources: [...sources, source], warnings, evidenceCandidates: nextEvidence, hasFacts: true }).length > MAX_CONTEXT_CHARACTERS - 500) continue;
    sources.push(source);
    if (candidate) evidenceCandidates.push(candidate);
  }
  if (sources.length < candidates.length) warning("질문 관련도와 자료량 제한에 따라 일부 근거를 생략했습니다. 이 근거 목록을 전체 자료 목록으로 보지 마세요.");
  const hasFacts = sources.some(source => factIds.has(source.id));
  if (!hasFacts && request.mode !== "guide") warning("선택 범위에 사용할 수 있는 확정 실적·승인 목표가 없습니다. 자료 없음은 0이나 정책 미시행을 뜻하지 않습니다.");
  return { sources, warnings, evidenceCandidates, hasFacts };
}
