const fs = require("fs");

function fmt(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function readFileIfExists(path) {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

const startMs = Number(process.env.STATE_start_ms || process.env.CI_START_EPOCH_MS || 0);
const endMs = Date.now();
const totalMs = endMs - startMs;

// Este archivo lo escribimos en el último step normal (antes de POST)
const prePostStr = readFileIfExists(`${process.env.GITHUB_WORKSPACE}/.ci_end_prepost_ms`);
const prePostMs = prePostStr ? Number(prePostStr) - startMs : null;

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const lines = [];
  lines.push("\n---\n");
  lines.push("## ⏱️ Tiempo total del Job (incluye POST)");
  lines.push("");
  lines.push(`- **Total (incluye POST):** \`${fmt(totalMs)}\``);

  if (prePostMs !== null && Number.isFinite(prePostMs)) {
    const postOverhead = totalMs - prePostMs;
    lines.push(`- **Hasta fin de steps (pre-POST):** \`${fmt(prePostMs)}\``);
    lines.push(`- **Overhead POST:** \`${fmt(postOverhead)}\``);
  } else {
    lines.push("- **Pre-POST:** (no disponible)");
  }

  fs.appendFileSync(summaryPath, lines.join("\n"), { encoding: "utf8" });
}
