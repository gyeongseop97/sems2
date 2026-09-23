import assert from "node:assert/strict";
import test from "node:test";
import { calculateEmission, factorRevision, isFactorEffective, snapshotFactor, type FactorDefinition } from "../lib/factor-calculation";
import { DEFAULT_EMISSION_FACTORS } from "../lib/emission-factor-library";

const electricity: FactorDefinition = { id: "grid", scope: "Scope 2", category: "전력", source: "전력", value: 0.42, activityUnit: "kWh", factorUnit: "kgCO₂e/kWh", year: "2022", authority: "test", active: true };
const calculate = (factor = electricity, usage = 1000, unit = "kWh", period = "2026-01") => calculateEmission({ factor, usage, unit, period });

test("kg, tonnes, and energy conversions give the same 0.42 tCO2e", () => {
  const variants = [calculate(), calculate(electricity, 1, "MWh"), calculate({ ...electricity, value: 0.42, factorUnit: "tCO2e/MWh" }), calculate(electricity, 3600, "MJ")];
  for (const result of variants) { assert.ok(result.ok); assert.equal(result.emissions, 0.42); }
});
test("factor year is not an implicit expiry; explicit validity covers the entire period", () => {
  assert.ok(isFactorEffective(electricity, "2026-01"));
  assert.ok(!isFactorEffective({ ...electricity, validTo: "2025-12-31" }, "2026-01"));
  assert.ok(!isFactorEffective({ ...electricity, validFrom: "2026-01-15" }, "2026-01"));
  assert.ok(isFactorEffective({ ...electricity, validFrom: "2026-01-15" }, "2026-01-20"));
  assert.ok(!isFactorEffective({ ...electricity, validFrom: "2026-02-30" }, "2026-03"));
});
test("incompatible dimensions, invalid values, and intermediate coefficients cannot silently calculate", () => {
  for (const result of [calculate(electricity, 3, "kg"), calculate(electricity, -1), calculate(electricity, Infinity), calculate({ ...electricity, indicatorKind: "열량계수" }), calculate({ ...electricity, factorUnit: "TJ/Gg" }), calculate({ ...electricity, activityUnit: "Nm³", factorUnit: "kgCO2e/Nm³" }, 1, "m³")]) assert.equal(result.ok, false);
  const zero = calculate(electricity, 0); assert.ok(zero.ok); assert.equal(zero.emissions, 0);
});
test("snapshots retain the original source and value after factor settings change", () => {
  const factor = { ...electricity, reference: "original" };
  const snapshot = snapshotFactor(factor);
  const revision = snapshot.revision;
  factor.value = 0.9; factor.reference = "revised";
  assert.equal(snapshot.value, 0.42); assert.equal(snapshot.reference, "original");
  assert.notEqual(factorRevision(factor), revision);
  assert.equal(factorRevision({ ...electricity, active: false }), factorRevision(electricity));
});
test("every bundled default factor has a valid direct unit calculation", () => {
  for (const factor of DEFAULT_EMISSION_FACTORS) {
    const result = calculate(factor, 1, factor.activityUnit);
    assert.ok(result.ok, `${factor.id}: ${JSON.stringify(result)}`);
  }
});

test("SI prefix case is preserved for ML versus mL and MWh versus mWh", () => {
  const liquid = { ...electricity, activityUnit: "L", factorUnit: "kgCO2e/L", value: 1 };
  const mega = calculate(liquid, 1, "ML");
  const milli = calculate(liquid, 1, "mL");
  assert.ok(mega.ok); assert.ok(milli.ok);
  assert.equal(mega.emissions, 1000);
  assert.equal(milli.emissions, 0.000001);
  const denominator = calculate({ ...liquid, factorUnit: "kgCO2e/ML", value: 1000 }, 1_000_000, "L");
  assert.ok(denominator.ok); assert.equal(denominator.emissions, 1);
  const energy = calculate({ ...electricity, value: 1 }, 1_000_000, "mWh");
  assert.ok(energy.ok); assert.equal(energy.emissions, 0.001);
  const terajoule = calculate({ ...electricity, value: 3.6 }, 1, "TJ");
  assert.ok(terajoule.ok); assert.equal(terajoule.emissions, 1000);
});

test("factor validity uses the actual calendar month, including leap days and low-numbered years", () => {
  assert.equal(isFactorEffective({ ...electricity, validTo: "2024-02-28" }, "2024-02"), false);
  assert.equal(isFactorEffective({ ...electricity, validTo: "2024-02-29" }, "2024-02"), true);
  assert.equal(isFactorEffective({ ...electricity, validTo: "0099-01-31" }, "0099-01"), true);
  assert.equal(isFactorEffective({ ...electricity, validFrom: "2026-03-01", validTo: "2026-01-01" }, "2026-02"), false);
});
