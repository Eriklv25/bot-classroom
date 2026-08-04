const assert = require("node:assert/strict");
const fs = require("node:fs");

const sheets = fs.readFileSync("sheets_configuration.gs", "utf8");
const services = fs.readFileSync("google_services.gs", "utf8");
const main = fs.readFileSync("main.gs", "utf8");

const columnsMatch = sheets.match(/const TASK_COLUMNS = \[([\s\S]*?)\];/);
assert.ok(columnsMatch, "Debe existir la lista de columnas de Tareas");
assert.doesNotMatch(columnsMatch[1], /recordatorioCadaDias|horaRecordatorio/,
  "Las hojas nuevas no deben mostrar programación individual");
assert.match(sheets, /function removeLegacyTaskReminderColumns_\(spreadsheet\)/,
  "Las hojas existentes deben retirar las columnas antiguas");
assert.doesNotMatch(services, /function processScheduledTaskReminders_\(/,
  "El activador global no debe recorrer recordatorios individuales");
assert.doesNotMatch(main, /sendPendingSubmissionNotifications/,
  "El lote de revisión tampoco debe enviar recordatorios individuales");
assert.doesNotMatch(services, /sendPendingSubmissionNotifications/,
  "La implementación de correos individuales debe eliminarse");

for (const file of fs.readdirSync(".").filter(name => name.endsWith(".gs"))) {
  assert.doesNotMatch(fs.readFileSync(file, "utf8"), /console\.log\(/,
    `${file} debe usar niveles de registro descriptivos en lugar de Depuración`);
}

console.log("task_notifications_removed.test.cjs: OK");
