const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const servicesSource = fs.readFileSync("google_services.gs", "utf8");
assert.match(servicesSource, /"RESUMEN_CURSOS_NO_DISPONIBLES"/,
  "Debe registrarse un resumen legible de cursos no disponibles");
const plainTextStart = servicesSource.indexOf("function isClassroomCourseUnavailableError_(error)");
const plainTextEnd = servicesSource.indexOf("\n/**", plainTextStart);

assert.notEqual(plainTextStart, -1, "No se encontro isClassroomCourseUnavailableError_");
assert.notEqual(plainTextEnd, -1, "No se encontro el final del detector");

global.errorToPlainText = function (error) {
  return error && (error.stack || error.message) || String(error);
};

vm.runInThisContext(servicesSource.slice(plainTextStart, plainTextEnd));

assert.equal(isClassroomCourseUnavailableError_(new Error(
  "API call to classroom.courses.students.list failed with error: Requested entity was not found."
)), true);
assert.equal(isClassroomCourseUnavailableError_({
  message: "API call to classroom.courses.courseWork.list failed with error: Course not found"
}), true);
assert.equal(isClassroomCourseUnavailableError_(new Error("Service invoked too many times")), false);

const rememberStart = servicesSource.indexOf("function rememberUnavailableCourse_(courses, courseId, name, spreadsheetUrl)");
const rememberEnd = servicesSource.indexOf("\n/**", rememberStart);
assert.notEqual(rememberStart, -1, "No se encontro rememberUnavailableCourse_");
vm.runInThisContext(servicesSource.slice(rememberStart, rememberEnd));
const unavailable = [];
rememberUnavailableCourse_(unavailable, "871", "Semestre Agosto-Diciembre", "https://docs.google.com/example");
rememberUnavailableCourse_(unavailable, "871", "Nombre repetido", "");
assert.deepEqual(unavailable, [{
  courseId: "871",
  name: "Semestre Agosto-Diciembre",
  spreadsheetUrl: "https://docs.google.com/example"
}]);

const utilsSource = fs.readFileSync("utils.gs", "utf8");
assert.match(
  utilsSource,
  /options\.skipCourseIds\s*&&\s*options\.skipCourseIds\[String\(courseConfig\.courseId\)\]/,
  "El descubrimiento debe omitir los cursos marcados como no disponibles"
);

console.log("classroom_unavailable_course.test.cjs: OK");
