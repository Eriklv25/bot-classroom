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

  if (!Array.isArray(COURSE_CONFIGS) || !Array.isArray(TASK_RULES)) {
    throw new Error("COURSE_CONFIGS y TASK_RULES deben ser arreglos.");
  }

  COURSE_CONFIGS.filter(function (courseConfig) {
    return courseConfig && courseConfig.enabled === true;
  }).forEach(function (courseConfig) {
    if (!courseConfig.courseId) {
      throw new Error("Un curso activo no tiene courseId.");
    }
  });

  const configuredTitles = {};
  TASK_RULES.filter(function (rule) {
    return rule && rule.enabled === true;
  }).forEach(function (rule) {
    if (!rule.title) {
      throw new Error("Cada regla activa debe tener title.");
    }

    const reviewMode = rule.reviewMode || REVIEW_MODES.AI;
    if (reviewMode !== REVIEW_MODES.DOCUMENT_ONLY && reviewMode !== REVIEW_MODES.AI) {
      throw new Error("reviewMode invalido para la tarea: " + rule.title);
    }

    if (reviewMode === REVIEW_MODES.AI && rule.exampleFileId && /^ID_PDF_/.test(rule.exampleFileId)) {
      throw new Error("Reemplaza el ID de ejemplo antes de activar la regla: " + rule.title);
    }

    const normalizedTitle = (rule.courseId || "*") + ":" + normalizeTaskTitle(rule.title);
    if (configuredTitles[normalizedTitle]) {
      throw new Error("Hay mas de una regla activa para la tarea: " + rule.title);
    }
    configuredTitles[normalizedTitle] = true;
  });
}

/** Descubre las tareas publicadas cuyo titulo coincide con una regla. */
function getActiveTaskConfigs(options) {
  options = options || {};
  const taskConfigs = [];
  const activeRules = TASK_RULES.filter(function (rule) {
    return rule && rule.enabled === true;
  });

  const enabledCourses = COURSE_CONFIGS.filter(function (courseConfig) {
    return courseConfig && courseConfig.enabled === true;
  });

  for (let courseIndex = 0; courseIndex < enabledCourses.length; courseIndex++) {
    const courseConfig = enabledCourses[courseIndex];
    if (options.skipCourseIds && options.skipCourseIds[String(courseConfig.courseId)]) {
      continue;
    }
    if (options.shouldContinue && !options.shouldContinue(courseConfig.courseId)) {
      taskConfigs.incomplete = true;
      break;
    }

    const rulesForCourse = activeRules.filter(function (candidate) {
      return !candidate.courseId || String(candidate.courseId) === String(courseConfig.courseId);
    });
    // Si no hay reglas aplicables, consultar Classroom no puede producir una
    // tarea activa y solo agrega latencia al recorrido.
    if (!rulesForCourse.length) continue;

    let courseWorks;
    try {
      courseWorks = listCourseWorkForSetup(courseConfig.courseId, {
        logDetails: options.logCourseWorkDetails !== false
      });
    } catch (error) {
      if (options.onCourseError) {
        options.onCourseError(courseConfig.courseId, error);
        continue;
      }
      throw error;
    }

    courseWorks.forEach(function (courseWork) {
      if (courseWork.state !== "PUBLISHED" || courseWork.workType !== "ASSIGNMENT") {
        return;
      }

      const rule = findTaskRuleForTitle(courseWork.title, rulesForCourse);
      if (!rule) {
        return;
      }

      taskConfigs.push({
        enabled: true,
        name: courseWork.title,
        courseId: courseConfig.courseId,
        courseWorkId: courseWork.id,
        exampleFileId: rule.exampleFileId,
        reviewMode: rule.reviewMode || REVIEW_MODES.AI,
        prompt: rule.prompt || "",
        validGrade: rule.validGrade || CONFIG.VALID_GRADE,
        invalidGrade: rule.invalidGrade || CONFIG.INVALID_GRADE,
        sendStudentNotifications: courseConfig.sendStudentNotifications === true,
        reminderEveryDays: rule.reminderEveryDays || 1,
        reminderHour: rule.reminderHour || "09:00"
      });
    });
  }

  return taskConfigs;
}

/** Busca la regla cuyo titulo coincide sin distinguir mayusculas ni espacios. */
function findTaskRuleForTitle(title, rules) {
  const normalizedTitle = normalizeTaskTitle(title);
  for (let index = 0; index < rules.length; index++) {
    if (normalizedTitle === normalizeTaskTitle(rules[index].title)) {
      return rules[index];
    }
  }
  return null;
}

/** Normaliza titulos para compararlos de forma exacta y estable. */
function normalizeTaskTitle(title) {
  return String(title || "").trim().toLowerCase();
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
