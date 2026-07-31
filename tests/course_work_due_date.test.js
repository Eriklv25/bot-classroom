const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("google_services.gs", "utf8");
const start = source.indexOf("function getCourseWorkDueDate(courseWork)");
const end = source.indexOf("\n/**", start);

assert.notEqual(start, -1, "No se encontro getCourseWorkDueDate");
assert.notEqual(end, -1, "No se encontro el final de getCourseWorkDueDate");
vm.runInThisContext(source.slice(start, end));

const utcDeadline = getCourseWorkDueDate({
  dueDate: { year: 2026, month: 7, day: 31 },
  dueTime: { hours: 4, minutes: 30 }
});

assert.equal(utcDeadline.toISOString(), "2026-07-31T04:30:00.000Z");
assert.equal(
  isAfter("2026-07-31T07:23:00.000Z", utcDeadline),
  true,
  "04:30 UTC ya debe estar vencida a la 01:23 de Ciudad de Mexico"
);
assert.equal(isAfter("2026-07-31T04:29:59.000Z", utcDeadline), false);

const endOfLocalDay = getCourseWorkDueDate({
  dueDate: { year: 2026, month: 7, day: 31 }
});
assert.equal(endOfLocalDay.getHours(), 23);
assert.equal(endOfLocalDay.getMinutes(), 59);

function isAfter(now, deadline) {
  return new Date(now).getTime() > deadline.getTime();
}

console.log("course_work_due_date.test.js: OK");
