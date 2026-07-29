/**
 * Evalua una evidencia contra un documento ejemplo usando OpenAI.
 *
 * Recibe: blob PDF de evidencia, blob PDF ejemplo y configuracion de tarea.
 * Devuelve: JSON parseado con valida, motivo, diferencias y calificacion.
 * Se usa: en el flujo principal antes de decidir la calificacion.
 */
function evaluateEvidenceWithOpenAI(evidenceBlob, exampleBlob, taskConfig) {
  const apiKey = getOpenAiApiKey();
  const prompt = buildEvaluationPrompt(taskConfig);
  const payload = buildOpenAiResponsesPayload(evidenceBlob, exampleBlob, prompt, taskConfig);
  const responseText = fetchOpenAiResponsesApiWithRetries(apiKey, payload);
  const parsed = parseOpenAiJsonResponse(responseText);

  validateEvaluationJson(parsed);
  return parsed;
}

/**
 * Obtiene la API key de OpenAI desde Script Properties.
 *
 * Recibe: nada.
 * Devuelve: API key.
 * Se usa: antes de llamar a UrlFetchApp.
 */
function getOpenAiApiKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty(PROPERTY_KEYS.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error("Falta configurar Script Property OPENAI_API_KEY.");
  }

  return apiKey;
}

/**
 * Construye el prompt de evaluacion visual.
 *
 * Recibe: configuracion de tarea.
 * Devuelve: texto del prompt.
 * Se usa: como instruccion principal enviada a OpenAI.
 */
function buildEvaluationPrompt(taskConfig) {
  const validGrade = taskConfig.validGrade || CONFIG.VALID_GRADE;
  const invalidGrade = taskConfig.invalidGrade || CONFIG.INVALID_GRADE;
  const hasExample = Boolean(taskConfig.exampleFileId);

  if (taskConfig.prompt && String(taskConfig.prompt).trim()) {
    return [
      String(taskConfig.prompt).trim(),
      "Responde unicamente JSON valido, sin Markdown y con esta forma:",
      "{\"valida\":true,\"motivo\":\"explicacion breve\",\"diferencias\":[\"diferencia 1\"],\"calificacion\":" + validGrade + "}",
      "Si la evidencia no es valida, usa calificacion " + invalidGrade + "."
    ].join("\n");
  }

  return [
    hasExample ? "Se adjuntan 2 documentos PDF." : "Se adjunta 1 documento PDF como evidencia.",
    "El primer archivo corresponde a la evidencia entregada por el estudiante.",
    hasExample ? "El segundo archivo corresponde al documento ejemplo." : "No hay documento de referencia; evalua la evidencia por si misma.",
    hasExample ? "Evalua si la evidencia corresponde al mismo tipo general de documento que el ejemplo." : "Evalua si el documento es una evidencia legible, no vacia y coherente con la tarea titulada: " + taskConfig.name + ".",
    hasExample ? "Compara principalmente apariencia visual, formato general, encabezados, presencia de tablas, organizacion por secciones y estructura global." : "Revisa legibilidad, estructura general y que permita reconocer una evidencia relacionada con la tarea.",
    "No evalues contenido academico ni exactitud de datos.",
    "No rechaces por diferencias en nombres, fechas, alumnos, grupos, materias, calificaciones, folios, horas, valores numericos o texto interno de tablas.",
    "Acepta la evidencia si parece usar el mismo formato general aunque los datos internos sean diferentes.",
    "Rechaza solo si el documento pertenece a otro tipo de evidencia, no tiene estructura comparable, esta vacio, ilegible o no permite reconocer el formato.",
    "Responde unicamente JSON valido, sin Markdown y sin texto adicional.",
    "Usa exactamente esta forma:",
    "{\"valida\":true,\"motivo\":\"explicacion breve\",\"diferencias\":[\"diferencia 1\"],\"calificacion\":" + validGrade + "}",
    "Si la evidencia no es valida, usa calificacion " + invalidGrade + "."
  ].join("\n");
}

/**
 * Construye el payload para OpenAI Responses API con PDFs en base64.
 *
 * Recibe: blobs PDF, prompt y configuracion.
 * Devuelve: objeto listo para JSON.stringify.
 * Se usa: en evaluateEvidenceWithOpenAI.
 */
function buildOpenAiResponsesPayload(evidenceBlob, exampleBlob, prompt, taskConfig) {
  const content = [
    { type: "input_text", text: prompt },
    {
      type: "input_file",
      filename: evidenceBlob.getName() || "evidencia.pdf",
      file_data: "data:application/pdf;base64," + Utilities.base64Encode(evidenceBlob.getBytes())
    }
  ];

  if (exampleBlob) {
    content.push({
      type: "input_file",
      filename: exampleBlob.getName() || "documento_ejemplo.pdf",
      file_data: "data:application/pdf;base64," + Utilities.base64Encode(exampleBlob.getBytes())
    });
  }

  return {
    model: CONFIG.OPENAI_MODEL,
    input: [
      {
        role: "user",
        content: content
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "evidence_evaluation",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            valida: { type: "boolean" },
            motivo: { type: "string" },
            diferencias: {
              type: "array",
              items: { type: "string" }
            },
            calificacion: { type: "number" }
          },
          required: ["valida", "motivo", "diferencias", "calificacion"]
        }
      }
    }
  };
}

/**
 * Llama a OpenAI con reintentos simples.
 *
 * Recibe: API key y payload.
 * Devuelve: cuerpo de respuesta como texto.
 * Se usa: para aislar errores temporales de red o rate limit.
 */
function fetchOpenAiResponsesApiWithRetries(apiKey, payload) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.OPENAI_MAX_RETRIES + 1; attempt++) {
    try {
      const response = UrlFetchApp.fetch("https://api.openai.com/v1/responses", {
        method: "post",
        contentType: "application/json",
        headers: {
          Authorization: "Bearer " + apiKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true
      });

      const status = response.getResponseCode();
      const body = response.getContentText();

      if (status >= 200 && status < 300) {
        return body;
      }

      lastError = new Error("OpenAI respondio HTTP " + status + ": " + body);

      if (!isRetryableOpenAiStatus(status)) {
        lastError.nonRetryable = true;
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      if (error && error.nonRetryable === true) {
        throw error;
      }
    }

    Utilities.sleep(1000 * attempt);
  }

  throw lastError;
}

/**
 * Indica si un codigo HTTP de OpenAI amerita reintento.
 *
 * Recibe: status HTTP.
 * Devuelve: true para rate limit o errores temporales.
 * Se usa: para no repetir errores de configuracion como 400 o 401.
 */
function isRetryableOpenAiStatus(status) {
  return status === 429 || status >= 500;
}

/**
 * Extrae JSON de la respuesta de OpenAI.
 *
 * Recibe: texto completo de respuesta de Responses API.
 * Devuelve: objeto JSON de evaluacion.
 * Se usa: para validar que OpenAI respondio en el formato esperado.
 */
function parseOpenAiJsonResponse(responseText) {
  const response = JSON.parse(responseText);

  if (response.output_text) {
    return parseStrictJson(response.output_text);
  }

  const text = extractTextFromResponsesOutput(response);
  if (!text) {
    throw new Error("OpenAI no devolvio texto evaluable: " + responseText);
  }

  return parseStrictJson(text);
}

/**
 * Extrae texto de una respuesta Responses API cuando output_text no viene plano.
 *
 * Recibe: objeto de respuesta OpenAI.
 * Devuelve: texto encontrado o cadena vacia.
 * Se usa: como compatibilidad con variantes de respuesta.
 */
function extractTextFromResponsesOutput(response) {
  if (!response.output || !response.output.length) {
    return "";
  }

  for (let i = 0; i < response.output.length; i++) {
    const item = response.output[i];
    if (!item.content) {
      continue;
    }

    for (let j = 0; j < item.content.length; j++) {
      const content = item.content[j];
      if (content.text) {
        return content.text;
      }
    }
  }

  return "";
}

/**
 * Valida los campos minimos de la evaluacion.
 *
 * Recibe: objeto parseado.
 * Devuelve: nada; lanza error si falta algo.
 * Se usa: antes de decidir calificacion.
 */
function validateEvaluationJson(evaluation) {
  if (typeof evaluation.valida !== "boolean") {
    throw new Error("La respuesta de OpenAI no incluye valida como boolean.");
  }

  if (typeof evaluation.motivo !== "string") {
    throw new Error("La respuesta de OpenAI no incluye motivo como texto.");
  }

  if (!Array.isArray(evaluation.diferencias)) {
    throw new Error("La respuesta de OpenAI no incluye diferencias como arreglo.");
  }

  if (typeof evaluation.calificacion !== "number") {
    throw new Error("La respuesta de OpenAI no incluye calificacion como numero.");
  }
}

/**
 * Crea una evaluacion simulada cuando se decide no llamar a OpenAI en DRY_RUN.
 *
 * Recibe: configuracion de tarea.
 * Devuelve: objeto con la misma forma que OpenAI.
 * Se usa: para probar Classroom/Drive sin gastar tokens.
 */
function createSkippedOpenAiEvaluation(taskConfig) {
  return {
    valida: true,
    motivo: "Evaluacion OpenAI omitida por configuracion DRY_RUN.",
    diferencias: [],
    calificacion: taskConfig.validGrade || CONFIG.VALID_GRADE
  };
}

/** Crea la evaluacion aprobatoria cuando basta comprobar que existe un PDF. */
function createDocumentOnlyEvaluation(taskConfig) {
  return {
    valida: true,
    motivo: "Documento PDF cargado; esta tarea no requiere revision mediante IA.",
    diferencias: [],
    calificacion: taskConfig.validGrade || CONFIG.VALID_GRADE
  };
}


/**
 * Decide la calificacion final a partir de la evaluacion de OpenAI.
 *
 * Recibe: evaluacion y configuracion de tarea.
 * Devuelve: objeto con grade, isValid y motivo.
 * Se usa: antes de escribir assignedGrade.
 */
function decideGradeFromEvaluation(evaluation, taskConfig) {
  const validGrade = taskConfig.validGrade || CONFIG.VALID_GRADE;
  const invalidGrade = taskConfig.invalidGrade || CONFIG.INVALID_GRADE;
  const gradeFromOpenAi = Number(evaluation.calificacion);

  if (evaluation.valida === true) {
    return {
      isValid: true,
      grade: isFinite(gradeFromOpenAi) ? gradeFromOpenAi : validGrade,
      reason: evaluation.motivo
    };
  }

  return {
    isValid: false,
    grade: isFinite(gradeFromOpenAi) ? gradeFromOpenAi : invalidGrade,
    reason: evaluation.motivo
  };
}
