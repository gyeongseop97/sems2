import assert from "node:assert/strict";
import test from "node:test";
import { suggestColumnMapping, validateImportMapping, parseImportNumber, validateActivityImport } from "../lib/activity-import";
import type { FactorDefinition } from "../lib/factor-calculation";

const headers = ["회사명", "사업장명", "기준월", "Scope", "활동자료", "배출원", "수량", "단위", "값 구분", "비고"];
const mapping = suggestColumnMapping(headers);
const factor: FactorDefinition = { id: "power", scope: "Scope 2", category: "전력", source: "구매전력", value: 0.42, activityUnit: "kWh", factorUnit: "kgCO₂e/kWh", year: "2022", authority: "test", active: true };
const row = { 회사명: "A", 사업장명: "공장1", 기준월: "2026-01", Scope: "Scope 2", 활동자료: "전력", 배출원: "구매전력", 수량: "1,000", 단위: "kWh", 비고: "" };
const validate = (rows: Record<string, unknown>[], extra = {}) => validateActivityImport({ rows, mapping, collectionId: "C1", organizations: { A: ["공장1", "공장2"] }, tasks: [{ company: "A", site: "공장1", targetId: "Scope 2", period: "2026-01" }], factors: [factor], existingRecords: [], ...extra });

test("aliases map spreadsheet columns and ambiguous or reused headers need correction", () => {
  assert.equal(mapping.company, "회사명"); assert.deepEqual(validateImportMapping(mapping, headers), []);
  assert.ok(validateImportMapping({ ...mapping, site: "회사명" }, headers).some(message => message.includes("여러")));
  assert.equal(suggestColumnMapping(["법인", "회사명"]).company, undefined);
});
test("blank, malformed grouping and booleans are not zero; valid grouped numbers work", () => {
  for (const value of ["", " ", null, true, "1,2", "Infinity"]) assert.equal(parseImportNumber(value), null);
  assert.equal(parseImportNumber("0"), 0); assert.equal(parseImportNumber("1,250.50"), 1250.5);
});
test("imports calculate with snapshots and enforce site-level request boundaries", () => {
  const result = validate([row, { ...row, 사업장명: "공장2" }]);
  assert.equal(result.validRows.length, 1); assert.equal(result.validRows[0].emissions, 0.42);
  assert.equal(result.validRows[0].factorSnapshot.id, "power");
  assert.ok(result.issues.some(issue => issue.rowNumber === 3 && issue.code === "outside-request"));
});
test("duplicates within a file and against saved active records are excluded", () => {
  assert.equal(validate([row, row]).duplicateCount, 1);
  const existing = { collectionId: "C1", company: "A", site: "공장1", period: "2026-01", scope: "Scope 2", category: "전력", source: "구매전력" };
  assert.equal(validate([row], { existingRecords: [existing] }).validRows.length, 0);
  assert.equal(validate([row], { existingRecords: [{ ...existing, active: false }] }).validRows.length, 1);
});
test("zero and not applicable remain explicit, missing is rejected, and all errors are retained", () => {
  const result = validate([{ ...row, 수량: "" }, { ...row, 수량: 0 }, { ...row, 기준월: "2026-02", 수량: 0, "값 구분": "추정값" }]);
  assert.equal(result.validRows.length, 1); assert.equal(result.validRows[0].dataStatus, "zero");
  assert.ok(result.issues.some(issue => issue.code === "invalid-usage"));
  assert.ok(result.issues.some(issue => issue.code === "missing-reason"));
  assert.ok(result.issues.some(issue => issue.rowNumber === 4 && issue.code === "outside-request"));
  const na = validate([{ ...row, 수량: "", "값 구분": "해당 없음", 비고: "사업장 미가동" }]);
  assert.equal(na.validRows[0].dataStatus, "not_applicable");
});
test("multiple effective factors cannot silently choose the first", () => {
  const result = validate([row], { factors: [factor, { ...factor, id: "other", value: 0.9 }] });
  assert.equal(result.validRows.length, 0); assert.ok(result.issues.some(issue => issue.code === "ambiguous-factor"));
});

test("the displayed data status labels round-trip and malformed N/A values stay errors", () => {
  assert.equal(validate([{ ...row, "값 구분": "실측값" }]).validRows[0]?.dataStatus, "actual");
  assert.equal(validate([{ ...row, "값 구분": "해당 없음(n/a)", 수량: "", 비고: "해당 시설 없음" }]).validRows[0]?.dataStatus, "not_applicable");
  const malformed = validate([{ ...row, "값 구분": "해당 없음", 수량: "abc", 비고: "해당 시설 없음" }]);
  assert.equal(malformed.validRows.length, 0);
  assert.ok(malformed.issues.some(issue => issue.code === "invalid-usage"));
});

test("untrusted imported names cannot use inherited object properties as a company or status", () => {
  const result = validate([{ ...row, 회사명: "constructor" }, { ...row, "값 구분": "constructor" }]);
  assert.equal(result.validRows.length, 0);
  assert.ok(result.issues.some(issue => issue.rowNumber === 2 && issue.code === "invalid-site"));
  assert.ok(result.issues.some(issue => issue.rowNumber === 3 && issue.code === "invalid-status"));
});
