import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { PathwayState, Result } from "../types";

type SectionItem = { label: string; value: string };

const answer = <T extends Record<string, unknown>>(
  state: PathwayState,
  step: string,
) => (state.answers[step] || {}) as T;

const yesNo = (value: unknown) =>
  value === "yes" ? "Yes" : value === "no" ? "No" : String(value);
const treatment = (value: unknown) => (value ? "Yes" : "No");
const unitValue = (value: unknown, unit: unknown) =>
  `${String(value)} ${String(unit)}`;

export function reportedItems(state: PathwayState): SectionItem[] {
  const metabolic = answer<Record<string, unknown>>(state, "metabolic");
  const alcohol = answer<Record<string, unknown>>(state, "alcohol");
  const alternate = answer<{
    medications?: string[];
    geneticConditions?: string[];
    hbsagPositive?: boolean;
    hcvPositive?: boolean;
  }>(state, "alternate");
  const enzymes = answer<Record<string, unknown>>(state, "enzymes");
  const diabetes = answer<Record<string, unknown>>(state, "diabetes");
  const fib4 = answer<Record<string, unknown>>(state, "fib4");
  const app = answer<Record<string, unknown>>(state, "app");
  const elastography = answer<Record<string, unknown>>(state, "elastography");
  const items: SectionItem[] = [];

  if (metabolic.sex) {
    items.push(
      { label: "Sex used for thresholds", value: String(metabolic.sex) },
      {
        label: "Waist circumference",
        value: unitValue(metabolic.waist, metabolic.waistUnit),
      },
      {
        label: "Triglycerides",
        value: unitValue(metabolic.triglycerides, metabolic.triglyceridesUnit),
      },
      {
        label: "HDL cholesterol",
        value: unitValue(metabolic.hdl, metabolic.hdlUnit),
      },
      {
        label: "Blood pressure",
        value: `${String(metabolic.systolic)}/${String(metabolic.diastolic)} mmHg`,
      },
      {
        label: "Fasting blood glucose",
        value: unitValue(metabolic.glucose, metabolic.glucoseUnit),
      },
      {
        label: "Triglyceride treatment",
        value: treatment(metabolic.triglyceridesTreatment),
      },
      { label: "HDL treatment", value: treatment(metabolic.hdlTreatment) },
      {
        label: "Blood pressure treatment",
        value: treatment(metabolic.bloodPressureTreatment),
      },
      {
        label: "Previously diagnosed type 2 diabetes",
        value: treatment(metabolic.type2DiabetesDiagnosis),
      },
    );
  }
  if (alcohol.drinksPerWeek !== undefined)
    items.push({
      label: "Alcohol consumption",
      value: `${String(alcohol.drinksPerWeek)} standard drinks/week`,
    });
  if (state.answers.alternate) {
    items.push(
      {
        label: "Potential DILI medications",
        value: alternate.medications?.length
          ? alternate.medications.join(", ")
          : "None selected",
      },
      {
        label: "HBsAg positive",
        value: alternate.hbsagPositive ? "Yes" : "No",
      },
      {
        label: "HCV Ab+ and HCV RNA+",
        value: alternate.hcvPositive ? "Yes" : "No",
      },
      {
        label: "Genetic conditions",
        value: alternate.geneticConditions?.length
          ? alternate.geneticConditions.join(", ")
          : "None selected",
      },
    );
  }
  if (enzymes.alt !== undefined)
    items.push({ label: "ALT", value: `${String(enzymes.alt)} U/L` });
  if (enzymes.ast !== undefined)
    items.push({ label: "AST", value: `${String(enzymes.ast)} U/L` });
  if (diabetes.hasDiabetes)
    items.push({
      label: "Type 2 diabetes",
      value: yesNo(diabetes.hasDiabetes),
    });
  if (fib4.age !== undefined)
    items.push({ label: "Age", value: `${String(fib4.age)} years` });
  if (fib4.platelets !== undefined)
    items.push({
      label: "Platelet count",
      value: `${String(fib4.platelets)} 10^9/L`,
    });
  if (app.albumin !== undefined)
    items.push({ label: "Albumin", value: `${String(app.albumin)} g/dL` });
  if (app.platelets !== undefined)
    items.push({
      label: "Platelet count",
      value: `${String(app.platelets)} K/microL`,
    });
  if (elastography.status === "not-done") {
    items.push({ label: "Elastography", value: "Not done" });
  }
  if (elastography.kpa !== undefined)
    items.push({
      label: "Elastography",
      value: `${String(elastography.kpa)} kPa`,
    });

  return items;
}

export function calculatedItems(state: PathwayState): SectionItem[] {
  const metabolic = answer<{ criteriaCount?: number }>(state, "metabolic");
  const enzymes = answer<{ considerAlternateCause?: boolean }>(
    state,
    "enzymes",
  );
  const fib4 = answer<{ score?: number }>(state, "fib4");
  const app = answer<{ score?: number }>(state, "app");
  const items: SectionItem[] = [];

  if (metabolic.criteriaCount !== undefined) {
    items.push({
      label: "Metabolic syndrome criteria met",
      value: `${metabolic.criteriaCount} of 5`,
    });
  }
  if (enzymes.considerAlternateCause !== undefined) {
    items.push({
      label: "Aminotransferase soft cutoff flag",
      value: enzymes.considerAlternateCause
        ? "Consider alternate cause"
        : "Not flagged",
    });
  }
  if (fib4.score !== undefined)
    items.push({ label: "FIB-4", value: fib4.score.toFixed(2) });
  if (app.score !== undefined)
    items.push({ label: "APP", value: app.score.toFixed(2) });

  return items.length ? items : [{ label: "Calculated values", value: "None" }];
}

const isCalculatedSummaryItem = (item: string) =>
  item.startsWith("Calculated FIB-4:") || item.startsWith("Calculated APP:");

const isRecommendationSummaryItem = (item: string) =>
  /^(FibroScan|Shear wave elastography|MR elastography|Refer|Order|Do not refer|Intensify|Consider|Repeat|Continue|Exit)\b/.test(item);

const isElastographyOptionItem = (item: string) =>
  /^(FibroScan|Shear wave elastography|MR elastography):/.test(item);

const punctuate = (item: string) => (/[.!?]$/.test(item) ? item : `${item}.`);

export function resultItems(state: PathwayState, result: Result) {
  const summaryFacts = result.summary
    .filter((item) => !isCalculatedSummaryItem(item))
    .filter((item) => !isRecommendationSummaryItem(item));
  return [
    ...new Set([
      ...calculatedItems(state).map((item) => `${item.label}: ${item.value}.`),
      ...summaryFacts,
    ]),
  ];
}

export function recommendationItems(result: Result) {
  const actionItems = result.summary
    .filter((item) => !isCalculatedSummaryItem(item))
    .filter(isRecommendationSummaryItem);

  if (actionItems.length) return actionItems;
  if (result.message.includes("Exit this pathway."))
    return ["Exit this pathway."];
  if (
    result.message.includes(
      "Verify the diagnosis case by case and manage accordingly.",
    )
  ) {
    return ["Verify the diagnosis case by case and manage accordingly."];
  }

  return [punctuate(result.title)];
}

export function buildResultSummaryText(state: PathwayState, result: Result) {
  const recommendations = recommendationItems(result).map((item) =>
    isElastographyOptionItem(item) ? `  - ${item}` : `- ${item}`,
  );
  const lines = [
    "MASLD Clinical Care Pathway (development)",
    "",
    "Reported:",
    ...reportedItems(state).map((item) => `${item.label}: ${item.value}`),
    "",
    "Result:",
    ...resultItems(state, result).map((item) => `- ${item}`),
    "",
    "Recommendation:",
    ...recommendations,
  ];

  return lines.join("\n");
}

function Section({ title, items }: { title: string; items: SectionItem[] }) {
  return (
    <Box
      component="section"
      aria-label={title.replace(":", "")}
      sx={{ mt: 2.25 }}
    >
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      <Stack component="dl" spacing={0.75} sx={{ m: 0, mt: 1 }}>
        {items.map((item) => (
          <Box
            key={`${item.label}-${item.value}`}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "minmax(180px, 0.42fr) 1fr",
              },
              gap: { xs: 0.25, sm: 1.5 },
            }}
          >
            <Typography component="dt" variant="body2" color="text.secondary">
              {item.label}
            </Typography>
            <Typography
              component="dd"
              variant="body2"
              sx={{ m: 0, fontWeight: 700 }}
            >
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

function BulletSection({ title, items }: { title: string; items: string[] }) {
  const elastographyOptions = items.filter(isElastographyOptionItem);
  const groupedItems = items.filter((item) => !isElastographyOptionItem(item));

  return (
    <Box
      component="section"
      aria-label={title.replace(":", "")}
      sx={{ mt: 2.25 }}
    >
      <Typography variant="h6" component="h3">
        {title}
      </Typography>
      {items.length > 0 && (
        <Stack component="ul" spacing={0.75} sx={{ mb: 0, pl: 2.5, mt: 1.5 }}>
          {groupedItems.map((item) => (
            <Box component="li" key={item}>
              <Typography variant="body2">{item}</Typography>
              {item === "Refer for elastography." && elastographyOptions.length > 0 && (
                <Stack component="ul" spacing={0.5} sx={{ mt: 0.75, pl: 2.5 }}>
                  {elastographyOptions.map((option) => (
                    <Typography component="li" variant="body2" key={option}>
                      {option}
                    </Typography>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function ResultPanel({
  result,
  state,
}: {
  result: Result;
  state: PathwayState;
}) {
  const displayedResultItems = resultItems(state, result);
  const displayedRecommendationItems = recommendationItems(result);

  return (
    <>
      <Paper variant="outlined" sx={{ bgcolor: "background.default", p: 2.25 }}>
        <Section title="Reported:" items={reportedItems(state)} />
        <BulletSection title="Result:" items={displayedResultItems} />
        <BulletSection
          title="Recommendation:"
          items={displayedRecommendationItems}
        />
      </Paper>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          gap: 1.5,
          mt: 3.25,
        }}
      >
        <Button variant="outlined" type="button" data-action="back">
          Back
        </Button>
        <Button variant="contained" type="button" data-action="copy">
          Copy summary for EMR
        </Button>
      </Box>
    </>
  );
}
