const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");
assert.match(source, /REMOVE_ID:\s*"B10"/, "Debe existir un control visible para retirar IDs");
assert.match(source, /function isCourseRegistryRemovalEdit_\(event\)/,
  "El trigger de edicion debe reconocer el control de retiro");
assert.doesNotMatch(source, /addItem\("Retirar curso del registro"/,
  "No debe anunciarse un menu que las hojas independientes no pueden cargar");
const start = source.indexOf("function retirarCursoDelRegistro(courseId)");
const end = source.indexOf("\n/**", start);
assert.notEqual(start, -1, "No se encontro retirarCursoDelRegistro");
assert.notEqual(end, -1, "No se encontro el final de retirarCursoDelRegistro");

let storedRegistry = { "111": "sheet-old", "222": "sheet-current" };
let resetCourseId = null;
global.PROPERTY_KEYS = { COURSE_CONFIG_SPREADSHEETS: "COURSES" };
global.getCourseSpreadsheetRegistry_ = () => JSON.parse(JSON.stringify(storedRegistry));
global.PropertiesService = {
  getScriptProperties: () => ({
    setProperty: (key, value) => {
      assert.equal(key, "COURSES");
      storedRegistry = JSON.parse(value);
    }
  })
};
global.resetCourseReminderSchedule_ = courseId => { resetCourseId = courseId; };

vm.runInThisContext(source.slice(start, end));

assert.deepEqual(retirarCursoDelRegistro(" 111 "), {
  courseId: "111", spreadsheetId: "sheet-old", removed: true
});
assert.deepEqual(storedRegistry, { "222": "sheet-current" });
assert.equal(resetCourseId, "111");
assert.deepEqual(retirarCursoDelRegistro("999"), {
  courseId: "999", removed: false, reason: "not_registered"
});
assert.throws(() => retirarCursoDelRegistro("  "), /Indica el courseId/);

console.log("course_registry_removal.test.cjs: OK");
