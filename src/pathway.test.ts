import { describe, expect, it } from "vitest";
import { config } from "./config";
import { submitStep } from "./pathway";
import type { FormValues, PathwayState, Step } from "./types";

const start = (currentStep: Step = "metabolic", answers = {}): PathwayState =>
  ({ currentStep, history: [], answers });
const submit = (state: PathwayState, values: Record<string, string>) =>
  submitStep(state, values as FormValues);
const qualifyingMetabolic = (overrides = {}) => ({
  sex: "male", waist: "102", waistUnit: "cm", triglycerides: "1.7",
  triglyceridesUnit: "mmol", hdl: "1.5", hdlUnit: "mmol", systolic: "130",
  diastolic: "70", glucose: "4", glucoseUnit: "mmol", ...overrides,
});

describe("MASLD pathway engine", () => {
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
    expect(state.currentStep).toBe("alcohol");
  });

  it("uses exact local SI metabolic threshold boundaries", () => {
    expect(submit(start(), qualifyingMetabolic({
      waist: "101.99", triglycerides: "1.69", hdl: "1.0", systolic: "129.99",
      diastolic: "84.99", glucose: "5.59",
    })).result?.title).toBe("MASLD pathway not indicated");

    expect(submit(start(), qualifyingMetabolic({
      hdl: "0.99", systolic: "129.99", glucose: "5.59",
    })).currentStep).toBe("alcohol");

    expect(submit(start(), qualifyingMetabolic({
      sex: "female", hdl: "1.3", systolic: "129.99", glucose: "5.59",
    })).result?.title).toBe("MASLD pathway not indicated");

    expect(submit(start(), qualifyingMetabolic({
      sex: "female", hdl: "1.29", systolic: "129.99", glucose: "5.59",
    })).currentStep).toBe("alcohol");
  });

  it("counts treatment for triglycerides and HDL plus prior type 2 diabetes diagnosis", () => {
    const state = submit(start(), qualifyingMetabolic({
      waist: "101", triglycerides: "1.69", hdl: "1.5", systolic: "120",
      diastolic: "70", glucose: "5.59", triglyceridesTreatment: "on",
      hdlTreatment: "on", type2DiabetesDiagnosis: "on",
    }));
    expect((state.answers.metabolic as { criteriaCount: number }).criteriaCount).toBe(3);
    expect(state.currentStep).toBe("alcohol");
  });

  it("exits at configured MetALD and ALD thresholds", () => {
    const metabolic = submit(start(), qualifyingMetabolic());
    expect(submit(metabolic, { drinksPerWeek: "15.01" }).result?.message).toMatch(/MetALD range/);
    expect(submit(metabolic, { drinksPerWeek: "15.01" }).result?.message).toMatch(/Verify the diagnosis case by case/);
    expect(submit(metabolic, { drinksPerWeek: "30" }).result?.message).toMatch(/ALD range/);
  });

  it("continues below the sex-specific alcohol threshold", () => {
    const metabolic = submit(start(), qualifyingMetabolic({ sex: "female" }));
    expect(submit(metabolic, { drinksPerWeek: "10" }).currentStep).toBe("alternate");
    expect(submit(start("alcohol", { metabolic: { sex: "male" } }), { drinksPerWeek: "15" }).currentStep).toBe("alternate");
  });

  it("exits for an alternate diagnosis and continues without one", () => {
    const state = start("alternate");
    const exit = submit(state, { "dili-0": "on", hbsagPositive: "on" });
    expect(exit.result?.summary).toEqual([
      "Identified: possible drug-induced liver injury.",
      "Identified: positive HBsAg.",
    ]);
    expect(exit.result?.message).toMatch(/Verify the diagnosis case by case/);
    expect(submit(state, {}).currentStep).toBe("enzymes");
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
    expect(below.currentStep).toBe("diabetes");
    expect((below.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(false);

    const altAtCutoff = submit(start("enzymes"), { alt: "200", ast: "199.99" });
    expect(altAtCutoff.currentStep).toBe("diabetes");
    expect((altAtCutoff.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(true);

    const astAtCutoff = submit(start("enzymes"), { alt: "199.99", ast: "200" });
    expect(astAtCutoff.currentStep).toBe("diabetes");
    expect((astAtCutoff.answers.enzymes as { considerAlternateCause: boolean }).considerAlternateCause).toBe(true);
  });

  it("routes diabetes to APP and absence of diabetes to FIB-4", () => {
    expect(submit(start("diabetes"), { hasDiabetes: "yes" }).currentStep).toBe("app");
    expect(submit(start("diabetes"), { hasDiabetes: "no" }).currentStep).toBe("fib4");
  });

  it("calculates FIB-4 and routes exact boundaries", () => {
    const low = submit(start("fib4"), { age: "50", ast: "25.8", alt: "100", platelets: "100" });
    expect((low.answers.fib4 as { score: number }).score).toBe(1.29);
    expect(low.result?.title).toBe("Repeat FIB-4 every 2 years");
    expect(submit(start("fib4"), { age: "50", ast: "26", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
    expect(submit(start("fib4"), { age: "60", ast: "50", alt: "100", platelets: "100" }).currentStep).toBe("elastography");
  });

  it("calculates APP and routes exact boundaries", () => {
    expect(submit(start("app"), { albumin: "4", platelets: "1380" }).currentStep).toBe("elastography");
    expect(submit(start("app"), { albumin: "4", platelets: "2000" }).currentStep).toBe("elastography");
    expect(submit(start("app"), { albumin: "3", platelets: "3090" }).result?.title).toBe("Repeat APP in 1 year");
  });

  it("refers at 8 kPa and repeats FIB-4 below 8 kPa", () => {
    const answers = { fib4: { score: 1.3 } };
    const referral = submit(start("elastography", answers), { kpa: "8" });
    expect(referral.result?.title).toBe("Refer to hepatology");
    expect(referral.result?.summary).toContain("Intensify cardiometabolic risk-factor modification.");
    const repeat = submit(start("elastography", answers), { kpa: "7.99" });
    expect(repeat.result?.title).toBe("Repeat FIB-4 in 1 year");
    expect(repeat.result?.summary).toContain("Continue cardiometabolic risk-factor modification.");
  });

  it("adds repeat elastography consideration above 10 kPa", () => {
    const answers = { fib4: { score: 1.3 } };
    expect(submit(start("elastography", answers), { kpa: "10" }).result?.summary)
      .not.toContain("Consider repeat elastography in 1-2 years.");
    expect(submit(start("elastography", answers), { kpa: "10.01" }).result?.summary)
      .toContain("Consider repeat elastography in 1-2 years.");
  });
});
