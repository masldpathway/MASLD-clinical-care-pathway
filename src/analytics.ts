import type { PathwayState } from "./types";

export type UsageEvent = "site-entry" | "pathway-started" | "results-displayed" |
  "values-unavailable-enzymes" | "values-unavailable-fib4" | "values-unavailable-app" |
  "values-unavailable-elastography" | "assessment-completed" |
  "assessment-completed-app" | "assessment-completed-fib4" | "pathway-excluded" | "pathway-resumed";

type Counter = {
  no_onload: boolean;
  count?: (data: { path: string; title: string; referrer: string; event: boolean; no_session: boolean }) => void;
};
declare global {
  interface Window { goatcounter?: Counter }
}

let enabled = false;
let pending: UsageEvent[] = [];

export function initializeAnalytics(endpoint: string | undefined) {
  if (!endpoint || enabled) return;
  // Only accept a hosted GoatCounter endpoint, never an arbitrary tracking URL.
  if (!/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/count$/.test(endpoint)) return;
  enabled = true;
  window.goatcounter = { no_onload: true };
  const script = document.createElement("script");
  script.src = "https://gc.zgo.at/count.js";
  script.async = true;
  script.dataset.goatcounter = endpoint;
  script.onload = () => {
    const events = pending;
    pending = [];
    events.forEach(trackUsage);
  };
  script.onerror = () => { pending = []; enabled = false; };
  document.head.appendChild(script);
  trackUsage("site-entry");
}

export function analyticsEnabled() { return enabled; }

export function trackUsage(event: UsageEvent) {
  if (!enabled) return;
  if (!window.goatcounter?.count) {
    // Keep only fixed event names while the script loads; never retain form data.
    if (pending.length < 100) pending.push(event);
    return;
  }
  try {
    window.goatcounter.count({ path: event, title: event, referrer: "", event: true, no_session: true });
  } catch {
    // Analytics must never interrupt the assessment.
  }
}

export function resultUsageEvents(state: PathwayState): UsageEvent[] {
  if (state.currentStep !== "result" || !state.result) return [];
  const step = state.history.at(-1);
  const answers = step ? state.answers[step] as { missingValues?: boolean; status?: string } | undefined : undefined;
  let outcome: UsageEvent;
  if (step === "elastography" && answers?.status === "not-done") {
    outcome = "values-unavailable-elastography";
  } else if (answers?.missingValues && (step === "enzymes" || step === "fib4" || step === "app")) {
    outcome = `values-unavailable-${step}`;
  } else if (step === "metabolic" || step === "alternate") {
    outcome = "pathway-excluded";
  } else {
    outcome = "assessment-completed";
  }
  const events: UsageEvent[] = ["results-displayed", outcome];
  if (outcome === "assessment-completed") {
    // Use the completed scoring step, including when elastography followed it.
    const scoringStep = [...state.history].reverse().find((previous) => previous === "app" || previous === "fib4");
    if (scoringStep) events.push(`assessment-completed-${scoringStep}`);
  }
  return events;
}
