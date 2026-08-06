const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");

assert.match(source, /\["defaultState", template\.defaultState !== "DRAFT"\]/,
  "defaultState debe escribirse como booleano en hojas nuevas");
assert.match(source, /function ensureDefaultStateCheckbox_\(spreadsheet\)/,
  "Las hojas existentes deben migrar defaultState a una casilla");
assert.match(source, /ensureReminderTriggerField_\(spreadsheet\);\s*ensureDefaultStateCheckbox_\(spreadsheet\)/,
  "La migracion debe ejecutarse al abrir y al aplicar la plantilla");

const start = source.indexOf("function courseWorkStateFromCheckbox_(value)");
const end = source.indexOf("\n\nfunction readTemplateFields_", start);
assert.notEqual(start, -1);
assert.notEqual(end, -1);
vm.runInThisContext(source.slice(start, end));

assert.equal(courseWorkStateFromCheckbox_(true), "PUBLISHED");
assert.equal(courseWorkStateFromCheckbox_(false), "DRAFT");
assert.equal(courseWorkStateFromCheckbox_("PUBLISHED"), "PUBLISHED",
  "Debe conservar hojas heredadas configuradas como PUBLISHED");
assert.equal(courseWorkStateFromCheckbox_("ASSIGNED"), "PUBLISHED",
  "ASSIGNED se interpreta como el estado PUBLISHED de la API");
assert.equal(courseWorkStateFromCheckbox_("DRAFT"), "DRAFT");

console.log("default_state_checkbox.test.cjs: OK");
