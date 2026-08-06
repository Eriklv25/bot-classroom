const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");

assert.match(source, /\["modoSimulacion", CONFIG\.DRY_RUN === true\]/,
  "Las hojas nuevas deben mostrar modoSimulacion en Plantilla de curso");
assert.match(source, /addMissingTemplateField_\(sheet, values, "modoSimulacion"/,
  "Las hojas existentes deben recibir el campo sin recrearse");
assert.match(source, /loadConfigurationFromSpecificSpreadsheet_\(spreadsheet\);\s*saveDryRunSetting_\(CONFIG\.DRY_RUN\)/,
  "EJECUTAR debe guardar el modo seleccionado");

const saveStart = source.indexOf("function saveDryRunSetting_(dryRun)");
const readEnd = source.indexOf("\n\nfunction readTemplateFields_", saveStart);
assert.notEqual(saveStart, -1);
assert.notEqual(readEnd, -1);

let stored = null;
global.DRY_RUN_PROPERTY = "DRY_RUN";
global.CONFIG = { DRY_RUN: true };
global.PropertiesService = {
  getScriptProperties: () => ({
    setProperty: (key, value) => { assert.equal(key, "DRY_RUN"); stored = value; },
    getProperty: key => { assert.equal(key, "DRY_RUN"); return stored; }
  })
};

vm.runInThisContext(source.slice(saveStart, readEnd));

saveDryRunSetting_(false);
CONFIG.DRY_RUN = true;
assert.equal(applyStoredDryRunSetting_(), false);
assert.equal(CONFIG.DRY_RUN, false, "El detector debe restaurar el valor global guardado");

saveDryRunSetting_(true);
CONFIG.DRY_RUN = false;
assert.equal(applyStoredDryRunSetting_(), true);

console.log("template_dry_run_setting.test.cjs: OK");
