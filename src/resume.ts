import { config } from "./config";
import { submitStep } from "./pathway";
import type { FormValues, PathwayState, Step } from "./types";

function formValues(answers: unknown): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries((answers || {}) as Record<string, unknown>)) {
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) values[key] = String(value);
    if (value === true) values[key] = "on";
  }
  const alternate = answers as { medications?: string[]; geneticConditions?: string[] } | undefined;
  config.alternateDiagnoses.diliMedications.forEach((name, index) => {
    if (alternate?.medications?.includes(name)) values[`dili-${index}`] = "on";
  });
  config.alternateDiagnoses.geneticConditions.forEach((name, index) => {
    if (alternate?.geneticConditions?.includes(name)) values[`genetic-${index}`] = "on";
  });
  delete values.missingValues;
  return values;
}

// Versioned field positions keep links compact. Preserve their order for old links.
const compactFields = {
  metabolic: ["sex", "knownMetabolicSyndrome", "waist", "waistUnit", "triglycerides", "triglyceridesUnit", "hdl", "hdlUnit", "systolic", "diastolic", "glucose", "glucoseUnit", "triglyceridesTreatment", "hdlTreatment", "bloodPressureTreatment", "type2DiabetesDiagnosis"],
  alternate: ["drinksPerWeek", "hbsagPositive", "hcvPositive", "dili-0", "dili-1", "dili-2", "dili-3", "dili-4", "dili-5", "genetic-0", "genetic-1", "genetic-2", "genetic-3", "genetic-4"],
  diabetes: ["hasDiabetes"],
  enzymes: ["alt", "ast"],
  fib4: ["age", "alt", "ast", "platelets"],
  app: ["albumin", "platelets"],
  elastography: ["kpa"],
} as const;
const compactSteps = Object.keys(compactFields) as (keyof typeof compactFields)[];

function encodeCompact(state: PathwayState): string {
  const steps = state.history.map((step) => {
    const fields = compactFields[step as keyof typeof compactFields];
    const values = formValues(state.answers[step]);
    const packed = fields.map((field) => values[field] ?? null);
    while (packed.length && packed.at(-1) === null) packed.pop();
    return [compactSteps.indexOf(step as keyof typeof compactFields), packed];
  });
  const bytes = new TextEncoder().encode(JSON.stringify(steps));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCompact(encoded: string) {
  const raw = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  const steps = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(raw, (char) => char.charCodeAt(0))));
  if (!Array.isArray(steps)) throw new Error("Invalid link");
  return { version: 1, steps: steps.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0])) throw new Error("Invalid step");
    const step = compactSteps[entry[0]];
    const fields = step && compactFields[step];
    if (!fields || !Array.isArray(entry[1]) || entry[1].length > fields.length) throw new Error("Invalid fields");
    const values: Record<string, string> = {};
    entry[1].forEach((value: unknown, index: number) => {
      if (value === null) return;
      if (typeof value !== "string") throw new Error("Invalid value");
      values[fields[index]] = value;
    });
    return { step, values };
  }) };
}

export function buildResumeUrl(state: PathwayState, baseUrl?: string): string | undefined {
  const step = state.history.at(-1);
  const answers = step ? state.answers[step] as Record<string, unknown> | undefined : undefined;
  if (state.currentStep !== "result" || !step || !(answers?.missingValues || (step === "elastography" && answers?.status === "not-done"))) return;
  const base = baseUrl ?? (typeof window !== "undefined" ? window.location.href : undefined);
  if (!base) return;
  const url = new URL(base);
  url.hash = `r2=${encodeCompact(state)}`;
  return url.href;
}

// Replay submitted inputs so URL data never supplies calculated scores or routing.
export function readResumeState(hash: string): PathwayState | undefined {
  if (!hash.startsWith("#resume=") && !hash.startsWith("#r2=")) return;
  try {
    const payload = hash.startsWith("#r2=") ? decodeCompact(hash.slice(4)) : JSON.parse(decodeURIComponent(hash.slice(8)));
    if (payload.version !== 1 || !Array.isArray(payload.steps) || !payload.steps.length || payload.steps.length > 7) return;
    let state: PathwayState = { currentStep: "metabolic", history: [], answers: {} };
    for (const [index, entry] of payload.steps.entries()) {
      if (!entry || entry.step !== state.currentStep || !entry.values || typeof entry.values !== "object" || Array.isArray(entry.values)) return;
      if (Object.entries(entry.values).some(([key, value]) => ["__proto__", "constructor", "prototype", "missingValues"].includes(key) || typeof value !== "string")) return;
      const values = entry.values as FormValues;
      if (index === payload.steps.length - 1) {
        if (!["enzymes", "fib4", "app", "elastography"].includes(entry.step)) return;
        return { ...state, answers: { ...state.answers, [entry.step as Step]: values } };
      }
      state = submitStep(state, values);
      if (state.currentStep === "result") return;
    }
  } catch {
    // An invalid or obsolete link opens a fresh pathway.
  }
}
