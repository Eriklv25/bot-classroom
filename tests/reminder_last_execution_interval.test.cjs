const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");
assert.match(source, /permanecera activo hasta que se presione EJECUTAR en otra hoja/,
  "El resultado debe explicar que la ultima ejecucion controla el intervalo global");
assert.match(source, /la ultima hoja ejecutada prevalece/,
  "La nota del campo debe describir la misma regla que aplica el codigo");

const start = source.indexOf("function getActiveReminderTriggerMinutes_(fallbackSpreadsheet)");
const end = source.indexOf("\n\nfunction setCourseExecutionStatus_", start);
assert.notEqual(start, -1, "No se encontro la lectura del intervalo global activo");
assert.notEqual(end, -1, "No se encontro el final de la lectura del intervalo global");

let storedInterval = "5";
global.REMINDER_TRIGGER_PROPERTY = "REMINDER_TRIGGER_INTERVAL_MINUTES";
global.DEFAULT_REMINDER_TRIGGER_MINUTES = 60;
global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: () => storedInterval })
};
global.normalizeReminderTriggerMinutes_ = value => Number(value);
global.readTemplateFields_ = spreadsheet => ({
  intervaloTriggerRecordatoriosMinutos: spreadsheet.interval
});

vm.runInThisContext(source.slice(start, end));

assert.equal(getActiveReminderTriggerMinutes_({ interval: 10 }), 5,
  "El valor guardado por la ultima ejecucion debe prevalecer sobre cualquier hoja abierta");
storedInterval = null;
assert.equal(getActiveReminderTriggerMinutes_({ interval: 10 }), 10,
  "Antes de la primera ejecucion se puede inicializar el trigger con la hoja actual");
assert.equal(getActiveReminderTriggerMinutes_(), 60,
  "Sin una ejecucion ni una hoja se debe usar el intervalo predeterminado");

console.log("reminder_last_execution_interval.test.cjs: OK");
