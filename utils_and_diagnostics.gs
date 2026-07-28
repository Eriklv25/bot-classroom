/**
 * Crea el temporizador utilizado para respetar el limite de Apps Script.
 *
 * Recibe: fecha en la que inicio el lote.
 * Devuelve: objeto con inicio y limite seguro de ejecucion.
 */
function createExecutionTimer(startedAt) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  const safeRuntimeMs = CONFIG.MAX_RUNTIME_MS - CONFIG.SAFETY_MARGIN_MS;

  return {
    startedAt: start,
    safeDeadlineMs: start.getTime() + safeRuntimeMs
  };
}

/**
 * Indica si queda tiempo suficiente para iniciar otra operacion del lote.
 */
function hasSafeTimeRemaining(timer) {
  return Boolean(timer) && Date.now() < timer.safeDeadlineMs;
}

/**
 * Valida los valores indispensables antes de consultar servicios externos.
 */
function validateGlobalConfiguration() {
  if (typeof CONFIG !== "object" || !CONFIG) {
    throw new Error("Falta definir CONFIG.");
  }

  if (!Number.isFinite(CONFIG.MAX_RUNTIME_MS) || CONFIG.MAX_RUNTIME_MS <= 0) {
    throw new Error("CONFIG.MAX_RUNTIME_MS debe ser mayor que cero.");
  }

  if (!Number.isFinite(CONFIG.SAFETY_MARGIN_MS) || CONFIG.SAFETY_MARGIN_MS < 0) {
    throw new Error("CONFIG.SAFETY_MARGIN_MS no puede ser negativo.");
  }

  if (CONFIG.SAFETY_MARGIN_MS >= CONFIG.MAX_RUNTIME_MS) {
    throw new Error("CONFIG.SAFETY_MARGIN_MS debe ser menor que CONFIG.MAX_RUNTIME_MS.");
  }

  if (!Number.isInteger(CONFIG.MAX_EVIDENCES_PER_RUN) || CONFIG.MAX_EVIDENCES_PER_RUN < 1) {
    throw new Error("CONFIG.MAX_EVIDENCES_PER_RUN debe ser un entero mayor que cero.");
  }

  if (!Array.isArray(TASK_CONFIGS)) {
    throw new Error("Falta definir TASK_CONFIGS.");
  }

  getActiveTaskConfigs().forEach(function (taskConfig, index) {
    ["courseId", "courseWorkId", "exampleFileId"].forEach(function (fieldName) {
      if (!taskConfig[fieldName]) {
        throw new Error("Falta TASK_CONFIGS[" + index + "]." + fieldName + ".");
      }
    });
  });
}

/**
 * Devuelve solamente las tareas habilitadas para el lote.
 */
function getActiveTaskConfigs() {
  if (!Array.isArray(TASK_CONFIGS)) {
    return [];
  }

  return TASK_CONFIGS.filter(function (taskConfig) {
    return taskConfig && taskConfig.enabled === true;
  });
}

/**
 * Construye una etiqueta legible para registros y mensajes de error.
 */
function getTaskLabel(taskConfig) {
  if (!taskConfig) {
    return "tarea sin configuracion";
  }

  if (taskConfig.name) {
    return taskConfig.name;
  }

  return "courseId=" + (taskConfig.courseId || "?")
    + ", courseWorkId=" + (taskConfig.courseWorkId || "?");
}

/**
 * Convierte cualquier valor capturado a texto util para logs y correos.
 */
function errorToPlainText(error) {
  if (error === null || typeof error === "undefined") {
    return "Error desconocido";
  }

  if (error instanceof Error) {
    return error.stack || error.message || String(error);
  }

  if (typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch (serializationError) {
      return String(error);
    }
  }

  return String(error);
}

/**
 * Parsea texto JSON y rechaza respuestas vacias o valores que no sean objetos.
 */
function parseStrictJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("No se recibio texto JSON.");
  }

  const parsed = JSON.parse(text.trim());
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("La respuesta JSON debe ser un objeto.");
  }

  return parsed;
}
