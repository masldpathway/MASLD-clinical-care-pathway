import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeAnalytics, resultUsageEvents, trackUsage } from "./analytics";
import { submitStep } from "./pathway";
import type { PathwayState, Step } from "./types";

const start = (currentStep: Step): PathwayState => ({ currentStep, history: [], answers: {} });
afterEach(() => vi.unstubAllGlobals());

describe("usage outcomes", () => {
  it.each(["enzymes", "fib4", "app"] as const)("counts missing values at %s separately from completion", (step) => {
    const result = submitStep(start(step), { missingValues: "yes" });
    expect(resultUsageEvents(result)).toEqual(["results-displayed", `values-unavailable-${step}`]);
  });

  it("distinguishes unavailable elastography from a completed assessment", () => {
    const state = { ...start("elastography"), history: ["fib4"] as Step[], answers: { fib4: { score: 2 } } };
    expect(resultUsageEvents(submitStep(state, { missingValues: "yes" }))).toEqual([
      "results-displayed", "values-unavailable-elastography",
    ]);
    expect(resultUsageEvents(submitStep(state, { kpa: "7" }))).toEqual([
      "results-displayed", "assessment-completed", "assessment-completed-fib4",
    ]);
  });

  it("counts early recommendations as complete and screening exclusions separately", () => {
    expect(resultUsageEvents(submitStep(start("fib4"), { age: "50", ast: "20", alt: "100", platelets: "200" }))).toEqual([
      "results-displayed", "assessment-completed", "assessment-completed-fib4",
    ]);
    expect(resultUsageEvents(submitStep(start("metabolic"), { sex: "male" }))).toEqual([
      "results-displayed", "pathway-excluded",
    ]);
    expect(resultUsageEvents(start("fib4"))).toEqual([]);
  });

  it("counts APP completion both directly and after elastography", () => {
    const direct = submitStep(start("app"), { albumin: "40", platelets: "300" });
    expect(resultUsageEvents(direct)).toEqual([
      "results-displayed", "assessment-completed", "assessment-completed-app",
    ]);
    const intermediate = submitStep(start("app"), { albumin: "40", platelets: "200" });
    expect(intermediate.currentStep).toBe("elastography");
    expect(resultUsageEvents(submitStep(intermediate, { kpa: "9" }))).toEqual([
      "results-displayed", "assessment-completed", "assessment-completed-app",
    ]);
    expect(resultUsageEvents(submitStep(intermediate, { missingValues: "yes" }))).toEqual([
      "results-displayed", "values-unavailable-elastography",
    ]);
  });

  it("queues events until loaded and sends fixed names without sensitive URLs", () => {
    const script = { dataset: {}, onload: () => {} };
    const counterWindow = { location: { href: "https://example.org/?patient=private#r2=sensitive" }, goatcounter: {} };
    vi.stubGlobal("window", counterWindow);
    vi.stubGlobal("document", { createElement: () => script, head: { appendChild: vi.fn() } });
    initializeAnalytics("https://example.goatcounter.com/count");
    trackUsage("results-displayed");
    const count = vi.fn();
    counterWindow.goatcounter = { count };
    script.onload();
    expect(count.mock.calls.map(([event]) => event)).toEqual([
      { path: "site-entry", title: "site-entry", referrer: "", event: true, no_session: true },
      { path: "results-displayed", title: "results-displayed", referrer: "", event: true, no_session: true },
    ]);
    trackUsage("results-displayed");
    expect(count).toHaveBeenCalledTimes(3);
    count.mockImplementation(() => { throw new Error("blocked"); });
    expect(() => trackUsage("results-displayed")).not.toThrow();
  });
});
