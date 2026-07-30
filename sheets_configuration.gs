/** Interfaz de configuracion: exactamente una hoja de curso, participantes y tareas. */
const CONFIG_SHEET_NAMES = {
  TEMPLATE: "Plantilla de curso",
  STUDENTS: "Participantes",
  TASKS: "Tareas"
};

const COURSE_EXECUTION_CONTROL = {
  CHECKBOX: "B5",
  STATUS: "B7",
  LAST_RUN: "B8",
  RESULT: "B9",
  FIELDS_HEADER_ROW: 12
};

const TASK_COLUMNS = [
  "crearAhora", "enabled", "topic", "nombreActividad", "descripcion",
  "reviewMode", "exampleId", "prompt", "validGrade", "invalidGrade",
  "maxPoints", "state", "dueDate", "dueTime", "recordatorioCadaDias", "horaRecordatorio"
];

const PARTICIPANT_COLUMNS = ["selected", "name", "email"];

/** Crea una hoja independiente para un curso nuevo sin modificar hojas anteriores. */
function createConfigurationSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheet = SpreadsheetApp.create("Nuevo curso - Bot Classroom");
  properties.setProperty(PROPERTY_KEYS.CONFIG_SPREADSHEET_ID, spreadsheet.getId());
  moveSpreadsheetToConfiguredFolder_(spreadsheet);
  writeConfigurationSpreadsheet_(spreadsheet);
  ensureCourseConfigurationTrigger_(spreadsheet);
  logConfigurationSpreadsheetLink_(spreadsheet, "Hoja de configuracion lista");
  return spreadsheet.getUrl();
}

/** Crea y registra una hoja ya vinculada a un curso creado por otro flujo. */
function crearConfiguracionParaCursoExistente_(courseId, courseName) {
  const url = createConfigurationSpreadsheet();
  const spreadsheet = getConfigurationSpreadsheet_();
  findTemplateFieldRange_(spreadsheet, "existingCourseId").setValue(String(courseId || ""));
  findTemplateFieldRange_(spreadsheet, "courseName").setValue(String(courseName || ""));
  spreadsheet.rename(String(courseName || "Curso") || "Curso");
  if (courseId) registerCourseSpreadsheet_(courseId, spreadsheet);
  return url;
}

function crearHojaDeCurso() { return createConfigurationSpreadsheet(); }

/** Agrega acciones guiadas cada vez que se abre la hoja. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Bot Classroom")
    .addItem("Elegir carpeta de almacenamiento", "elegirCarpetaDeAlmacenamiento")
    .addItem("Listar hojas de cursos", "listarHojasDeCursos")
    .addToUi();
}

/** Solicita la URL de una carpeta de Drive y la guarda en la plantilla activa. */
function elegirCarpetaDeAlmacenamiento() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Elegir carpeta de almacenamiento",
    "Abre la carpeta deseada en Google Drive, copia su URL completa y pegala aqui.",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return null;

  const folderUrl = String(response.getResponseText() || "").trim();
  const folderId = extractDriveId_(folderUrl);
  const folder = DriveApp.getFolderById(folderId);
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const fieldRange = findTemplateFieldRange_(spreadsheet, "carpetaAlmacenamiento");
  fieldRange.setValue(folderUrl).setNote("Carpeta seleccionada: " + folder.getName());
  spreadsheet.toast("Carpeta seleccionada: " + folder.getName(), "Bot Classroom", 5);
  return folderId;
}

/** Atiende el boton principal y el boton CREAR AHORA de cada fila de Tareas. */
function ejecutarCambiosDelCurso(event) {
  if (event && !isCourseExecutionEdit_(event) && !isTaskCreationEdit_(event)) return null;
  const spreadsheet = event && event.source ? event.source : getConfigurationSpreadsheet_();
  const templateSheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  if (event) {
    if (isTaskCreationEdit_(event)) event.range.offset(0, 1).setValue(true);
    event.range.setValue(false);
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    setCourseExecutionStatus_(templateSheet, "OCUPADO", "Ya hay otra ejecucion en curso.");
    return null;
  }
  try {
    setCourseExecutionStatus_(templateSheet, "EJECUTANDO", "Leyendo la configuracion...");
    loadConfigurationFromSpecificSpreadsheet_(spreadsheet);
    const template = COURSE_SETUP_TEMPLATE;
    let courseId = String(template.existingCourseId || "").trim();
    let course;
    const created = !courseId;
    if (created) {
      course = createClassroomCourseFromConfig(template.course);
      courseId = String(course.id);
      saveCreatedCourseToSpreadsheet_(spreadsheet, course);
    } else {
      course = updateClassroomCourseFromConfig(courseId, template.course);
    }
    syncCourseSpreadsheetFile_(spreadsheet, course, readTemplateFields_(spreadsheet).carpetaAlmacenamiento);
    const setup = createCourseSetupFromTemplate(Object.assign({}, template, { courseId: courseId }));
    const invitations = inviteStudentsFromTemplate(courseId, template.students || []);
    registerCourseSpreadsheet_(courseId, spreadsheet);
    setCourseExecutionStatus_(templateSheet, "COMPLETADO",
      (created ? "Curso creado" : "Curso actualizado") + ": " + course.name + " (" + courseId + ")");
    return { course: course, created: created, setup: setup, studentInvitations: invitations };
  } catch (error) {
    setCourseExecutionStatus_(templateSheet, "ERROR", errorToPlainText(error));
    throw error;
  } finally { lock.releaseLock(); }
}

function isCourseExecutionEdit_(event) {
  return event && event.range && event.value === "TRUE" &&
    event.range.getSheet().getName() === CONFIG_SHEET_NAMES.TEMPLATE &&
    event.range.getA1Notation() === COURSE_EXECUTION_CONTROL.CHECKBOX;
}

function isTaskCreationEdit_(event) {
  return event && event.range && String(event.value).toUpperCase() === "TRUE" &&
    event.range.getSheet().getName() === CONFIG_SHEET_NAMES.TASKS && event.range.getColumn() === 1 &&
    event.range.getRow() > 1;
}

function ensureCourseConfigurationTrigger_(spreadsheet) {
  const triggers = ScriptApp.getProjectTriggers();
  const spreadsheetId = spreadsheet.getId();
  const hasTrigger = function (handler, eventType) {
    return triggers.some(function (trigger) {
      return trigger.getHandlerFunction() === handler &&
        trigger.getTriggerSourceId() === spreadsheetId &&
        trigger.getEventType() === eventType;
    });
  };

  if (!hasTrigger("ejecutarCambiosDelCurso", ScriptApp.EventType.ON_EDIT)) {
    ScriptApp.newTrigger("ejecutarCambiosDelCurso").forSpreadsheet(spreadsheet).onEdit().create();
  }
  if (!hasTrigger("onOpen", ScriptApp.EventType.ON_OPEN)) {
    ScriptApp.newTrigger("onOpen").forSpreadsheet(spreadsheet).onOpen().create();
  }
  if (!triggers.some(function (trigger) {
    return trigger.getHandlerFunction() === "procesarRecordatoriosProgramados" &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  })) {
    ScriptApp.newTrigger("procesarRecordatoriosProgramados").timeBased().everyHours(1).create();
  }
}

function setCourseExecutionStatus_(sheet, status, result) {
  sheet.getRange(COURSE_EXECUTION_CONTROL.STATUS).setValue(status);
  sheet.getRange(COURSE_EXECUTION_CONTROL.LAST_RUN).setValue(new Date()).setNumberFormat("yyyy-mm-dd hh:mm:ss");
  sheet.getRange(COURSE_EXECUTION_CONTROL.RESULT).setValue(result || "");
  SpreadsheetApp.flush();
}

function saveCreatedCourseToSpreadsheet_(spreadsheet, course) {
  const sheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  const values = sheet.getDataRange().getValues();
  values.forEach(function (row, index) {
    if (row[0] === "existingCourseId") sheet.getRange(index + 1, 2).setValue(String(course.id));
  });
  SpreadsheetApp.flush();
}

function findTemplateFieldRange_(spreadsheet, fieldName) {
  const sheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  const values = sheet.getDataRange().getValues();
  for (let index = COURSE_EXECUTION_CONTROL.FIELDS_HEADER_ROW - 1; index < values.length; index++) {
    if (String(values[index][0] || "").trim() === fieldName) return sheet.getRange(index + 1, 2);
  }
  throw new Error("Falta el campo de configuracion: " + fieldName);
}

/** Identifica el archivo con el curso y lo mueve a la carpeta elegida en la plantilla. */
function syncCourseSpreadsheetFile_(spreadsheet, course, folderIdOrUrl) {
  const courseName = String(course && course.name || "").trim();
  if (!courseName) throw new Error("El curso no tiene un nombre valido para identificar la hoja.");
  spreadsheet.rename(courseName);
  if (String(folderIdOrUrl || "").trim()) {
    moveSpreadsheetToConfiguredFolder_(spreadsheet, folderIdOrUrl);
  }
}

function registerCourseSpreadsheet_(courseId, spreadsheet) {
  const registry = getCourseSpreadsheetRegistry_();
  registry[String(courseId)] = spreadsheet.getId();
  PropertiesService.getScriptProperties().setProperty(PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS, JSON.stringify(registry));
}

function getCourseSpreadsheetRegistry_() {
  const value = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS);
  if (!value) return {};
  try { return JSON.parse(value) || {}; } catch (error) { throw new Error("Registro de hojas invalido."); }
}

/** Devuelve y registra en consola los enlaces de todas las hojas de curso conocidas. */
function listarHojasDeCursos() {
  const registry = getCourseSpreadsheetRegistry_();
  const courses = Object.keys(registry).map(function (courseId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(registry[courseId]);
      return { courseId: courseId, name: spreadsheet.getName(), url: spreadsheet.getUrl() };
    } catch (error) {
      return { courseId: courseId, name: "Hoja no accesible", url: "" };
    }
  });
  console.log("Hojas de cursos: " + JSON.stringify(courses));
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    const links = courses.length ? courses.map(function (course) {
      const label = escapeHtml_(course.name + " (" + course.courseId + ")");
      return course.url ? '<li><a href="' + escapeHtml_(course.url) + '" target="_blank">' + label + '</a></li>' : "<li>" + label + "</li>";
    }).join("") : "<li>Todavia no hay cursos registrados.</li>";
    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput("<p>Selecciona la hoja que deseas abrir:</p><ul>" + links + "</ul>").setWidth(520).setHeight(320),
      "Hojas de cursos"
    );
  }
  return courses;
}

function escapeHtml_(value) {
  return String(value || "").replace(/[&<>\"]/g, function (character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" }[character];
  });
}

function configurarCarpetaDeHojas(folderIdOrUrl) {
  const id = extractDriveId_(folderIdOrUrl);
  const properties = PropertiesService.getScriptProperties();
  if (id) properties.setProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID, id);
  else properties.deleteProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID);
  return id;
}

function extractDriveId_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/[-\w]{20,}/);
  if (!match) throw new Error("No se encontro un ID de Drive valido.");
  return match[0];
}

function moveSpreadsheetToConfiguredFolder_(spreadsheet, folderIdOrUrl) {
  const id = extractDriveId_(folderIdOrUrl) || PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID);
  if (id) DriveApp.getFileById(spreadsheet.getId()).moveTo(DriveApp.getFolderById(id));
}

function resetConfigurationSpreadsheetFromCode() { return createConfigurationSpreadsheet(); }
function getConfigurationSpreadsheetUrl() { return getConfigurationSpreadsheet_().getUrl(); }
function verEnlaceHojaDeConfiguracion() { return getConfigurationSpreadsheetUrl(); }

/** Carga todas las hojas registradas para que el proceso programado revise sus tareas. */
function loadConfigurationFromSpreadsheet(loadAllCourseSpreadsheets) {
  const registry = getCourseSpreadsheetRegistry_();
  const ids = Object.keys(registry);
  if (loadAllCourseSpreadsheets === true && ids.length) {
    const courses = [], rules = [];
    ids.forEach(function (courseId) {
      const spreadsheet = SpreadsheetApp.openById(registry[courseId]);
      readTaskRows_(spreadsheet).forEach(function (task) { rules.push(toTaskRule_(task, courseId)); });
      courses.push({ enabled: true, courseId: courseId, sendStudentNotifications: true });
    });
    replaceArray_(COURSE_CONFIGS, courses);
    replaceArray_(TASK_RULES, rules);
    return true;
  }
  const id = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.CONFIG_SPREADSHEET_ID);
  if (!id) return false;
  loadConfigurationFromSpecificSpreadsheet_(SpreadsheetApp.openById(id));
  return true;
}

function loadConfigurationFromSpecificSpreadsheet_(spreadsheet) {
  applyCourseTemplate_(spreadsheet);
  const courseId = String(COURSE_SETUP_TEMPLATE.existingCourseId || "");
  replaceArray_(COURSE_CONFIGS, courseId ? [{ enabled: true, courseId: courseId, sendStudentNotifications: true }] : []);
  replaceArray_(TASK_RULES, readTaskRows_(spreadsheet).map(function (task) { return toTaskRule_(task, courseId); }));
}

function writeConfigurationSpreadsheet_(spreadsheet) {
  const template = getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  writeTemplateSheet_(template);
  writeParticipantsSheet_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.STUDENTS));
  writeTasksSheet_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TASKS));
  spreadsheet.getSheets().forEach(function (sheet) {
    if ([CONFIG_SHEET_NAMES.TEMPLATE, CONFIG_SHEET_NAMES.STUDENTS, CONFIG_SHEET_NAMES.TASKS].indexOf(sheet.getName()) === -1) {
      spreadsheet.deleteSheet(sheet);
    }
  });
  spreadsheet.setActiveSheet(template);
}

function writeParticipantsSheet_(sheet) {
  writeTableWithHeaders_(sheet, PARTICIPANT_COLUMNS, COURSE_SETUP_TEMPLATE.students || []);
  const editableRows = Math.max((COURSE_SETUP_TEMPLATE.students || []).length + 25, 50);
  sheet.getRange(2, 1, editableRows, 1).insertCheckboxes();
  sheet.getRange(1, 1).setNote("Marca la casilla para invitar a esta persona. Puedes agregar nuevos participantes en las filas vacias.");
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 280);
}

function writeTemplateSheet_(sheet) {
  const template = COURSE_SETUP_TEMPLATE;
  const rows = [
    ["PLANTILLA DE CURSO", ""],
    ["1. CONFIGURA", "Completa esta pestaña, Participantes y Tareas."],
    ["2. GUARDA", "Google Sheets guarda automaticamente."],
    ["3. APLICA", "Opcional: Bot Classroom > Elegir carpeta. Despues marca EJECUTAR."],
    ["EJECUTAR", false], ["Aviso", "No cambies pestañas, encabezados ni nombres de campo."],
    ["Estado", "LISTO"], ["Ultima ejecucion", ""], ["Resultado", "Sin cambios enviados."], ["", ""],
    ["Campo", "Valor"],
    ["existingCourseId", template.existingCourseId], ["courseName", template.course.name],
    ["courseSection", template.course.section], ["descriptionHeading", template.course.descriptionHeading],
    ["courseDescription", template.course.description], ["room", template.course.room],
    ["ownerId", template.course.ownerId], ["courseState", template.course.courseState],
    ["skipExistingCourseWork", template.skipExistingCourseWork], ["defaultState", template.defaultState],
    ["defaultMaxPoints", template.defaultMaxPoints],
    ["recordatorioInvitacionCadaDias", (template.teacherInvitationReminder || {}).everyDays || 2],
    ["horaRecordatorioInvitacion", (template.teacherInvitationReminder || {}).hour || "09:00"],
    ["recordatorioPendientesCadaDias", (template.pendingActivitiesReminder || {}).everyDays || 2],
    ["horaRecordatorioPendientes", (template.pendingActivitiesReminder || {}).hour || "10:00"],
    ["carpetaAlmacenamiento", ""]
  ];
  replaceSheetValues_(sheet, rows);
  sheet.getRange("A1:B1").merge().setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
  sheet.getRange(COURSE_EXECUTION_CONTROL.CHECKBOX).insertCheckboxes().setBackground("#34a853");
  sheet.getRange("A11:B11").setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
  sheet.getRange("B20").insertCheckboxes();
  sheet.getRange("B27").setNote("Opcional. Usa el menu Bot Classroom > Elegir carpeta de almacenamiento o pega aqui la URL de una carpeta de Google Drive.");
  sheet.setColumnWidth(1, 190); sheet.setColumnWidth(2, 620); sheet.getDataRange().setWrap(true);
}

function writeTasksSheet_(sheet) {
  const rulesByTitle = {};
  TASK_RULES.forEach(function (rule) { rulesByTitle[normalizeTaskTitle(rule.title)] = rule; });
  const rows = COURSE_SETUP_TEMPLATE.courseWork.map(function (work) {
    const rule = rulesByTitle[normalizeTaskTitle(work.title)] || {};
    return {
      crearAhora: false, enabled: work.enabled !== false, topic: work.topicName || "",
      nombreActividad: work.title, descripcion: work.description || "",
      reviewMode: rule.reviewMode || REVIEW_MODES.DOCUMENT_ONLY,
      exampleId: rule.exampleFileId || "", prompt: rule.prompt || "",
      validGrade: rule.validGrade || CONFIG.VALID_GRADE, invalidGrade: rule.invalidGrade || CONFIG.INVALID_GRADE,
      maxPoints: work.maxPoints || COURSE_SETUP_TEMPLATE.defaultMaxPoints, state: work.state || COURSE_SETUP_TEMPLATE.defaultState,
      dueDate: work.dueDate ? formatDateParts_(work.dueDate) : "", dueTime: work.dueTime ? formatTimeParts_(work.dueTime) : "",
      recordatorioCadaDias: work.reminderEveryDays || 1, horaRecordatorio: work.reminderHour || "09:00"
    };
  });
  writeTableWithHeaders_(sheet, TASK_COLUMNS, rows);
  const editableRows = Math.max(rows.length + 25, 50);
  sheet.getRange(2, 1, editableRows, 2).insertCheckboxes();
  const reviewRule = SpreadsheetApp.newDataValidation().requireValueInList([REVIEW_MODES.DOCUMENT_ONLY, REVIEW_MODES.AI], true).build();
  sheet.getRange(2, 6, editableRows, 1).setDataValidation(reviewRule);
  sheet.getRange(2, 13, editableRows, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange(2, 14, editableRows, 1).setNumberFormat("HH:mm");
  sheet.getRange(1, 13).setNote("Fecha de entrega. Usa AAAA-MM-DD; por ejemplo: 2026-08-31.");
  sheet.getRange(1, 14).setNote("Hora de entrega en formato de 24 horas. Usa HH:MM; por ejemplo: 23:59.");
  sheet.setColumnWidth(13, 120);
  sheet.setColumnWidth(14, 110);
}

function applyCourseTemplate_(spreadsheet) {
  const values = readTemplateFields_(spreadsheet);
  COURSE_SETUP_TEMPLATE.existingCourseId = values.existingCourseId || "";
  COURSE_SETUP_TEMPLATE.course = { name: values.courseName, section: values.courseSection || "",
    descriptionHeading: values.descriptionHeading || "", description: values.courseDescription || "",
    room: values.room || "", ownerId: values.ownerId || "me", courseState: values.courseState || "ACTIVE" };
  COURSE_SETUP_TEMPLATE.skipExistingCourseWork = values.skipExistingCourseWork !== false;
  COURSE_SETUP_TEMPLATE.defaultState = values.defaultState || "DRAFT";
  COURSE_SETUP_TEMPLATE.defaultMaxPoints = values.defaultMaxPoints || 100;
  COURSE_SETUP_TEMPLATE.teacherInvitationReminder = Object.assign({}, COURSE_SETUP_TEMPLATE.teacherInvitationReminder, {
    everyDays: positiveInteger_(values.recordatorioInvitacionCadaDias, 2), hour: normalizeHour_(values.horaRecordatorioInvitacion, "09:00")
  });
  COURSE_SETUP_TEMPLATE.pendingActivitiesReminder = Object.assign({}, COURSE_SETUP_TEMPLATE.pendingActivitiesReminder, {
    everyDays: positiveInteger_(values.recordatorioPendientesCadaDias, 2), hour: normalizeHour_(values.horaRecordatorioPendientes, "10:00")
  });
  replaceArray_(COURSE_SETUP_TEMPLATE.students,
    readTable_(spreadsheet, CONFIG_SHEET_NAMES.STUDENTS).filter(function (participant) {
      return String(participant.name || "").trim() || String(participant.email || "").trim();
    }));
  const tasks = readTaskRows_(spreadsheet);
  replaceArray_(COURSE_SETUP_TEMPLATE.topics, uniqueTopics_(tasks));
  replaceArray_(COURSE_SETUP_TEMPLATE.courseWork, tasks.map(function (task) {
    return { enabled: task.enabled !== false, topicName: task.topic, title: task.nombreActividad,
      description: task.descripcion || "", maxPoints: task.maxPoints, state: task.state,
      dueDate: parseDateParts_(task.dueDate), dueTime: parseTimeParts_(task.dueTime),
      reminderEveryDays: positiveInteger_(task.recordatorioCadaDias, 1), reminderHour: normalizeHour_(task.horaRecordatorio, "09:00") };
  }));
}

function readTemplateFields_(spreadsheet) {
  const rows = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE).getDataRange().getValues();
  const result = {};
  rows.slice(COURSE_EXECUTION_CONTROL.FIELDS_HEADER_ROW - 1).forEach(function (row) {
    if (row[0]) result[String(row[0]).trim()] = parseCell_(row[1]);
  });
  return result;
}

function readTaskRows_(spreadsheet) {
  return readTable_(spreadsheet, CONFIG_SHEET_NAMES.TASKS).filter(function (row) { return row.nombreActividad; });
}

function toTaskRule_(task, courseId) {
  return { enabled: task.enabled !== false, courseId: courseId || "", title: task.nombreActividad,
    reviewMode: task.reviewMode || REVIEW_MODES.DOCUMENT_ONLY, exampleFileId: task.exampleId || "",
    prompt: task.prompt || "", validGrade: Number(task.validGrade || CONFIG.VALID_GRADE),
    invalidGrade: Number(task.invalidGrade || CONFIG.INVALID_GRADE),
    reminderEveryDays: positiveInteger_(task.recordatorioCadaDias, 1), reminderHour: normalizeHour_(task.horaRecordatorio, "09:00") };
}

function positiveInteger_(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
function normalizeHour_(value, fallback) {
  if (value instanceof Date) return formatTimeParts_({ hours: value.getHours(), minutes: value.getMinutes() });
  const text = String(value || "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : fallback;
}

function uniqueTopics_(tasks) {
  const seen = {};
  return tasks.filter(function (task) {
    const key = normalizeTaskTitle(task.topic);
    if (!key || seen[key]) return false;
    seen[key] = true; return true;
  }).map(function (task) { return { name: task.topic }; });
}

function readTable_(spreadsheet, sheetName) {
  const values = requireSheet_(spreadsheet, sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ""; }); }).map(function (row) {
    const item = {}; headers.forEach(function (header, index) { if (header) item[header] = parseCell_(row[index]); }); return item;
  });
}

function writeTable_(sheet, records) { writeTableWithHeaders_(sheet, collectHeaders_(records), records); }
function writeTableWithHeaders_(sheet, headers, records) {
  replaceSheetValues_(sheet, [headers].concat(records.map(function (record) {
    return headers.map(function (header) { return serializeCell_(record[header]); });
  })));
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
  sheet.autoResizeColumns(1, headers.length);
  records.forEach(function (record, row) { headers.forEach(function (header, column) {
    if (typeof record[header] === "boolean") sheet.getRange(row + 2, column + 1).insertCheckboxes();
  }); });
}

function parseCell_(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (/^(true|verdadero|si|sí)$/i.test(text)) return true;
  if (/^(false|falso|no)$/i.test(text)) return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return value;
}
function parseDateParts_(value) {
  if (!value) return null;
  if (value instanceof Date) return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  const match = String(value).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new Error("Fecha invalida; usa AAAA-MM-DD: " + value);
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (date.getFullYear() !== parts.year || date.getMonth() + 1 !== parts.month || date.getDate() !== parts.day) {
    throw new Error("Fecha invalida; usa una fecha real en formato AAAA-MM-DD: " + value);
  }
  return parts;
}
function parseTimeParts_(value) {
  if (!value) return null;
  if (value instanceof Date) return { hours: value.getHours(), minutes: value.getMinutes() };
  const match = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error("Hora invalida; usa HH:MM en formato de 24 horas: " + value);
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}
function formatDateParts_(value) { return [value.year, padTwo_(value.month), padTwo_(value.day)].join("-"); }
function formatTimeParts_(value) { return padTwo_(value.hours) + ":" + padTwo_(value.minutes); }
function padTwo_(value) { return String(value).padStart(2, "0"); }
function serializeCell_(value) { return value === null || value === undefined ? "" : value; }
function replaceArray_(target, source) { target.splice.apply(target, [0, target.length].concat(source)); }
function collectHeaders_(records) {
  const headers = []; records.forEach(function (record) { Object.keys(record).forEach(function (key) {
    if (headers.indexOf(key) === -1) headers.push(key);
  }); }); return headers.length ? headers : ["enabled"];
}
function getConfigurationSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.CONFIG_SPREADSHEET_ID);
  if (!id) throw new Error("Primero ejecuta crearHojaDeCurso.");
  return SpreadsheetApp.openById(id);
}
function logConfigurationSpreadsheetLink_(spreadsheet, message) { console.log(message + ": " + spreadsheet.getUrl()); }
function getOrCreateSheet_(spreadsheet, name) { return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name); }
function requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name); if (!sheet) throw new Error("Falta la pestaña: " + name); return sheet;
}
function replaceSheetValues_(sheet, rows) {
  sheet.getDataRange().breakApart(); sheet.clear();
  if (rows.length && rows[0].length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
