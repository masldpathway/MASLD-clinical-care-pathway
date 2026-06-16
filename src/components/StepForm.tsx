import type { ReactNode } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { config } from "../config";
import type { PathwayState, Step } from "../types";
import { Actions, Check, Input, Select } from "./Fields";

type Props = { state: PathwayState };
type Answers = Record<string, unknown>;

const saved = (state: PathwayState, step: Step) => (state.answers[step] || {}) as Answers;
const text = (value: unknown) => value === undefined ? "" : String(value);

function UnitInput({ id, label, value, unit, options }: {
  id: string;
  label: string;
  value: unknown;
  unit: unknown;
  options: [string, string][];
}) {
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <TextField id={id} name={id} label={label} type="number" slotProps={{ htmlInput: { min: 0, step: "any" } }} required defaultValue={text(value)} fullWidth />
      <FormControl sx={{ flex: "0 0 120px" }}>
        <InputLabel id={`${id}-unit-label`}>Unit</InputLabel>
        <MuiSelect id={`${id}Unit`} name={`${id}Unit`} labelId={`${id}-unit-label`} label="Unit" defaultValue={text(unit) || options[0][0]}>
          {options.map(([optionValue, optionLabel]) =>
            <MenuItem key={optionValue} value={optionValue}>{optionLabel}</MenuItem>)}
        </MuiSelect>
      </FormControl>
    </Box>
  );
}

function Layout({ description, children, actions = <Actions /> }: {
  description: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return <>
    <Typography color="text.secondary" sx={{ mb: 2.75 }}>{description}</Typography>
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25 }}>{children}</Box>
    {actions}
  </>;
}

function CheckSection({ title, children }: { title: string; children: ReactNode }) {
  return <Box sx={{ gridColumn: { sm: "1 / -1" } }}>
    <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{title}</Typography>
    <Stack spacing={1}>{children}</Stack>
  </Box>;
}

function Metabolic({ state }: Props) {
  const answers = saved(state, "metabolic");
  return <Layout
    description={<>MASLD screening continues when at least {config.metabolicSyndrome.requiredCriteria} of 5 criteria are met. Specific treatment or pre-existing qualifying conditions count for the associated criterion.</>}
    actions={<Actions back={false} />}
  >
    <Select id="sex" name="sex" label="Sex used for pathway thresholds" required defaultValue={text(answers.sex)}
      options={[["male", "Male"], ["female", "Female"]]} />
    <UnitInput id="waist" label="Waist circumference" value={answers.waist} unit={answers.waistUnit}
      options={[["cm", "cm"], ["in", "inches"]]} />
    <UnitInput id="triglycerides" label="Triglycerides" value={answers.triglycerides} unit={answers.triglyceridesUnit}
      options={[["mmol", "mmol/L"], ["mgdl", "mg/dL"]]} />
    <UnitInput id="hdl" label="HDL cholesterol" value={answers.hdl} unit={answers.hdlUnit}
      options={[["mmol", "mmol/L"], ["mgdl", "mg/dL"]]} />
    <Input id="systolic" name="systolic" label="Systolic blood pressure (mmHg)" type="number" min="0" step="any" required defaultValue={text(answers.systolic)} />
    <Input id="diastolic" name="diastolic" label="Diastolic blood pressure (mmHg)" type="number" min="0" step="any" required defaultValue={text(answers.diastolic)} />
    <UnitInput id="glucose" label="Fasting blood glucose" value={answers.glucose} unit={answers.glucoseUnit}
      options={[["mmol", "mmol/L"], ["mgdl", "mg/dL"]]} />
    <CheckSection title="Treatment or pre-existing qualifying conditions">
      <Check id="triglyceridesTreatment" name="triglyceridesTreatment" centerLabel label="Specific treatment for elevated triglycerides" defaultChecked={Boolean(answers.triglyceridesTreatment)} />
      <Check id="hdlTreatment" name="hdlTreatment" centerLabel label="Specific treatment for low HDL cholesterol" defaultChecked={Boolean(answers.hdlTreatment)} />
      <Check id="bloodPressureTreatment" name="bloodPressureTreatment" centerLabel label="Treatment for elevated blood pressure" defaultChecked={Boolean(answers.bloodPressureTreatment)} />
      <Check id="type2DiabetesDiagnosis" name="type2DiabetesDiagnosis" centerLabel label="Previously diagnosed type 2 diabetes" defaultChecked={Boolean(answers.type2DiabetesDiagnosis)} />
    </CheckSection>
  </Layout>;
}

function Alcohol({ state }: Props) {
  const answers = saved(state, "alcohol");
  return <Layout description={<>Enter the average number of standard drinks consumed each week. The development configuration uses a {config.alcohol.standardDrinkGrams} g standard drink.</>}>
    <Input id="drinksPerWeek" name="drinksPerWeek" label="Standard drinks per week" type="number" min="0" step="any" required defaultValue={text(answers.drinksPerWeek)} />
  </Layout>;
}

function Alternate({ state }: Props) {
  const answers = saved(state, "alternate");
  const medications = (answers.medications || []) as string[];
  const conditions = (answers.geneticConditions || []) as string[];
  return <Layout description="Select known alternate diagnoses or possible causes. Any positive result exits this MASLD pathway.">
    <CheckSection title="Potential drug-induced liver injury medications">
      {config.alternateDiagnoses.diliMedications.map((medication, index) =>
        <Check key={medication} id={`dili-${index}`} name={`dili-${index}`} centerLabel label={medication} defaultChecked={medications.includes(medication)} />)}
    </CheckSection>
    <CheckSection title="Viral hepatitis">
      <Check id="hbsagPositive" name="hbsagPositive" centerLabel label="HBsAg+" defaultChecked={Boolean(answers.hbsagPositive)} />
      <Check id="hcvPositive" name="hcvPositive" centerLabel label="HCV Ab+ and HCV RNA+" defaultChecked={Boolean(answers.hcvPositive)} />
    </CheckSection>
    <CheckSection title="Genetic conditions">
      {config.alternateDiagnoses.geneticConditions.length
        ? config.alternateDiagnoses.geneticConditions.map((condition, index) =>
          <Check key={condition} id={`genetic-${index}`} name={`genetic-${index}`} centerLabel label={condition} defaultChecked={conditions.includes(condition)} />)
        : <Typography variant="caption" color="text.secondary">No genetic conditions are configured in this prototype.</Typography>}
    </CheckSection>
  </Layout>;
}

function Enzymes({ state }: Props) {
  const answers = saved(state, "enzymes");
  return <Layout description={<>ALT or AST at or above {config.aminotransferases.thresholdUL} U/L is a soft cutoff to consider an alternate cause, but it does not exclude the patient from this pathway.</>}>
    <Input id="alt" name="alt" label="ALT (U/L)" type="number" min="0" step="any" required defaultValue={text(answers.alt)} />
    <Input id="ast" name="ast" label="AST (U/L)" type="number" min="0" step="any" required defaultValue={text(answers.ast)} />
  </Layout>;
}

function Diabetes({ state }: Props) {
  const answers = saved(state, "diabetes");
  return <Layout description="Type 2 diabetes determines the next risk stratification tool.">
    <Select id="hasDiabetes" name="hasDiabetes" label="Does the patient have type 2 diabetes?" required defaultValue={text(answers.hasDiabetes)}
      options={[["yes", "Yes"], ["no", "No"]]} />
  </Layout>;
}

function Fib4({ state }: Props) {
  const answers = saved(state, "fib4");
  const enzymes = saved(state, "enzymes");
  return <Layout description="FIB-4 = (age x AST) / (platelet count x square root of ALT)." actions={<Actions nextLabel="Calculate FIB-4" />}>
    <Input id="age" name="age" label="Age (years)" type="number" min="0" step="any" required defaultValue={text(answers.age)} />
    <Input id="platelets" name="platelets" label="Platelet count (10^9/L)" type="number" min="0" step="any" required defaultValue={text(answers.platelets)} />
    <Input id="alt" name="alt" label="ALT (U/L)" type="number" min="0" step="any" required defaultValue={text(enzymes.alt)} />
    <Input id="ast" name="ast" label="AST (U/L)" type="number" min="0" step="any" required defaultValue={text(enzymes.ast)} />
  </Layout>;
}

function AppScore({ state }: Props) {
  const answers = saved(state, "app");
  return <Layout description="APP = albumin (g/dL) x platelet count (K/microL) / 1000." actions={<Actions nextLabel="Calculate APP" />}>
    <Input id="albumin" name="albumin" label="Albumin (g/dL)" type="number" min="0" step="any" required defaultValue={text(answers.albumin)} />
    <Input id="platelets" name="platelets" label="Platelet count (K/microL)" type="number" min="0" step="any" required defaultValue={text(answers.platelets)} />
  </Layout>;
}

function Elastography({ state }: Props) {
  const answers = saved(state, "elastography");
  return <Layout description="Enter the FibroScan, shear-wave elastography, or other elastography result." actions={<Actions nextLabel="View recommendation" />}>
    <Input id="kpa" name="kpa" label="Liver stiffness (kPa)" type="number" min="0" step="any" required defaultValue={text(answers.kpa)} />
  </Layout>;
}

export const stepForms: Record<Exclude<Step, "result">, (props: Props) => ReactNode> = {
  metabolic: Metabolic,
  alcohol: Alcohol,
  alternate: Alternate,
  enzymes: Enzymes,
  diabetes: Diabetes,
  fib4: Fib4,
  app: AppScore,
  elastography: Elastography,
};
