export type Sex = "male" | "female";
export type Step =
  | "metabolic"
  | "alternate"
  | "enzymes"
  | "diabetes"
  | "fib4"
  | "app"
  | "elastography"
  | "result";

export interface Result {
  title: string;
  message: string;
  score?: string;
  summary: string[];
  recommendations?: string[];
}

export interface PathwayState {
  currentStep: Step;
  history: Step[];
  answers: Record<string, unknown>;
  result?: Result;
}

export type FormValues = Record<string, FormDataEntryValue>;

