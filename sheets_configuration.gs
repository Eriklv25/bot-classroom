/**
 * Interfaz de configuracion basada en Google Sheets.
 *
 * Ejecuta createConfigurationSpreadsheet una sola vez. El ID se guarda en
 * Script Properties y, desde entonces, el bot carga estas hojas al arrancar.
 * OPENAI_API_KEY nunca se escribe en la hoja.
 */
const CONFIG_SHEET_NAMES = {
  HOME: "INICIO",
  GENERAL: "General",
  COURSES: "Cursos",
  TASK_RULES: "Reglas de tareas",
  CREATION: "Crear tareas",
  TEMPLATE: "Plantilla del curso",
  STUDENTS: "Participantes",
  TOPICS: "Temas",
  TEMPLATE_WORK: "Tareas de plantilla"
};

/**
 * Crea la hoja editable en Mi unidad y devuelve su enlace.
 * Si ya existe una hoja configurada, devuelve la misma en vez de duplicarla.
 */
function createConfigurationSpreadsheet() {
  const existingId = PropertiesService.getScriptProperties().getProperty(
    PROPERTY_KEYS.CONFIG_SPREADSHEET_ID
  );
  if (existingId) {
    try {
      const existingSpreadsheet = SpreadsheetApp.openById(existingId);
      logConfigurationSpreadsheetLink_(existingSpreadsheet, "Hoja de configuracion existente");
      return existingSpreadsheet.getUrl();
    } catch (error) {
      console.log("La hoja configurada anteriormente ya no es accesible; se creara una nueva.");
    }
  }

  const spreadsheet = SpreadsheetApp.create("Configuracion - Bot Classroom");
  const firstSheet = spreadsheet.getSheets()[0];
  firstSheet.setName(CONFIG_SHEET_NAMES.HOME);

  writeConfigurationSpreadsheet_(spreadsheet);
  moveSpreadsheetToConfiguredFolder_(spreadsheet);
  PropertiesService.getScriptProperties().setProperty(
    PROPERTY_KEYS.CONFIG_SPREADSHEET_ID,
    spreadsheet.getId()
  );

  logConfigurationSpreadsheetLink_(spreadsheet, "Hoja creada en Google Drive");
  return spreadsheet.getUrl();
}

/** Alias en español visible en el selector de funciones de Apps Script. */
function crearHojaDeConfiguracion() {
  return createConfigurationSpreadsheet();
}

/** Define la carpeta de Drive para las hojas que se creen despues. */
function configurarCarpetaDeHojas(folderIdOrUrl) {
  const properties = PropertiesService.getScriptProperties();
  const folderId = extractDriveId_(folderIdOrUrl);
  if (!folderId) {
    properties.deleteProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID);
    console.log("Las hojas nuevas se guardaran en Mi unidad.");
    return "";
  }
  const folder = DriveApp.getFolderById(folderId);
  properties.setProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID, folder.getId());
  console.log("Las hojas nuevas se guardaran en: " + folder.getName());
  return folder.getUrl();
}

/** Crea y registra una hoja aislada para un curso existente. */
function crearHojaDeConfiguracionParaCurso(courseId, courseName, folderIdOrUrl) {
  if (!courseId) throw new Error("Indica el courseId del curso.");
  const registry = getCourseSpreadsheetRegistry_();
  if (registry[courseId]) {
    const existing = SpreadsheetApp.openById(registry[courseId]);
    logConfigurationSpreadsheetLink_(existing, "Hoja existente del curso");
    return existing.getUrl();
  }

  const spreadsheet = SpreadsheetApp.create("Configuracion - " + (courseName || ("Curso " + courseId)));
  spreadsheet.getSheets()[0].setName(CONFIG_SHEET_NAMES.HOME);
  const previousCourses = COURSE_CONFIGS.slice();
  const previousExistingCourseId = COURSE_SETUP_TEMPLATE.existingCourseId;
  try {
    replaceArray_(COURSE_CONFIGS, [{ enabled: true, courseId: String(courseId), sendStudentNotifications: false }]);
    COURSE_SETUP_TEMPLATE.existingCourseId = String(courseId);
    writeConfigurationSpreadsheet_(spreadsheet);
  } finally {
    replaceArray_(COURSE_CONFIGS, previousCourses);
    COURSE_SETUP_TEMPLATE.existingCourseId = previousExistingCourseId;
  }

  moveSpreadsheetToConfiguredFolder_(spreadsheet, folderIdOrUrl);
  registry[String(courseId)] = spreadsheet.getId();
  saveCourseSpreadsheetRegistry_(registry);
  logConfigurationSpreadsheetLink_(spreadsheet, "Hoja independiente creada para el curso");
  return spreadsheet.getUrl();
}

/** Sobrescribe la hoja configurada con los valores que actualmente tiene el codigo. */
function resetConfigurationSpreadsheetFromCode() {
  const spreadsheet = getConfigurationSpreadsheet_();
  writeConfigurationSpreadsheet_(spreadsheet);
  return spreadsheet.getUrl();
}

/** Devuelve la URL de la interfaz configurada. */
function getConfigurationSpreadsheetUrl() {
  const spreadsheet = getConfigurationSpreadsheet_();
  logConfigurationSpreadsheetLink_(spreadsheet, "Abre la configuracion aqui");
  return spreadsheet.getUrl();
}

/** Alias en español que vuelve a mostrar el enlace en el registro de ejecucion. */
function verEnlaceHojaDeConfiguracion() {
  return getConfigurationSpreadsheetUrl();
}

/** Carga y valida todas las secciones editables de la hoja. */
function loadConfigurationFromSpreadsheet(loadAllCourseSpreadsheets) {
  const registry = getCourseSpreadsheetRegistry_();
  const courseIds = Object.keys(registry);
  if (loadAllCourseSpreadsheets === true && courseIds.length) {
    const allCourses = [];
    const allRules = [];
    const allCreationRows = [];
    courseIds.forEach(function (courseId) {
      const spreadsheet = SpreadsheetApp.openById(registry[courseId]);
      readTable_(spreadsheet, CONFIG_SHEET_NAMES.COURSES).forEach(function (course) {
        course.courseId = String(courseId);
        allCourses.push(course);
      });
      readTable_(spreadsheet, CONFIG_SHEET_NAMES.TASK_RULES).forEach(function (rule) {
        rule.courseId = String(courseId);
        allRules.push(rule);
      });
      readCreationRows_(spreadsheet).forEach(function (row) {
        row.courseId = String(courseId);
        allCreationRows.push(row);
      });
    });
    replaceArray_(COURSE_CONFIGS, allCourses);
    replaceArray_(TASK_RULES, allRules);
    replaceArray_(COURSE_WORK_CREATION_CONFIGS, allCreationRows);
    return true;
  }

  const propertyValue = PropertiesService.getScriptProperties().getProperty(
    PROPERTY_KEYS.CONFIG_SPREADSHEET_ID
  );
  if (!propertyValue) {
    return false;
  }

  const spreadsheet = SpreadsheetApp.openById(propertyValue);
  applyGeneralConfiguration_(readObjectRows_(spreadsheet, CONFIG_SHEET_NAMES.GENERAL));
  replaceArray_(COURSE_CONFIGS, readTable_(spreadsheet, CONFIG_SHEET_NAMES.COURSES));
  replaceArray_(TASK_RULES, readTable_(spreadsheet, CONFIG_SHEET_NAMES.TASK_RULES));
  replaceArray_(COURSE_WORK_CREATION_CONFIGS, readCreationRows_(spreadsheet));
  applyCourseTemplate_(spreadsheet);
  return true;
}

function getCourseSpreadsheetRegistry_() {
  const value = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS);
  if (!value) return {};
  try {
    return JSON.parse(value) || {};
  } catch (error) {
    throw new Error("COURSE_CONFIG_SPREADSHEETS no contiene JSON valido.");
  }
}

function saveCourseSpreadsheetRegistry_(registry) {
  PropertiesService.getScriptProperties().setProperty(
    PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS,
    JSON.stringify(registry)
  );
}

function extractDriveId_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/[-\w]{20,}/);
  if (!match) throw new Error("No se encontro un ID de carpeta valido.");
  return match[0];
}

function moveSpreadsheetToConfiguredFolder_(spreadsheet, folderIdOrUrl) {
  const folderId = extractDriveId_(folderIdOrUrl) ||
    PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.CONFIG_FOLDER_ID);
  if (!folderId) return;
  DriveApp.getFileById(spreadsheet.getId()).moveTo(DriveApp.getFolderById(folderId));
}

function writeConfigurationSpreadsheet_(spreadsheet) {
  writeHomeSheet_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.HOME), spreadsheet);
  writeObjectRows_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.GENERAL), CONFIG);
  writeTable_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.COURSES), COURSE_CONFIGS);
  writeTable_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TASK_RULES), TASK_RULES);
  writeCreationRows_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.CREATION));
  writeTemplateSheets_(spreadsheet);
  spreadsheet.setActiveSheet(spreadsheet.getSheetByName(CONFIG_SHEET_NAMES.HOME));
}

function writeHomeSheet_(sheet, spreadsheet) {
  const rows = [
    ["CONFIGURACION DEL BOT CLASSROOM", ""],
    ["1", "Edita los valores en las pestañas de este archivo."],
    ["2", "No cambies los nombres de las pestañas ni los encabezados."],
    ["3", "No necesitas guardar: Google Sheets guarda automaticamente."],
    ["4", "Ejecuta el bot normalmente; siempre leera los valores mas recientes."],
    ["Ubicacion", "Este archivo esta en Mi unidad de Google Drive."],
    ["Enlace", spreadsheet.getUrl()],
    ["Seguridad", "OPENAI_API_KEY permanece en Script Properties y no aparece aqui."],
    ["Formatos", "Fechas: AAAA-MM-DD. Horas: HH:MM."],
    ["Ayuda", "La pestaña General explica los valores principales en su tercera columna."]
  ];
  replaceSheetValues_(sheet, rows);
  sheet.setFrozenRows(1);
  sheet.getRange("A1:B1").merge().setBackground("#1a73e8").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(14).setHorizontalAlignment("center");
  sheet.getRange("A2:A10").setFontWeight("bold").setBackground("#e8f0fe");
  sheet.getRange("B7").setFormula('=HYPERLINK("' + spreadsheet.getUrl() + '","ABRIR ESTA HOJA")');
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 620);
  sheet.getRange("A1:B10").setWrap(true).setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
}

function writeObjectRows_(sheet, object) {
  const rows = [["Campo", "Valor", "Ayuda"]];
  Object.keys(object).forEach(function (key) {
    rows.push([key, object[key], getGeneralHelp_(key)]);
  });
  replaceSheetValues_(sheet, rows);
  formatConfigurationSheet_(sheet, 3);
  Object.keys(object).forEach(function (key, index) {
    if (typeof object[key] === "boolean") sheet.getRange(index + 2, 2).insertCheckboxes();
  });
}

function writeTable_(sheet, records) {
  const headers = collectHeaders_(records);
  const rows = [headers].concat(records.map(function (record) {
    return headers.map(function (header) { return serializeCell_(record[header]); });
  }));
  replaceSheetValues_(sheet, rows);
  formatConfigurationSheet_(sheet, Math.max(headers.length, 1));
  addBooleanValidation_(sheet, headers, records);
  addReviewModeValidation_(sheet, headers, records.length);
}

function writeCreationRows_(sheet) {
  const records = COURSE_WORK_CREATION_CONFIGS.map(function (item) {
    return {
      enabled: item.enabled,
      courseId: item.courseId,
      title: item.title,
      description: item.description,
      maxPoints: item.maxPoints,
      state: item.state,
      topicId: item.topicId || "",
      dueDate: item.dueDate ? formatDateParts_(item.dueDate) : "",
      dueTime: item.dueTime ? formatTimeParts_(item.dueTime) : ""
    };
  });
  writeTable_(sheet, records);
}

function writeTemplateSheets_(spreadsheet) {
  const template = COURSE_SETUP_TEMPLATE;
  const flatTemplate = {
    createNewCourse: template.createNewCourse,
    existingCourseId: template.existingCourseId,
    courseName: template.course.name,
    courseSection: template.course.section,
    descriptionHeading: template.course.descriptionHeading,
    courseDescription: template.course.description,
    room: template.course.room,
    ownerId: template.course.ownerId,
    courseState: template.course.courseState,
    invitationReminderEnabled: template.teacherInvitationReminder.enabled,
    invitationReminderSubject: template.teacherInvitationReminder.subject,
    invitationReminderBodyIntro: template.teacherInvitationReminder.bodyIntro,
    skipExistingCourseWork: template.skipExistingCourseWork,
    defaultState: template.defaultState,
    defaultMaxPoints: template.defaultMaxPoints
  };
  writeObjectRows_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE), flatTemplate);
  writeTable_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.STUDENTS), template.students);
  writeTable_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TOPICS), template.topics);
  const templateWork = template.courseWork.map(function (item) {
    const copy = Object.assign({}, item);
    copy.dueDate = item.dueDate ? formatDateParts_(item.dueDate) : "";
    return copy;
  });
  writeTable_(getOrCreateSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE_WORK), templateWork);
}

function readObjectRows_(spreadsheet, sheetName) {
  const values = requireSheet_(spreadsheet, sheetName).getDataRange().getValues();
  const result = {};
  values.slice(1).forEach(function (row) {
    const key = String(row[0] || "").trim();
    if (key) result[key] = parseCell_(row[1]);
  });
  return result;
}

function readTable_(spreadsheet, sheetName) {
  const values = requireSheet_(spreadsheet, sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (value) { return String(value).trim(); });
  return values.slice(1).filter(function (row) {
    return row.some(function (cell) { return cell !== ""; });
  }).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) {
      if (header) record[header] = parseCell_(row[index]);
    });
    return record;
  });
}

function readCreationRows_(spreadsheet) {
  return readTable_(spreadsheet, CONFIG_SHEET_NAMES.CREATION).map(function (row) {
    row.dueDate = parseDateParts_(row.dueDate);
    row.dueTime = parseTimeParts_(row.dueTime);
    if (!row.dueDate) delete row.dueDate;
    if (!row.dueTime) delete row.dueTime;
    return row;
  });
}

function applyGeneralConfiguration_(values) {
  Object.keys(CONFIG).forEach(function (key) {
    if (Object.prototype.hasOwnProperty.call(values, key)) CONFIG[key] = values[key];
  });
}

function applyCourseTemplate_(spreadsheet) {
  const values = readObjectRows_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  COURSE_SETUP_TEMPLATE.createNewCourse = values.createNewCourse;
  COURSE_SETUP_TEMPLATE.existingCourseId = values.existingCourseId || "";
  COURSE_SETUP_TEMPLATE.course = {
    name: values.courseName,
    section: values.courseSection,
    descriptionHeading: values.descriptionHeading,
    description: values.courseDescription,
    room: values.room,
    ownerId: values.ownerId,
    courseState: values.courseState
  };
  COURSE_SETUP_TEMPLATE.teacherInvitationReminder = {
    enabled: values.invitationReminderEnabled,
    subject: values.invitationReminderSubject,
    bodyIntro: values.invitationReminderBodyIntro
  };
  COURSE_SETUP_TEMPLATE.skipExistingCourseWork = values.skipExistingCourseWork;
  COURSE_SETUP_TEMPLATE.defaultState = values.defaultState;
  COURSE_SETUP_TEMPLATE.defaultMaxPoints = values.defaultMaxPoints;
  replaceArray_(COURSE_SETUP_TEMPLATE.students, readTable_(spreadsheet, CONFIG_SHEET_NAMES.STUDENTS));
  replaceArray_(COURSE_SETUP_TEMPLATE.topics, readTable_(spreadsheet, CONFIG_SHEET_NAMES.TOPICS));
  replaceArray_(COURSE_SETUP_TEMPLATE.courseWork, readTable_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE_WORK).map(function (item) {
    item.dueDate = parseDateParts_(item.dueDate);
    return item;
  }));
}

function parseCell_(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (/^(true|verdadero|si|sí)$/i.test(trimmed)) return true;
  if (/^(false|falso|no)$/i.test(trimmed)) return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (/^(null|ninguna)$/i.test(trimmed)) return null;
  return value;
}

function parseDateParts_(value) {
  if (!value) return null;
  if (value instanceof Date) return { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
  const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) throw new Error("Fecha invalida; usa AAAA-MM-DD: " + value);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function parseTimeParts_(value) {
  if (!value) return null;
  if (value instanceof Date) return { hours: value.getHours(), minutes: value.getMinutes() };
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error("Hora invalida; usa HH:MM: " + value);
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function formatDateParts_(value) {
  return [value.year, padTwo_(value.month), padTwo_(value.day)].join("-");
}

function formatTimeParts_(value) {
  return padTwo_(value.hours) + ":" + padTwo_(value.minutes);
}

function padTwo_(value) { return String(value).padStart(2, "0"); }
function serializeCell_(value) { return value === null || value === undefined ? "" : value; }
function replaceArray_(target, source) { target.splice.apply(target, [0, target.length].concat(source)); }

function collectHeaders_(records) {
  const headers = [];
  records.forEach(function (record) {
    Object.keys(record).forEach(function (key) {
      if (headers.indexOf(key) === -1) headers.push(key);
    });
  });
  return headers.length ? headers : ["enabled"];
}

function getConfigurationSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.CONFIG_SPREADSHEET_ID);
  if (!id) throw new Error("Primero ejecuta createConfigurationSpreadsheet.");
  return SpreadsheetApp.openById(id);
}

function logConfigurationSpreadsheetLink_(spreadsheet, message) {
  console.log(message + ": " + spreadsheet.getUrl());
  console.log("Tambien puedes encontrarla en Google Drive con el nombre: " + spreadsheet.getName());
}

function getOrCreateSheet_(spreadsheet, name) {
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("Falta la pestaña de configuracion: " + name);
  return sheet;
}

function replaceSheetValues_(sheet, rows) {
  sheet.getDataRange().breakApart();
  sheet.clear();
  if (rows.length && rows[0].length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}

function formatConfigurationSheet_(sheet, columns) {
  sheet.getBandings().forEach(function (banding) { banding.remove(); });
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columns).setBackground("#1a73e8").setFontColor("#ffffff").setFontWeight("bold");
  sheet.autoResizeColumns(1, columns);
  if (sheet.getMaxRows() > 1) sheet.getRange(2, 1, sheet.getMaxRows() - 1, columns).applyRowBanding();
}

function addBooleanValidation_(sheet, headers, records) {
  if (!records.length) return;
  headers.forEach(function (header, index) {
    const containsBoolean = records.some(function (record) { return typeof record[header] === "boolean"; });
    if (containsBoolean) {
      sheet.getRange(2, index + 1, records.length, 1).insertCheckboxes();
    }
  });
}

function addReviewModeValidation_(sheet, headers, rowCount) {
  const index = headers.indexOf("reviewMode");
  if (index === -1 || !rowCount) return;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList([REVIEW_MODES.DOCUMENT_ONLY, REVIEW_MODES.AI], true).build();
  sheet.getRange(2, index + 1, rowCount, 1).setDataValidation(rule);
}

function getGeneralHelp_(key) {
  const help = {
    DRY_RUN: "TRUE prueba sin escribir calificaciones.",
    EVALUATE_WITH_OPENAI_IN_DRY_RUN: "Permite llamar a OpenAI durante la prueba.",
    MAX_RUNTIME_MS: "Tiempo maximo del lote en milisegundos.",
    SAFETY_MARGIN_MS: "Margen antes del limite de ejecucion.",
    MAX_EVIDENCES_PER_RUN: "Entregas maximas por corrida.",
    ADMIN_EMAIL: "Correo que recibe errores y resumenes.",
    SHEETS_LOG_ID: "ID de la hoja de bitacora; puede ser esta misma hoja.",
    OPENAI_MODEL: "Modelo utilizado para revisar PDFs.",
    TRIGGER_EVERY_HOURS: "Frecuencia del trigger en horas."
  };
  return help[key] || "Valor general del bot.";
}
