const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("openai_and_grading.gs", "utf8");
const start = source.indexOf("function buildEvaluationPrompt(taskConfig)");
const end = source.indexOf("\n\n/**\n * Construye el payload", start);
global.CONFIG = { VALID_GRADE: 100, INVALID_GRADE: 60 };
vm.runInThisContext(source.slice(start, end));

const custom = buildEvaluationPrompt({
  name: "Tarea personalizada", prompt: "REVISA ESTA REGLA", validGrade: 90, invalidGrade: 50
});
const general = buildEvaluationPrompt({
  name: "Tarea general", prompt: "", validGrade: 100, invalidGrade: 60
});

assert.match(custom, /^REVISA ESTA REGLA/);
assert.doesNotMatch(custom, /No evalues contenido academico/);
assert.match(general, /No evalues contenido academico/,
  "Una tarea sin prompt debe volver al general aunque otra tarea tuviera prompt personalizado");
assert.doesNotMatch(general, /REVISA ESTA REGLA/,
  "Los prompts no deben heredarse entre tareas");

console.log("per_task_prompt_fallback.test.cjs: OK");
