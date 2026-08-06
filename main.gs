/**
 * Punto de entrada principal del bot.
 *
 * Recibe: nada. Se ejecuta manualmente o por trigger.
 * Devuelve: un resumen de la ejecucion para logs y diagnostico.
 * Se usa: como funcion principal programada por el detector de entregas.
 */
function processPendingSubmissionsBatch() {
  const startedAt = new Date();
  const timer = createExecutionTimer(startedAt);
  const lock = LockService.getScriptLock();
  const summary = createEmptyBatchSummary(startedAt);

  console.info("Iniciando revision de tareas");

  try {
    /*
     * LockService evita que dos ejecuciones del mismo bot se empalmen.
     * Esto importa si un trigger tarda mas de lo normal o si alguien ejecuta
     * el script manualmente mientras el trigger sigue trabajando.
     */
    if (!lock.tryLock(10000)) {
      console.info("Otra ejecucion sigue activa. Se cancela esta corrida.");
      summary.skippedBecauseLocked = true;
      return summary;
    }

    return processPendingSubmissionsBatchWithLockHeld_(startedAt, timer, summary);
  } catch (error) {
    summary.errors++;
    summary.criticalError = errorToPlainText(error);
    console.info("Error critico en la ejecucion: " + summary.criticalError);
    sendCriticalErrorEmail("Error critico en el bot de Classroom", summary.criticalError);
    appendExecutionLogToSheet(summary);
    throw error;
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseError) {
      console.info("No fue necesario liberar lock o ya estaba liberado: " + releaseError);
    }
  }
}

/**
 * Consulta Classroom con el intervalo global configurado y procesa nuevas entregas.
 * Apps Script/Classroom no proporciona un activador nativo de tipo "on submit",
 * por lo que este sondeo es la aproximacion mas cercana a un evento de entrega.
 */
function detectarEntregasProgramadas() {
  try {
    return processPendingSubmissionsBatch();
  } finally {
    scheduleNextSubmissionDetection_();
  }
}

/**
 * Ejecuta el lote suponiendo que el llamador ya posee el ScriptLock.
 *
 * El procesador global de recordatorios usa esta variante para conservar el
 * mismo lock durante toda la corrida. De otro modo liberaba el lock entre los
 * recordatorios generales y los de cada tarea, permitiendo que el trigger del
 * minuto siguiente iniciara otra corrida sobre los mismos cursos.
 */
function processPendingSubmissionsBatchWithLockHeld_(startedAt, timer, summary) {
  loadConfigurationFromSpreadsheet(true);
  validateGlobalConfiguration();

  if (CONFIG.DRY_RUN) {
    console.info(
      "[DRY_RUN] Modo simulacion activo: no se escribiran calificaciones en Classroom. " +
      "Las entregas sin calificacion seguiran pendientes y se volveran a detectar en la siguiente ejecucion."
    );
  }

  const activeTasks = getActiveTaskConfigs();
  console.info("Tareas activas: " + activeTasks.length);

  for (let index = 0; index < activeTasks.length; index++) {
    const taskConfig = activeTasks[index];

    if (!hasSafeTimeRemaining(timer)) {
      console.info("Deteniendo lote por limite seguro de tiempo antes de iniciar otra tarea");
      break;
    }

    processOneConfiguredTask(taskConfig, timer, summary);
  }

  summary.finishedAt = new Date();
  summary.elapsedMs = summary.finishedAt.getTime() - startedAt.getTime();
  console.info("Ejecucion finalizada: " + JSON.stringify(summary));

  appendExecutionLogToSheet(summary);
  sendBatchSummaryToTeacher(summary);
  return summary;
}

/**
 * Procesa una tarea configurada.
 *
 * Recibe: configuracion de tarea, temporizador y resumen acumulado.
 * Devuelve: nada; actualiza el resumen recibido.
 * Se usa: dentro del lote principal, una vez por tarea activa.
 */
function processOneConfiguredTask(taskConfig, timer, summary) {
  console.info("Revisando tarea configurada: " + getTaskLabel(taskConfig));

  try {
    const courseWork = getCourseWork(taskConfig.courseId, taskConfig.courseWorkId);
    const pendingSubmissions = getPendingSubmissionsForTask(taskConfig, courseWork);

    console.info("Entregas pendientes encontradas: " + pendingSubmissions.length);

    for (let index = 0; index < pendingSubmissions.length; index++) {
      if (!hasSafeTimeRemaining(timer)) {
        console.info("Deteniendo tarea por limite seguro de tiempo");
        return;
      }

      processOneSubmission(taskConfig, courseWork, pendingSubmissions[index], summary);
    }
  } catch (error) {
    summary.errors++;
    const message = "Fallo al procesar tarea " + getTaskLabel(taskConfig) + ": " + errorToPlainText(error);
    console.info(message);
    sendCriticalErrorEmail("Error al procesar tarea de Classroom", message);
  }
}

/**
 * Procesa una sola entrega de estudiante.
 *
 * Recibe: configuracion, datos de la tarea, entrega y resumen.
 * Devuelve: nada; escribe calificacion si DRY_RUN esta desactivado.
 * Se usa: para cada evidencia pendiente.
 */
function processOneSubmission(taskConfig, courseWork, submission, summary) {
  console.info("Entrega encontrada: " + submission.id + " / usuario " + submission.userId);

  try {
    const evidenceFile = getFirstPdfEvidenceFromSubmission(submission);
    if (!evidenceFile) {
      throw new Error("La entrega no contiene un archivo PDF accesible.");
    }

    console.info("Archivo descargado: " + evidenceFile.name);

    const evaluation = evaluateSubmissionByConfiguredMode(evidenceFile, taskConfig);

    console.info("Resultado de revision: " + JSON.stringify(evaluation));

    const gradingDecision = decideGradeFromEvaluation(evaluation, taskConfig);

    if (CONFIG.DRY_RUN) {
      console.info(
        "[DRY_RUN] Calificacion simulada: " + gradingDecision.grade +
        ". No se escribio ninguna calificacion en Classroom; la entrega se volvera a detectar."
      );
    } else {
      assignGradeToSubmission(taskConfig, submission.id, gradingDecision.grade);
      console.info("Calificacion asignada: " + gradingDecision.grade);
    }

    summary.processed++;
    if (gradingDecision.isValid) {
      summary.valid++;
    } else {
      summary.invalid++;
    }

    appendEvaluationLogToSheet(taskConfig, courseWork, submission, evidenceFile, evaluation, gradingDecision);
  } catch (error) {
    summary.errors++;
    const message = "Error en entrega " + submission.id + ": " + errorToPlainText(error);
    console.info(message);
    appendErrorLogToSheet(taskConfig, submission, message);
    sendCriticalErrorEmail("Error al revisar evidencia", message);
  }
}

/**
 * Crea el resumen inicial del lote.
 *
 * Recibe: fecha de inicio.
 * Devuelve: objeto acumulador.
 * Se usa: al inicio de processPendingSubmissionsBatch.
 */
function createEmptyBatchSummary(startedAt) {
  return {
    startedAt: startedAt,
    finishedAt: null,
    elapsedMs: 0,
    processed: 0,
    valid: 0,
    invalid: 0,
    errors: 0,
    skippedBecauseLocked: false,
    criticalError: ""
  };
}

/**
 * Indica si en DRY_RUN tambien debe llamarse a OpenAI.
 *
 * Recibe: nada.
 * Devuelve: true si conviene evaluar con OpenAI en esta corrida.
 * Se usa: antes de gastar tokens durante pruebas.
 */
function shouldCallOpenAiNow() {
  if (!CONFIG.DRY_RUN) {
    return true;
  }

  return CONFIG.EVALUATE_WITH_OPENAI_IN_DRY_RUN === true;
}

/** Aplica el switch de revision configurado para la tarea. */
function evaluateSubmissionByConfiguredMode(evidenceFile, taskConfig) {
  if (taskConfig.reviewMode === REVIEW_MODES.DOCUMENT_ONLY) {
    return createDocumentOnlyEvaluation(taskConfig);
  }

  if (!shouldCallOpenAiNow()) {
    return createSkippedOpenAiEvaluation(taskConfig);
  }

  const exampleBlob = taskConfig.exampleFileId
    ? getPdfBlobFromDriveFileId(taskConfig.exampleFileId, "documento_ejemplo.pdf").blob
    : null;

  return evaluateEvidenceWithOpenAI(evidenceFile.blob, exampleBlob, taskConfig);
}
