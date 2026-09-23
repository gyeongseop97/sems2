import { calculateEmission, isFactorEffective, type FactorDefinition, type FactorSnapshot } from "./factor-calculation";

export type ImportFieldKey = "company" | "site" | "period" | "scope" | "category" | "source" | "usage" | "unit" | "owner" | "department" | "evidence" | "description" | "dataStatus";
export type ImportColumnMapping = Partial<Record<ImportFieldKey, string>>;
export const IMPORT_FIELDS: { key: ImportFieldKey; label: string; required: boolean; aliases: string[] }[] = [
  { key: "company", label: "법인", required: true, aliases: ["회사", "회사명", "법인명", "company"] },
  { key: "site", label: "사업장", required: true, aliases: ["사업장명", "공장", "site"] },
  { key: "period", label: "자료 기준월", required: true, aliases: ["기준월", "귀속월", "년월", "period", "month"] },
  { key: "scope", label: "Scope", required: true, aliases: ["스코프", "배출범위"] },
  { key: "category", label: "활동자료 구분", required: true, aliases: ["활동자료", "분류", "category"] },
  { key: "source", label: "배출원", required: true, aliases: ["배출원명", "source"] },
  { key: "usage", label: "사용량", required: true, aliases: ["활동량", "수량", "usage", "amount"] },
  { key: "unit", label: "단위", required: false, aliases: ["활동량단위", "사용량단위", "unit"] },
  { key: "dataStatus", label: "값 구분", required: false, aliases: ["데이터상태", "자료상태", "dataStatus"] },
  { key: "owner", label: "담당자", required: false, aliases: ["작성자", "owner"] },
  { key: "department", label: "담당 부서", required: false, aliases: ["부서", "department"] },
  { key: "description", label: "입력 설명", required: false, aliases: ["설명", "비고", "사유", "description"] },
  { key: "evidence", label: "증빙 파일명", required: false, aliases: ["증빙파일명", "evidence"] },
];

const normalHeader = (value: string) => value.trim().toLowerCase().replace(/[\s_()-]+/g, "");

export function suggestColumnMapping(headers: string[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    const aliases = [field.label, field.key, ...field.aliases].map(normalHeader);
    const matches = headers.filter(header => aliases.includes(normalHeader(header)));
    if (matches.length === 1) mapping[field.key] = matches[0];
  }
  return mapping;
}

export function validateImportMapping(mapping: ImportColumnMapping, headers: string[]): string[] {
  const errors: string[] = [];
  const used = new Set<string>();
  for (const field of IMPORT_FIELDS) {
    const selected = mapping[field.key];
    if (!selected) {
      if (field.required) errors.push(`${field.label}에 해당하는 열을 선택해 주세요.`);
      continue;
    }
    if (!headers.includes(selected)) errors.push(`${field.label}: 선택한 열을 시트에서 찾을 수 없습니다.`);
    if (headers.filter(header => header === selected).length > 1) errors.push(`${selected}: 같은 열 제목이 반복됩니다. Excel에서 제목을 구분해 주세요.`);
    if (used.has(selected)) errors.push(`${selected}: 하나의 열을 여러 항목에 연결할 수 없습니다.`);
    used.add(selected);
  }
  return errors;
}

/** Empty cells are missing, never coerced to zero. Accept properly grouped thousands. */
export function parseImportNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !/^[+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const parsed = Number(text.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
}

type ImportedDataStatus = "actual" | "zero" | "not_applicable" | "estimated";
export type ImportedActivity = {
  rowNumber: number; company: string; site: string; period: string; scope: "Scope 1" | "Scope 2" | "Scope 3";
  category: string; source: string; usage: number; unit: string; factor: number; emissions: number;
  owner: string; department: string; evidence: string; description: string;
  dataStatus: ImportedDataStatus; factorId: string; factorSnapshot: FactorSnapshot;
};
export type ImportIssue = { rowNumber: number; field: ImportFieldKey | "row"; code: string; message: string; rawValue: string };
type ActivityIdentity = { collectionId?: string; company: string; site: string; period: string; scope: string; category: string; source: string; active?: boolean };

export function activityImportKey(row: ActivityIdentity): string {
  return JSON.stringify([row.collectionId ?? "", row.company, row.site, row.period, row.scope, row.category, row.source]);
}

const statusAliases: Record<string, ImportedDataStatus> = {
  actual: "actual", "실측": "actual", "실측값": "actual", "실제값": "actual", "실제": "actual",
  zero: "zero", "0": "zero", "발생없음": "zero", "0(발생없음)": "zero", "실제0": "zero", "실측0": "zero",
  not_applicable: "not_applicable", "해당없음": "not_applicable", "해당없음(N/A)": "not_applicable", "해당없음(n/a)": "not_applicable", "n/a": "not_applicable",
  estimated: "estimated", "추정": "estimated", "추정값": "estimated",
};

export function validateActivityImport({ rows, mapping, collectionId, organizations, tasks, factors, existingRecords, firstDataRow = 2 }: {
  rows: Record<string, unknown>[]; mapping: ImportColumnMapping; collectionId: string;
  organizations: Record<string, string[]>;
  tasks: { company: string; targetId: string; period: string; site?: string }[];
  factors: FactorDefinition[]; existingRecords: ActivityIdentity[]; firstDataRow?: number;
}): { validRows: ImportedActivity[]; issues: ImportIssue[]; totalRows: number; duplicateCount: number } {
  const validRows: ImportedActivity[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set(existingRecords.filter(record => record.active !== false).map(activityImportKey));
  let totalRows = 0;
  let duplicateCount = 0;
  rows.forEach((row, index) => {
    if (Object.values(row).every(value => value == null || String(value).trim() === "")) return;
    totalRows += 1;
    const rowNumber = firstDataRow + index;
    const raw = (field: ImportFieldKey): unknown => mapping[field] ? row[mapping[field]!] : undefined;
    const cell = (field: ImportFieldKey) => String(raw(field) ?? "").trim();
    const issue = (field: ImportFieldKey | "row", code: string, message: string) => issues.push({ rowNumber, field, code, message, rawValue: field === "row" ? "" : cell(field) });
    const startErrors = issues.length;
    const company = cell("company");
    const site = cell("site");
    const period = cell("period");
    const scope = cell("scope").replace(/^scope\s*([123])$/i, "Scope $1");
    const category = cell("category");
    const source = cell("source");
    const description = cell("description");
    const parsedUsage = parseImportNumber(raw("usage"));
    const statusCell = cell("dataStatus").replace(/\s+/g, "");
    const statusKey = Object.hasOwn(statusAliases, statusCell) ? statusCell : statusCell.toLowerCase();
    const dataStatus = statusCell ? (Object.hasOwn(statusAliases, statusKey) ? statusAliases[statusKey] : undefined) : parsedUsage === 0 ? "zero" : "actual";
    if (!dataStatus) issue("dataStatus", "invalid-status", "값 구분은 실제값·발생 없음·해당 없음·추정값 중 선택해 주세요.");
    if (!collectionId) issue("row", "missing-request", "수집기간을 선택해 주세요.");
    if (!Object.hasOwn(organizations, company) || !organizations[company]?.includes(site)) issue("site", "invalid-site", "등록된 법인과 사업장을 확인해 주세요.");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) issue("period", "invalid-period", "자료 기준월은 YYYY-MM 형식이어야 합니다.");
    if (!["Scope 1", "Scope 2", "Scope 3"].includes(scope)) issue("scope", "invalid-scope", "Scope 1·2·3 중 하나를 입력해 주세요.");
    if (!tasks.some(task => task.company === company && task.targetId === scope && task.period === period && (!task.site || task.site === site))) issue("row", "outside-request", "이 법인·사업장·월·Scope는 선택한 수집 요청의 대상이 아닙니다.");
    if ((dataStatus === "estimated" || dataStatus === "not_applicable") && !description) issue("description", "missing-reason", "추정값 또는 해당 없음의 사유를 입력해 주세요.");
    if (dataStatus === "not_applicable" ? (cell("usage") !== "" && parsedUsage !== 0) : (parsedUsage === null || parsedUsage < 0)) issue("usage", "invalid-usage", "사용량은 0 이상의 숫자여야 합니다. 빈칸은 0으로 처리하지 않습니다.");
    if (dataStatus === "zero" && parsedUsage !== 0) issue("usage", "invalid-zero", "발생 없음은 사용량 0을 명시해 주세요.");
    const usage = parsedUsage ?? 0;
    const matching = factors.filter(factor => factor.scope === scope && factor.category === category && factor.source === source && isFactorEffective(factor, period));
    if (!matching.length) issue("source", "missing-factor", "해당 활동자료와 자료 기준월에 적용할 수 있는 배출계수가 없습니다.");
    if (matching.length > 1) issue("source", "ambiguous-factor", "같은 활동자료에 유효한 계수가 여러 개입니다. 계수의 적용 기간을 정리해 주세요.");
    const factor = matching.length === 1 ? matching[0] : undefined;
    const unit = cell("unit") || factor?.activityUnit || "";
    const calculation = factor ? calculateEmission({ usage, unit, period, factor }) : undefined;
    if (calculation && !calculation.ok) calculation.errors.forEach(message => issue("usage", "calculation-error", message));
    const key = activityImportKey({ collectionId, company, site, period, scope, category, source });
    if (seen.has(key)) { duplicateCount += 1; issue("row", "duplicate", "같은 수집기간·법인·사업장·월·활동자료가 이미 등록되었거나 파일에서 반복됩니다."); }
    if (issues.length !== startErrors || !factor || !calculation?.ok || !dataStatus) return;
    seen.add(key);
    validRows.push({ rowNumber, company, site, period, scope: scope as ImportedActivity["scope"], category, source, usage, unit,
      factor: factor.value, emissions: calculation.emissions, factorId: factor.id, factorSnapshot: calculation.snapshot,
      dataStatus, owner: cell("owner") || "미지정", department: cell("department") || "미지정", description, evidence: cell("evidence"),
    });
  });
  return { validRows, issues, totalRows, duplicateCount };
}
