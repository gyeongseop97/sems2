import assert from "node:assert/strict";
import test from "node:test";
import { buildAiGrounding } from "../lib/ai/context";
import type { AiDraftRequest, AiIndicator, AiWorkspace } from "../lib/ai/types";

const workspace = (patch: Partial<AiWorkspace> = {}): AiWorkspace => ({
  organizations: { A: ["본사", "공장"], B: ["본사"] }, records: [], metricSubmissions: [],
  indicators: [], evidence: [], targets: [], reports: [], ...patch,
});
const request = (patch: Partial<AiDraftRequest> = {}): AiDraftRequest => ({ mode: "report", company: "A", year: 2026, question: "ESG 실적을 정리해 주세요", ...patch });
const indicator = (patch: Partial<AiIndicator> = {}): AiIndicator => ({ id: 1, code: "E-001", name: "전력 사용량", category: "환경", unit: "kWh", cycle: "월", aggregation: "합계", owner: "환경팀", frameworks: ["GRI 302-1"], active: true, ...patch });
const metric = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({ id: 1, indicatorId: 1, company: "A", site: "본사", period: "2026-01", status: "확정", value: 10, dataStatus: "actual", ...patch });
const activity = (patch: Record<string, unknown> = {}) => ({ id: 1, company: "A", site: "본사", period: "2026-01", scope: "Scope 1", status: "확정", emissions: 10, ...patch });
const parsed = (context: ReturnType<typeof buildAiGrounding>, kind: string) => context.sources.filter(source => source.kind === kind).map(source => JSON.parse(source.excerpt));

test("company and year boundaries exclude another company, old years, inactive and unconfirmed emissions", () => {
  const result = buildAiGrounding(workspace({ records: [activity(), activity({ id: 2, company: "B", emissions: 900 }),
    activity({ id: 3, period: "2025-01", emissions: 7 }), activity({ id: 4, period: "2024-01", emissions: 800 }),
    activity({ id: 5, active: false, emissions: 600 }), activity({ id: 6, status: "검토대기", emissions: 500 }),
    activity({ id: 7, scope: "Scope 2", emissions: 0, dataStatus: "zero" })] }), [], request());
  const facts = parsed(result, "activity");
  assert.equal(facts.find(row => row.연도 === 2026 && row.Scope === "Scope 1")?.배출량, 10);
  assert.equal(facts.find(row => row.연도 === 2025)?.배출량, 7);
  assert.equal(facts.find(row => row.Scope === "Scope 2")?.배출량, 0);
  assert.ok(!facts.some(row => row.Scope === "Scope 3"));
  assert.ok(!JSON.stringify(result.sources).includes('"B"'));
  assert.match(result.warnings.join(), /검토·작성 중/);
  assert.match(result.warnings.join(), /실제 0/);
});

test("an empty company means the accessible companies, rather than inventing missing Scope totals", () => {
  const data = workspace({ organizations: { A: [], B: [] }, records: [activity(), activity({ id: 2, company: "B", emissions: 20 }), activity({ id: 3, company: "UNAUTHORIZED", emissions: 1000 })] });
  const result = buildAiGrounding(data, [], request({ company: "" }));
  assert.equal(parsed(result, "activity")[0].배출량, 30);
  assert.equal(result.sources.filter(source => source.kind === "activity").length, 1);
  assert.ok(!JSON.stringify(result).includes("UNAUTHORIZED"));
});

test("guides use only the selected active indicator definition, even if its authoring status is missing", () => {
  const selected = indicator({ definition: "월별 전기 고지서의 구매 전력", boundary: "사업장", dataSource: "고지서" });
  const result = buildAiGrounding(workspace({ records: [activity()], metricSubmissions: [metric()], indicators: [{ id: 1, status: "미작성" }] }), [selected, indicator({ id: 2 })], request({ mode: "guide", indicatorId: 1 }));
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].kind, "indicator");
  assert.equal(result.hasFacts, true);
  assert.match(result.sources[0].excerpt, /월별 전기 고지서/);
  assert.match(result.warnings.join(), /미작성/);
  const inactive = buildAiGrounding(workspace(), [indicator({ active: false })], request({ mode: "guide", indicatorId: 1 }));
  assert.equal(inactive.sources.length, 0);
});

test("metrics use confirmed active indicators and retain zero, missing, estimate and N/A warnings", () => {
  const result = buildAiGrounding(workspace({ metricSubmissions: [metric({ value: 0, dataStatus: "zero" }),
    metric({ id: 2, period: "2026-02", value: 20, dataStatus: "estimated" }),
    metric({ id: 3, period: "2026-03", value: 0, dataStatus: "missing" }),
    metric({ id: 4, period: "2026-04", value: 900, dataStatus: "not_applicable" }),
    metric({ id: 5, company: "B", value: 999 }), metric({ id: 6, status: "검토대기", value: 800 }),
    metric({ id: 7, indicatorId: 2, value: 700 }), metric({ id: 8, period: "2024-01", value: 600 })] }), [indicator(), indicator({ id: 2, active: false })], request());
  const facts = parsed(result, "metric");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].집계값, 20);
  assert.equal(facts[0].실제0, 1);
  assert.equal(facts[0].미입력, 1);
  assert.equal(facts[0].추정값, 1);
  assert.equal(facts[0].해당없음, 1);
  assert.match(result.warnings.join(), /미확정/);
  assert.match(result.warnings.join(), /집계가 불완전/);
});

test("ratio metrics recalculate from the basis and never sum percentages", () => {
  const definition = indicator({ unit: "%", organizationAggregation: "비율", aggregation: "최종값" });
  const rows = [metric({ value: 50, numerator: 50, denominator: 100 }), metric({ id: 2, company: "B", value: 1, numerator: 10, denominator: 1000 })];
  const result = buildAiGrounding(workspace({ metricSubmissions: rows }), [definition], request({ company: "" }));
  assert.equal(parsed(result, "metric")[0].집계값, 60 / 1100 * 100);
  const withoutBasis = rows.map(row => {
    const legacy = { ...row };
    delete legacy.numerator;
    delete legacy.denominator;
    return legacy;
  });
  const missingBasis = buildAiGrounding(workspace({ metricSubmissions: withoutBasis }), [definition], request({ company: "" }));
  assert.equal(parsed(missingBasis, "metric")[0].집계값, null);
  assert.match(missingBasis.warnings.join(), /분자와 분모/);
  assert.equal(missingBasis.hasFacts, false);
});

test("a ratio-looking unit cannot inherit a plain sum rule", () => {
  const result = buildAiGrounding(workspace({ metricSubmissions: [metric({ value: 25 }), metric({ id: 2, site: "공장", value: 50 })] }), [indicator({ unit: "%", organizationAggregation: "합계" })], request());
  assert.equal(parsed(result, "metric")[0].집계값, null);
  assert.ok(!parsed(result, "metric").some(row => row.집계값 === 75));
});

test("ratio time series also show each site's recomputed ratio instead of a sum in the source breakdown", () => {
  const result = buildAiGrounding(workspace({ metricSubmissions: [metric({ value: 25, numerator: 25, denominator: 100 }),
    metric({ id: 2, period: "2026-02", value: 50, numerator: 50, denominator: 100 })] }), [indicator({ unit: "%" })], request());
  const fact = parsed(result, "metric")[0];
  assert.equal(fact.집계값, 37.5);
  assert.equal(fact.회사사업장별값[0].값, 37.5);
  assert.equal(fact.회사사업장별값[0].분자, 75);
  assert.equal(fact.회사사업장별값[0].분모, 200);
});

test("FIXED metrics aggregate each defined amount while ignoring the parent placeholder zero", () => {
  const definition = indicator({ inputTemplate: "FIXED", unit: "명", detailItems: [
    { key: "men", label: "남성", unit: "명", aggregation: "최종값" },
    { key: "women", label: "여성", unit: "명", aggregation: "최종값" },
    { key: "unknown", label: "미입력 항목", unit: "명", aggregation: "최종값" },
  ] });
  const rows = [metric({ value: 0, detailRows: [{ id: "a", values: { detailKey: "men", amount: 60 } }, { id: "b", values: { detailKey: "women", amount: "40" } }] }),
    metric({ id: 2, period: "2025-12", value: 0, detailRows: [{ id: "c", values: { detailKey: "men", amount: 50 } }] })];
  const result = buildAiGrounding(workspace({ metricSubmissions: rows }), [definition], request());
  const facts = parsed(result, "metric");
  assert.equal(facts.find(row => row.연도 === 2026 && row.세부항목 === "남성")?.집계값, 60);
  assert.equal(facts.find(row => row.연도 === 2026 && row.세부항목 === "여성")?.집계값, 40);
  assert.equal(facts.find(row => row.연도 === 2026 && row.세부항목 === "미입력 항목")?.집계값, null);
  assert.ok(facts.every(row => row.세부항목 && row.집계값 !== 0));
  assert.match(result.warnings.join(), /미입력/);
});

test("duplicate submissions and duplicate FIXED keys do not produce a fabricated sum", () => {
  const duplicate = buildAiGrounding(workspace({ metricSubmissions: [metric(), metric({ id: 2, value: 20 })] }), [indicator()], request());
  assert.equal(parsed(duplicate, "metric")[0].집계값, null);
  assert.match(duplicate.warnings.join(), /중복/);
  const definition = indicator({ inputTemplate: "FIXED", detailItems: [{ key: "x", label: "세부값", unit: "kWh", aggregation: "합계" }] });
  const fixed = buildAiGrounding(workspace({ metricSubmissions: [metric({ detailRows: [{ values: { detailKey: "x", amount: 10 } }, { values: { detailKey: "x", amount: 20 } }] })] }), [definition], request());
  assert.equal(parsed(fixed, "metric")[0].집계값, null);
  assert.match(fixed.warnings.join(), /세부항목.*중복/);
});

test("a FIXED percentage does not reuse an unrelated parent numerator or sum detail percentages", () => {
  const definition = indicator({ inputTemplate: "FIXED", unit: "다중 단위", detailItems: [{ key: "ratio", label: "여성 비율", unit: "%", aggregation: "최종값" }] });
  const result = buildAiGrounding(workspace({ metricSubmissions: [metric({ value: 0, numerator: 40, denominator: 100, detailRows: [{ values: { detailKey: "ratio", amount: 40 } }] })] }), [definition], request());
  assert.equal(parsed(result, "metric")[0].집계값, null);
  assert.match(result.warnings.join(), /분자와 분모/);
  assert.equal(result.hasFacts, false);
});

test("approved goals stay company-scoped and never become achieved emissions", () => {
  const target = { id: "TG-A", company: "A", status: "승인", name: "2030 목표", baselineYear: 2019, targetYear: 2030, baselineEmissions: 100, targetEmissions: 90, reductionRate: 10 };
  const result = buildAiGrounding(workspace({ targets: [target, { ...target, id: "TG-G", company: "그룹 전체", targetEmissions: 800 },
    { ...target, id: "TG-B", company: "B" }, { ...target, id: "TG-D", status: "초안" }, { ...target, id: "OLD", targetYear: 2024 }] }), [], request());
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].kind, "target");
  assert.equal(parsed(result, "target")[0].목표배출량, 90);
  assert.match(result.sources[0].excerpt, /달성 실적이 아님/);
  assert.ok(!JSON.stringify(result).includes("그룹 전체"));
});

test("evidence is approved, valid, non-confidential, scoped metadata with separate download candidates", () => {
  const document = { id: 1, organization: "A", title: "인권 정책", documentType: "정책", status: "승인", securityLevel: "일반", issuedDate: "2025-01-01", expiresAt: "2099-01-01", version: "v1", fileName: "policy.pdf", storagePath: "A/policy.pdf" };
  const result = buildAiGrounding(workspace({ evidence: [document, { ...document, id: 2, organization: "B", title: "B 비공개 문서" },
    { ...document, id: 3, securityLevel: "기밀", title: "기밀 임금" }, { ...document, id: 4, status: "검토중" },
    { ...document, id: 5, expiresAt: "2020-01-01" }, { ...document, id: 6, expiresAt: "잘못된 날짜" }] }), [], request({ mode: "answer", question: "인권 정책을 시행하고 있나요?" }));
  assert.equal(result.sources.length, 1);
  assert.equal(result.evidenceCandidates.length, 1);
  assert.equal(result.evidenceCandidates[0].sourceId, result.sources[0].id);
  assert.equal(result.evidenceCandidates[0].storagePath, "A/policy.pdf");
  assert.equal(result.hasFacts, false);
  assert.match(result.sources[0].excerpt, /원문 미확인/);
  assert.match(result.sources[0].excerpt, /증명이 아닙니다/);
  assert.ok(!JSON.stringify(result).includes("기밀 임금"));
  assert.ok(!JSON.stringify(result).includes("B 비공개 문서"));
});

test("no data remains absent instead of becoming a zero or a no-policy claim", () => {
  const result = buildAiGrounding(workspace(), [indicator()], request());
  assert.equal(result.sources.length, 0);
  assert.equal(result.hasFacts, false);
  assert.match(result.warnings.join(), /자료 없음은 0이나 정책 미시행을 뜻하지/);
});

test("context is bounded and source IDs are stable while simple question relevance keeps the requested topic", () => {
  const definitions = Array.from({ length: 70 }, (_, index) => indicator({ id: index + 1, name: index === 69 ? "인권 교육시간" : `전력 지표 ${index}`, code: `E-${index}` }));
  const data = workspace({ metricSubmissions: definitions.map(item => metric({ id: item.id, indicatorId: item.id, value: item.id })) });
  const result = buildAiGrounding(data, definitions, request({ question: "인권 교육시간" }));
  assert.ok(result.sources.length <= 40);
  assert.ok(JSON.stringify(result).length <= 30_000);
  assert.match(result.sources[0].title, /인권 교육시간/);
  const reordered = buildAiGrounding({ ...data, metricSubmissions: [...data.metricSubmissions].reverse() }, [...definitions].reverse(), request({ question: "인권 교육시간" }));
  assert.deepEqual(result.sources.map(source => source.id), reordered.sources.map(source => source.id));
});


test("Scope 2 exposes original electricity separately from emissions, heat and unauthorized data", () => {
  const result = buildAiGrounding(workspace({ records: [
    activity({ scope: "Scope 2", category: "전력", source: "구매전력", usage: 1000, unit: "kWh", emissions: 0.4, period: "2023-01" }),
    activity({ id: 2, scope: "Scope 2", category: "전력", source: "구매전력", usage: 2000, unit: "kWh", emissions: null, period: "2023-02" }),
    activity({ id: 3, scope: "Scope 2", category: "열", source: "스팀", usage: 20, unit: "GJ", period: "2023-01" }),
    activity({ id: 4, scope: "Scope 2", category: "전력", source: "구매전력", usage: 9000, unit: "kWh", company: "B", period: "2023-01" }),
    activity({ id: 5, scope: "Scope 2", category: "전력", source: "구매전력", usage: 8000, unit: "kWh", status: "검토대기", period: "2023-01" }),
    activity({ id: 6, scope: "Scope 2", category: "전력", source: "구매전력", usage: 7000, unit: "kWh", dataStatus: "missing", period: "2023-03" }),
  ] }), [], request({ year: 2023, question: "2023년 전력 사용량" }));
  const facts = parsed(result, "activity");
  const power = facts.find(row => row.배출원 === "구매전력");
  assert.equal(power.사용량, 3000);
  assert.equal(power.단위, "kWh");
  assert.equal(power.미입력또는오류, 1);
  assert.equal(facts.find(row => row.배출원 === "스팀").사용량, 20);
  assert.equal(facts.find(row => row.배출량 !== undefined).배출량, 10.4);
  assert.ok(!JSON.stringify(result.sources).includes('"B"'));
});
