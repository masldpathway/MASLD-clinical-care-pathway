# MASLD-clinical-care-pathway
Knowledge translation project for easing the use of the MASLD clinical care pathway

## Run the app

Install dependencies and start the Vite development server:

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Usage analytics (optional)

The public tracking address `https://masldpathway.goatcounter.com/count` is
configured in `.env` and in the GitHub Pages build workflow. It is not a secret.
For local overrides, set `VITE_GOATCOUNTER_ENDPOINT` in `.env.local` and restart
Vite. Set it to an empty string to disable analytics locally. For deployment,
the GitHub Actions repository variable `VITE_GOATCOUNTER_ENDPOINT` can override
the configured address. Without a valid endpoint, no analytics script loads
and no events are sent.
GoatCounter filters localhost traffic by default; verify live counts on the
deployed site using the dashboard's total event counts.

Events: `site-entry`, `pathway-started`, `results-displayed`,
`assessment-completed`, `assessment-completed-app`, `assessment-completed-fib4`,
`pathway-excluded`, `pathway-resumed`, and
`values-unavailable-enzymes`, `values-unavailable-fib4`,
`values-unavailable-app`, `values-unavailable-elastography`.

Each results display sends `results-displayed` plus one outcome event. Completed
assessments also send `assessment-completed-app` or `assessment-completed-fib4`
based on the scoring route, including when followed by elastography. These are
subsets of `assessment-completed`, so do not add them to the total. The breakdown
starts when this change is deployed; historical events cannot be split retroactively.
Completion
includes recommendations reached before elastography when the pathway ends there.
Unavailable elastography is counted as unavailable values. Starting over permits
a new `pathway-started`; returning via a resume link counts as `pathway-resumed`.
Repeated result displays count again; React rerenders do not. These are event
totals, not unique patients or linked individual journeys. Closing a tab does not
record a confirmed exit. Blockers and network failures may reduce counts.

Only fixed event names are supplied by the app, with an empty referrer; patient
inputs, scores, result text, query strings, and resume fragments are excluded.
GoatCounter receives ordinary network request metadata; see its
[privacy documentation](https://www.goatcounter.com/help/privacy).

## Run the tests

Run the typed pathway-engine tests with Vitest:

```sh
npm test
```

## Configure clinical assumptions

All development assumptions are grouped in `src/config.ts`. Review and
validate these thresholds before using the application for patient care.

The implemented logical branches are documented in
[`docs/pathway-logic.md`](docs/pathway-logic.md).

## Deploy

The GitHub Actions workflow in `.github/workflows/deploy-pages.yml` tests,
builds, and deploys the app to GitHub Pages after changes are pushed to `main`.

Before the first deployment, enable the workflow as the repository's Pages
source:

1. Open the GitHub repository's **Settings** tab.
2. Select **Pages** under **Code and automation**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Run **Deploy to GitHub Pages** from the repository's **Actions** tab if the
   initial push occurred before Pages was enabled.
