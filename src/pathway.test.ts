import { describe, expect, it } from "vitest";
import { buildResultSummaryText, recommendationItems } from "./components/ResultPanel";
import { config } from "./config";
import { submitStep } from "./pathway";
import type { FormValues, PathwayState, Step } from "./types";

const start = (currentStep: Step = "metabolic", answers = {}): PathwayState =>
  ({ currentStep, history: [], answers: { ...(currentStep === "alternate" ? { metabolic: { sex: "male" } } : {}), ...(currentStep === "enzymes" ? { diabetes: { hasDiabetes: "no" } } : {}), ...answers } });
const submit = (state: PathwayState, values: Record<string, string>) =>
  submitStep(state, { ...(state.currentStep === "alternate" ? { drinksPerWeek: "0" } : {}), ...values } as FormValues);
const qualifyingMetabolic = (overrides = {}) => ({
  sex: "male", waist: "102", waistUnit: "cm", triglycerides: "1.7",
  triglyceridesUnit: "mmol", hdl: "1.5", hdlUnit: "mmol", systolic: "130",
  diastolic: "70", glucose: "4", glucoseUnit: "mmol", ...overrides,
});

describe("MASLD pathway engine", () => {
  it.each(["male", "female"])("skips criteria for established metabolic syndrome (%s) and preserves alcohol thresholds", (sex) => {
    const state = submit(start(), { sex, knownMetabolicSyndrome: "on" });
    expect(state.currentStep).toBe("alternate");
    expect(state.history).toEqual(["metabolic"]);
    expect(state.answers.metabolic).toEqual({ sex, knownMetabolicSyndrome: true });
    const limit = sex === "male" ? 15 : 10;
    expect(submit(state, { drinksPerWeek: String(limit) }).currentStep).toBe("diabetes");
    expect(submit(state, { drinksPerWeek: String(limit + 0.01) }).result?.message).toMatch(/MetALD range/);
  });

  it("exits when fewer than three metabolic criteria are met", () => {
    const state = submit(start(), qualifyingMetabolic({ waist: "101" }));
    expect((state.answers.metabolic as { criteriaCount: number }).criteriaCount).toBe(2);
    expect(state.result?.title).toBe("MASLD pathway not indicated");
  });

  it("counts pre-existing qualifying conditions and converts US customary units", () => {
    const state = submit(start(), qualifyingMetabolic({
      sex: "female", waist: String(88 / 2.54), waistUnit: "in",
      triglycerides: String(1.7 * 88.57), triglyceridesUnit: "mgdl",
      hdl: String(1.3 * 38.67), hdlUnit: "mgdl",
      systolic: "100", diastolic: "60", glucose: String(5.6 * 18),
      glucoseUnit: "mgdl", bloodPressureTreatment: "on",
    }));
    expect((state.answers.metabolic as { criteriaCount: number }).criteriaCount).toBe(4);
    expect(state.currentStep).toBe("alternate");
  });

  it("uses exact local SI metabolic threshold boundaries", () => {
    expect(submit(start(), qualifyingMetabolic({
      waist: "101.99", triglycerides: "1.69", hdl: "1.0", systolic: "129.99",
      diastolic: "84.99", glucose: "5.59",
    })).result?.title).toBe("MASLD pathway not indicated");

    expect(submit(start(), qualifyingMetabolic({
      hdl: "0.99", systolic: "129.99", glucose: "5.59",
    })).currentStep).toBe("alternate");

    expect(submit(start(), qualifyingMetabolic({
      sex: "female", hdl: "1.3", systolic: "129.99", glucose: "5.59",
    })).result?.title).toBe("MASLD pathway not indicated");

    expect(submit(start(), qualifyingMetabolic({
      sex: "female", hdl: "1.29", systolic: "129.99", glucose: "5.59",
    })).currentStep).toBe("alternate");
  });

  it("counts treatment for triglycerides and HDL plus prior type 2 diabetes diagnosis", () => {
    const state = submit(start(), qualifyingMetabolic({
      waist: "101", triglycerides: "1.69", hdl: "1.5", systolic: "120",
      diastolic: "70", glucose: "5.59", triglyceridesTreatment: "on",
      hdlTreatment: "on", type2DiabetesDiagnosis: "on",
    }));
    expect((state.answers.metabolic as { criteriaCount: number }).criteriaCount).toBe(3);
    expect(state.currentStep).toBe("alternate");
  });

  it("exits at configured MetALD and ALD thresholds", () => {
    const metabolic = submit(start(), qualifyingMetabolic());
    expect(submit(metabolic, { drinksPerWeek: "15.01" }).result?.message).toMatch(/MetALD range/);
    expect(submit(metabolic, { drinksPerWeek: "15.01" }).result?.message).not.toMatch(/Verify the diagnosis/);
    expect(submit(metabolic, { drinksPerWeek: "30" }).result?.message).toMatch(/ALD range/);
  });

  it("continues below the sex-specific alcohol threshold", () => {
    const metabolic = submit(start(), qualifyingMetabolic({ sex: "female" }));
    expect(submit(metabolic, { drinksPerWeek: "10" }).currentStep).toBe("diabetes");
    expect(submit(start("alternate", { metabolic: { sex: "male" } }), { drinksPerWeek: "15" }).currentStep).toBe("diabetes");
  });

  it("exits for an alternate diagnosis and continues without one", () => {
    const state = start("alternate");
    const exit = submit(state, { "dili-0": "on", hbsagPositive: "on" });
    expect(exit.result?.summary).toEqual([
      "Reported alcohol consumption: 0 standard drinks/week.",
      "Identified: possible drug-induced liver injury.",
      "Identified: positive HBsAg.",
    ]);
    expect(exit.result?.message).not.toMatch(/Verify the diagnosis/);
    expect(submit(state, {}).currentStep).toBe("diabetes");
  });

  it("lists the configured common DILI agents and classes", () => {
    expect(config.alternateDiagnoses.diliMedications).toEqual([
      "Amoxicillin-clavulanate (Augmentin)",
      "Isoniazid",
      "Methotrexate",
      "Statins",
      "Immune checkpoint inhibitors",
      "Herbal and dietary supplements",
    ]);
  });

  it("lists the configured genetic alternate causes", () => {
    expect(config.alternateDiagnoses.geneticConditions).toEqual([
      "Alpha-1 antitrypsin deficiency",
      "Hereditary hemochromatosis",
      "Wilson's disease",
      "Glycogen storage disease",
      "Cystic fibrosis",
    ]);
  });

  it("continues through the aminotransferase soft cutoff and flags alternate-cause review", () => {
    const below = submit(start("enzymes"), { alt: "199.99", ast: "199.99" });
    expect(below.currentStep).toBe("fib4");
    expect((below.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(false);

    const altAtCutoff = submit(start("enzymes"), { alt: "200", ast: "199.99" });
    expect(altAtCutoff.currentStep).toBe("fib4");
    expect((altAtCutoff.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(true);

    const astAtCutoff = submit(start("enzymes"), { alt: "199.99", ast: "200" });
    expect(astAtCutoff.currentStep).toBe("fib4");
    expect((astAtCutoff.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(true);
  });

  it.each([['yes', 'app'], ['no', 'fib4']])("asks about diabetes (%s) before enzymes and routes to %s", (hasDiabetes, next) => {
    const diabetes = submit(start("diabetes"), { hasDiabetes });
    expect(diabetes.currentStep).toBe("enzymes");
    const enzymes = submit(diabetes, { alt: "100", ast: "26" });
    expect(enzymes.currentStep).toBe(next);
    expect(enzymes.history).toEqual(["diabetes", "enzymes"]);
  });

  it("calculates FIB-4 and routes exact boundaries", () => {
    const low = submit(start("fib4"), { age: "50", ast: "25.8", alt: "100", platelets: "100" });
    expect((low.answers.fib4 as { score: number }).score).toBe(1.29);
    expect(low.result?.title).toBe("Continue management in primary care");
    expect(submit(start("fib4"), { age: "50", ast: "26", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "50", ast: "53.4", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "50", ast: "53.6", alt: "100", platelets: "100" }).result?.title).toBe("Refer to hepatology");
  });

  it("uses older adult FIB-4 low-risk cutoff at age 65 and above", () => {
    expect(submit(start("fib4"), { age: "64.99", ast: "30.77", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "65", ast: "30.6153846", alt: "100", platelets: "100" }).result?.title).toBe("Continue management in primary care");
    expect(submit(start("fib4"), { age: "100", ast: "20", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "100", ast: "26.7", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "100", ast: "26.8", alt: "100", platelets: "100" }).result?.title).toBe("Refer to hepatology");
  });

  it("calculates APP and routes exact boundaries", () => {
    expect(submit(start("app"), { albumin: "4", platelets: "1380" }).currentStep).toBe("elastography");
    expect(submit(start("app"), { albumin: "4", platelets: "2000" }).currentStep).toBe("elastography");
    expect(submit(start("app"), { albumin: "3", platelets: "3090" }).result?.title).toBe("Repeat APP in 1 year");
  });

  it("refers at 8 kPa and repeats FIB-4 below 8 kPa with intensified risk-factor modification", () => {
    const answers = { fib4: { age: 65, score: 1.3 } };
    const referral = submit(start("elastography", answers), { status: "available", kpa: "8" });
    expect(referral.result?.title).toBe("Refer to hepatology");
    expect(referral.result?.summary).toContain("Intensify cardiometabolic risk-factor modification.");
    const repeat = submit(start("elastography", answers), { status: "available", kpa: "7.99" });
    expect(repeat.result?.title).toBe("Repeat FIB-4 in 1 year");
    expect(repeat.result?.summary).toContain("Repeat FIB-4 in 1 year.");
    expect(repeat.result?.summary).toContain("Intensify cardiometabolic risk-factor modification.");

    const youngerRepeat = submit(start("elastography", { fib4: { age: 64.99, score: 1.3 } }), { status: "available", kpa: "7.99" });
    expect(youngerRepeat.result?.title).toBe("Repeat FIB-4 in 1 year");
    expect(youngerRepeat.result?.summary).toContain("Repeat FIB-4 in 1 year.");
    expect(youngerRepeat.result?.summary).toContain("Intensify cardiometabolic risk-factor modification.");
  });

  it("lists elastography referral options when elastography has not been done", () => {
    const answers = { fib4: { score: 1.3 } };
    const result = submit(start("elastography", answers), { status: "not-done" });
    expect(result.result?.title).toBe("Refer for elastography");
    expect(result.result?.summary).toContain("Elastography not done.");
    expect(result.result?.summary).toContain("Refer for elastography.");
    expect(result.result?.summary).toContain("FibroScan: Refer to hepatology or local expert to have a FibroScan.");
    expect(result.result?.summary).toContain("Shear wave elastography: Refer to radiology at QEII HSC, Central Zone.");
    expect(result.result?.summary).toContain("MR elastography: Order an MRI liver with elastography at QEII HSC, Central Zone.");
  });

  it("adds repeat elastography consideration above 10 kPa", () => {
    const answers = { fib4: { score: 1.3 } };
    expect(submit(start("elastography", answers), { status: "available", kpa: "10" }).result?.summary)
      .not.toContain("Consider repeat elastography in 1-2 years.");
    expect(submit(start("elastography", answers), { status: "available", kpa: "10.01" }).result?.summary)
      .toContain("Consider repeat elastography in 1-2 years.");
  });
});


describe("pathway exit recommendations", () => {
  const cases: [string, PathwayState, Record<string, string>, string][] = [
    ["metabolic criteria", start(), qualifyingMetabolic({ waist: "101" }), "does not meet the configured metabolic syndrome criteria"],
    ["ALD", start("alternate", { metabolic: { sex: "male" } }), { drinksPerWeek: "30" }, "configured ALD range"],
    ["MetALD", start("alternate", { metabolic: { sex: "female" } }), { drinksPerWeek: "10.01" }, "configured MetALD range"],
    ["DILI", start("alternate"), { "dili-0": "on" }, "possible drug-induced liver injury"],
    ["HBV", start("alternate"), { hbsagPositive: "on" }, "positive HBsAg"],
    ["HCV", start("alternate"), { hcvPositive: "on" }, "positive HCV antibody and HCV RNA"],
    ["genetic cause", start("alternate"), { "genetic-0": "on" }, "possible genetic condition"],
    ["multiple causes", start("alternate"), { hbsagPositive: "on", hcvPositive: "on" }, "positive HBsAg; positive HCV antibody and HCV RNA"],
  ];
  it.each(cases)("explains %s in displayed and copied recommendations", (_, initial, values, reason) => {
    const state = submit(initial, values);
    expect(state.currentStep).toBe("result");
    const result = state.result!;
    expect(recommendationItems(result)[0]).toContain("This pathway doesn't apply because");
    expect(recommendationItems(result)[0]).toContain(reason);
    const copiedRecommendation = buildResultSummaryText(state, result).split("Recommendation:\n")[1];
    expect(copiedRecommendation).toContain(reason);
    expect(recommendationItems(result)).toHaveLength(1);
    expect(buildResultSummaryText(state, result)).not.toContain("Verify the diagnosis");
    expect(result.message).not.toContain("Verify the diagnosis");
  });
});


it.each([
  ["male", "15", "diabetes"], ["male", "15.01", "MetALD"],
  ["male", "29.99", "MetALD"], ["male", "30", "ALD"],
  ["female", "10", "diabetes"], ["female", "10.01", "MetALD"],
  ["female", "24.99", "MetALD"], ["female", "25", "ALD"],
])("combined screen preserves %s alcohol boundary %s", (sex, drinksPerWeek, expected) => {
  const state = submit(start("alternate", { metabolic: { sex } }), { drinksPerWeek });
  if (expected === "diabetes") expect(state.currentStep).toBe("diabetes");
  else expect(state.result?.recommendations?.[0]).toContain(`configured ${expected} range`);
  expect(state.history).toEqual(["alternate"]);
});

it("retains alcohol and alternate diagnoses together on exclusion", () => {
  const state = submit(start("alternate"), { drinksPerWeek: "30", hbsagPositive: "on", "dili-0": "on" });
  expect(state.answers.alternate).toMatchObject({ drinksPerWeek: 30, hbsagPositive: true, medications: ["Amoxicillin-clavulanate (Augmentin)"] });
  expect(state.result?.recommendations?.[0]).toContain("configured ALD range");
  expect(state.result?.recommendations?.[0]).toContain("positive HBsAg");
  expect(state.result?.recommendations?.[0]).toContain("possible drug-induced liver injury");
});


describe("unavailable bloodwork", () => {
  it.each([
    ["enzymes", {}, ["ALT", "AST"]],
    ["enzymes", { alt: "100", ast: "" }, ["AST"]],
    ["fib4", { age: "50", alt: "100", ast: "26" }, ["platelet count"]],
    ["fib4", { age: "50", platelets: "100" }, ["ALT", "AST"]],
    ["app", {}, ["albumin", "platelet count"]],
    ["app", { albumin: "4" }, ["platelet count"]],
  ] as [Step, Record<string, string>, string[]][])("lists full branch bloodwork on %s", (step, values, missing) => {
    const state = submit(start(step), { ...values, missingValues: "yes" });
    expect(state.currentStep).toBe("result");
    expect(state.history).toEqual([step]);
    expect(state.answers[step]).toMatchObject({ missingValues: true, missingTests: missing });
    expect(state.result?.score).toBeUndefined();
    expect(state.result?.recommendations?.[0]).toBe(`Required bloodwork to complete this pathway: ALT, AST, platelet count${step === "app" ? ", albumin" : ""}.`);
    expect(buildResultSummaryText(state, state.result!)).not.toMatch(/NaN|undefined|doesn't apply/);
    expect(buildResultSummaryText(state, state.result!)).toContain("assessment incomplete");
  });
  it("requests age separately from bloodwork and preserves available inputs", () => {
    const state = submit(start("fib4"), { missingValues: "yes", alt: "100", ast: "26", platelets: "100" });
    expect(state.result?.recommendations).toContain("Confirm the patient's age to calculate FIB-4.");
    expect(state.result?.recommendations?.[0]).not.toContain("age");
    expect(state.answers.fib4).toMatchObject({ alt: 100, ast: 26, platelets: 100 });
  });
  it("does not calculate using invalid denominators", () => {
    const state = submit(start("fib4"), { missingValues: "yes", age: "50", alt: "0", ast: "26", platelets: "0" });
    expect(state.result?.recommendations?.[0]).toContain("ALT, AST, platelet count");
    expect(state.result?.score).toBeUndefined();
  });
});


it.each([['yes', 'ALT, AST, platelet count, albumin'], ['no', 'ALT, AST, platelet count']])(
  "lists the full %s diabetes branch bloodwork before and after enzymes are entered",
  (hasDiabetes, labs) => {
    const diabetes = submit(start("diabetes"), { hasDiabetes });
    for (const values of [{}, { alt: "100", ast: "26" }] as Record<string, string>[]) {
      const state = submit(diabetes, { ...values, missingValues: "yes" });
      expect(state.result?.recommendations?.[0]).toBe(`Required bloodwork to complete this pathway: ${labs}.`);
      expect(buildResultSummaryText(state, state.result!)).toContain(`Required bloodwork to complete this pathway: ${labs}.`);
      expect(state.answers.diabetes).toEqual({ hasDiabetes });
      expect(state.result?.recommendations).toContain("Order any of these tests that are not already available.");
    }
  },
);


it.each([{ fib4: { score: 1.3 } }, { app: { score: 8 } }])(
  "missing-values button on elastography preserves the prior score and recommends testing",
  (answers) => {
    const state = submit(start("elastography", answers), { missingValues: "yes", kpa: "" });
    expect(state.currentStep).toBe("result");
    expect(state.history).toEqual(["elastography"]);
    expect(state.answers.elastography).toEqual({ status: "not-done" });
    expect(state.result?.title).toBe("Refer for elastography");
    expect(state.result?.summary.join(" ")).toMatch(/Calculated (FIB-4|APP):/);
    const summary = buildResultSummaryText(state, state.result!);
    expect(summary).toContain("FibroScan:");
    expect(summary).toContain("Shear wave elastography:");
    expect(summary).toContain("MR elastography:");
    expect(summary).not.toMatch(/NaN|undefined/);
  },
);
