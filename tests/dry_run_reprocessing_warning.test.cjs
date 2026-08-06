const assert = require("node:assert/strict");
const fs = require("node:fs");

const mainSource = fs.readFileSync("main.gs", "utf8");
const servicesSource = fs.readFileSync("google_services.gs", "utf8");

assert.match(
  mainSource,
  /Modo simulacion activo:[\s\S]*no se escribiran calificaciones en Classroom[\s\S]*se volveran a detectar/,
  "El inicio del lote debe advertir que DRY_RUN ocasiona detecciones repetidas"
);

assert.match(
  mainSource,
  /Calificacion simulada:[\s\S]*No se escribio ninguna calificacion en Classroom; la entrega se volvera a detectar/,
  "El resultado simulado no debe parecer una calificacion realmente asignada"
);

assert.match(
  servicesSource,
  /Pendientes sin draftGrade ni assignedGrade en/,
  "El diagnostico debe describir los dos campos de calificacion que filtra"
);

console.log("dry_run_reprocessing_warning.test.cjs: OK");
