/**
 * Business Process Bottleneck Detector
 * script.js — Prototype frontend logic
 *
 * Architecture note:
 * ------------------
 * `analyzeProcess(data)` is the single integration point for the analysis
 * engine. In this prototype it runs locally. In the production version it
 * will be replaced with a call to the Langflow + Gemini reasoning pipeline
 * without changing any other part of this file.
 *
 * See the FUTURE LANGFLOW INTEGRATION comment inside analyzeProcess() below.
 */

"use strict";

/* ─── EXPECTED CSV COLUMNS ───────────────────────────────────────────── */
const REQUIRED_COLUMNS = [
  "activity",
  "avg_processing_min",
  "avg_waiting_min",
  "delay_rework_rate",
  "rework_rate",
  "volume_time_corr",
  "controllability",
  "bottleneck_score",
];

/* ─── STATE ───────────────────────────────────────────────────────────── */
// Holds parsed CSV data once a valid file is loaded; null means use sample.
let uploadedData = null;

/* ─── DOM REFERENCES ─────────────────────────────────────────────────── */
const csvFileInput    = document.getElementById("csvFile");
const fileNameDisplay = document.getElementById("fileNameDisplay");
const analyzeBtn      = document.getElementById("analyzeBtn");
const inputNote       = document.getElementById("inputNote");
const emptyState      = document.getElementById("emptyState");
const loadingState    = document.getElementById("loadingState");
const analysisOutput  = document.getElementById("analysisOutput");
const errorState      = document.getElementById("errorState");
const errorMessage    = document.getElementById("errorMessage");

/* ─── FILE SELECTION ─────────────────────────────────────────────────── */
csvFileInput.addEventListener("change", () => {
  const file = csvFileInput.files[0];
  if (!file) {
    fileNameDisplay.textContent = "Choose CSV file…";
    uploadedData = null;
    setInputNote(false);
    return;
  }

  fileNameDisplay.textContent = file.name;
  hideError();

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      uploadedData = parseCSV(e.target.result);
      setInputNote(true, file.name);
    } catch (err) {
      uploadedData = null;
      showError(err.message);
      fileNameDisplay.textContent = file.name + " — invalid";
      setInputNote(false);
    }
  };
  reader.onerror = () => {
    uploadedData = null;
    showError("Could not read the file. Please try again.");
    setInputNote(false);
  };
  reader.readAsText(file);
});

/* ─── INPUT NOTE HELPER ──────────────────────────────────────────────── */
function setInputNote(usingFile, fileName) {
  if (usingFile) {
    inputNote.textContent =
      "Ready to analyze uploaded file: " + fileName;
    inputNote.classList.add("input-note-ready");
  } else {
    inputNote.textContent =
      "Demo mode: the prototype uses built-in sample data to demonstrate analysis.";
    inputNote.classList.remove("input-note-ready");
  }
}

/* ─── MAIN ENTRY POINT ───────────────────────────────────────────────── */
async function handleAnalyze() {
  hideError();
  showLoading();

  // Use uploaded data if available, otherwise fall back to sample data.
  const data = uploadedData !== null ? uploadedData : getSampleData();

  try {
    const result = await analyzeProcess(data);
    renderResult(result);
  } catch (err) {
    showLoadError(err.message);
  }
}

/* ─── CSV PARSER ─────────────────────────────────────────────────────── */
/**
 * Parses a CSV string into the internal data format.
 * Throws a descriptive Error if the file is malformed or missing columns.
 *
 * @param {string} text - Raw CSV file contents.
 * @returns {{ processes: ProcessRow[] }}
 */
function parseCSV(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");

  if (lines.length < 2) {
    throw new Error(
      "The CSV file must contain a header row and at least one data row."
    );
  }

  // Parse header — trim whitespace, strip BOM, normalise to lowercase
  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^\uFEFF/, "").toLowerCase());

  // Validate required columns
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
  if (missing.length > 0) {
    throw new Error(
      "Missing required column(s): " +
        missing.join(", ") +
        ". Expected: " +
        REQUIRED_COLUMNS.join(", ") +
        "."
    );
  }

  // Parse data rows
  const processes = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    if (values.length !== headers.length) continue; // skip malformed rows

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx].trim();
    });

    const score = parseFloat(row["bottleneck_score"]);
    if (isNaN(score)) continue; // skip rows without a valid score

    const toNum = (key) => {
      const v = parseFloat(row[key]);
      return isNaN(v) ? null : v;
    };

    processes.push({
      name:                  row["activity"] || "Unknown",
      bottleneckScore:       score,
      avgProcessingTime:     toNum("avg_processing_min"),
      avgWaitingTime:        toNum("avg_waiting_min"),
      delayReworkRate:       toNum("delay_rework_rate"),
      reworkRate:            toNum("rework_rate"),
      volumeTimeCorrelation: toNum("volume_time_corr"),
      controllability:       toNum("controllability"),
    });
  }

  if (processes.length === 0) {
    throw new Error(
      "No valid data rows found. Please check that numeric columns contain numbers and that bottleneck_score is present."
    );
  }

  return { processes };
}

/**
 * Splits a single CSV line respecting double-quoted fields.
 */
function splitCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/* ─── SAMPLE DATA ────────────────────────────────────────────────────── */
/**
 * Built-in sample process metrics used when no file is uploaded.
 * Mirrors the structure produced by parseCSV() so the rest of the
 * code path is identical whether data comes from a file or from here.
 */
function getSampleData() {
  return {
    processes: [
      {
        name:                  "Packing",
        bottleneckScore:       75.0413,
        avgProcessingTime:     29.0733,
        avgWaitingTime:        15.06,
        delayReworkRate:       0.213333,
        reworkRate:            0.10,
        volumeTimeCorrelation: 0.732066,
        controllability:       1.0,
      },
      {
        name:                  "Shipping",
        bottleneckScore:       54.8905,
        avgProcessingTime:     1438.79,
        avgWaitingTime:        null,
        delayReworkRate:       null,
        reworkRate:            null,
        volumeTimeCorrelation: null,
        controllability:       0.2,
      },
      {
        name:                  "Quality Check",
        bottleneckScore:       38.2100,
        avgProcessingTime:     18.50,
        avgWaitingTime:        5.20,
        delayReworkRate:       0.08,
        reworkRate:            0.03,
        volumeTimeCorrelation: 0.45,
        controllability:       0.8,
      },
    ],
  };
}

/* ─── ANALYSIS ENGINE ────────────────────────────────────────────────────
 *
 * This function is the single integration point for the analysis engine.
 *
 * FUTURE LANGFLOW INTEGRATION:
 * Send the prepared process metrics to the Langflow workflow
 * and use the AI response as the final diagnosis and recommendations.
 *
 * To wire up the Langflow + Gemini pipeline, replace the entire body of
 * this function with a fetch() call, for example:
 *
 *   async function analyzeProcess(data) {
 *     const response = await fetch("https://your-langflow-endpoint/api/v1/run", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify({ input_value: JSON.stringify(data) })
 *     });
 *     if (!response.ok) throw new Error("Langflow API error: " + response.status);
 *     return await response.json();
 *   }
 *
 * renderResult() and all UI code below remain unchanged.
 * ─────────────────────────────────────────────────────────────────────── */
/* ─── LANGFLOW CONFIG ────────────────────────────────────────────────── */
const LANGFLOW_ENDPOINT =
  "http://127.0.0.1:7860/api/v1/run/937171c0-42ed-4bf0-9e93-32746afd2dc8";
// API key is loaded from config.local.js (gitignored). See config.example.js.
const LANGFLOW_API_KEY = window.LANGFLOW_API_KEY || "";

async function analyzeProcess(data) {
  // Sort all processes by bottleneck score descending.
  const sorted = [...data.processes].sort(
    (a, b) => b.bottleneckScore - a.bottleneckScore
  );

  const priority = sorted[0];
  const runnerUp = sorted[1] || null;

  // Build the structured metrics payload that will be sent to Langflow.
  // All processes are included with their full metrics so Langflow has
  // the complete picture, not just the priority bottleneck.
  const metricsPayload = {
    processes: sorted.map((p) => ({
      activity:                p.name,
      avg_processing_min:      p.avgProcessingTime,
      avg_waiting_min:         p.avgWaitingTime,
      delay_rework_rate:       p.delayReworkRate,
      rework_rate:             p.reworkRate,
      volume_time_correlation: p.volumeTimeCorrelation,
      controllability:         p.controllability,
      bottleneck_score:        p.bottleneckScore,
    })),
  };

  // Call the Langflow API.  Falls back gracefully if unreachable.
  let langflowText  = null;
  let langflowError = null;

  try {
    const response = await fetch(LANGFLOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":    LANGFLOW_API_KEY,
      },
      body: JSON.stringify({
        output_type: "chat",
        input_type:  "chat",
        input_value: JSON.stringify(metricsPayload),
        session_id:  crypto.randomUUID(),
      }),
    });

    if (!response.ok) {
      langflowError = "Langflow returned HTTP " + response.status + " " + response.statusText;
    } else {
      const json = await response.json();
      // Langflow wraps output inside outputs[0].outputs[0].results.message.text
      langflowText =
        json?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ||
        json?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message ||
        json?.outputs?.[0]?.outputs?.[0]?.artifacts?.message ||
        null;
      if (!langflowText) {
        langflowError = "Langflow responded but the analysis text could not be extracted.";
      }
    }
  } catch (err) {
    langflowError = "Langflow could not be reached (" + err.message + "). Showing local analysis only.";
  }

  return {
    priority,
    runnerUp,
    allProcesses: sorted,
    usingSampleData: data === getSampleData(),
    langflowText,
    langflowError,
  };
}

/* ─── RENDER RESULT ──────────────────────────────────────────────────── */
/**
 * Populates every section of analysisOutput with data from the result object
 * and makes the section visible.
 */
function renderResult(result) {
  const p  = result.priority;
  const ru = result.runnerUp;

  /* --- Priority Bottleneck hero --- */
  setText("r-process-name",  p.name.toUpperCase());
  setText("r-score-value",   fmt(p.bottleneckScore, 2));
  setAttr("r-score-bar-fill", "style", "width:" + Math.min(p.bottleneckScore, 100).toFixed(2) + "%");
  setAttr("r-score-bar-wrap", "aria-label",
    "Bottleneck score " + fmt(p.bottleneckScore, 0) + " out of 100");

  /* --- Bottleneck insight sentence --- */
  setText("r-bottleneck-insight", buildInsight(p));

  /* --- Evidence metrics --- */
  setText("r-processing",    fmtMetric(p.avgProcessingTime, "min"));
  setText("r-waiting",       fmtMetric(p.avgWaitingTime,    "min"));
  setText("r-delay-rework",  fmtPct(p.delayReworkRate));
  setText("r-rework",        fmtPct(p.reworkRate));
  setText("r-vol-corr",      p.volumeTimeCorrelation !== null
                               ? fmt(p.volumeTimeCorrelation, 2) : "—");
  setText("r-controllability", p.controllability !== null
                               ? fmt(p.controllability, 1) : "—");

  /* --- Metric card classes (alert / positive) --- */
  setMetricClass("r-card-delay-rework", p.delayReworkRate, 0.10, "metric-alert");
  setMetricClass("r-card-rework",       p.reworkRate,      0.05, "metric-alert");
  setMetricClass("r-card-ctrl",         p.controllability, 0.70, "metric-positive");

  /* --- Comparison section --- */
  renderComparison(p, ru);

  /* --- Possible Causes --- */
  setText("r-evidence-waiting",
    p.avgWaitingTime !== null
      ? "High waiting time (" + fmt(p.avgWaitingTime, 2) + " min average)"
      : "Waiting time data not available");
  setText("r-evidence-delay",
    p.delayReworkRate !== null
      ? "High delay/rework rate (" + fmtPct(p.delayReworkRate) + ")"
      : "Delay/rework rate data not available");
  setText("r-evidence-rework",
    p.reworkRate !== null
      ? fmt(p.reworkRate * 100, 0) + "% rework rate"
      : "Rework rate data not available");
  setText("r-evidence-volcorr",
    p.volumeTimeCorrelation !== null
      ? "Strong relationship between volume and processing time (r = " +
          fmt(p.volumeTimeCorrelation, 2) + ")"
      : "Volume–time correlation data not available");

  /* --- Recommendations sub-heading --- */
  setText("r-rec-subheading", "Actionable next steps for " + p.name);

  /* --- Recommendation bodies --- */
  renderRecommendations(p);

  /* --- AI Analysis block (Langflow) --- */
  const aiSection = document.getElementById("r-ai-analysis-section");
  const aiBadge   = document.getElementById("r-ai-status-badge");
  const aiText    = document.getElementById("r-ai-analysis-text");
  const aiBox     = document.getElementById("r-ai-analysis");

  if (result.langflowText) {
    // Success: show AI response with a blue-tinted card.
    aiSection.classList.remove("hidden");
    aiBadge.textContent = "Analysis complete";
    aiBadge.className   = "ai-status-badge badge-success";
    aiBox.className     = "ai-analysis-card ai-success";
    aiText.textContent  = result.langflowText;
  } else if (result.langflowError) {
    // Failure: section is shown with a neutral unavailable notice.
    // Local metrics cards above remain the primary analysis.
    aiSection.classList.remove("hidden");
    aiBadge.textContent = "Analysis unavailable";
    aiBadge.className   = "ai-status-badge badge-unavailable";
    aiBox.className     = "ai-analysis-card ai-unavailable";
    aiText.textContent  = "AI process analysis is temporarily unavailable. The metrics and recommendations above are based on local analysis of your data.";
  } else {
    aiSection.classList.add("hidden");
  }

  /* --- Analysis footer --- */
  const source = uploadedData !== null
    ? "uploaded CSV data"
    : "built-in sample data";
  const aiStatus = result.langflowText
    ? " \u00A0·\u00A0 AI analysis complete."
    : " \u00A0·\u00A0 AI analysis unavailable — local analysis shown.";
  setText("r-analysis-source", "Analysis complete — using " + source + aiStatus);

  showAnalysis();
}

/* ─── COMPARISON RENDERER ────────────────────────────────────────────── */
function renderComparison(priority, runnerUp) {
  // Priority card
  setText("r-cmp-priority-name",  priority.name);
  setText("r-cmp-priority-score", fmt(priority.bottleneckScore, 2));
  setText("r-cmp-priority-proc",  fmtMetric(priority.avgProcessingTime, "min"));
  setText("r-cmp-priority-ctrl",  priority.controllability !== null
                                    ? fmt(priority.controllability, 1) : "—");

  if (runnerUp) {
    // Show runner-up card
    document.getElementById("r-cmp-runnerup-card").classList.remove("hidden");
    document.getElementById("r-cmp-no-runnerup").classList.add("hidden");
    setText("r-cmp-runnerup-name",  runnerUp.name);
    setText("r-cmp-runnerup-score", fmt(runnerUp.bottleneckScore, 2));
    setText("r-cmp-runnerup-proc",  fmtMetric(runnerUp.avgProcessingTime, "min"));
    setText("r-cmp-runnerup-ctrl",  runnerUp.controllability !== null
                                      ? fmt(runnerUp.controllability, 1) : "—");

    // Insight sentence
    const isSlowerRunnerup =
      runnerUp.avgProcessingTime !== null &&
      priority.avgProcessingTime !== null &&
      runnerUp.avgProcessingTime > priority.avgProcessingTime;

    const insightEl = document.getElementById("r-comparison-insight");
    if (isSlowerRunnerup) {
      insightEl.innerHTML =
        "<strong>" + runnerUp.name + "</strong> takes longer in absolute processing time, " +
        "but its lower controllability (" +
        fmt(runnerUp.controllability, 1) +
        ") and lower bottleneck score make <strong>" + priority.name +
        "</strong> the more actionable process to investigate first.";
    } else {
      insightEl.innerHTML =
        "<strong>" + priority.name + "</strong> has the highest bottleneck score " +
        "(" + fmt(priority.bottleneckScore, 2) + ") " +
        "and is the most actionable process based on the available metrics.";
    }
  } else {
    document.getElementById("r-cmp-runnerup-card").classList.add("hidden");
    document.getElementById("r-cmp-no-runnerup").classList.remove("hidden");
    document.getElementById("r-comparison-insight").innerHTML =
      "Only one process is present in the dataset. " +
      "<strong>" + priority.name + "</strong> is identified as the priority bottleneck.";
  }
}

/* ─── RECOMMENDATIONS RENDERER ──────────────────────────────────────── */
function renderRecommendations(p) {
  const recs = buildRecommendations(p);
  const list = document.getElementById("r-recommendations-list");
  list.innerHTML = "";
  recs.forEach((rec, i) => {
    const li = document.createElement("li");
    li.className = "rec-card";
    li.innerHTML =
      '<span class="rec-number">' + (i + 1) + "</span>" +
      '<div class="rec-body">' +
      "<strong>" + escapeHtml(rec.title) + "</strong>" +
      "<p>" + escapeHtml(rec.body) + "</p>" +
      "</div>";
    list.appendChild(li);
  });
}

/* ─── RECOMMENDATION BUILDER ─────────────────────────────────────────── */
function buildRecommendations(p) {
  const recs = [];

  if (p.reworkRate !== null && p.reworkRate > 0) {
    recs.push({
      title: "Investigate rework root causes",
      body:
        "Identify and address the causes behind the " +
        fmt(p.reworkRate * 100, 0) +
        "% rework rate in " + p.name + " to reduce waste and processing time.",
    });
  }

  if (p.avgWaitingTime !== null && p.avgWaitingTime > 0) {
    recs.push({
      title: "Analyze queue and handoff issues",
      body:
        "Examine the " + fmt(p.avgWaitingTime, 2) +
        "-minute average waiting time in " + p.name +
        " and identify queue or handoff bottlenecks that can be reduced.",
    });
  }

  if (p.volumeTimeCorrelation !== null && p.volumeTimeCorrelation > 0.5) {
    recs.push({
      title: "Improve workload management",
      body:
        "Examine how volume fluctuations relate to the " +
        fmt(p.volumeTimeCorrelation, 2) +
        " volume–time correlation in " + p.name +
        " and apply smoothing or resource balancing strategies.",
    });
  }

  if (p.delayReworkRate !== null && p.delayReworkRate > 0.1) {
    recs.push({
      title: "Reduce delay and rework frequency",
      body:
        "A delay/rework rate of " + fmtPct(p.delayReworkRate) +
        " in " + p.name +
        " indicates recurring process interruptions. Map the specific failure points and introduce process controls.",
    });
  }

  // Always include at least one recommendation
  if (recs.length === 0) {
    recs.push({
      title: "Conduct a detailed process review for " + p.name,
      body:
        "Although metric-driven recommendations are limited by the available data, " +
        p.name +
        " has the highest bottleneck score and warrants a closer operational review.",
    });
  }

  return recs;
}

/* ─── INSIGHT SENTENCE BUILDER ───────────────────────────────────────── */
function buildInsight(p) {
  const parts = [];
  if (p.avgWaitingTime !== null && p.avgWaitingTime > 5)
    parts.push("significant waiting time");
  if (p.delayReworkRate !== null && p.delayReworkRate > 0.05)
    parts.push("delay/rework rate");
  if (p.reworkRate !== null && p.reworkRate > 0.02)
    parts.push("rework");
  if (p.volumeTimeCorrelation !== null && p.volumeTimeCorrelation > 0.5)
    parts.push("strong volume sensitivity");

  const ctrlNote =
    p.controllability !== null && p.controllability >= 0.7
      ? " It is highly controllable, making it an actionable area for operational improvement."
      : p.controllability !== null && p.controllability < 0.4
      ? " Note: controllability is low, which may limit the direct impact of internal interventions."
      : "";

  if (parts.length === 0) {
    return (
      p.name +
      " has the highest bottleneck score in the dataset." +
      ctrlNote
    );
  }

  return (
    p.name +
    " combines the highest bottleneck score with " +
    joinList(parts) +
    "." +
    ctrlNote
  );
}

/* ─── FORMATTING HELPERS ─────────────────────────────────────────────── */
function fmt(val, decimals) {
  if (val === null || val === undefined) return "—";
  return Number(val).toFixed(decimals);
}

function fmtMetric(val, unit) {
  if (val === null || val === undefined) return "—";
  return fmt(val, 2) + " " + unit;
}

function fmtPct(val) {
  if (val === null || val === undefined) return "—";
  return fmt(val * 100, 1) + "%";
}

function joinList(arr) {
  if (arr.length === 1) return arr[0];
  return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── DOM HELPERS ────────────────────────────────────────────────────── */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, value);
}

/**
 * Adds `cls` to the metric card if `value` is above `threshold`,
 * removes it otherwise (so re-runs with different data stay correct).
 */
function setMetricClass(id, value, threshold, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  // Remove all variant classes first
  el.classList.remove("metric-alert", "metric-positive");
  if (value !== null && value >= threshold) el.classList.add(cls);
}

/* ─── UI STATE HELPERS ───────────────────────────────────────────────── */
function showLoading() {
  analyzeBtn.disabled = true;
  emptyState.classList.add("hidden");
  errorState.classList.add("hidden");
  loadingState.classList.remove("hidden");
  analysisOutput.classList.add("hidden");
}

function showAnalysis() {
  loadingState.classList.add("hidden");
  analysisOutput.classList.remove("hidden");
  analyzeBtn.disabled = false;
  analysisOutput.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorState.classList.remove("hidden");
  emptyState.classList.add("hidden");
}

function hideError() {
  errorState.classList.add("hidden");
}

/** Called when analyzeProcess() itself throws (should be rare). */
function showLoadError(msg) {
  loadingState.classList.add("hidden");
  analysisOutput.classList.add("hidden");
  emptyState.classList.add("hidden");
  analyzeBtn.disabled = false;
  showError("Analysis failed: " + msg);
}
