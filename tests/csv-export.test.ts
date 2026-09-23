import assert from "node:assert/strict";
import test from "node:test";
import { csvEscape } from "../lib/csv-export";

test("CSV export neutralizes formula-like strings including leading whitespace", () => {
  for (const value of ["=1+1", "+SUM(A1)", "-3+4", "@SUM(A1)", " \t=1+1", "\r=1+1", "\ntext", "\ttext"]) {
    assert.ok(csvEscape(value).startsWith('"\''), value);
  }
});

test("CSV export preserves numeric negatives and zero", () => {
  assert.equal(csvEscape(-3.5), '"-3.5"');
  assert.equal(csvEscape(0), '"0"');
});

test("CSV export retains ordinary text and quotes embedded delimiters", () => {
  assert.equal(csvEscape('열, 이름 "확인"'), '"열, 이름 ""확인"""');
  assert.equal(csvEscape("사용량"), '"사용량"');
});
