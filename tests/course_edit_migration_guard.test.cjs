const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("sheets_configuration.gs", "utf8");
const functionStart = source.indexOf("function ejecutarCambiosDelCurso(event)");
assert.notEqual(functionStart, -1, "Debe existir ejecutarCambiosDelCurso");
const functionEnd = source.indexOf("\nfunction isCourseExecutionEdit_", functionStart);
assert.notEqual(functionEnd, -1, "No se encontro el final de ejecutarCambiosDelCurso");
const body = source.slice(functionStart, functionEnd);

const guardIndex = body.indexOf("if (event && !isCourseExecutionEdit_(event) && !isCourseRegistryRemovalEdit_(event)) return null;");
assert.notEqual(guardIndex, -1,
  "El trigger debe salir sin migrar columnas cuando la edicion no es EJECUTAR ni RETIRAR ID ANTIGUO");

["ensureParticipantColumns_", "ensureTaskColumns_", "removeLegacyTaskReminderColumns_"].forEach(name => {
  const callIndex = body.indexOf(name + "(");
  assert.ok(callIndex > guardIndex, `${name} no debe ejecutarse antes de validar el tipo de edicion`);
});

const onOpenStart = source.indexOf("function onOpen()");
const onOpenEnd = source.indexOf("\n/** Solicita", onOpenStart);
const onOpenBody = source.slice(onOpenStart, onOpenEnd);
assert.doesNotMatch(onOpenBody, /removeLegacyTaskReminderColumns_\(/,
  "onOpen no debe borrar columnas heredadas porque puede exceder el tiempo del servicio de Spreadsheets");

assert.match(source, /function cleanupConfigurationEditTriggers_\(currentSpreadsheetId\)/,
  "Debe existir limpieza de activadores onEdit huerfanos antes de crear nuevos");
assert.match(source, /cleanupConfigurationEditTriggers_\(spreadsheetId\);[\s\S]*ScriptApp\.newTrigger\("ejecutarCambiosDelCurso"\)/,
  "Debe limpiar activadores de hojas no registradas antes de crear el onEdit de una nueva hoja");
assert.match(source, /function handleConfigurationTriggerCreationError_\(spreadsheet, error\)/,
  "Debe capturar el error de limite de activadores sin cancelar la creacion de la hoja");
assert.match(source, /setCourseExecutionStatus_\(sheet, "SIN ACTIVADOR"/,
  "Debe dejar un diagnostico visible si no se pudo instalar el activador de edicion");

console.log("course_edit_migration_guard.test.cjs: OK");
