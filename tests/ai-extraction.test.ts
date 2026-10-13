import assert from "node:assert/strict";
import test from "node:test";
import { AI_MAX_FILE_BYTES, inspectAiFile, resolveExtractedValue } from "../lib/ai/extraction";
import { extractionOutputSchema } from "../lib/ai/schemas";
import type { AiExtraction } from "../lib/ai/types";

const extracted = (patch: Partial<AiExtraction> = {}): AiExtraction => ({
  company: "세원정공", site: "대구공장", periodFrom: "2026-01-01", periodTo: "2026-01-31",
  metricName: "전력 사용량", amount: 1000, unit: "kWh", sourceExcerpt: "사용량 1,000 kWh", sourcePage: 1, notes: [], ...patch,
});
const context = { company: "세원정공", site: "대구공장", period: "2026-01" };

test("impossible calendar dates are rejected while valid month-only and leap-day periods remain usable", () => {
  for (const period of ["2026-02-31", "2026-02-29", "2026-01-00", "2026-13"]) {
    const value = extracted({ periodFrom: period, periodTo: period });
    assert.equal(extractionOutputSchema.safeParse(value).success, false);
    assert.equal(resolveExtractedValue(value, "kWh").ok, false);
  }
  for (const period of ["2026-02", "2026-02-28", "2024-02-29"]) {
    const value = extracted({ periodFrom: period, periodTo: period });
    assert.equal(extractionOutputSchema.safeParse(value).success, true);
    assert.equal(resolveExtractedValue(value, "kWh").ok, true);
  }
});

test("explicit electricity and mass units convert in both directions", () => {
  for (const [amount, from, to, expected] of [
    [2.5, "MWh", "kWh", 2500], [2500, "kWh", "MWh", 2.5],
    [5000, "kg", "t", 5], [2.5, "t", "kg", 2500],
  ] as const) {
    const result = resolveExtractedValue(extracted({ amount, unit: from }), to, context);
    assert.ok(result.ok);
    assert.equal(result.value, expected);
    assert.ok(result.notes.some(note => note.includes("단위")));
  }
});

test("an actual zero is retained and never treated as an unreadable value", () => {
  const result = resolveExtractedValue(extracted({ amount: 0 }), "kWh", context);
  assert.ok(result.ok);
  assert.equal(result.value, 0);
  assert.deepEqual(result.notes, []);
});

test("null, negative, non-finite, and overflowing values cannot be applied", () => {
  for (const amount of [null, -1, NaN, Infinity]) {
    assert.equal(resolveExtractedValue(extracted({ amount }), "kWh", context).ok, false);
  }
  assert.equal(resolveExtractedValue(extracted({ amount: Number.MAX_VALUE, unit: "MWh" }), "kWh", context).ok, false);
});

test("missing units and incompatible dimensions do not trigger guessed conversions", () => {
  for (const [unit, expected] of [[null, "kWh"], ["", "kWh"], ["kWh", ""], ["kg", "kWh"], ["m³", "L"], ["mWh", "MWh"]]) {
    assert.equal(resolveExtractedValue(extracted({ unit }), expected ?? "", context).ok, false);
  }
  const knownSameUnit = resolveExtractedValue(extracted({ unit: "명", amount: 12 }), "명", context);
  assert.ok(knownSameUnit.ok);
  assert.equal(knownSameUnit.value, 12);
});

test("another company or site is rejected while equivalent legal-name and spacing forms are accepted", () => {
  assert.equal(resolveExtractedValue(extracted({ company: "세원테크" }), "kWh", context).ok, false);
  assert.equal(resolveExtractedValue(extracted({ site: "아산공장" }), "kWh", context).ok, false);
  const equivalent = resolveExtractedValue(extracted({ company: "㈜ 세원정공", site: "대구 공장" }), "kWh", context);
  assert.ok(equivalent.ok);
  assert.equal(equivalent.value, 1000);
});

test("source usage periods must match the selected month or year rather than a billing date", () => {
  assert.equal(resolveExtractedValue(extracted({ periodFrom: "2026-02-01", periodTo: "2026-02-28" }), "kWh", context).ok, false);
  assert.equal(resolveExtractedValue(extracted({ periodTo: "2026-02-01" }), "kWh", context).ok, false);
  assert.equal(resolveExtractedValue(extracted({ periodFrom: "2025-01", periodTo: "2025-12" }), "kWh", { ...context, period: "2026" }).ok, false);
  assert.ok(resolveExtractedValue(extracted(), "kWh", { ...context, period: "2026" }).ok);
});

test("missing company and usage period remain unknown and produce confirmation notes", () => {
  const source = extracted({ company: null, periodFrom: null, periodTo: null });
  const before = structuredClone(source);
  const result = resolveExtractedValue(source, "kWh", context);
  assert.ok(result.ok);
  assert.equal(result.value, 1000);
  assert.ok(result.notes.some(note => note.includes("회사명")));
  assert.ok(result.notes.some(note => note.includes("사용기간")));
  assert.deepEqual(source, before);
  assert.equal(source.periodFrom, null);
  assert.equal(source.periodTo, null);
});

test("document inspection requires matching PDF, JPEG, PNG, and WEBP signatures", () => {
  const encoder = new TextEncoder();
  const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  for (const [bytes, type] of [
    [encoder.encode("%PDF-1.7\nfixture"), "application/pdf"],
    [Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg"],
    [png, "image/png"],
    [encoder.encode("RIFF0000WEBPfixture"), "image/webp"],
  ] as const) assert.equal(inspectAiFile(bytes, type), type);

  assert.equal(inspectAiFile(encoder.encode("<!doctype html><html>error</html>"), "application/pdf"), null);
  assert.equal(inspectAiFile(png, "image/jpeg"), null);
  assert.equal(inspectAiFile(encoder.encode("plain text"), "text/plain"), null);
  assert.equal(inspectAiFile(Uint8Array.from([0xff, 0xd8]), "image/jpeg"), null);
});

test("document inspection rejects empty or oversized bytes and permits the declared size limit", () => {
  assert.equal(inspectAiFile(new Uint8Array(), "application/pdf"), null);
  const atLimit = new Uint8Array(AI_MAX_FILE_BYTES);
  atLimit.set(new TextEncoder().encode("%PDF-"));
  assert.equal(inspectAiFile(atLimit, "application/pdf"), "application/pdf");
  const oversized = new Uint8Array(AI_MAX_FILE_BYTES + 1);
  oversized.set(new TextEncoder().encode("%PDF-"));
  assert.equal(inspectAiFile(oversized, "application/pdf"), null);
});
