const fs = require("fs");

function append(file, line) {
  if (!file) return;
  fs.appendFileSync(file, line + "\n", { encoding: "utf8" });
}

const startMs = Date.now();
const startIso = new Date(startMs).toISOString();

// Guarda estado para el post (se expone luego como env: STATE_start_ms)
append(process.env.GITHUB_STATE, `start_ms=${startMs}`);

// Exporta variables para los steps normales
append(process.env.GITHUB_ENV, `CI_START_EPOCH_MS=${startMs}`);
append(process.env.GITHUB_ENV, `CI_START_ISO=${startIso}`);
