import { describe, expect, it } from "vitest";
import { submitStep } from "./pathway";
import { buildResumeUrl, readResumeState } from "./resume";
import type { PathwayState } from "./types";

function screening(hasDiabetes = "no") {
  let state: PathwayState = { currentStep: "metabolic", history: [], answers: {} };
  state = submitStep(state, { sex: "female", knownMetabolicSyndrome: "on" });
  state = submitStep(state, { drinksPerWeek: "2" });
  return submitStep(state, { hasDiabetes });
}

function roundTrip(state: PathwayState) {
  return readResumeState(new URL(buildResumeUrl(state, "https://example.com/pathway/")!).hash)!;
}

describe("resume links", () => {
  it("restores the same step and entered values, including earlier screening", () => {
    const incomplete = submitStep(screening(), { missingValues: "yes", alt: "100" });
    const restored = roundTrip(incomplete);
    expect(restored.currentStep).toBe("enzymes");
    expect(restored.history).toEqual(["metabolic", "alternate", "diabetes"]);
    expect(restored.answers.enzymes).toMatchObject({ alt: "100" });
    expect(restored.answers.diabetes).toEqual({ hasDiabetes: "no" });
    expect(restored.answers.metabolic).toEqual({ sex: "female", knownMetabolicSyndrome: true });
    expect(restored.result).toBeUndefined();
    expect(submitStep(restored, { alt: "100", ast: "26" }).currentStep).toBe("fib4");
  });
  it.each(["yes", "no"])("restores partial scoring inputs for diabetes %s", (hasDiabetes) => {
    const state = submitStep(screening(hasDiabetes), { alt: "100", ast: "26" });
    const incomplete = submitStep(state, { missingValues: "yes", ...(hasDiabetes === "yes" ? { albumin: "4" } : { age: "50", alt: "100", ast: "26" }) });
    const restored = roundTrip(incomplete);
    expect(restored.currentStep).toBe(hasDiabetes === "yes" ? "app" : "fib4");
    expect(restored.answers[restored.currentStep]).not.toHaveProperty("missingValues");
    expect(restored.answers[restored.currentStep]).not.toHaveProperty("score");
    expect(restored.answers.enzymes).toMatchObject({ alt: 100, ast: 26 });
  });
  it("recalculates prior scores when returning for elastography", () => {
    let state = submitStep(screening(), { alt: "100", ast: "26" });
    state = submitStep(state, { age: "50", alt: "100", ast: "26", platelets: "100" });
    state = submitStep(state, { missingValues: "yes" });
    const url = new URL(buildResumeUrl(state, "https://example.com/pathway/")!);
    const payload = { version: 1, steps: state.history.map((step) => ({
      step, values: Object.fromEntries(Object.entries(state.answers[step] as Record<string, unknown>)
        .filter(([, value]) => typeof value === "string" || typeof value === "number" || value === true)
        .filter(([key]) => key !== "missingValues")
        .map(([key, value]) => [key, value === true ? "on" : String(value)])),
    })) };
    payload.steps.find((entry: { step: string }) => entry.step === "fib4")!.values.score = "999";
    const restored = readResumeState(`#resume=${encodeURIComponent(JSON.stringify(payload))}`)!;
    expect(restored.currentStep).toBe("elastography");
    expect(restored.answers.fib4).toMatchObject({ score: 1.3 });
  });
  it("uses the fragment and preserves the deployment path", () => {
    const state = submitStep(screening(), { missingValues: "yes" });
    const url = new URL(buildResumeUrl(state, "https://example.com/pathway/?view=app#old")!);
    expect(url.pathname).toBe("/pathway/");
    expect(url.search).toBe("?view=app");
    expect(url.hash).toMatch(/^#r2=/);
  });
  it.each(["", "#resume=%", "#resume=null", "#resume=%7B%7D", '#resume={"version":1,"steps":[{"step":"fib4","values":{}}]}'])("ignores malformed links %s", (hash) => {
    expect(readResumeState(hash)).toBeUndefined();
  });
  it("does not generate links for exclusions or completed results", () => {
    const excluded = submitStep({ currentStep: "metabolic", history: [], answers: {} }, { sex: "male" });
    expect(buildResumeUrl(excluded, "https://example.com/")).toBeUndefined();
  });
});


it("makes a substantially shorter link without losing entered values", () => {
  let state: PathwayState = { currentStep: "metabolic", history: [], answers: {} };
  state = submitStep(state, { sex: "male", waist: "102", waistUnit: "cm", triglycerides: "1.7", triglyceridesUnit: "mmol", hdl: "1.5", hdlUnit: "mmol", systolic: "130", diastolic: "70", glucose: "4", glucoseUnit: "mmol" });
  state = submitStep(state, { drinksPerWeek: "3" });
  state = submitStep(state, { hasDiabetes: "no" });
  state = submitStep(state, { missingValues: "yes", alt: "100" });
  const compact = buildResumeUrl(state, "https://example.com/pathway/")!;
  const legacySize = encodeURIComponent(JSON.stringify({ version: 1, steps: state.history.map((step) => ({ step, values: state.answers[step] })) })).length;
  expect(new URL(compact).hash.length).toBeLessThan(legacySize / 2);
  const restored = readResumeState(new URL(compact).hash)!;
  expect(restored.answers.metabolic).toMatchObject({ sex: "male", waist: "102", triglycerides: "1.7", criteriaCount: 3 });
  expect(restored.answers.enzymes).toMatchObject({ alt: "100" });
});

it.each(["#r2=garbage", "#r2=bnVsbA", "#r2=W1s5OSxbXV1d"])("ignores invalid compact links %s", (hash) => {
  expect(readResumeState(hash)).toBeUndefined();
});
