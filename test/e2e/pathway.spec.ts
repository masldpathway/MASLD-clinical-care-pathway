import { expect, test, type Page } from "@playwright/test";

async function fillNumber(page: Page, name: string, value: string) {
  await page.getByRole("spinbutton", { name, exact: true }).fill(value);
}

async function fillMetabolicStep(page: Page) {
  await page.getByRole("radio", { name: "Male", exact: true }).check();
  await fillNumber(page, "Waist circumference", "102");
  await fillNumber(page, "Triglycerides", "1.7");
  await fillNumber(page, "HDL cholesterol", "1.5");
  await fillNumber(page, "Systolic blood pressure (mmHg)", "130");
  await fillNumber(page, "Diastolic blood pressure (mmHg)", "70");
  await fillNumber(page, "Fasting blood glucose", "4");
  await page.getByRole("button", { name: "Continue" }).click();
}

async function completeSharedScreening(page: Page, drinksPerWeek = "15") {
  await fillNumber(page, "Standard drinks per week", drinksPerWeek);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillEnzymes(page: Page, alt = "100", ast = "25.8") {
  await fillNumber(page, "ALT (U/L)", alt);
  await fillNumber(page, "AST (U/L)", ast);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function answerDiabetes(page: Page, option: "Yes" | "No") {
  await page.getByRole("button", { name: option, exact: true }).click();
}

async function resultSection(page: Page) {
  return page.getByRole("region", { name: "Result" });
}

async function recommendationSection(page: Page) {
  return page.getByRole("region", { name: "Recommendation" });
}

test("start over clears first-step inputs without leaving the page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("radio", { name: "Male", exact: true }).check();
  await fillNumber(page, "Waist circumference", "102");
  await fillNumber(page, "Triglycerides", "1.7");
  await fillNumber(page, "Systolic blood pressure (mmHg)", "130");

  await page.getByRole("button", { name: "Start over" }).click();

  await expect(page.getByRole("heading", { name: "Assess metabolic syndrome" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Waist circumference", exact: true })).toHaveValue("");
  await expect(page.getByRole("spinbutton", { name: "Triglycerides", exact: true })).toHaveValue("");
  await expect(page.getByRole("spinbutton", { name: "Systolic blood pressure (mmHg)", exact: true })).toHaveValue("");
});

test("back navigation removes abandoned downstream answers from the report", async ({ page }) => {
  await page.goto("/");

  await fillMetabolicStep(page);
  await fillNumber(page, "Standard drinks per week", "90");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Pathway recommendation" })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();

  await fillNumber(page, "Waist circumference", "101");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Pathway recommendation" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Reported" })).not.toContainText("Alcohol consumption");
  await expect(await resultSection(page)).toContainText("Metabolic syndrome criteria met: 2 of 5.");
  await expect(await recommendationSection(page)).toContainText("This pathway doesn't apply because the patient does not meet the configured metabolic syndrome criteria.");
});

test("non-diabetes FIB-4 low-risk path shows reported values, factual results, and recommendations", async ({ page }) => {
  await page.goto("/");

  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "No");
  await fillNumber(page, "ALT (U/L)", "100");
  await fillNumber(page, "AST (U/L)", "25.8");
  await fillNumber(page, "Age (years)", "50");
  await fillNumber(page, "Platelet count (10^9/L)", "100");
  await page.getByRole("button", { name: "Calculate FIB-4" }).click();

  await expect(page.getByRole("heading", { name: "Pathway recommendation" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Reported" })).toContainText("Alcohol consumption");
  await expect(await resultSection(page)).toContainText("FIB-4: 1.29.");
  await expect(await recommendationSection(page)).toContainText("Do not refer to hepatology.");
  await expect(await recommendationSection(page)).toContainText("Repeat FIB-4 in 1-2 years.");
  await expect(page.getByRole("heading", { name: "Calculated:" })).toHaveCount(0);
});

test("diabetes APP referral path separates result facts from recommendation actions", async ({ page }) => {
  await page.goto("/");

  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "Yes");
  await fillEnzymes(page, "100", "100");
  await fillNumber(page, "Albumin (g/dL)", "3.4");
  await fillNumber(page, "Platelet count (K/microL)", "900");
  await page.getByRole("button", { name: "Calculate APP" }).click();
  await fillNumber(page, "Liver stiffness (kPa)", "9");
  await page.getByRole("button", { name: "View recommendation" }).click();

  const result = await resultSection(page);
  const recommendation = await recommendationSection(page);

  await expect(result).toContainText("APP: 3.06.");
  await expect(result).toContainText("Elastography: 9.0 kPa.");
  await expect(result).not.toContainText("Refer to hepatology.");
  await expect(result).not.toContainText("Intensify cardiometabolic risk-factor modification.");
  await expect(recommendation).toContainText("Refer to hepatology.");
  await expect(recommendation).toContainText("Intensify cardiometabolic risk-factor modification.");
});

test("copy summary includes the full structured report", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL ?? "http://127.0.0.1:5173" });
  await page.goto("/");

  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "Yes");
  await fillEnzymes(page, "100", "100");
  await fillNumber(page, "Albumin (g/dL)", "3.4");
  await fillNumber(page, "Platelet count (K/microL)", "900");
  await page.getByRole("button", { name: "Calculate APP" }).click();
  await fillNumber(page, "Liver stiffness (kPa)", "9");
  await page.getByRole("button", { name: "View recommendation" }).click();
  await page.getByRole("button", { name: "Copy for EMR" }).click();

  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  expect(clipboardText).toContain("Reported:");
  expect(clipboardText).toContain("Waist circumference: 102 cm");
  expect(clipboardText).toContain("Result:");
  expect(clipboardText).toContain("- APP: 3.06.");
  expect(clipboardText).toContain("- Elastography: 9.0 kPa.");
  expect(clipboardText).toContain("Recommendation:");
  expect(clipboardText).toContain("- Refer to hepatology.");
  expect(clipboardText).toContain("- Intensify cardiometabolic risk-factor modification.");
});

test("elastography not done path lists testing referral options", async ({ page }) => {
  await page.goto("/");

  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "No");
  await fillNumber(page, "ALT (U/L)", "100");
  await fillNumber(page, "AST (U/L)", "26");
  await fillNumber(page, "Age (years)", "50");
  await fillNumber(page, "Platelet count (10^9/L)", "100");
  await page.getByRole("button", { name: "Calculate FIB-4" }).click();
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Pathway recommendation" })).toBeVisible();
  await expect(await resultSection(page)).toContainText("Elastography not done.");
  const recommendation = await recommendationSection(page);
  await expect(recommendation).toContainText("Refer for elastography.");
  const nestedOptions = recommendation.locator("ul ul");
  await expect(nestedOptions).toContainText("FibroScan: Refer to hepatology or local expert to have a FibroScan.");
  await expect(nestedOptions).toContainText("Shear wave elastography: Refer to radiology at QEII HSC, Central Zone.");
  await expect(nestedOptions).toContainText("MR elastography: Order an MRI liver with elastography at QEII HSC, Central Zone.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await fillNumber(page, "Liver stiffness (kPa)", "8");
  await page.getByRole("button", { name: "View recommendation", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Refer to hepatology.");
  await expect(await resultSection(page)).not.toContainText("Elastography not done.");
});


test("known metabolic syndrome skips measurements and reports the prior diagnosis", async ({ page }) => {
  await page.goto("/");
  const known = page.getByRole("checkbox", { name: "Patient has metabolic syndrome", exact: true });
  await known.check();
  await expect(page.getByRole("spinbutton", { name: "Waist circumference", exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Female", exact: true }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Exclude alternate diagnoses" })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(known).toBeChecked();
  await known.uncheck();
  await expect(page.getByRole("spinbutton", { name: "Waist circumference", exact: true })).toBeVisible();
  await known.check();
  await page.getByRole("button", { name: "Continue" }).click();
  await fillNumber(page, "Standard drinks per week", "11");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(await recommendationSection(page)).toContainText("This pathway doesn't apply because alcohol consumption meets the configured MetALD range.");
  const report = page.getByRole("region", { name: "Reported", exact: true });
  await expect(report).toContainText("Previously diagnosed; criteria assessment skipped");
  await expect(report).not.toContainText("Waist circumference");
  await expect(page.getByRole("region", { name: "Result", exact: true })).not.toContainText("Metabolic syndrome criteria met");
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(known).not.toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Waist circumference", exact: true })).toBeVisible();
});


test("combined screening preserves answers on back and lists all exclusion reasons", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await expect(page.getByRole("heading", { name: "Exclude alternate diagnoses" })).toBeVisible();
  await expect(page.getByText("Step 2 of 7", { exact: true })).toBeVisible();
  await fillNumber(page, "Standard drinks per week", "30");
  await page.getByRole("checkbox", { name: "HBsAg+", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("configured ALD range");
  await expect(await recommendationSection(page)).toContainText("positive HBsAg");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Standard drinks per week", exact: true })).toHaveValue("30");
  await expect(page.getByRole("checkbox", { name: "HBsAg+", exact: true })).toBeChecked();
  await fillNumber(page, "Standard drinks per week", "15");
  await page.getByRole("checkbox", { name: "HBsAg+", exact: true }).uncheck();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check for type 2 diabetes" })).toBeVisible();
});


test("diabetes comes before enzymes and changing it clears downstream answers", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  await answerDiabetes(page, "Yes");
  await expect(page.getByRole("heading", { name: "Review aminotransferases", exact: true })).toBeVisible();
  await fillEnzymes(page);
  await expect(page.getByRole("heading", { name: "Calculate APP", exact: true })).toBeVisible();
  await fillNumber(page, "Albumin (g/dL)", "4");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "Yes", exact: true })).toHaveAttribute("aria-pressed", "true");
  await answerDiabetes(page, "No");
  await expect(page.getByRole("spinbutton", { name: "ALT (U/L)", exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Calculate FIB-4", exact: true })).toBeVisible();
});


test("sex is required when metabolic syndrome assessment is skipped", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Patient has metabolic syndrome", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assess metabolic syndrome", exact: true })).toBeVisible();
  const male = page.getByRole("radio", { name: "Male", exact: true });
  await expect(male).toHaveAttribute("required", "");
  await male.check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Exclude alternate diagnoses", exact: true })).toBeVisible();
});


test("missing FIB-4 inputs recommend bloodwork and return to the same step", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "No");
  await fillNumber(page, "ALT (U/L)", "100");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Required bloodwork to complete this pathway: ALT, AST, platelet count.");
  await expect(await recommendationSection(page)).not.toContainText("doesn't apply");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "ALT (U/L)", exact: true })).toHaveValue("100");
  await fillNumber(page, "AST (U/L)", "25.8");
  await fillNumber(page, "Age (years)", "50");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Required bloodwork to complete this pathway: ALT, AST, platelet count.");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Age (years)", exact: true })).toHaveValue("50");
  await fillNumber(page, "Platelet count (10^9/L)", "100");
  await page.getByRole("button", { name: "Calculate FIB-4", exact: true }).click();
  await expect(await resultSection(page)).toContainText("FIB-4: 1.29");
});

test("missing APP values recommends albumin and platelet bloodwork", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "Yes");
  await fillEnzymes(page);
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Required bloodwork to complete this pathway: ALT, AST, platelet count, albumin.");
});


test("diabetes branch lists all required bloodwork before ALT and AST are available", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "Yes");
  await expect(page.getByText("Step 4 of 7", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Required bloodwork to complete this pathway: ALT, AST, platelet count, albumin.");
  await expect(page.getByRole("region", { name: "Reported", exact: true })).toContainText("Yes");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await answerDiabetes(page, "No");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await expect(await recommendationSection(page)).toContainText("Required bloodwork to complete this pathway: ALT, AST, platelet count.");
  await expect(await recommendationSection(page)).not.toContainText("albumin");
});

test("return link and copied summary restore entered values in a new tab", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL ?? "http://127.0.0.1:5173" });
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page, "3");
  await answerDiabetes(page, "No");
  await fillNumber(page, "ALT (U/L)", "100");
  await fillNumber(page, "AST (U/L)", "25.8");
  await fillNumber(page, "Age (years)", "50");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  const link = page.getByRole("link", { name: "Return to this step when the required values are available to complete the pathway." });
  const href = await link.getAttribute("href");
  expect(href).toContain("#r2=");
  await page.getByRole("button", { name: "Copy for EMR", exact: true }).click();
  await expect(page.getByText("Copied to clipboard", { exact: true })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(href!);
  expect(copied.match(/Return to/g)).toHaveLength(1);
  const html = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) => entry.types.includes("text/html"))!;
    return (await item.getType("text/html")).text();
  });
  const formatted = await page.evaluate((markup) => {
    const doc = new DOMParser().parseFromString(markup, "text/html");
    return { text: doc.body.textContent, href: doc.querySelector("a")?.getAttribute("href"), links: doc.querySelectorAll("a").length };
  }, html);
  expect(formatted.href).toBe(href);
  expect(formatted.links).toBe(1);
  expect(formatted.text).not.toContain("#r2=");
  expect(formatted.text).toContain("Return to the pathway when the required values are available");
  await link.click();
  await expect(page.getByRole("heading", { name: "Calculate FIB-4", exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Age (years)", exact: true })).toHaveValue("50");
  await expect(page.getByRole("spinbutton", { name: "ALT (U/L)", exact: true })).toHaveValue("100");
  await expect(page.getByRole("spinbutton", { name: "AST (U/L)", exact: true })).toHaveValue("25.8");
  const reopened = await context.newPage();
  await reopened.goto(href!);
  await expect(reopened.getByRole("heading", { name: "Calculate FIB-4", exact: true })).toBeVisible();
  await expect(reopened.getByRole("spinbutton", { name: "Age (years)", exact: true })).toHaveValue("50");
  await fillNumber(reopened, "Platelet count (10^9/L)", "100");
  await reopened.getByRole("button", { name: "Calculate FIB-4", exact: true }).click();
  await expect(await resultSection(reopened)).toContainText("FIB-4: 1.29");
  await expect(reopened.getByRole("region", { name: "Reported", exact: true })).toContainText("3 standard drinks/week");
  await reopened.getByRole("button", { name: "Start over", exact: true }).click();
  await reopened.reload();
  await expect(reopened.getByRole("heading", { name: "Assess metabolic syndrome", exact: true })).toBeVisible();
  await expect(reopened.getByRole("radio", { name: "Male", exact: true })).not.toBeChecked();
});

test("one click copies even when the clipboard API rejects the first attempt", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL ?? "http://127.0.0.1:5173" });
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "No");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await page.evaluate(() => {
    for (const method of ["writeText", "write"]) {
      Object.defineProperty(navigator.clipboard, method, {
        configurable: true,
        value: () => Promise.reject(new DOMException("Document is not focused", "NotAllowedError")),
      });
    }
  });
  await page.getByRole("button", { name: "Copy for EMR", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied!", exact: true })).toBeVisible();
  await expect(page.getByText("Copied to clipboard", { exact: true })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain("Required bloodwork to complete this pathway: ALT, AST, platelet count.");
  expect(text).toContain("#r2=");
  const hasFormattedLink = await page.evaluate(async () => {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) => entry.types.includes("text/html"));
    return item ? (await (await item.getType("text/html")).text()).includes("<a href=") : false;
  });
  expect(hasFormattedLink).toBe(true);
  await expect(page.locator("textarea")).toHaveCount(0);
});

test("clipboard failure shows an error instead of a false success", async ({ page }) => {
  await page.goto("/");
  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await answerDiabetes(page, "No");
  await page.getByRole("button", { name: "I don't have the required values", exact: true }).click();
  await page.evaluate(() => {
    for (const method of ["writeText", "write"]) Object.defineProperty(navigator.clipboard, method, { configurable: true, value: () => Promise.reject(new Error("Blocked")) });
    document.execCommand = () => false;
  });
  await page.getByRole("button", { name: "Copy for EMR", exact: true }).click();
  await expect(page.getByText("Unable to copy. Check your browser's clipboard permissions and try again.", { exact: true })).toBeVisible();
  await expect(page.getByText("Copied to clipboard", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy for EMR", exact: true })).toBeEnabled();
});
