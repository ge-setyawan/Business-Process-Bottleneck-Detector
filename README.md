# Business Process Bottleneck Detector

> **"Don't just find what's slow. Find what needs fixing."**
>
> IBM Hackathon Prototype

---

## Overview

Small businesses frequently struggle to identify which operational process deserves attention most. Raw data — spreadsheets, order logs, manual records — rarely surfaces the answer directly. Operational bottlenecks are often hidden behind averages, masked by workload spikes, or confused with processes that are slow but fundamentally stable.

This prototype provides a structured, AI-assisted path from raw process metrics to a clear, prioritized recommendation — without requiring data science expertise, a deployed backend, or paid infrastructure.

---

## Problem

The instinctive approach to process improvement is to target the slowest step. This is often wrong.

A process can have the longest average processing time and still be the *least* actionable bottleneck — because it is externally constrained, stable under varying volumes, or not meaningfully within the team's control. Intervening there first wastes time and investment.

The productive question is not *"which step takes the longest?"* but *"which step is generating the most friction, is sensitive to demand fluctuations, and is actually within the team's power to improve?"*

---

## Solution

**Business Process Bottleneck Detector** analyzes a set of process metrics per activity and synthesizes them into a **Bottleneck Score** that reflects operational urgency and actionability — not just duration.

The highest-scoring process is surfaced as the **Priority Bottleneck**, supported by evidence metrics, possible causes, and concrete recommendations. An AI analysis from Langflow + Gemini provides additional reasoning over the full dataset.

### Core workflow

```
Detect → Diagnose → Prioritize → Recommend
```

---

## How It Works

1. **Upload** — The user uploads a CSV file containing process metrics for each activity in their workflow (or runs the built-in sample).
2. **Parse** — The frontend parses and validates the CSV entirely in the browser. No data leaves the machine before analysis.
3. **Score** — JavaScript computes a Bottleneck Score for each process and ranks them.
4. **Send to Langflow** — All process metrics are serialized as JSON and sent to a locally running Langflow instance via REST API.
5. **Prompt Template** — The Langflow flow applies a structured Prompt Template that provides the analysis rules and context to the language model.
6. **Gemini analyzes** — Gemini 3.5 Flash Lite receives the metrics and reasoning rules, then generates a natural-language analysis of the bottleneck findings.
7. **Display** — The frontend renders both the local metric-based results and the Langflow + Gemini AI analysis in a single unified view.

---

## Core Analysis Metrics

| Metric | Description |
|---|---|
| **Bottleneck Score** | Composite score (0–100) reflecting overall operational urgency and actionability |
| **Avg Processing Time** | Mean time to complete the activity (minutes) |
| **Avg Waiting Time** | Mean time an item waits before the activity begins (minutes) |
| **Delay / Rework Rate** | Proportion of process instances affected by delays or rework |
| **Rework Rate** | Proportion of instances requiring rework specifically |
| **Volume–Time Correlation** | Statistical association between transaction volume and processing time |
| **Controllability** | Estimated degree to which the team can directly influence this process (0–1) |

> **Note on correlation:** Volume–time correlation is used as evidence of volume sensitivity — an indicator that a process degrades under load. It does not establish a causal relationship. Root-cause conclusions require additional operational investigation.

---

## Key Differentiation

This system does **not** automatically select the longest process as the priority bottleneck.

The Bottleneck Score incorporates:

- **Operational friction** — rework and delay rates signal recurring process failures
- **Volume sensitivity** — a high correlation between volume and processing time indicates a process that degrades under demand
- **Controllability** — a process that is slow but externally constrained ranks lower than one the team can directly improve
- **Waiting time** — queue and handoff delays, separate from active processing time

A long-but-stable, low-controllability process will consistently rank below a shorter process with high rework, volume sensitivity, and full internal controllability.

---

## MVP Dataset

The prototype ships with a synthetic dataset representing an online retail / UMKM order fulfillment workflow:

```
Order Received → Verification → Payment → Picking → Packing → Shipping
```

- **150 orders**, approximately **900 process events** across a **30-day period**
- File: `flowlens_metrics_v1.csv`

**Intentional design choices in the synthetic data:**

- **Packing** is modeled with increasing operational friction under higher order volumes — rework rate, delay rate, and volume–time correlation all rise as volume increases.
- **Shipping** is modeled as a long but relatively stable process with low controllability, reflecting realistic last-mile logistics constraints.

> ⚠️ This is **synthetic test data**, generated to demonstrate the scoring system's ability to distinguish between a long stable process and a shorter but operationally troubled one. It does not represent any real business.

---

## Example Result

Running the MVP dataset produces the following priority result:

| Process | Bottleneck Score | Avg Processing Time | Controllability |
|---|---|---|---|
| **Packing** *(Priority)* | **~75.04** | 29.07 min | 1.0 |
| Shipping *(Runner-up)* | ~54.89 | 1,438.79 min | 0.2 |

**Shipping has a dramatically longer processing time but a lower bottleneck score** because its volume sensitivity and controllability are significantly lower. Packing — despite being faster in absolute terms — accumulates more rework, higher volume sensitivity, and full controllability, making it the more actionable process to address.

> This result reflects the synthetic dataset's intentional design. It does not establish a causal relationship between any metric and real business outcomes.

---

## Technology

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript (ES6+, no frameworks) |
| AI pipeline | Langflow (local) + Gemini 3.5 Flash Lite |
| Data format | CSV |
| Hosting | Static file — no server required |

The prototype runs entirely locally. It does not require a deployed backend, a database, paid hosting, or a paid API.

---

## Project Structure

```
index.html             — Application shell and UI markup
styles.css             — All styling (responsive, no external dependencies)
script.js              — CSV parsing, analysis logic, Langflow integration, UI rendering
flowlens_metrics_v1.csv — MVP synthetic dataset (150 orders, 6 activities)
config.example.js      — Safe template for local API key configuration (committed)
config.local.js        — Your local Langflow API key (NOT committed — see .gitignore)
.gitignore             — Excludes config.local.js from Git
README.md              — This file
```

> **Important:** `config.local.js` contains your personal Langflow API key and is intentionally excluded from this repository via `.gitignore`. It must never be committed. Use `config.example.js` as the template.

---

## Local Setup

### Prerequisites

- [Langflow](https://github.com/langflow-ai/langflow) running locally (default: `http://127.0.0.1:7860`)
- The **Bottleneck Analyzer** Langflow flow imported and active
- A modern web browser (Chrome, Firefox, Edge, Safari)

### Steps

1. Start your local Langflow instance.
2. Open Langflow and import (or confirm active) the Bottleneck Analyzer flow.
3. Copy `config.example.js` to `config.local.js`:
   ```
   cp config.example.js config.local.js
   ```
4. Open `config.local.js` and replace `YOUR_LANGFLOW_API_KEY_HERE` with your actual Langflow API key.
5. Open `index.html` directly in your browser (no build step or server required).
6. Upload `flowlens_metrics_v1.csv` using the file input, or proceed without a file to use the built-in sample.
7. Click **Analyze Process**.

> Do **not** commit `config.local.js`. It is listed in `.gitignore` for this reason.

---

## Limitations

- **Synthetic dataset.** All results demonstrated in this prototype are based on generated data and do not reflect any real business operation.
- **No financial or customer metrics.** The dataset does not include cost, revenue, or customer-impact data. Business impact cannot be quantified from the current inputs.
- **Correlation is not causation.** Volume–time correlation is used as a signal, not as proof of a causal mechanism. Root-cause conclusions require additional operational data and direct investigation.
- **Hypotheses are unverified.** Possible causes displayed in the UI are clearly labeled as hypotheses. They are derived from metric patterns, not from root-cause analysis.
- **Local Langflow required.** The current prototype calls a locally running Langflow instance. It does not include a deployed or cloud-hosted AI backend. If Langflow is unavailable, the local metric-based analysis is shown as a fallback.

---

## Demo Flow

1. Open `index.html` in a browser.
2. Upload `flowlens_metrics_v1.csv`.
3. Click **Analyze Process**.
4. Observe **Packing** identified as the Priority Bottleneck (score ~75.04), ranked above Shipping despite Shipping's much longer processing time.
5. Scroll to the **AI Analysis** section — the badge reads **"AI Analysis: Langflow + Gemini"** and displays Gemini's reasoning over the full set of process metrics.

---

## Future Improvements

- **Real business event logs** — replace synthetic data with actual process mining inputs (XES, ERP exports)
- **Resource and staffing data** — incorporate capacity constraints and shift patterns into the scoring model
- **Financial impact estimation** — connect cost-per-minute and throughput data to quantify bottleneck cost
- **Historical trend analysis** — track bottleneck score changes over time to measure intervention effectiveness
- **Process mining integration** — automated discovery of process flows from event logs
- **Secure deployed backend** — move the Langflow API call server-side to protect credentials and support multi-user access

---

## Disclaimer

This prototype uses synthetic data for demonstration purposes. All hypotheses displayed in the application are clearly labeled as unverified. No financial losses, customer impact figures, or causal relationships are claimed or implied.

---

*IBM Hackathon — Business Process Bottleneck Detector*
