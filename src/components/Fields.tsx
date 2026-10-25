import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select as MuiSelect,
  TextField,
} from "@mui/material";
import type {
  CheckboxProps,
  SelectProps as MuiSelectProps,
  TextFieldProps,
} from "@mui/material";

type InputProps = TextFieldProps & {
  label: string;
  hint?: string;
  min?: string | number;
  step?: string | number;
};

export function Input({ label, hint, min, step, ...props }: InputProps) {
  return <TextField {...props} label={label} helperText={hint} slotProps={{ htmlInput: { min, step } }} fullWidth />;
}

type SelectProps = Omit<MuiSelectProps<string>, "label"> & {
  id: string;
  label: string;
  options: [string, string][];
};

export function Select({ id, label, options, ...props }: SelectProps) {
  return (
    <FormControl fullWidth required={props.required}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <MuiSelect {...props} id={id} labelId={`${id}-label`} label={label}>
        <MenuItem value=""><em>Select an option</em></MenuItem>
        {options.map(([value, text]) => <MenuItem key={value} value={value}>{text}</MenuItem>)}
      </MuiSelect>
    </FormControl>
  );
}

type CheckProps = CheckboxProps & {
  label: string;
  centerLabel?: boolean;
};

export function Check({ label, centerLabel = false, ...props }: CheckProps) {
  return (
    <FormControlLabel
      control={<Checkbox {...props} />}
      label={label}
      sx={{
        alignItems: centerLabel ? "center" : "flex-start",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.default",
        m: 0,
        px: 1,
        py: 0.25,
        "& .MuiCheckbox-root": { pt: centerLabel ? 1 : 0.75 },
      }}
    />
  );
}

export function Actions({ back = true, nextLabel = "Continue", missingValues = false }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mt: 3.25 }}>
      {back && <Button variant="outlined" type="button" data-action="back">Back</Button>}
      {missingValues && <Button variant="outlined" type="submit" name="missingValues" value="yes" formNoValidate>
        I don't have the required values
      </Button>}
      <Button variant="contained" type="submit" sx={{ ml: "auto" }}>{nextLabel}</Button>
    </Box>
  );
}
