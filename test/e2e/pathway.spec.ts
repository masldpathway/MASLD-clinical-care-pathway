import { expect, test, type Page } from "@playwright/test";

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

async function fillNumber(page: Page, name: string, value: string) {
  await page.getByRole("spinbutton", { name, exact: true }).fill(value);
}

async function fillMetabolicStep(page: Page) {
  await choose(page, "Sex used for pathway thresholds", "Male");
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
  await page.getByRole("button", { name: "Continue" }).click();
}

async function fillEnzymes(page: Page, alt = "100", ast = "25.8") {
  await fillNumber(page, "ALT (U/L)", alt);
  await fillNumber(page, "AST (U/L)", ast);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function answerDiabetes(page: Page, option: "Yes" | "No") {
  await choose(page, "Does the patient have type 2 diabetes?", option);
  await page.getByRole("button", { name: "Continue" }).click();
}

async function resultSection(page: Page) {
  return page.getByRole("region", { name: "Result" });
}

async function recommendationSection(page: Page) {
  return page.getByRole("region", { name: "Recommendation" });
}

test("start over clears first-step inputs without leaving the page", async ({ page }) => {
  await page.goto("/");

  await choose(page, "Sex used for pathway thresholds", "Male");
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
});

test("non-diabetes FIB-4 low-risk path shows reported values, factual results, and recommendations", async ({ page }) => {
  await page.goto("/");

  await fillMetabolicStep(page);
  await completeSharedScreening(page);
  await fillEnzymes(page);
  await answerDiabetes(page, "No");
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
  await fillEnzymes(page, "100", "100");
  await answerDiabetes(page, "Yes");
  await fillNumber(page, "Albumin (g/dL)", "3.4");
  await fillNumber(page, "Platelet count (K/microL)", "900");
  await page.getByRole("button", { name: "Calculate APP" }).click();
  await expect(page.getByLabel("Has elastography been completed?")).toHaveText("Yes, result available");
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
  await fillEnzymes(page, "100", "100");
  await answerDiabetes(page, "Yes");
  await fillNumber(page, "Albumin (g/dL)", "3.4");
  await fillNumber(page, "Platelet count (K/microL)", "900");
  await page.getByRole("button", { name: "Calculate APP" }).click();
  await expect(page.getByLabel("Has elastography been completed?")).toHaveText("Yes, result available");
  await fillNumber(page, "Liver stiffness (kPa)", "9");
  await page.getByRole("button", { name: "View recommendation" }).click();
  await page.getByRole("button", { name: "Copy summary for EMR" }).click();

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
  await fillEnzymes(page, "100", "26");
  await answerDiabetes(page, "No");
  await fillNumber(page, "Age (years)", "50");
  await fillNumber(page, "Platelet count (10^9/L)", "100");
  await page.getByRole("button", { name: "Calculate FIB-4" }).click();
  await choose(page, "Has elastography been completed?", "No, elastography not done");
  await page.getByRole("button", { name: "View recommendation" }).click();

  await expect(page.getByRole("heading", { name: "Pathway recommendation" })).toBeVisible();
  await expect(await resultSection(page)).toContainText("Elastography not done.");
  const recommendation = await recommendationSection(page);
  await expect(recommendation).toContainText("Refer for elastography.");
  const nestedOptions = recommendation.locator("ul ul");
  await expect(nestedOptions).toContainText("FibroScan: Refer to hepatology or local expert to have a FibroScan.");
  await expect(nestedOptions).toContainText("Shear wave elastography: Refer to radiology at QEII HSC, Central Zone.");
  await expect(nestedOptions).toContainText("MR elastography: Order an MRI liver with elastography at QEII HSC, Central Zone.");
});
