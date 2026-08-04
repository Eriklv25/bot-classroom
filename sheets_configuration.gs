/** Interfaz de configuracion: exactamente una hoja de curso, participantes y tareas. */
const CONFIG_SHEET_NAMES = {
  TEMPLATE: "Plantilla de curso",
  STUDENTS: "Participantes",
  TASKS: "Tareas"
};

/** Zona horaria civil usada por todos los valores capturados en las hojas. */
const COURSE_SHEET_TIME_ZONE = "America/Mexico_City";
// Apps Script solo admite estos intervalos para triggers periodicos. El trigger
// despierta el proceso; isScheduledReminderDue_ decide si toca enviar y evita
// que una misma clave se repita durante el dia.
const REMINDER_TRIGGER_INTERVALS_MINUTES = [1, 5, 10, 15, 30, 60, 120, 240, 360, 480, 720];
const DEFAULT_REMINDER_TRIGGER_MINUTES = 60;
const REMINDER_TRIGGER_PROPERTY = "REMINDER_TRIGGER_INTERVAL_MINUTES";
const REMINDER_TRIGGER_MODE_PROPERTY = "REMINDER_TRIGGER_MODE";
const REMINDER_TRIGGER_MODE = "ONE_SHOT_V1";
const REMINDER_TRIGGER_MINIMUM_DELAY_MS = 60 * 1000;
// Un trigger instalable dispone normalmente de seis minutos. Se corta antes para
// que alcance a registrar el diagnostico, liberar el lock y crear el siguiente.
const REMINDER_SAFE_RUNTIME_MS = 4 * 60 * 1000;

const COURSE_EXECUTION_CONTROL = {
  CHECKBOX: "B5",
  STATUS: "B7",
  LAST_RUN: "B8",
  RESULT: "B9",
  REMOVE_ID: "B10",
  FIELDS_HEADER_ROW: 12
};

const TASK_COLUMNS = [
  "crearAhora", "enabled", "topic", "nombreActividad", "descripcion",
  "reviewMode", "exampleId", "prompt", "validGrade", "invalidGrade",
  "maxPoints", "state", "dueDate", "dueTime"
];

const PARTICIPANT_COLUMNS = ["selected", "name", "email", "rol"];

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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet && spreadsheet.getSheetByName(CONFIG_SHEET_NAMES.TEMPLATE)) {
    ensureReminderTriggerField_(spreadsheet);
    removeLegacyTaskReminderColumns_(spreadsheet);
  }
  SpreadsheetApp.getUi().createMenu("Bot Classroom")
    .addItem("Elegir carpeta de almacenamiento", "elegirCarpetaDeAlmacenamiento")
    .addItem("Listar hojas de cursos", "listarHojasDeCursos")
    .addItem("Limpiar cursos de la papelera", "limpiarRegistroDeCursosEnPapelera")
    .addSeparator()
    .addItem("Revisar recordatorios ahora", "procesarRecordatoriosAhora")
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

/** Aplica desde EJECUTAR todos los cambios, incluidas las tareas seleccionadas. */
function ejecutarCambiosDelCurso(event) {
  if (event && event.source) ensureCourseRetirementControl_(event.source);
  if (event && event.source) removeLegacyTaskReminderColumns_(event.source);
  if (event && isCourseRegistryRemovalEdit_(event)) {
    const courseId = String(event.value || "").trim();
    const result = retirarCursoDelRegistro(courseId);
    // Conserva el ID visible si la operacion falla (por ejemplo, si otra
    // ejecucion mantiene el lock) para que el usuario pueda volver a intentar.
    event.range.clearContent();
    const templateSheet = requireSheet_(event.source, CONFIG_SHEET_NAMES.TEMPLATE);
    setCourseExecutionStatus_(templateSheet, result.removed ? "CURSO RETIRADO" : "SIN CAMBIOS",
      result.removed
        ? "Se retiro del registro el curso " + courseId + ". No se borro su hoja ni Classroom."
        : "El curso " + courseId + " no estaba registrado.");
    return result;
  }
  if (event && !isCourseExecutionEdit_(event)) return null;
  const spreadsheet = event && event.source ? event.source : getConfigurationSpreadsheet_();
  ensureReminderTriggerField_(spreadsheet);
  const templateSheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  if (event) event.range.setValue(false);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    setCourseExecutionStatus_(templateSheet, "OCUPADO", "Ya hay otra ejecucion en curso.");
    return null;
  }
  try {
    setCourseExecutionStatus_(templateSheet, "EJECUTANDO", "Leyendo la configuracion...");
    loadConfigurationFromSpecificSpreadsheet_(spreadsheet);
    ensureCourseConfigurationTrigger_(spreadsheet);
    const template = COURSE_SETUP_TEMPLATE;
    const selectedTaskTitles = readTaskRows_(spreadsheet).filter(function (task) {
      return task.crearAhora === true;
    }).map(function (task) { return String(task.nombreActividad || "").trim(); });
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
    const setup = createCourseSetupFromTemplate(Object.assign({}, template, {
      courseId: courseId,
      // Las casillas se conservan para mostrar que la tarea ya fue solicitada.
      createMissingCourseWork: selectedTaskTitles.length > 0,
      createOnlyCourseWorkTitles: selectedTaskTitles
    }));
    const invitations = inviteStudentsFromTemplate(courseId, template.students || []);
    registerCourseSpreadsheet_(courseId, spreadsheet);
    resetCourseReminderSchedule_(courseId);
    // ensureCourseConfigurationTrigger_ puede conservar un trigger one-shot que
    // fue creado con la configuracion anterior. Al terminar EJECUTAR se reemplaza
    // siempre para que el contador (por ejemplo, cinco minutos) empiece ahora y
    // exista una proxima ejecucion verificable.
    const nextReminderMinutes = getShortestConfiguredReminderTriggerMinutes_(spreadsheet);
    scheduleNextReminderRun_(nextReminderMinutes);
    console.info("Proxima revision de recordatorios programada en aproximadamente " +
      nextReminderMinutes + " minuto(s). Handler=procesarRecordatoriosProgramados");
    setCourseExecutionStatus_(templateSheet, "COMPLETADO",
      (created ? "Curso creado" : "Curso actualizado") + ": " + course.name + " (" + courseId +"). " +
      "Proxima revision de recordatorios en aproximadamente " + nextReminderMinutes + " minuto(s).");
    return { course: course, created: created, setup: setup, studentInvitations: invitations,
      nextReminderMinutes: nextReminderMinutes };
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

function isCourseRegistryRemovalEdit_(event) {
  return event && event.range && String(event.value || "").trim() !== "" &&
    event.range.getSheet().getName() === CONFIG_SHEET_NAMES.TEMPLATE &&
    event.range.getA1Notation() === COURSE_EXECUTION_CONTROL.REMOVE_ID;
}

/** Agrega el control tambien a las hojas creadas antes de esta funcionalidad. */
function ensureCourseRetirementControl_(spreadsheet) {
  const sheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  sheet.getRange("A10").setValue("RETIRAR ID ANTIGUO");
  sheet.getRange(COURSE_EXECUTION_CONTROL.REMOVE_ID)
    .setBackground("#fce8e6")
    .setNumberFormat("@")
    .setNote("Pega aqui un courseId antiguo y presiona Enter. Se retirara de los recordatorios sin borrar la hoja ni el curso.");
}

function isTaskCreationEdit_(event) {
  return event && event.range && String(event.value).toUpperCase() === "TRUE" &&
    event.range.getSheet().getName() === CONFIG_SHEET_NAMES.TASKS && event.range.getColumn() === 1 &&
    event.range.getRow() > 1;
}

function ensureCourseConfigurationTrigger_(spreadsheet) {
  let triggers = ScriptApp.getProjectTriggers();
  const spreadsheetId = spreadsheet.getId();

  // Las hojas son creadas por un proyecto independiente, por lo que antiguamente
  // se instalaba tambien un onOpen por archivo. Esos triggers solo agregaban un
  // menu auxiliar y agotaban rapidamente la cuota de triggers del proyecto. Se
  // eliminan al migrar; el flujo principal depende unicamente del onEdit.
  triggers.filter(function (trigger) {
    return trigger.getHandlerFunction() === "onOpen" &&
      trigger.getEventType() === ScriptApp.EventType.ON_OPEN;
  }).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });

  // Conserva exactamente un trigger de edicion para esta hoja. Ademas de evitar
  // duplicados, hacerlo despues de la limpieza libera cuota antes de crear uno.
  triggers = ScriptApp.getProjectTriggers();
  const editTriggers = triggers.filter(function (trigger) {
    return trigger.getHandlerFunction() === "ejecutarCambiosDelCurso" &&
      trigger.getTriggerSourceId() === spreadsheetId &&
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  editTriggers.slice(1).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  if (!editTriggers.length) {
    ScriptApp.newTrigger("ejecutarCambiosDelCurso").forSpreadsheet(spreadsheet).onEdit().create();
  }

  triggers = ScriptApp.getProjectTriggers();
  const reminderTriggers = triggers.filter(function (trigger) {
    return trigger.getHandlerFunction() === "procesarRecordatoriosProgramados" &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  });
  const intervalMinutes = getShortestConfiguredReminderTriggerMinutes_(spreadsheet);
  const properties = PropertiesService.getScriptProperties();
  const currentInterval = Number(properties.getProperty(REMINDER_TRIGGER_PROPERTY));
  const currentMode = properties.getProperty(REMINDER_TRIGGER_MODE_PROPERTY);
  if (currentInterval !== intervalMinutes || currentMode !== REMINDER_TRIGGER_MODE ||
      reminderTriggers.length !== 1) {
    reminderTriggers.forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
    createReminderClockTrigger_(intervalMinutes);
    properties.setProperty(REMINDER_TRIGGER_PROPERTY, String(intervalMinutes));
    properties.setProperty(REMINDER_TRIGGER_MODE_PROPERTY, REMINDER_TRIGGER_MODE);
  }
}

/**
 * Programa una sola ejecucion futura.
 *
 * No se usa everyMinutes/everyHours: un trigger periodico vuelve a arrancar
 * aunque la corrida anterior siga trabajando. La siguiente ejecucion se arma
 * al terminar la actual, de modo que nunca se acumulan invocaciones en cola.
 */
function createReminderClockTrigger_(intervalMinutes) {
  const delayMs = Math.max(REMINDER_TRIGGER_MINIMUM_DELAY_MS, Number(intervalMinutes) * 60 * 1000);
  return ScriptApp.newTrigger("procesarRecordatoriosProgramados").timeBased().after(delayMs).create();
}

/** Sustituye cualquier trigger previo por la unica siguiente ejecucion. */
function scheduleNextReminderRun_(intervalMinutes) {
  ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === "procesarRecordatoriosProgramados" &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  }).forEach(function (trigger) { ScriptApp.deleteTrigger(trigger); });
  createReminderClockTrigger_(intervalMinutes);
  PropertiesService.getScriptProperties().setProperty(
    REMINDER_TRIGGER_PROPERTY, String(intervalMinutes));
  PropertiesService.getScriptProperties().setProperty(
    REMINDER_TRIGGER_MODE_PROPERTY, REMINDER_TRIGGER_MODE);
}

/** Usa la frecuencia mas corta para que una hoja no retrase a las demas. */
function getShortestConfiguredReminderTriggerMinutes_(currentSpreadsheet) {
  const spreadsheetIds = [];
  const addId = function (id) {
    if (id && spreadsheetIds.indexOf(id) === -1) spreadsheetIds.push(id);
  };
  if (currentSpreadsheet) addId(currentSpreadsheet.getId());
  const registry = getCourseSpreadsheetRegistry_();
  Object.keys(registry).forEach(function (courseId) { addId(registry[courseId]); });

  const intervals = spreadsheetIds.map(function (spreadsheetId) {
    try {
      const spreadsheet = currentSpreadsheet && currentSpreadsheet.getId() === spreadsheetId
        ? currentSpreadsheet : SpreadsheetApp.openById(spreadsheetId);
      return normalizeReminderTriggerMinutes_(
        readTemplateFields_(spreadsheet).intervaloTriggerRecordatoriosMinutos,
        DEFAULT_REMINDER_TRIGGER_MINUTES
      );
    } catch (error) {
      console.info("No se pudo leer el intervalo del trigger en la hoja " + spreadsheetId + ": " + errorToPlainText(error));
      return null;
    }
  }).filter(function (interval) { return interval !== null; });
  return intervals.length ? Math.min.apply(null, intervals) : DEFAULT_REMINDER_TRIGGER_MINUTES;
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

/**
 * Quita del registro las hojas enviadas a la papelera o que ya no existen.
 *
 * El registro vive en las propiedades del proyecto, no en Drive. Por eso mover
 * o borrar definitivamente una hoja no elimina por si solo su courseId.
 */
function limpiarRegistroDeCursosEnPapelera() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(REMINDER_SAFE_RUNTIME_MS)) {
    throw new Error("No se pudo limpiar el registro porque hay otra ejecucion en curso.");
  }
  try {
    return limpiarRegistroDeCursosInaccesibles_();
  } finally {
    lock.releaseLock();
  }
}

/** Debe ejecutarse con el ScriptLock adquirido. */
function limpiarRegistroDeCursosInaccesibles_() {
  const registry = getCourseSpreadsheetRegistry_();
  const removed = [];
  Object.keys(registry).forEach(function (courseId) {
    const spreadsheetId = registry[courseId];
    let reason = "";
    try {
      if (DriveApp.getFileById(spreadsheetId).isTrashed()) reason = "in_trash";
    } catch (error) {
      // Una hoja borrada definitivamente ya no puede abrirse para preguntar si
      // esta en la papelera. En ese caso tambien es una entrada huerfana.
      reason = "not_accessible";
    }
    if (!reason) return;
    delete registry[courseId];
    resetCourseReminderSchedule_(courseId);
    removed.push({ courseId: courseId, spreadsheetId: spreadsheetId, reason: reason });
  });
  if (removed.length) {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS, JSON.stringify(registry));
  }
  console.info("Limpieza de cursos huerfanos: " + JSON.stringify(removed));
  return { removed: removed, remainingCourseIds: Object.keys(registry) };
}

/**
 * Retira un courseId del recorrido global sin borrar el curso ni su hoja.
 * Puede llamarse desde el editor: retirarCursoDelRegistro("123456789").
 */
function retirarCursoDelRegistro(courseId) {
  const cleanCourseId = String(courseId || "").trim();
  if (!cleanCourseId) throw new Error("Indica el courseId que deseas retirar.");

  // La retirada es una operacion read-modify-write. Sin el mismo ScriptLock
  // que usan la configuracion y los recordatorios, varias ediciones seguidas
  // pueden leer el registro antiguo y la ultima escritura vuelve a introducir
  // los IDs que las anteriores acababan de quitar.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(REMINDER_SAFE_RUNTIME_MS)) {
    throw new Error("No se pudo retirar el curso porque hay otra ejecucion en curso. " +
      "El ID permanece en la celda para volver a intentarlo.");
  }
  try {
    const registry = getCourseSpreadsheetRegistry_();
    if (!Object.prototype.hasOwnProperty.call(registry, cleanCourseId)) {
      return { courseId: cleanCourseId, removed: false, reason: "not_registered" };
    }

    const spreadsheetId = registry[cleanCourseId];
    delete registry[cleanCourseId];
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.COURSE_CONFIG_SPREADSHEETS, JSON.stringify(registry));
    resetCourseReminderSchedule_(cleanCourseId);
    console.info("Curso retirado del registro: " + cleanCourseId +
      ". La hoja y el curso de Classroom no fueron eliminados.");
    return { courseId: cleanCourseId, spreadsheetId: spreadsheetId, removed: true };
  } finally {
    lock.releaseLock();
  }
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
  console.info("Hojas de cursos: " + JSON.stringify(courses));
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
      try {
        const spreadsheet = SpreadsheetApp.openById(registry[courseId]);
        readTaskRows_(spreadsheet).forEach(function (task) { rules.push(toTaskRule_(task, courseId)); });
        courses.push({ enabled: true, courseId: courseId });
      } catch (error) {
        console.info("Se omite la configuracion inaccesible del curso " + courseId + ": " + errorToPlainText(error));
      }
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
  replaceArray_(COURSE_CONFIGS, courseId ? [{ enabled: true, courseId: courseId }] : []);
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
  const participants = (COURSE_SETUP_TEMPLATE.students || []).map(function (participant) {
    return Object.assign({ rol: "ALUMNO" }, participant);
  });
  writeTableWithHeaders_(sheet, PARTICIPANT_COLUMNS, participants);
  const editableRows = Math.max((COURSE_SETUP_TEMPLATE.students || []).length + 25, 50);
  sheet.getRange(2, 1, editableRows, 1).insertCheckboxes();
  sheet.getRange(1, 1).setNote("Marca la casilla para invitar a esta persona. Puedes agregar nuevos participantes en las filas vacias.");
  const roleRule = SpreadsheetApp.newDataValidation().requireValueInList(["ALUMNO", "PROFESOR"], true).build();
  sheet.getRange(2, 4, editableRows, 1).setDataValidation(roleRule);
  sheet.getRange(1, 4).setNote("Elige ALUMNO o PROFESOR para definir el rol de la invitacion en Classroom.");
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 130);
}

function writeTemplateSheet_(sheet) {
  const template = COURSE_SETUP_TEMPLATE;
  const rows = [
    ["PLANTILLA DE CURSO", ""],
    ["1. CONFIGURA", "Completa esta pestaña, Participantes y Tareas."],
    ["2. GUARDA", "Google Sheets guarda automaticamente."],
    ["3. APLICA", "Opcional: Bot Classroom > Elegir carpeta. Despues marca EJECUTAR."],
    ["EJECUTAR", false], ["Aviso", "No cambies pestañas, encabezados ni nombres de campo."],
    ["Estado", "LISTO"], ["Ultima ejecucion", ""], ["Resultado", "Sin cambios enviados."],
    ["RETIRAR ID ANTIGUO", ""],
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
    ["intervaloTriggerRecordatoriosMinutos", template.reminderTriggerEveryMinutes || DEFAULT_REMINDER_TRIGGER_MINUTES],
    ["zonaHoraria", COURSE_SHEET_TIME_ZONE],
    ["carpetaAlmacenamiento", ""]
  ];
  replaceSheetValues_(sheet, rows);
  sheet.getRange("A1:B1").merge().setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
  sheet.getRange(COURSE_EXECUTION_CONTROL.CHECKBOX).insertCheckboxes().setBackground("#34a853");
  sheet.getRange(COURSE_EXECUTION_CONTROL.REMOVE_ID)
    .setBackground("#fce8e6")
    .setNumberFormat("@")
    .setNote("Pega aqui un courseId antiguo y presiona Enter. Se retirara de los recordatorios sin borrar la hoja ni el curso.");
  sheet.getRange("A11:B11").setBackground("#1a73e8").setFontColor("white").setFontWeight("bold");
  sheet.getRange("B20").insertCheckboxes();
  configureReminderTriggerFieldRange_(sheet.getRange("B27"));
  sheet.getRange("B28").setNote("Zona horaria usada para todas las horas de esta hoja: Ciudad de Mexico.");
  sheet.getRange("B29").setNote("Opcional. Usa el menu Bot Classroom > Elegir carpeta de almacenamiento o pega aqui la URL de una carpeta de Google Drive.");
  sheet.setColumnWidth(1, 190); sheet.setColumnWidth(2, 620); sheet.getDataRange().setWrap(true);
}

/** Agrega el campo a hojas creadas antes de que la frecuencia fuera editable. */
function ensureReminderTriggerField_(spreadsheet) {
  const sheet = requireSheet_(spreadsheet, CONFIG_SHEET_NAMES.TEMPLATE);
  const values = sheet.getDataRange().getValues();
  let fieldRow = 0;
  for (let index = COURSE_EXECUTION_CONTROL.FIELDS_HEADER_ROW - 1; index < values.length; index++) {
    if (String(values[index][0] || "").trim() === "intervaloTriggerRecordatoriosMinutos") {
      fieldRow = index + 1;
      break;
    }
  }
  if (!fieldRow) {
    fieldRow = sheet.getLastRow() + 1;
    sheet.getRange(fieldRow, 1, 1, 2).setValues([
      ["intervaloTriggerRecordatoriosMinutos", DEFAULT_REMINDER_TRIGGER_MINUTES]
    ]);
  }
  configureReminderTriggerFieldRange_(sheet.getRange(fieldRow, 2));
}

function configureReminderTriggerFieldRange_(range) {
  range.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(REMINDER_TRIGGER_INTERVALS_MINUTES.map(String), true).build())
    .setNote([
      "Cada cuantos minutos el bot despierta para COMPROBAR si corresponde enviar recordatorios.",
      "No significa que enviara correos cada ese numero de minutos: las horas, los dias y la proteccion contra duplicados siguen aplicando.",
      "Ejemplo: con 5, revisa aproximadamente cada 5 minutos; si el correo esta configurado para las 09:00, antes de las 09:00 no lo envia.",
      "Si hay varios cursos, se usa el intervalo mas corto configurado."
    ].join("\n"));
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
      dueDate: work.dueDate ? formatDateParts_(work.dueDate) : "", dueTime: work.dueTime ? formatTimeParts_(work.dueTime) : ""
    };
  });
  writeTableWithHeaders_(sheet, TASK_COLUMNS, rows);
  const editableRows = Math.max(rows.length + 25, 50);
  sheet.getRange(2, 1, editableRows, 2).insertCheckboxes();
  sheet.getRange(1, 1).setNote("Selecciona una o varias tareas y despues marca EJECUTAR en Plantilla de curso. Las casillas permanecen seleccionadas como referencia.");
  sheet.getRange(1, 2).setNote("Activa o desactiva la revision automatica de esta tarea. No crea la tarea en Classroom.");
  sheet.getRange(1, 13).setNote("Fecha limite en formato AAAA-MM-DD (por ejemplo, 2026-08-31).");
  sheet.getRange(1, 14).setNote("Hora limite en formato HH:MM de 24 horas (por ejemplo, 23:59), usando la zona horaria indicada en Plantilla de curso.");
  sheet.getRange(2, 13, editableRows, 1).setNumberFormat("yyyy-mm-dd");
  sheet.getRange(2, 14, editableRows, 1).setNumberFormat("hh:mm");
  const reviewRule = SpreadsheetApp.newDataValidation().requireValueInList([REVIEW_MODES.DOCUMENT_ONLY, REVIEW_MODES.AI], true).build();
  sheet.getRange(2, 6, editableRows, 1).setDataValidation(reviewRule);
}

/** Retira de hojas existentes la antigua programacion individual por tarea. */
function removeLegacyTaskReminderColumns_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CONFIG_SHEET_NAMES.TASKS);
  if (!sheet || sheet.getLastColumn() === 0) return;
  const legacyHeaders = ["recordatorioCadaDia", "recordatorioCadaDias", "horaRecordatorio"];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (let index = headers.length - 1; index >= 0; index--) {
    if (legacyHeaders.indexOf(String(headers[index] || "").trim()) !== -1) {
      sheet.deleteColumn(index + 1);
    }
  }
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
    everyDays: nonNegativeInteger_(values.recordatorioInvitacionCadaDias, 2), hour: normalizeHour_(values.horaRecordatorioInvitacion, "09:00")
  });
  COURSE_SETUP_TEMPLATE.pendingActivitiesReminder = Object.assign({}, COURSE_SETUP_TEMPLATE.pendingActivitiesReminder, {
    everyDays: nonNegativeInteger_(values.recordatorioPendientesCadaDias, 2), hour: normalizeHour_(values.horaRecordatorioPendientes, "10:00")
  });
  COURSE_SETUP_TEMPLATE.reminderTriggerEveryMinutes = normalizeReminderTriggerMinutes_(
    values.intervaloTriggerRecordatoriosMinutos, DEFAULT_REMINDER_TRIGGER_MINUTES);
  replaceArray_(COURSE_SETUP_TEMPLATE.students,
    readTable_(spreadsheet, CONFIG_SHEET_NAMES.STUDENTS).filter(function (participant) {
      return String(participant.name || "").trim() || String(participant.email || "").trim();
    }));
  const tasks = readTaskRows_(spreadsheet);
  replaceArray_(COURSE_SETUP_TEMPLATE.topics, uniqueTopics_(tasks));
  replaceArray_(COURSE_SETUP_TEMPLATE.courseWork, tasks.map(function (task) {
    return { enabled: task.enabled !== false, topicName: task.topic, title: task.nombreActividad,
      description: task.descripcion || "", maxPoints: task.maxPoints, state: task.state,
      dueDate: parseDateParts_(task.dueDate), dueTime: parseTimeParts_(task.dueTime) };
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
    invalidGrade: Number(task.invalidGrade || CONFIG.INVALID_GRADE) };
}

function positiveInteger_(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}
function nonNegativeInteger_(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function normalizeReminderTriggerMinutes_(value, fallback) {
  const number = Number(value || fallback);
  if (REMINDER_TRIGGER_INTERVALS_MINUTES.indexOf(number) === -1) {
    throw new Error("Intervalo de trigger invalido. Usa uno de estos valores en minutos: " +
      REMINDER_TRIGGER_INTERVALS_MINUTES.join(", ") + ".");
  }
  return number;
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
    throw new Error("Fecha inexistente; usa AAAA-MM-DD: " + value);
  }
  return parts;
}
function parseTimeParts_(value) {
  if (!value) return null;
  if (value instanceof Date) return { hours: value.getHours(), minutes: value.getMinutes() };
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error("Hora invalida; usa HH:MM: " + value);
  const parts = { hours: Number(match[1]), minutes: Number(match[2]) };
  if (parts.hours > 23 || parts.minutes > 59) throw new Error("Hora inexistente; usa HH:MM de 00:00 a 23:59: " + value);
  return parts;
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
function logConfigurationSpreadsheetLink_(spreadsheet, message) { console.info(message + ": " + spreadsheet.getUrl()); }
function getOrCreateSheet_(spreadsheet, name) { return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name); }
function requireSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name); if (!sheet) throw new Error("Falta la pestaña: " + name); return sheet;
}
function replaceSheetValues_(sheet, rows) {
  sheet.getDataRange().breakApart(); sheet.clear();
  if (rows.length && rows[0].length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
}
