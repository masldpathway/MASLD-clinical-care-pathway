import { useState, type FormEvent, type MouseEvent } from "react";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { buildResultSummaryHtml, buildResultSummaryText, ResultPanel } from "./components/ResultPanel";
import { stepForms } from "./components/StepForm";
import { copyText } from "./clipboard";
import { buildResumeUrl, readResumeState } from "./resume";
import { submitStep } from "./pathway";
import type { PathwayState, Step } from "./types";

const initialState: PathwayState = {
  currentStep: "metabolic",
  history: [],
  answers: {},
};
const titles: Record<Step, string> = {
  metabolic: "Assess metabolic syndrome",
  alternate: "Exclude alternate diagnoses",
  enzymes: "Review aminotransferases",
  diabetes: "Check for type 2 diabetes",
  fib4: "Calculate FIB-4",
  app: "Calculate APP",
  elastography: "Enter noninvasive fibrosis staging",
  result: "Pathway recommendation",
};
const order: Step[] = [
  "metabolic",
  "alternate",
  "diabetes",
  "enzymes",
  "fib4",
  "app",
  "elastography",
  "result",
];

function pruneAnswersAfterBack(state: PathwayState, previous: Step) {
  const previousIndex = order.indexOf(previous);
  const pruned = { ...state.answers };

  for (const step of order.slice(previousIndex + 1)) {
    delete pruned[step];
  }

  return pruned;
}

export default function App() {
  const [state, setState] = useState<PathwayState>(() => readResumeState(window.location.hash) ?? initialState);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [resetCount, setResetCount] = useState(0);
  const index =
    state.currentStep === "result"
      ? order.length
      : Math.max(1, order.indexOf(state.currentStep) + 1);
  const CurrentForm =
    state.currentStep === "result" ? undefined : stepForms[state.currentStep];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCopyStatus("idle");
    setState(
      submitStep(state, Object.fromEntries(new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter))),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function click(event: MouseEvent<HTMLFormElement>) {
    const action = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-action]",
    )?.dataset.action;
    if (action === "resume") {
      event.preventDefault();
      const url = buildResumeUrl(state);
      const restored = url && readResumeState(new URL(url).hash);
      if (restored) {
        window.history.replaceState(null, "", url);
        setState(restored);
        setCopyStatus("idle");
        setResetCount((count) => count + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
    if (action === "back") {
      const previous = state.history.at(-1);
      if (previous)
        setState({
          ...state,
          currentStep: previous,
          history: state.history.slice(0, -1),
          result: undefined,
          answers: pruneAnswersAfterBack(state, previous),
        });
    }
  }

  async function copySummary() {
    if (!state.result || copyStatus === "copying") return;
    setCopyStatus("copying");
    try {
      await copyText(buildResultSummaryText(state, state.result), buildResultSummaryHtml(state, state.result));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <>
      <AppBar
        position="static"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        <Toolbar sx={{ width: "100%", maxWidth: 952, mx: "auto", gap: 1.5 }}>
          <Avatar
            variant="rounded"
            sx={{ bgcolor: "primary.main", fontWeight: 800 }}
          >
            M
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>
              MASLD Clinical Care Pathway
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Development prototype
            </Typography>
          </Box>
          <Chip
            label="Anonymous session"
            size="small"
            sx={{
              bgcolor: "primary.light",
              color: "primary.dark",
              fontWeight: 700,
              display: { xs: "none", sm: "flex" },
            }}
          />
        </Toolbar>
      </AppBar>
      <Container component="main" maxWidth="md" sx={{ py: { xs: 3.5, sm: 6 } }}>
        <Box component="section" aria-labelledby="page-title" sx={{ mb: 3.5 }}>
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 800, letterSpacing: "0.09em" }}
          >
            Primary care decision support
          </Typography>
          <Typography
            variant="h1"
            component="h1"
            id="page-title"
            sx={{ mb: 1 }}
          >
            MASLD Clinical Care Pathway
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 740, mb: 2 }}>
            Answer one set of questions at a time. This tool follows the pathway
            from suspected steatosis through screening, elastography, and
            referral.
          </Typography>
          <Alert severity="warning">
            <strong>App under development.</strong> Use clinical judgment when
            applying pathway recommendations.
          </Alert>
        </Box>
        <Paper
          component="section"
          aria-live="polite"
          elevation={5}
          sx={{ overflow: "hidden", borderRadius: 3 }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2.5,
              px: { xs: 2.25, sm: 3.25 },
              py: 2.5,
            }}
          >
            <Box>
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 800, letterSpacing: "0.09em" }}
              >
                {state.currentStep === "result"
                  ? "Complete"
                  : `Step ${index} of ${order.length - 1}`}
              </Typography>
              <Typography variant="h2" component="h2">
                {titles[state.currentStep]}
              </Typography>
            </Box>
            <Button
              variant="text"
              onClick={() => {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
                setState(initialState);
                setCopyStatus("idle");
                setResetCount((count) => count + 1);
              }}
            >
              Start over
            </Button>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(index / order.length) * 100}
          />
          <Box
            component="form"
            id="pathway-form"
            key={`${state.currentStep}-${resetCount}`}
            onSubmit={submit}
            onClick={click}
            sx={{ p: { xs: 2.25, sm: 3.25 } }}
          >
            {state.result ? (
              <ResultPanel result={state.result} state={state} onCopy={copySummary} copyStatus={copyStatus} />
            ) : (
              CurrentForm && <CurrentForm state={state} />
            )}
            {copyStatus === "error" && <Alert severity="error" sx={{ mt: 2 }}>
              Unable to copy. Check your browser's clipboard permissions and try again.
            </Alert>}
            {copyStatus === "copied" && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Copied to clipboard
              </Alert>
            )}
          </Box>
        </Paper>
        <Typography
          component="footer"
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center", display: "block", mt: 2.5 }}
        >
          No data is saved or sent to a server.
        </Typography>
      </Container>
    </>
  );
}
