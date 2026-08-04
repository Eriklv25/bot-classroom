const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");
const start = source.indexOf("function limpiarRegistroDeCursosInaccesibles_()");
const end = source.indexOf("\n/**", start + 20);
assert.notEqual(start, -1, "Debe existir la limpieza de entradas huerfanas");
assert.notEqual(end, -1, "No se encontro el final de la limpieza");

let registry = { active: "sheet-active", trashed: "sheet-trash", deleted: "sheet-gone" };
const reset = [];
global.getCourseSpreadsheetRegistry_ = () => JSON.parse(JSON.stringify(registry));
global.DriveApp = {
  getFileById: id => {
    if (id === "sheet-gone") throw new Error("File not found");
    return { isTrashed: () => id === "sheet-trash" };
  }
};
global.PROPERTY_KEYS = { COURSE_CONFIG_SPREADSHEETS: "COURSES" };
global.PropertiesService = {
  getScriptProperties: () => ({
    setProperty: (key, value) => {
      assert.equal(key, "COURSES");
      registry = JSON.parse(value);
    }
  })
};
global.resetCourseReminderSchedule_ = id => reset.push(id);

vm.runInThisContext(source.slice(start, end));
assert.deepEqual(limpiarRegistroDeCursosInaccesibles_(), {
  removed: [
    { courseId: "trashed", spreadsheetId: "sheet-trash", reason: "in_trash" },
    { courseId: "deleted", spreadsheetId: "sheet-gone", reason: "not_accessible" }
  ],
  remainingCourseIds: ["active"]
});
assert.deepEqual(registry, { active: "sheet-active" });
assert.deepEqual(reset, ["trashed", "deleted"]);

console.log("course_registry_trash_cleanup.test.cjs: OK");
