/**
 * Utilidades compartidas por el procesamiento, los servicios y la evaluacion.
 */

/** Crea un temporizador con el limite seguro de la ejecucion actual. */
function createExecutionTimer(startedAt) {
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);

  if (isNaN(start.getTime())) {
    throw new Error("La fecha de inicio de la ejecucion no es valida.");
  }

  return {
    startedAt: start,
    safeDeadlineMs: start.getTime() + CONFIG.MAX_RUNTIME_MS - CONFIG.SAFETY_MARGIN_MS
  };
}

/** Indica si queda tiempo antes del limite seguro de Apps Script. */
function hasSafeTimeRemaining(timer) {
  return Boolean(timer) && new Date().getTime() < timer.safeDeadlineMs;
}

/** Valida la configuracion indispensable antes de acceder a servicios externos. */
function validateGlobalConfiguration() {
  if (!Number.isFinite(CONFIG.MAX_RUNTIME_MS) || CONFIG.MAX_RUNTIME_MS <= 0) {
    throw new Error("CONFIG.MAX_RUNTIME_MS debe ser un numero positivo.");
  }

  if (!Number.isFinite(CONFIG.SAFETY_MARGIN_MS) || CONFIG.SAFETY_MARGIN_MS < 0) {
    throw new Error("CONFIG.SAFETY_MARGIN_MS debe ser un numero no negativo.");
  }

  if (CONFIG.SAFETY_MARGIN_MS >= CONFIG.MAX_RUNTIME_MS) {
    throw new Error("CONFIG.SAFETY_MARGIN_MS debe ser menor que CONFIG.MAX_RUNTIME_MS.");
  }

  if (!Number.isFinite(CONFIG.MAX_EVIDENCES_PER_RUN) || CONFIG.MAX_EVIDENCES_PER_RUN < 1) {
    throw new Error("CONFIG.MAX_EVIDENCES_PER_RUN debe ser un numero mayor o igual a 1.");
  }

  if (!Array.isArray(TASK_CONFIGS)) {
    throw new Error("TASK_CONFIGS debe ser un arreglo.");
  }

  getActiveTaskConfigs().forEach(function (taskConfig) {
    if (!taskConfig.courseId || !taskConfig.courseWorkId || !taskConfig.exampleFileId) {
      throw new Error("La tarea " + getTaskLabel(taskConfig) + " no tiene todos los IDs requeridos.");
    }
  });
}

/** Devuelve solamente las tareas habilitadas. */
function getActiveTaskConfigs() {
  return TASK_CONFIGS.filter(function (taskConfig) {
    return taskConfig && taskConfig.enabled === true;
  });
}

/** Genera una etiqueta legible para logs y errores. */
function getTaskLabel(taskConfig) {
  if (!taskConfig) {
    return "tarea sin configuracion";
  }

  return taskConfig.name || [taskConfig.courseId, taskConfig.courseWorkId].filter(Boolean).join("/") || "tarea sin nombre";
}

/** Convierte cualquier valor lanzado en un mensaje util para logs. */
function errorToPlainText(error) {
  if (error && error.stack) {
    return String(error.stack);
  }

  if (error && error.message) {
    return String(error.message);
  }

  return String(error);
}

/** Convierte una respuesta JSON, rechazando texto adicional o JSON invalido. */
function parseStrictJson(text) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("La respuesta no contiene JSON.");
  }

  try {
    return JSON.parse(text.trim());
  } catch (error) {
    throw new Error("La respuesta no es JSON valido: " + errorToPlainText(error));
  }
}
