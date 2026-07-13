import { config } from "./config";
import type { FormValues, PathwayState, Result, Sex, Step } from "./types";

const number = (value: FormDataEntryValue | undefined) =>
  Number.parseFloat(String(value));
const checked = (value: FormDataEntryValue | undefined) => Boolean(value);
const alternatePathwayMessage =
  "The MASLD pathway no longer applies. Verify the diagnosis case by case and manage accordingly.";

const transition = (
  state: PathwayState,
  currentStep: Step,
  answers: unknown,
  nextStep: Step,
  result?: Result,
): PathwayState => ({
  ...state,
  currentStep: nextStep,
  history: [...state.history, currentStep],
  answers: { ...state.answers, [currentStep]: answers },
  result,
});

export function submitStep(state: PathwayState, values: FormValues): PathwayState {
  const handlers: Partial<Record<Step, (state: PathwayState, values: FormValues) => PathwayState>> = {
    metabolic: submitMetabolic,
    alcohol: submitAlcohol,
    alternate: submitAlternate,
    enzymes: submitEnzymes,
    diabetes: submitDiabetes,
    fib4: submitFib4,
    app: submitApp,
    elastography: submitElastography,
  };
  const handler = handlers[state.currentStep];
  if (!handler) return state;
  return handler(state, values);
}

function submitMetabolic(state: PathwayState, values: FormValues): PathwayState {
  const sex = String(values.sex) as Sex;
  const waistCm = values.waistUnit === "in" ? number(values.waist) * 2.54 : number(values.waist);
  const triglycerides = values.triglyceridesUnit === "mgdl"
    ? number(values.triglycerides) / 88.57
    : number(values.triglycerides);
  const hdl = values.hdlUnit === "mgdl" ? number(values.hdl) / 38.67 : number(values.hdl);
  const glucose = values.glucoseUnit === "mgdl" ? number(values.glucose) / 18 : number(values.glucose);
  const criteria = [
    waistCm >= config.metabolicSyndrome.waistCm[sex],
    triglycerides >= config.metabolicSyndrome.triglyceridesMmolL ||
      checked(values.triglyceridesTreatment),
    hdl < config.metabolicSyndrome.hdlMmolL[sex] || checked(values.hdlTreatment),
    number(values.systolic) >= config.metabolicSyndrome.bloodPressureMmHg.systolic ||
      number(values.diastolic) >= config.metabolicSyndrome.bloodPressureMmHg.diastolic ||
      checked(values.bloodPressureTreatment),
    glucose >= config.metabolicSyndrome.fastingGlucoseMmolL ||
      checked(values.type2DiabetesDiagnosis),
  ];
  const answers = { ...values, sex, criteriaCount: criteria.filter(Boolean).length };
  if (answers.criteriaCount < config.metabolicSyndrome.requiredCriteria) {
    return transition(state, "metabolic", answers, "result", {
      title: "MASLD pathway not indicated",
      message: "The patient does not currently meet the configured metabolic syndrome criteria. Exit this pathway.",
      summary: [`Metabolic syndrome criteria met: ${answers.criteriaCount} of 5.`],
    });
  }
  return transition(state, "metabolic", answers, "alcohol");
}

function submitAlcohol(state: PathwayState, values: FormValues): PathwayState {
  const drinksPerWeek = number(values.drinksPerWeek);
  const sex = (state.answers.metabolic as { sex: Sex }).sex;
  const thresholds = config.alcohol[sex];
  if (drinksPerWeek >= thresholds.aldMinimum) {
    return transition(state, "alcohol", { drinksPerWeek }, "result", {
      title: "MASLD pathway does not apply",
      message: `${alternatePathwayMessage} Alcohol consumption meets the configured ALD range.`,
      summary: [`Reported alcohol consumption: ${drinksPerWeek} standard drinks/week.`],
    });
  }
  if (drinksPerWeek > thresholds.metaldMinimum) {
    return transition(state, "alcohol", { drinksPerWeek }, "result", {
      title: "MASLD pathway does not apply",
      message: `${alternatePathwayMessage} Alcohol consumption meets the configured MetALD range.`,
      summary: [`Reported alcohol consumption: ${drinksPerWeek} standard drinks/week.`],
    });
  }
  return transition(state, "alcohol", { drinksPerWeek }, "alternate");
}

function submitAlternate(state: PathwayState, values: FormValues): PathwayState {
  const medications = config.alternateDiagnoses.diliMedications.filter((_, index) => values[`dili-${index}`]);
  const geneticConditions = config.alternateDiagnoses.geneticConditions.filter((_, index) => values[`genetic-${index}`]);
  const answers = {
    medications,
    geneticConditions,
    hbsagPositive: checked(values.hbsagPositive),
    hcvPositive: checked(values.hcvPositive),
  };
  const diagnoses = [
    medications.length ? "possible drug-induced liver injury" : "",
    answers.hbsagPositive ? "positive HBsAg" : "",
    answers.hcvPositive ? "positive HCV antibody and HCV RNA" : "",
    geneticConditions.length ? "possible genetic condition" : "",
  ].filter(Boolean);
  if (diagnoses.length) {
    return transition(state, "alternate", answers, "result", {
      title: "MASLD pathway does not apply",
      message: `${alternatePathwayMessage} An alternate diagnosis or cause has been identified.`,
      summary: diagnoses.map((diagnosis) => `Identified: ${diagnosis}.`),
    });
  }
  return transition(state, "alternate", answers, "enzymes");
}

function submitEnzymes(state: PathwayState, values: FormValues): PathwayState {
  const answers = {
    alt: number(values.alt),
    ast: number(values.ast),
    considerAlternateCause: false,
  };
  answers.considerAlternateCause =
    answers.alt >= config.aminotransferases.thresholdUL ||
    answers.ast >= config.aminotransferases.thresholdUL;
  return transition(state, "enzymes", answers, "diabetes");
}

function submitDiabetes(state: PathwayState, values: FormValues): PathwayState {
  const answers = { hasDiabetes: String(values.hasDiabetes) };
  return transition(state, "diabetes", answers, answers.hasDiabetes === "yes" ? "app" : "fib4");
}

function submitFib4(state: PathwayState, values: FormValues): PathwayState {
  const answers = {
    age: number(values.age),
    alt: number(values.alt),
    ast: number(values.ast),
    platelets: number(values.platelets),
    score: 0,
  };
  answers.score = (answers.age * answers.ast) / (answers.platelets * Math.sqrt(answers.alt));
  const lowRiskUpperExclusive = answers.age >= config.fib4.olderAdultAgeLowerInclusive
    ? config.fib4.olderAdultLowRiskUpperExclusive
    : config.fib4.lowRiskUpperExclusive;
  if (answers.score < lowRiskUpperExclusive) {
    return transition(state, "fib4", answers, "result", {
      score: `FIB-4 ${answers.score.toFixed(2)}`,
      title: "Continue management in primary care",
      message: "The calculated FIB-4 is in the configured low-risk range. Do not refer to hepatology; continue management in primary care and repeat FIB-4 in 1-2 years.",
      summary: [
        `Calculated FIB-4: ${answers.score.toFixed(2)}.`,
        "Do not refer to hepatology.",
        "Continue management in primary care.",
        "Repeat FIB-4 in 1-2 years.",
      ],
    });
  }
  if (answers.score > config.fib4.indeterminateUpperInclusive) {
    return transition(state, "fib4", answers, "result", {
      score: `FIB-4 ${answers.score.toFixed(2)}`,
      title: "Refer to hepatology",
      message: "The calculated FIB-4 is above the configured advanced-fibrosis cutoff. Refer to hepatology for further management and intensify cardio-metabolic risk reduction.",
      summary: [
        `Calculated FIB-4: ${answers.score.toFixed(2)}.`,
        "Refer to hepatology for further management.",
        "Intensify cardio-metabolic risk reduction.",
      ],
    });
  }
  return transition(state, "fib4", answers, "elastography");
}

function submitApp(state: PathwayState, values: FormValues): PathwayState {
  const answers = { albumin: number(values.albumin), platelets: number(values.platelets), score: 0 };
  answers.score = (answers.albumin * answers.platelets) / 1000;
  if (answers.score >= config.app.repeatYearlyLowerInclusive) {
    return transition(state, "app", answers, "result", {
      score: `APP ${answers.score.toFixed(2)}`,
      title: "Repeat APP in 1 year",
      message: "The calculated APP meets the configured yearly repeat-screening range. Repeat APP in 1 year.",
      summary: [`Calculated APP: ${answers.score.toFixed(2)}.`],
    });
  }
  return transition(state, "app", answers, "elastography");
}

function submitElastography(state: PathwayState, values: FormValues): PathwayState {
  const answers = { kpa: number(values.kpa) };
  const fib4 = state.answers.fib4 as { age?: number, score: number } | undefined;
  const app = state.answers.app as { score: number } | undefined;
  const previousScore = fib4
    ? `Calculated FIB-4: ${fib4.score.toFixed(2)}.`
    : `Calculated APP: ${app!.score.toFixed(2)}.`;
  if (answers.kpa >= config.elastography.referralThresholdKpa) {
    const summary = [
      previousScore,
      `Elastography: ${answers.kpa.toFixed(1)} kPa.`,
      "Refer to hepatology.",
      "Intensify cardiometabolic risk-factor modification.",
    ];
    if (answers.kpa > config.elastography.repeatConsiderationThresholdKpa) {
      summary.push("Consider repeat elastography in 1-2 years.");
    }
    return transition(state, "elastography", answers, "result", {
      score: `${answers.kpa.toFixed(1)} kPa`,
      title: "Refer to hepatology",
      message: "Elastography meets the configured referral threshold. Refer the patient to hepatology and intensify cardiometabolic risk-factor modification.",
      summary,
    });
  }
  return transition(state, "elastography", answers, "result", {
    score: `${answers.kpa.toFixed(1)} kPa`,
    title: "Repeat FIB-4 in 1 year",
    message: "Elastography is below the configured referral threshold. Repeat FIB-4 in 1 year and intensify cardiometabolic risk-factor modification.",
    summary: [
      previousScore,
      `Elastography: ${answers.kpa.toFixed(1)} kPa.`,
      "Repeat FIB-4 in 1 year.",
      "Intensify cardiometabolic risk-factor modification.",
    ],
  });
}
