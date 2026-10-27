import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { theme } from "./theme";
import "../styles.css";
import { initializeAnalytics } from "./analytics";

initializeAnalytics((import.meta as ImportMeta & { env: Record<string, string | undefined> }).env.VITE_GOATCOUNTER_ENDPOINT);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
