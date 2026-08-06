const assert = require("node:assert/strict");
const fs = require("node:fs");

const sheetsSource = fs.readFileSync("sheets_configuration.gs", "utf8");
const mainSource = fs.readFileSync("main.gs", "utf8");
const serviceSource = fs.readFileSync("google_services.gs", "utf8");

assert.match(sheetsSource, /intervaloDeteccionEntregasMinutos/,
  "La plantilla debe exponer un intervalo editable para detectar entregas");
assert.match(sheetsSource, /SUBMISSION_DETECTION_INTERVAL_PROPERTY/,
  "El intervalo de la ultima hoja ejecutada debe persistirse globalmente");
assert.match(sheetsSource, /function ensureSubmissionDetectionTrigger_\(\)/,
  "EJECUTAR debe poder garantizar un unico detector global");
assert.match(sheetsSource, /getHandlerFunction\(\) === "processPendingSubmissionsBatch"/,
  "La instalacion debe retirar el activador horario anterior para evitar recorridos duplicados");
assert.match(mainSource,
  /function detectarEntregasProgramadas\(\)[\s\S]*processPendingSubmissionsBatch\(\)[\s\S]*scheduleNextSubmissionDetection_\(\)/,
  "El detector debe procesar el lote y reprogramarse incluso al terminar con error");
assert.match(serviceSource, /trigger\.getHandlerFunction\(\) === SUBMISSION_DETECTION_HANDLER/,
  "La limpieza de activadores debe incluir el detector nuevo");
assert.doesNotMatch(mainSource, /MAX_EVIDENCES_PER_RUN/,
  "El lote no debe detenerse por una cantidad fija de evidencias");

console.log("submission_detection_trigger.test.cjs: OK");
