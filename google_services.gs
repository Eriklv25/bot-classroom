/**
 * Obtiene una tarea de Classroom.
 *
 * Recibe: courseId y courseWorkId.
 * Devuelve: objeto CourseWork de Google Classroom.
 * Se usa: para conocer titulo, fecha limite y metadatos de la tarea.
 */
function getCourseWork(courseId, courseWorkId) {
  return Classroom.Courses.CourseWork.get(courseId, courseWorkId);
}

/**
 * Lista cursos activos visibles para la cuenta que ejecuta Apps Script.
 *
 * Recibe: nada.
 * Devuelve: arreglo con id, nombre y estado de cada curso.
 * Se usa: manualmente para copiar el courseId correcto antes de crear/configurar tareas.
 */
function listClassroomCoursesForSetup() {
  const courses = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.list({
      pageSize: 100,
      pageToken: pageToken,
      courseStates: ["ACTIVE"]
    });

    if (response.courses) {
      response.courses.forEach(function (course) {
        courses.push({
          id: course.id,
          name: course.name,
          section: course.section || "",
          courseState: course.courseState,
          alternateLink: course.alternateLink || ""
        });
      });
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  console.log("Cursos encontrados para configuracion: " + JSON.stringify(courses));
  return courses;
}

/**
 * Lista tareas de un curso.
 *
 * Recibe: courseId.
 * Devuelve: arreglo con id, titulo, estado y puntos maximos.
 * Se usa: manualmente para revisar tareas existentes o copiar un courseWorkId.
 */
function listCourseWorkForSetup(courseId, options) {
  options = options || {};
  const courseWorks = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.CourseWork.list(courseId, {
      pageSize: 100,
      pageToken: pageToken,
      // Classroom no incluye necesariamente los borradores si no se solicitan.
      // Leer ambos estados evita volver a crear una tarea seleccionada en otra ejecucion.
      courseWorkStates: ["PUBLISHED", "DRAFT"]
    });

    if (response.courseWork) {
      response.courseWork.forEach(function (courseWork) {
        courseWorks.push({
          id: courseWork.id,
          title: courseWork.title,
          state: courseWork.state,
          workType: courseWork.workType,
          maxPoints: courseWork.maxPoints || null,
          dueDate: courseWork.dueDate || null,
          // dueTime es indispensable para decidir si una actividad que vence
          // hoy ya esta atrasada. Sin copiarlo, getCourseWorkDueDate usaba
          // 23:59 y el resumen diario podia omitir una entrega ya vencida.
          dueTime: courseWork.dueTime || null,
          alternateLink: courseWork.alternateLink || ""
        });
      });
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  // El detalle completo es util al ejecutar esta funcion manualmente, pero en
  // los procesos periodicos puede ocupar gran parte del registro y ocultar el
  // error que realmente detuvo la corrida.
  if (options.logDetails !== false) {
    console.log("Tareas encontradas para curso " + courseId + ": " + JSON.stringify(courseWorks));
  }
  return courseWorks;
}

/**
 * Lista temas de un curso.
 *
 * Recibe: courseId.
 * Devuelve: arreglo con id y nombre de cada tema.
 * Se usa: manualmente para copiar el topicId al crear tareas desde Apps Script.
 */
function listClassroomTopicsForSetup(courseId) {
  const topics = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.Topics.list(courseId, {
      pageSize: 100,
      pageToken: pageToken
    });

    if (response.topic) {
      response.topic.forEach(function (topic) {
        topics.push({
          id: topic.topicId,
          name: topic.name,
          updateTime: topic.updateTime || ""
        });
      });
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  console.log("Temas encontrados para curso " + courseId + ": " + JSON.stringify(topics));
  return topics;
}

/**
 * Prueba controlada para listar temas del curso Pruebas bot.
 *
 * Recibe: nada.
 * Devuelve: arreglo de temas.
 * Se usa: manualmente para copiar un topicId.
 */
function testListTopicsPruebasBot() {
  return listClassroomTopicsForSetup("841460792596");
}

/**
 * Crea un tema de Classroom.
 *
 * Recibe: courseId y nombre del tema.
 * Devuelve: objeto Topic creado.
 * Se usa: durante la inicializacion de cursos nuevos.
 */
function createClassroomTopic(courseId, topicName) {
  if (!courseId) {
    throw new Error("Falta courseId.");
  }

  if (!topicName) {
    throw new Error("Falta topicName.");
  }

  const topic = Classroom.Courses.Topics.create(
    {
      name: topicName
    },
    courseId
  );

  console.log("Tema creado: " + topic.name + " / topicId=" + topic.topicId);
  return topic;
}

/**
 * Busca un tema por nombre o lo crea si no existe.
 *
 * Recibe: courseId, nombre del tema y mapa mutable de temas.
 * Devuelve: topicId.
 * Se usa: para poder crear tareas usando topicName en vez de topicId.
 */
function getOrCreateTopicIdByName(courseId, topicName, topicMap) {
  if (!topicName) {
    return "";
  }

  const key = normalizeSetupName(topicName);
  if (topicMap[key]) {
    return topicMap[key].id;
  }

  const created = createClassroomTopic(courseId, topicName);
  topicMap[key] = {
    id: created.topicId,
    name: created.name
  };
  return created.topicId;
}

/**
 * Convierte los temas de un curso a mapa por nombre normalizado.
 *
 * Recibe: courseId.
 * Devuelve: mapa nombre -> tema.
 * Se usa: para evitar crear temas duplicados.
 */
function getClassroomTopicMapByName(courseId) {
  const topics = listClassroomTopicsForSetup(courseId);
  const topicMap = {};

  topics.forEach(function (topic) {
    topicMap[normalizeSetupName(topic.name)] = topic;
  });

  return topicMap;
}

/**
 * Convierte las tareas de un curso a mapa por titulo normalizado.
 *
 * Recibe: courseId.
 * Devuelve: mapa titulo -> tarea.
 * Se usa: para evitar crear tareas duplicadas si se ejecuta dos veces.
 */
function getCourseWorkMapByTitle(courseId) {
  const courseWorks = listCourseWorkForSetup(courseId);
  const courseWorkMap = {};

  courseWorks.forEach(function (courseWork) {
    courseWorkMap[normalizeSetupName(courseWork.title)] = courseWork;
  });

  return courseWorkMap;
}

/**
 * Crea un curso de Classroom desde la plantilla.
 *
 * Recibe: configuracion de curso.
 * Devuelve: curso creado.
 * Se usa: al iniciar un semestre nuevo desde cero.
 */
function createClassroomCourseFromConfig(courseConfig) {
  if (!courseConfig || !courseConfig.name) {
    throw new Error("Falta COURSE_SETUP_TEMPLATE.course.name.");
  }

  const resource = {
    name: courseConfig.name,
    section: courseConfig.section || "",
    descriptionHeading: courseConfig.descriptionHeading || "",
    description: courseConfig.description || "",
    room: courseConfig.room || "",
    ownerId: courseConfig.ownerId || "me",
    courseState: courseConfig.courseState || "ACTIVE"
  };

  const created = Classroom.Courses.create(resource);
  console.log("Curso creado: " + created.name + " / courseId=" + created.id);
  return created;
}

/** Actualiza los campos editables de un curso ya creado desde la misma hoja. */
function updateClassroomCourseFromConfig(courseId, courseConfig) {
  if (!courseId || !courseConfig || !courseConfig.name) {
    throw new Error("Faltan courseId o nombre para actualizar el curso.");
  }
  const resource = {
    name: courseConfig.name,
    section: courseConfig.section || "",
    descriptionHeading: courseConfig.descriptionHeading || "",
    description: courseConfig.description || "",
    room: courseConfig.room || "",
    courseState: courseConfig.courseState || "ACTIVE"
  };
  const updated = Classroom.Courses.patch(resource, courseId, {
    updateMask: "name,section,descriptionHeading,description,room,courseState"
  });
  console.log("Curso actualizado: " + updated.name + " / courseId=" + courseId);
  return updated;
}

/**
 * Crea un curso nuevo, temas, tareas e invitaciones desde COURSE_SETUP_TEMPLATE.
 *
 * Recibe: nada.
 * Devuelve: resumen de curso creado, setup e invitaciones.
 * Se usa: como boton principal para un semestre nuevo.
 */
function createNewCourseFromTemplate() {
  loadConfigurationFromSpreadsheet();
  const template = COURSE_SETUP_TEMPLATE;
  if (template.createNewCourse !== true) {
    throw new Error("COURSE_SETUP_TEMPLATE.createNewCourse debe ser true para crear un curso nuevo.");
  }

  const course = createClassroomCourseFromConfig(template.course);
  const setupTemplate = Object.assign({}, template, {
    courseId: course.id
  });

  const setupSummary = createCourseSetupFromTemplate(setupTemplate);
  const invitationSummary = inviteStudentsFromTemplate(course.id, template.students || []);
  const configurationSpreadsheetUrl = crearConfiguracionParaCursoExistente_(course.id, course.name);

  const summary = {
    course: {
      id: course.id,
      name: course.name,
      section: course.section || "",
      alternateLink: course.alternateLink || ""
    },
    setup: setupSummary,
    studentInvitations: invitationSummary,
    configurationSpreadsheetUrl: configurationSpreadsheetUrl
  };

  console.log("Resumen de curso nuevo desde plantilla: " + JSON.stringify(summary));
  console.log("Copia este courseId en COURSE_SETUP_TEMPLATE.existingCourseId si quieres hacer ajustes sin crear otro curso: " + course.id);
  return summary;
}

/** Invita con el rol elegido unicamente a los participantes marcados. */
function inviteStudentsFromTemplate(courseId, students) {
  if (!courseId) {
    throw new Error("Falta courseId.");
  }

  const summary = { courseId: courseId, invited: [], skipped: [], errors: [] };
  (students || []).forEach(function (student) {
    if (!student || student.selected !== true) {
      return;
    }

    const email = String(student.email || "").trim();
    if (!email) {
      summary.errors.push({ name: student.name || "", error: "Falta email." });
      return;
    }
    const role = String(student.rol || student.role || "ALUMNO").trim().toUpperCase() === "PROFESOR"
      ? "TEACHER" : "STUDENT";

    try {
      const invitation = Classroom.Invitations.create({
        courseId: courseId,
        userId: email,
        role: role
      });
      summary.invited.push({ name: student.name || "", email: email, role: role, invitationId: invitation.id || "" });
    } catch (error) {
      const text = errorToPlainText(error);
      if (text.indexOf("ALREADY_EXISTS") !== -1 || text.indexOf("already") !== -1) {
        summary.skipped.push({ name: student.name || "", email: email, reason: "Ya esta inscrito o invitado." });
      } else {
        summary.errors.push({ name: student.name || "", email: email, error: text });
      }
    }
  });

  console.log("Resumen de invitaciones de alumnos: " + JSON.stringify(summary));
  return summary;
}

/** Invita el checklist seleccionado a un curso ya configurado en la plantilla. */
function inviteSelectedStudentsFromTemplate() {
  loadConfigurationFromSpreadsheet();
  const courseId = COURSE_SETUP_TEMPLATE.existingCourseId || COURSE_SETUP_TEMPLATE.courseId;
  if (!courseId) {
    throw new Error("Falta COURSE_SETUP_TEMPLATE.existingCourseId.");
  }

  return inviteStudentsFromTemplate(courseId, COURSE_SETUP_TEMPLATE.students || []);
}

/**
 * Inicializa un curso desde COURSE_SETUP_TEMPLATE.
 *
 * Recibe: nada.
 * Devuelve: resumen con temas y tareas creadas u omitidas.
 * Se usa: para continuar ajustes sobre existingCourseId sin crear otro curso.
 */
function setupCourseFromTemplate() {
  loadConfigurationFromSpreadsheet();
  const courseId = COURSE_SETUP_TEMPLATE.existingCourseId || COURSE_SETUP_TEMPLATE.courseId;
  if (!courseId) {
    throw new Error("Falta COURSE_SETUP_TEMPLATE.existingCourseId. Si quieres crear un curso nuevo, ejecuta createNewCourseFromTemplate.");
  }

  return createCourseSetupFromTemplate(Object.assign({}, COURSE_SETUP_TEMPLATE, {
    courseId: courseId
  }));
}

/**
 * Crea temas y tareas desde una plantilla de curso.
 *
 * Recibe: plantilla con courseId, topics y courseWork.
 * Devuelve: resumen de acciones.
 * Se usa: como base para setupCourseFromTemplate.
 */
function createCourseSetupFromTemplate(template) {
  if (!template || !template.courseId) {
    throw new Error("Falta courseId para inicializar el curso.");
  }

  const courseId = template.courseId;
  const topicMap = getClassroomTopicMapByName(courseId);
  const courseWorkMap = getCourseWorkMapByTitle(courseId);
  const summary = {
    courseId: courseId,
    topicsCreated: [],
    topicsExisting: [],
    courseWorkCreated: [],
    courseWorkUpdated: [],
    courseWorkSkipped: []
  };

  (template.topics || []).forEach(function (topicConfig) {
    const topicName = topicConfig.name;
    const before = Boolean(topicMap[normalizeSetupName(topicName)]);
    const topicId = getOrCreateTopicIdByName(courseId, topicName, topicMap);

    const item = {
      name: topicName,
      topicId: topicId
    };

    if (before) {
      summary.topicsExisting.push(item);
    } else {
      summary.topicsCreated.push(item);
    }
  });

  (template.courseWork || []).forEach(function (workConfig) {
    const existing = courseWorkMap[normalizeSetupName(workConfig.title)];
    // El titulo es la identidad estable: nunca se crea una segunda tarea con el mismo nombre.
    if (existing) {
      const topicId = getOrCreateTopicIdByName(courseId, workConfig.topicName, topicMap);
      const updated = updateCourseWorkFromConfig(courseId, existing.id, {
        title: workConfig.title,
        description: workConfig.description || "",
        maxPoints: workConfig.maxPoints || template.defaultMaxPoints || CONFIG.VALID_GRADE,
        state: workConfig.state || template.defaultState || "DRAFT",
        currentState: existing.state,
        dueDate: workConfig.dueDate || null,
        dueTime: workConfig.dueTime || null,
        topicId: topicId || null
      });
      summary.courseWorkUpdated.push({ title: updated.title, courseWorkId: updated.id });
      return;
    }

    const requestedTitles = (template.createOnlyCourseWorkTitles || [template.createOnlyCourseWorkTitle])
      .filter(Boolean).map(normalizeSetupName);
    const mayCreateMissing = template.createMissingCourseWork !== false;
    if (!mayCreateMissing || (requestedTitles.length && requestedTitles.indexOf(normalizeSetupName(workConfig.title)) === -1)) {
      summary.courseWorkSkipped.push({ title: workConfig.title, reason: "No se marco crearAhora" });
      return;
    }

    if (workConfig.enabled === false && !requestedTitles.length) {
      summary.courseWorkSkipped.push({ title: workConfig.title, reason: "Tarea deshabilitada" });
      return;
    }

    const topicId = getOrCreateTopicIdByName(courseId, workConfig.topicName, topicMap);
    const creationConfig = {
      courseId: courseId,
      title: workConfig.title,
      description: workConfig.description || "",
      maxPoints: workConfig.maxPoints || template.defaultMaxPoints || CONFIG.VALID_GRADE,
      state: workConfig.state || template.defaultState || "DRAFT",
      dueDate: workConfig.dueDate || null,
      dueTime: workConfig.dueTime || null,
      topicId: topicId || null
    };

    const created = createCourseWorkFromConfig(creationConfig);
    courseWorkMap[normalizeSetupName(created.title)] = {
      id: created.id,
      title: created.title
    };

    summary.courseWorkCreated.push({
      title: created.title,
      courseWorkId: created.id,
      topicName: workConfig.topicName || "",
      topicId: topicId || ""
    });
  });

  console.log("Resumen de inicializacion de curso: " + JSON.stringify(summary));
  return summary;
}

/** Actualiza una tarea existente conservando su ID de Classroom. */
function updateCourseWorkFromConfig(courseId, courseWorkId, config) {
  const resource = {
    title: config.title,
    description: config.description || "",
    maxPoints: Number(config.maxPoints || CONFIG.VALID_GRADE)
  };
  const updateFields = ["title", "description", "maxPoints"];
  const requestedState = config.state || "DRAFT";
  // Classroom solo permite cambiar el estado de una tarea existente a PUBLISHED.
  // En particular, una tarea publicada no puede regresar a DRAFT mediante patch.
  if (requestedState === "PUBLISHED" && config.currentState !== "PUBLISHED") {
    resource.state = requestedState;
    updateFields.push("state");
  }
  if (config.topicId) {
    resource.topicId = String(config.topicId);
    updateFields.push("topicId");
  }
  if (config.dueDate) {
    const utcDue = getFutureCourseWorkDue_(config.dueDate, config.dueTime, config.title);
    if (!utcDue) {
      return Classroom.Courses.CourseWork.patch(resource, courseId, courseWorkId, {
        updateMask: updateFields.join(",")
      });
    }
    resource.dueDate = utcDue.dueDate;
    updateFields.push("dueDate");
    if (config.dueTime) {
      resource.dueTime = utcDue.dueTime;
      updateFields.push("dueTime");
    }
  }
  return Classroom.Courses.CourseWork.patch(resource, courseId, courseWorkId, {
    updateMask: updateFields.join(",")
  });
}

/**
 * Envia invitaciones de profesor para un curso.
 *
 * Recibe: courseId y arreglo de correos.
 * Devuelve: resumen de invitaciones.
 * Se usa: despues de crear un curso nuevo.
 */
function inviteTeachersFromTemplate(courseId, teacherEmails) {
  if (!courseId) {
    throw new Error("Falta courseId.");
  }

  const summary = {
    courseId: courseId,
    invited: [],
    skipped: [],
    errors: []
  };

  (teacherEmails || []).forEach(function (email) {
    const cleanEmail = String(email || "").trim();
    if (!cleanEmail) {
      return;
    }

    try {
      const invitation = Classroom.Invitations.create({
        courseId: courseId,
        userId: cleanEmail,
        role: "TEACHER"
      });

      summary.invited.push({
        email: cleanEmail,
        invitationId: invitation.id || ""
      });
    } catch (error) {
      const text = errorToPlainText(error);
      if (text.indexOf("ALREADY_EXISTS") !== -1 || text.indexOf("already") !== -1) {
        summary.skipped.push({
          email: cleanEmail,
          reason: "Ya existe invitacion o ya pertenece al curso."
        });
      } else {
        summary.errors.push({
          email: cleanEmail,
          error: text
        });
      }
    }
  });

  console.log("Resumen de invitaciones de profesores: " + JSON.stringify(summary));
  return summary;
}

/**
 * Lista correos de profesores que ya pertenecen al curso.
 *
 * Recibe: courseId.
 * Devuelve: arreglo de correos.
 * Se usa: para saber quien ya acepto la invitacion.
 */
function listTeacherEmailsForCourse(courseId) {
  const emails = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.Teachers.list(courseId, {
      pageSize: 100,
      pageToken: pageToken
    });

    if (response.teachers) {
      response.teachers.forEach(function (teacher) {
        const profile = teacher.profile || {};
        if (profile.emailAddress) {
          emails.push(String(profile.emailAddress).toLowerCase());
        }
      });
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return emails;
}

/**
 * Lista invitaciones visibles de un curso.
 *
 * Recibe: courseId.
 * Devuelve: arreglo de invitaciones.
 * Se usa: para diagnosticar invitaciones pendientes.
 */
function listInvitationsForCourse(courseId) {
  const invitations = [];
  let pageToken = null;

  do {
    const response = Classroom.Invitations.list({
      courseId: courseId,
      pageSize: 100,
      pageToken: pageToken
    });

    if (response.invitations) {
      invitations.push.apply(invitations, response.invitations);
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return invitations;
}

/**
 * Identifica profesores de la plantilla que todavia no aparecen como teachers.
 *
 * Recibe: courseId y arreglo de correos esperados.
 * Devuelve: resumen de aceptados y pendientes.
 * Se usa: antes de mandar recordatorios.
 */
function getTeacherInvitationStatus(courseId, teacherEmails) {
  const teacherEmailSet = {};
  listTeacherEmailsForCourse(courseId).forEach(function (email) {
    teacherEmailSet[email] = true;
  });

  const invitations = listInvitationsForCourse(courseId);
  const invitationEmailSet = {};
  invitations.forEach(function (invitation) {
    if (invitation.userId) {
      invitationEmailSet[String(invitation.userId).toLowerCase()] = true;
    }
  });

  const status = {
    courseId: courseId,
    accepted: [],
    pending: [],
    missingInvitation: []
  };

  (teacherEmails || []).forEach(function (email) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return;
    }

    if (teacherEmailSet[cleanEmail]) {
      status.accepted.push(cleanEmail);
    } else if (invitationEmailSet[cleanEmail]) {
      status.pending.push(cleanEmail);
    } else {
      status.missingInvitation.push(cleanEmail);
    }
  });

  console.log("Estado de invitaciones de profesores: " + JSON.stringify(status));
  return status;
}

/**
 * Envia recordatorio a profesores que no han aceptado invitacion.
 *
 * Recibe: nada; usa COURSE_SETUP_TEMPLATE.existingCourseId y teachers.
 * Devuelve: resumen de correos enviados.
 * Se usa: manualmente o por trigger para seguimiento de invitaciones.
 */
function sendTeacherInvitationRemindersFromTemplate(skipConfigurationLoad) {
  if (skipConfigurationLoad !== true) loadConfigurationFromSpreadsheet();
  const courseId = COURSE_SETUP_TEMPLATE.existingCourseId || COURSE_SETUP_TEMPLATE.courseId;
  if (!courseId) {
    throw new Error("Falta COURSE_SETUP_TEMPLATE.existingCourseId para revisar invitaciones.");
  }

  const reminderConfig = COURSE_SETUP_TEMPLATE.teacherInvitationReminder || {};
  if (reminderConfig.enabled === false) {
    throw new Error("teacherInvitationReminder.enabled esta en false.");
  }

  const selectedEmails = (COURSE_SETUP_TEMPLATE.students || []).filter(function (participant) {
    return participant && participant.selected === true;
  }).map(function (participant) { return participant.email; });
  const status = getParticipantInvitationStatus_(courseId, selectedEmails);
  const course = Classroom.Courses.get(courseId);
  const recipients = status.pending.concat(status.missingInvitation);
  const summary = {
    courseId: courseId,
    sent: [],
    skippedAccepted: status.accepted,
    pending: status.pending,
    missingInvitation: status.missingInvitation
  };

  recipients.forEach(function (email) {
    MailApp.sendEmail({
      to: email,
      subject: reminderConfig.subject || "Recordatorio: acepta la invitacion al curso de Classroom",
      body: [
        reminderConfig.bodyIntro || "Hola. Sigue pendiente que aceptes tu invitacion al curso de Classroom.",
        "",
        "Curso: " + (course.name || courseId),
        course.alternateLink ? "Liga: " + course.alternateLink : "",
        "",
        "Por favor entra a Classroom y acepta la invitacion."
      ].join("\n")
    });

    summary.sent.push(email);
  });

  console.log("Resumen de recordatorios de profesores: " + JSON.stringify(summary));
  return summary;
}

/** Identifica participantes invitados como alumnos que todavia no aceptan el curso. */
function getParticipantInvitationStatus_(courseId, emails) {
  const accepted = {};
  let pageToken = null;
  do {
    const response = Classroom.Courses.Students.list(courseId, { pageSize: 100, pageToken: pageToken });
    (response.students || []).forEach(function (student) {
      const email = student.profile && student.profile.emailAddress;
      if (email) accepted[String(email).toLowerCase()] = true;
    });
    pageToken = response.nextPageToken || null;
  } while (pageToken);
  pageToken = null;
  do {
    const response = Classroom.Courses.Teachers.list(courseId, { pageSize: 100, pageToken: pageToken });
    (response.teachers || []).forEach(function (teacher) {
      const email = teacher.profile && teacher.profile.emailAddress;
      if (email) accepted[String(email).toLowerCase()] = true;
    });
    pageToken = response.nextPageToken || null;
  } while (pageToken);
  const invited = {};
  listInvitationsForCourse(courseId).forEach(function (invitation) {
    if (invitation.userId) invited[String(invitation.userId).toLowerCase()] = true;
  });
  const status = { courseId: courseId, accepted: [], pending: [], missingInvitation: [] };
  (emails || []).forEach(function (email) {
    const clean = String(email || "").trim().toLowerCase();
    if (!clean) return;
    if (accepted[clean]) status.accepted.push(clean);
    else if (invited[clean]) status.pending.push(clean);
    else status.missingInvitation.push(clean);
  });
  return status;
}

// La accion manual puede adelantar solamente la hora de la primera revision.
// La frecuencia y la proteccion contra duplicados del mismo dia se conservan.
var REMINDER_IGNORE_SCHEDULED_HOUR_ = false;

/**
 * Permite comprobar inmediatamente invitaciones y actividades desde el menu.
 * No vuelve a enviar una programacion que ya fue procesada hoy.
 */
function procesarRecordatoriosAhora() {
  REMINDER_IGNORE_SCHEDULED_HOUR_ = true;
  try {
    return procesarRecordatoriosProgramados();
  } finally {
    REMINDER_IGNORE_SCHEDULED_HOUR_ = false;
  }
}

/** Punto de entrada periodico para todos los recordatorios configurados en la hoja. */
function procesarRecordatoriosProgramados() {
  const startedAt = new Date();
  const runId = Utilities.getUuid().slice(0, 8);
  const control = {
    runId: runId,
    startedMs: startedAt.getTime(),
    deadlineMs: startedAt.getTime() + REMINDER_SAFE_RUNTIME_MS,
    lastStage: "inicio"
  };
  const lock = LockService.getScriptLock();
  REMINDER_EMAIL_CACHE_ = {};
  logReminderProgress_(control, "INICIO", { safeRuntimeMs: REMINDER_SAFE_RUNTIME_MS });
  if (!lock.tryLock(1000)) {
    logReminderProgress_(control, "OMITIDA_LOCK", {
      message: "Otra ejecucion posee el ScriptLock; esta invocacion termina sin esperar."
    });
    return { runId: runId, skippedBecauseLocked: true, invitations: [], pendingActivities: null };
  }

  const summary = { runId: runId, invitations: [], pendingActivities: null, errors: [], incomplete: false };
  let nextIntervalMinutes = DEFAULT_REMINDER_TRIGGER_MINUTES;
  try {
    const registry = getCourseSpreadsheetRegistry_();
    logReminderProgress_(control, "REGISTRO_LEIDO", { courses: Object.keys(registry).length });
    nextIntervalMinutes = getShortestConfiguredReminderTriggerMinutes_();
    const courseIds = Object.keys(registry);
    for (let courseIndex = 0; courseIndex < courseIds.length; courseIndex++) {
      const courseId = courseIds[courseIndex];
      if (!hasReminderTimeRemaining_(control, "curso:" + courseId)) {
        summary.incomplete = true;
        break;
      }
      try {
        logReminderProgress_(control, "CURSO_INICIO", { courseId: courseId, index: courseIndex + 1 });
        const spreadsheet = SpreadsheetApp.openById(registry[courseId]);
        loadConfigurationFromSpecificSpreadsheet_(spreadsheet);
        const config = COURSE_SETUP_TEMPLATE.teacherInvitationReminder || {};
        const invitationKey = "invitaciones:" + courseId;
        const invitationSchedule = getScheduledReminderStatus_(invitationKey, config.everyDays, config.hour);
        logReminderProgress_(control, "INVITACIONES_DECISION", {
          courseId: courseId,
          enabled: config.enabled !== false,
          due: invitationSchedule.due,
          reason: config.enabled === false ? "disabled" : invitationSchedule.reason,
          scheduledHour: invitationSchedule.scheduledHour,
          currentHour: invitationSchedule.currentHour,
          lastCheckedAt: invitationSchedule.lastCheckedAt
        });
        if (config.enabled !== false && invitationSchedule.due) {
          try {
            const invitationCourse = getPendingCourseInvitationsForCourse_(courseId, config);
            const invitationResults = sendCourseInvitationRemindersForCourse_(invitationCourse);
            summary.invitations = summary.invitations.concat(invitationResults);
            logReminderProgress_(control, "INVITACIONES_RESULTADO", {
              courseId: courseId,
              selectedParticipants: invitationCourse.selectedParticipants,
              pending: invitationCourse.recipients.length,
              accepted: invitationCourse.skippedAccepted.length,
              sent: invitationResults.length
            });
            markScheduledReminderSent_(invitationKey, config.everyDays, config.hour);
          } catch (invitationError) {
            const invitationMessage = "No se pudieron procesar invitaciones del curso " + courseId +
              "; se intentaran los recordatorios de pendientes: " + errorToPlainText(invitationError);
            logReminderProgress_(control, "INVITACIONES_ERROR", {
              courseId: courseId,
              message: invitationMessage,
              stack: invitationError && invitationError.stack || ""
            });
            summary.errors.push({ courseId: courseId, message: invitationMessage });
          }
        }
        const pendingConfig = COURSE_SETUP_TEMPLATE.pendingActivitiesReminder || {};
        const pendingKey = "pendientes:" + courseId;
        const pendingSchedule = getScheduledReminderStatus_(pendingKey, pendingConfig.everyDays, pendingConfig.hour);
        logReminderProgress_(control, "PENDIENTES_DECISION", {
          courseId: courseId,
          enabled: pendingConfig.enabled !== false,
          due: pendingSchedule.due,
          reason: pendingConfig.enabled === false ? "disabled" : pendingSchedule.reason,
          scheduledHour: pendingSchedule.scheduledHour,
          currentHour: pendingSchedule.currentHour,
          lastCheckedAt: pendingSchedule.lastCheckedAt
        });
        if (pendingConfig.enabled !== false && pendingSchedule.due) {
          const pendingResult = sendPendingActivitiesSummary_(courseId, control);
          summary["pendingActivities:" + courseId] = pendingResult;
          logReminderProgress_(control, "PENDIENTES_RESULTADO", {
            courseId: courseId,
            worksChecked: pendingResult.worksChecked,
            overdueWorks: pendingResult.overdueWorks,
            recipients: pendingResult.recipients,
            sent: pendingResult.sent.length,
            incomplete: pendingResult.incomplete
          });
          if (!pendingResult.incomplete) {
            markScheduledReminderSent_(pendingKey, pendingConfig.everyDays, pendingConfig.hour);
          }
          else summary.incomplete = true;
        }
        logReminderProgress_(control, "CURSO_FIN", { courseId: courseId });
      } catch (error) {
        const message = "No se pudo procesar recordatorios del curso " + courseId + ": " + errorToPlainText(error);
        logReminderProgress_(control, "CURSO_ERROR", { courseId: courseId, message: message, stack: error && error.stack || "" });
        summary.errors.push({ courseId: courseId, message: message });
      }
    }

    // Los recordatorios no deben arrancar el lote de calificacion: ese lote
    // puede usar OpenAI y acercarse al limite de ejecucion. Aqui solo se listan
    // entregas sin enviar y se mandan las notificaciones que correspondan.
    if (!summary.incomplete && hasReminderTimeRemaining_(control, "recordatorios_por_tarea")) {
      summary.pendingActivities = processScheduledTaskReminders_(summary.errors, control);
      summary.incomplete = summary.pendingActivities.incomplete;
    }
    logReminderProgress_(control, "FIN", summary);
    return summary;
  } catch (error) {
    logReminderProgress_(control, "ERROR_FATAL", {
      lastStage: control.lastStage,
      message: errorToPlainText(error),
      stack: error && error.stack || ""
    });
    throw error;
  } finally {
    try {
      logReminderProgress_(control, "PROGRAMANDO_SIGUIENTE", { intervalMinutes: nextIntervalMinutes });
      scheduleNextReminderRun_(nextIntervalMinutes);
    } finally {
      lock.releaseLock();
    }
  }
}

/** Recorre las tareas configuradas sin evaluar ni calificar entregas. */
function processScheduledTaskReminders_(errors, control) {
  loadConfigurationFromSpreadsheet(true);
  const activeTasks = getActiveTaskConfigs({
    logCourseWorkDetails: false,
    shouldContinue: function (courseId) {
      return hasReminderTimeRemaining_(control, "descubrir_tareas:" + courseId);
    },
    onCourseError: function (courseId, error) {
      const message = "No se pudieron descubrir tareas del curso " + courseId +
        "; se continuara con los demas cursos: " + errorToPlainText(error);
      logReminderProgress_(control, "DESCUBRIMIENTO_CURSO_ERROR", {
        courseId: courseId,
        message: message
      });
      errors.push({ courseId: courseId, message: message });
    }
  });
  const summary = {
    tasksChecked: 0,
    notificationsChecked: 0,
    incomplete: activeTasks.incomplete === true
  };
  for (let index = 0; index < activeTasks.length; index++) {
    const taskConfig = activeTasks[index];
    if (!hasReminderTimeRemaining_(control, "tarea:" + getTaskLabel(taskConfig))) {
      summary.incomplete = true;
      break;
    }
    try {
      logReminderProgress_(control, "TAREA_INICIO", { task: getTaskLabel(taskConfig), index: index + 1, total: activeTasks.length });
      const courseWork = getCourseWork(taskConfig.courseId, taskConfig.courseWorkId);
      const unsubmitted = getUnsubmittedSubmissionsForTask(taskConfig, courseWork);
      sendPendingSubmissionNotifications(taskConfig, courseWork, unsubmitted);
      summary.tasksChecked++;
      summary.notificationsChecked += unsubmitted.length;
      logReminderProgress_(control, "TAREA_FIN", { task: getTaskLabel(taskConfig), unsubmitted: unsubmitted.length });
    } catch (error) {
      const message = "No se pudieron procesar recordatorios de " +
        getTaskLabel(taskConfig) + ": " + errorToPlainText(error);
      logReminderProgress_(control, "TAREA_ERROR", { message: message, stack: error && error.stack || "" });
      errors.push({ courseId: taskConfig.courseId, message: message });
    }
  }
  return summary;
}

/** Escribe trazas compactas que permiten ubicar la llamada externa que se atoro. */
function logReminderProgress_(control, stage, details) {
  control.lastStage = stage;
  console.log("[RECORDATORIOS][" + control.runId + "][" + stage + "][" +
    (new Date().getTime() - control.startedMs) + "ms] " + JSON.stringify(details || {}));
}

/** Detiene trabajo nuevo con margen suficiente para ejecutar el bloque finally. */
function hasReminderTimeRemaining_(control, nextStage) {
  const remainingMs = control.deadlineMs - new Date().getTime();
  if (remainingMs > 0) return true;
  logReminderProgress_(control, "LIMITE_SEGURO", { nextStage: nextStage, remainingMs: remainingMs });
  return false;
}

/** Reune todos los participantes seleccionados que aun no aceptan el curso. */
function getPendingCourseInvitationsForCourse_(courseId, reminderConfig) {
  // La invitacion al curso tambien queda pendiente para alumnos. Limitar este
  // recordatorio a PROFESOR dejaba fuera silenciosamente a los participantes
  // seleccionados con rol ALUMNO, aunque todavia no hubieran aceptado.
  const selectedEmails = [];
  const seenEmails = {};
  (COURSE_SETUP_TEMPLATE.students || []).forEach(function (participant) {
    const email = String(participant && participant.email || "").trim().toLowerCase();
    if (!participant || participant.selected !== true || !email || seenEmails[email]) return;
    seenEmails[email] = true;
    selectedEmails.push(email);
  });
  const status = getParticipantInvitationStatus_(courseId, selectedEmails);
  const course = Classroom.Courses.get(courseId);
  return {
    courseId: courseId,
    name: course.name || courseId,
    alternateLink: course.alternateLink || "",
    selectedParticipants: selectedEmails.length,
    recipients: status.pending.concat(status.missingInvitation),
    skippedAccepted: status.accepted,
    reminderConfig: reminderConfig || {}
  };
}

/** Envia un correo independiente por curso a cada participante pendiente. */
function sendCourseInvitationRemindersForCourse_(course) {
  const summaries = [];
  const reminderConfig = course.reminderConfig || {};
  (course.recipients || []).forEach(function (email) {
    MailApp.sendEmail({
      to: email,
      subject: reminderConfig.subject || "Recordatorio: acepta la invitacion al curso de Classroom",
      body: [
        reminderConfig.bodyIntro || "Hola. Sigue pendiente que aceptes tu invitacion al curso de Classroom.",
        "",
        "Curso: " + course.name,
        course.alternateLink ? "Liga: " + course.alternateLink : "",
        "",
        "Por favor entra a Classroom y acepta la invitacion."
      ].join("\n")
    });
    summaries.push({ email: email, courseId: course.courseId });
  });
  return summaries;
}

/** Envia a cada participante un solo correo con sus actividades vencidas sin entregar. */
function sendPendingActivitiesSummary_(courseId, control) {
  const pendingByEmail = {};
  const emailByUserId = {};
  const works = listCourseWorkForSetup(courseId);
  let overdueWorks = 0;
  for (let workIndex = 0; workIndex < works.length; workIndex++) {
    const work = works[workIndex];
    if (work.state !== "PUBLISHED" || work.workType !== "ASSIGNMENT") continue;
    // El resumen general solo reclama actividades cuya fecha limite ya paso.
    // Las actividades futuras o sin fecha limite no deben aparecer en el correo.
    if (!isCourseWorkOverdue(work)) continue;
    overdueWorks++;
    if (!hasReminderTimeRemaining_(control, "resumen:" + courseId + ":" + work.id)) {
      return { sent: [], incomplete: true, worksChecked: workIndex };
    }
    const submissions = listStudentSubmissions(courseId, work.id);
    logReminderProgress_(control, "RESUMEN_ACTIVIDAD", {
      courseId: courseId, workId: work.id, index: workIndex + 1,
      total: works.length, submissions: submissions.length
    });
    for (let submissionIndex = 0; submissionIndex < submissions.length; submissionIndex++) {
      const submission = submissions[submissionIndex];
      if (submission.state !== "NEW" && submission.state !== "CREATED") continue;
      if (!hasReminderTimeRemaining_(control, "perfil:" + submission.userId)) {
        return { sent: [], incomplete: true, worksChecked: workIndex };
      }
      if (!Object.prototype.hasOwnProperty.call(emailByUserId, submission.userId)) {
        emailByUserId[submission.userId] = getEmailForSubmission(submission);
      }
      const email = emailByUserId[submission.userId];
      if (!email) continue;
      if (!pendingByEmail[email]) pendingByEmail[email] = [];
      pendingByEmail[email].push(work.title);
    }
  }
  const course = Classroom.Courses.get(courseId);
  const sent = [];
  Object.keys(pendingByEmail).forEach(function (email) {
    MailApp.sendEmail({
      to: email,
      subject: "Actividades pendientes: " + (course.name || courseId),
      body: ["Hola.", "", "Estas actividades vencidas siguen pendientes:", "- " + pendingByEmail[email].join("\n- "), "", "Revisa el curso en Google Classroom."].join("\n")
    });
    sent.push({ email: email, activities: pendingByEmail[email].length });
  });
  return {
    sent: sent,
    incomplete: false,
    worksChecked: works.length,
    overdueWorks: overdueWorks,
    recipients: Object.keys(pendingByEmail).length
  };
}

function isScheduledReminderDue_(key, everyDays, hour) {
  return getScheduledReminderStatus_(key, everyDays, hour).due;
}

/** Explica por que una frecuencia programada se ejecuta o se omite. */
function getScheduledReminderStatus_(key, everyDays, hour) {
  const configuredHour = String(hour || "09:00").split(":");
  const now = new Date();
  const scheduledMinutes = Number(configuredHour[0]) * 60 + Number(configuredHour[1] || 0);
  const currentParts = Utilities.formatDate(now, COURSE_SHEET_TIME_ZONE, "H,m").split(",");
  const currentMinutes = Number(currentParts[0]) * 60 + Number(currentParts[1]);
  const status = {
    due: false,
    reason: "before_scheduled_hour",
    scheduledHour: String(hour || "09:00"),
    currentHour: Utilities.formatDate(now, COURSE_SHEET_TIME_ZONE, "HH:mm"),
    lastCheckedAt: null
  };
  if (currentMinutes < scheduledMinutes && !REMINDER_IGNORE_SCHEDULED_HOUR_) return status;
  // La frecuencia y la hora forman parte de la programacion. Si el usuario
  // cambia cualquiera de ellas, el nuevo horario debe tener su propio estado;
  // de lo contrario una revision hecha con el horario anterior bloquea el
  // recordatorio nuevo durante el resto del dia.
  const scheduleKey = getScheduledReminderPropertyKey_(key, everyDays, hour);
  const last = Number(PropertiesService.getScriptProperties().getProperty(scheduleKey) || 0);
  if (!last) {
    status.due = true;
    status.reason = "never_checked";
    return status;
  }
  status.lastCheckedAt = Utilities.formatDate(new Date(last), COURSE_SHEET_TIME_ZONE, "yyyy-MM-dd HH:mm");
  const today = Utilities.formatDate(now, COURSE_SHEET_TIME_ZONE, "yyyy-MM-dd");
  const lastDay = Utilities.formatDate(new Date(last), COURSE_SHEET_TIME_ZONE, "yyyy-MM-dd");
  if (today === lastDay) {
    status.reason = "already_checked_today";
    return status;
  }

  // Se comparan dias civiles, no bloques moviles de 24 horas. Asi un trigger
  // que se retrasa unos minutos no desplaza para siempre el siguiente correo.
  const intervalDays = Math.max(1, Number(everyDays) || 1);
  const todayNumber = Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  const lastDayNumber = Date.UTC(Number(lastDay.slice(0, 4)), Number(lastDay.slice(5, 7)) - 1, Number(lastDay.slice(8, 10)));
  status.due = (todayNumber - lastDayNumber) / (24 * 60 * 60 * 1000) >= intervalDays;
  status.reason = status.due ? "interval_elapsed" : "interval_not_elapsed";
  return status;
}

function markScheduledReminderSent_(key, everyDays, hour) {
  const scheduleKey = getScheduledReminderPropertyKey_(key, everyDays, hour);
  PropertiesService.getScriptProperties().setProperty(scheduleKey, String(new Date().getTime()));
}

/** Separa el historial de envio de cada combinacion de frecuencia y hora. */
function getScheduledReminderPropertyKey_(key, everyDays, hour) {
  const intervalDays = Math.max(1, Number(everyDays) || 1);
  const scheduledHour = String(hour || "09:00").trim();
  return "REMINDER_SENT:" + key + ":cada=" + intervalDays + ":hora=" + scheduledHour;
}

/** Permite revisar de inmediato cambios de participantes, tareas u horarios. */
function resetCourseReminderSchedule_(courseId) {
  const properties = PropertiesService.getScriptProperties();
  const prefix = "REMINDER_SENT:";
  const courseMarker = ":" + String(courseId) + ":";
  const keys = Object.keys(properties.getProperties()).filter(function (key) {
    return key.indexOf(prefix) === 0 && key.indexOf(courseMarker) !== -1;
  });
  keys.forEach(function (key) { properties.deleteProperty(key); });
  console.log("Programacion de recordatorios reiniciada para curso " + courseId +
    "; claves eliminadas=" + keys.length);
}

/**
 * Normaliza nombres para comparaciones simples.
 *
 * Recibe: texto.
 * Devuelve: texto normalizado.
 * Se usa: para comparar temas y tareas por nombre.
 */
function normalizeSetupName(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Crea las tareas habilitadas en COURSE_WORK_CREATION_CONFIGS.
 *
 * Recibe: nada.
 * Devuelve: arreglo con las tareas creadas por Classroom.
 * Se usa: manualmente cuando quieres que las tareas nazcan desde este proyecto Apps Script.
 */
function createConfiguredCourseWorkItems() {
  loadConfigurationFromSpreadsheet();
  const enabledConfigs = COURSE_WORK_CREATION_CONFIGS.filter(function (creationConfig) {
    return creationConfig.enabled === true;
  });

  if (!enabledConfigs.length) {
    throw new Error("No hay tareas habilitadas en COURSE_WORK_CREATION_CONFIGS.");
  }

  return enabledConfigs.map(function (creationConfig) {
    return createCourseWorkFromConfig(creationConfig);
  });
}

/**
 * Crea una tarea de prueba en el curso llamado "Pruebas".
 *
 * Recibe: nada.
 * Devuelve: objeto CourseWork creado, incluyendo su id.
 * Se usa: manualmente para generar una tarea asociada a este Apps Script.
 */
function testCreateCourseWorkInPruebas() {
  return createCourseWorkFromConfig({
    courseId: "841460792596",
    title: "Prueba lista enterados",
    description: "Tarea creada desde Apps Script para lista de enterados.",
    maxPoints: 100,
    state: "DRAFT",
    dueDate: {
      year: 2026,
      month: 6,
      day: 30
    },
    dueTime: {
      hours: 23,
      minutes: 59
    }
  });
}

/**
 * Crea una tarea de Google Classroom desde una configuracion simple.
 *
 * Recibe: configuracion con courseId, title, description, maxPoints, dueDate y dueTime.
 * Devuelve: objeto CourseWork creado, incluyendo su id.
 * Se usa: para evitar la limitacion de calificar tareas creadas manualmente.
 */
function createCourseWorkFromConfig(creationConfig) {
  if (!creationConfig.courseId) {
    throw new Error("Falta courseId en configuracion de creacion de tarea.");
  }

  if (!creationConfig.title) {
    throw new Error("Falta title en configuracion de creacion de tarea.");
  }

  const resource = {
    title: creationConfig.title,
    description: creationConfig.description || "",
    workType: creationConfig.workType || "ASSIGNMENT",
    state: creationConfig.state || "DRAFT",
    maxPoints: creationConfig.maxPoints || CONFIG.VALID_GRADE,
    submissionModificationMode: creationConfig.submissionModificationMode || "MODIFIABLE_UNTIL_TURNED_IN"
  };

  if (creationConfig.dueDate) {
    const utcDue = getFutureCourseWorkDue_(
      creationConfig.dueDate, creationConfig.dueTime, creationConfig.title);
    if (utcDue) {
      resource.dueDate = utcDue.dueDate;
      if (creationConfig.dueTime) resource.dueTime = utcDue.dueTime;
    }
  }

  if (creationConfig.topicId) {
    resource.topicId = creationConfig.topicId;
  }

  /*
   * Esta llamada hace que la tarea quede asociada al proyecto de Apps Script.
   * Esa asociacion es importante para algunas operaciones posteriores, como
   * modificar calificaciones desde la API de Classroom.
   */
  const created = Classroom.Courses.CourseWork.create(resource, creationConfig.courseId);
  console.log("Tarea creada por Apps Script. courseId=" + creationConfig.courseId + ", courseWorkId=" + created.id);
  console.log("La tarea se descubrira automaticamente si su titulo coincide con una regla activa.");

  return created;
}

/** Convierte la fecha/hora civil de CDMX a los campos UTC requeridos por Classroom. */
function convertCourseSheetDueToUtc_(dueDate, dueTime) {
  if (!dueDate) return { dueDate: null, dueTime: null };
  if (!dueTime) return { dueDate: dueDate, dueTime: null };

  const nominalUtc = Date.UTC(
    Number(dueDate.year), Number(dueDate.month) - 1, Number(dueDate.day),
    Number(dueTime.hours || 0), Number(dueTime.minutes || 0), Number(dueTime.seconds || 0)
  );
  const offsetText = Utilities.formatDate(new Date(nominalUtc), COURSE_SHEET_TIME_ZONE, "Z");
  const sign = offsetText.charAt(0) === "-" ? -1 : 1;
  const offsetMinutes = sign * (Number(offsetText.slice(1, 3)) * 60 + Number(offsetText.slice(3, 5)));
  const instant = new Date(nominalUtc - offsetMinutes * 60 * 1000);

  return {
    dueDate: { year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1, day: instant.getUTCDate() },
    dueTime: { hours: instant.getUTCHours(), minutes: instant.getUTCMinutes(), seconds: instant.getUTCSeconds() }
  };
}

/**
 * Devuelve una fecha limite apta para Classroom o la omite si ya vencio.
 *
 * Classroom rechaza toda la operacion de creacion o actualizacion cuando se
 * envia una fecha pasada. Omitirla permite aplicar el resto de los cambios; en
 * una tarea existente se conserva la fecha que ya tenga en Classroom.
 */
function getFutureCourseWorkDue_(dueDate, dueTime, taskTitle, now) {
  const utcDue = convertCourseSheetDueToUtc_(dueDate, dueTime);
  const comparisonTime = dueTime
    ? Date.UTC(
      utcDue.dueDate.year, utcDue.dueDate.month - 1, utcDue.dueDate.day,
      utcDue.dueTime.hours || 0, utcDue.dueTime.minutes || 0, utcDue.dueTime.seconds || 0)
    : Date.UTC(utcDue.dueDate.year, utcDue.dueDate.month - 1, utcDue.dueDate.day, 23, 59, 59);
  const currentTime = now instanceof Date ? now.getTime() : Date.now();

  if (comparisonTime <= currentTime) {
    console.log("Se omitio la fecha limite pasada de la tarea '" +
      String(taskTitle || "sin titulo") + "'. Corrigela en la hoja para actualizarla en Classroom.");
    return null;
  }

  return utcDue;
}

/**
 * Diagnostica si una tarea esta asociada al proyecto desarrollador actual.
 *
 * Recibe: courseId y courseWorkId.
 * Devuelve: datos basicos de la tarea y associatedWithDeveloper si Classroom lo expone.
 * Se usa: para entender si una tarea manual podria bloquear escritura de calificacion.
 */
function diagnoseCourseWorkDeveloperAssociation(courseId, courseWorkId) {
  const courseWork = getCourseWork(courseId, courseWorkId);
  const diagnostic = {
    courseId: courseId,
    courseWorkId: courseWorkId,
    title: courseWork.title,
    state: courseWork.state,
    workType: courseWork.workType,
    associatedWithDeveloper: courseWork.associatedWithDeveloper
  };

  console.log("Diagnostico de asociacion de tarea: " + JSON.stringify(diagnostic));
  return diagnostic;
}

/**
 * Obtiene entregas pendientes de evaluacion para una tarea.
 *
 * Recibe: configuracion de tarea y objeto CourseWork.
 * Devuelve: lista de entregas TURNED_IN sin assignedGrade.
 * Se usa: antes de llamar a Drive/OpenAI para evitar gastar recursos en trabajos ya calificados.
 */
function getPendingSubmissionsForTask(taskConfig, courseWork) {
  const allSubmissions = listStudentSubmissions(taskConfig.courseId, taskConfig.courseWorkId);
  const pending = allSubmissions
    .filter(function (submission) {
      return submission.state === "TURNED_IN";
    })
    .filter(function (submission) {
      /*
       * Si ya existe calificacion en borrador o asignada, el bot asume que
       * esta evidencia ya fue revisada y no vuelve a llamar a OpenAI.
       */
      return !hasAnyGrade(submission);
    })
    .sort(compareSubmissionsByUpdateTime);

  console.log("Pendientes sin assignedGrade en " + courseWork.title + ": " + pending.length);
  return pending;
}

/**
 * Obtiene entregas que siguen sin enviarse para una tarea.
 *
 * Recibe: configuracion de tarea y objeto CourseWork.
 * Devuelve: lista de entregas con state NEW.
 * Se usa: para recordatorios PRE_24H y OVERDUE, igual que el workflow n8n recuperado.
 */
function getUnsubmittedSubmissionsForTask(taskConfig, courseWork) {
  const allSubmissions = listStudentSubmissions(taskConfig.courseId, taskConfig.courseWorkId);
  const unsubmitted = allSubmissions
    .filter(function (submission) {
      return submission.state === "NEW";
    })
    .sort(compareSubmissionsByUpdateTime);

  console.log("Entregas NEW en " + courseWork.title + ": " + unsubmitted.length);
  return unsubmitted;
}

/**
 * Lista todas las entregas de una tarea, manejando paginacion.
 *
 * Recibe: courseId y courseWorkId.
 * Devuelve: arreglo de StudentSubmission.
 * Se usa: como base para filtrar entregas pendientes.
 */
function listStudentSubmissions(courseId, courseWorkId) {
  const submissions = [];
  let pageToken = null;

  do {
    const response = Classroom.Courses.CourseWork.StudentSubmissions.list(courseId, courseWorkId, {
      pageSize: 100,
      pageToken: pageToken
    });

    if (response.studentSubmissions) {
      submissions.push.apply(submissions, response.studentSubmissions);
    }

    pageToken = response.nextPageToken || null;
  } while (pageToken);

  return submissions;
}

/**
 * Determina si una entrega ya tiene assignedGrade.
 *
 * Recibe: StudentSubmission.
 * Devuelve: true si existe una calificacion asignada.
 * Se usa: como filtro principal para no reprocesar evidencias.
 */
function hasAssignedGrade(submission) {
  return submission.assignedGrade !== null &&
    submission.assignedGrade !== undefined &&
    submission.assignedGrade !== "";
}

/**
 * Determina si una entrega ya tiene alguna calificacion escrita.
 *
 * Recibe: StudentSubmission.
 * Devuelve: true si existe draftGrade o assignedGrade.
 * Se usa: para no reprocesar evidencias ya revisadas cuando el bot trabaja en borrador.
 */
function hasAnyGrade(submission) {
  const hasDraftGrade = submission.draftGrade !== null &&
    submission.draftGrade !== undefined &&
    submission.draftGrade !== "";
  const hasAssignedGradeValue = submission.assignedGrade !== null &&
    submission.assignedGrade !== undefined &&
    submission.assignedGrade !== "";

  return hasDraftGrade || hasAssignedGradeValue;
}

/**
 * Ordena entregas por antiguedad.
 *
 * Recibe: dos StudentSubmission.
 * Devuelve: numero para Array.sort.
 * Se usa: para atender primero entregas mas antiguas.
 */
function compareSubmissionsByUpdateTime(a, b) {
  const left = new Date(a.updateTime || a.creationTime || 0).getTime();
  const right = new Date(b.updateTime || b.creationTime || 0).getTime();
  return left - right;
}

/**
 * Escribe assignedGrade en una entrega de Classroom.
 *
 * Recibe: configuracion de tarea, submissionId y calificacion.
 * Devuelve: respuesta de Classroom.
 * Se usa: despues de evaluar una evidencia como valida o invalida.
 */
function assignGradeToSubmission(taskConfig, submissionId, grade) {
  /*
   * studentSubmissions.patch requiere updateMask. Sin el updateMask, Google
   * puede ignorar campos o rechazar la peticion.
   */
  const gradeField = CONFIG.GRADE_FIELD_TO_WRITE || "assignedGrade";
  if (gradeField !== "draftGrade" && gradeField !== "assignedGrade") {
    throw new Error("GRADE_FIELD_TO_WRITE debe ser 'draftGrade' o 'assignedGrade'.");
  }

  const resource = {};
  resource[gradeField] = grade;

  return Classroom.Courses.CourseWork.StudentSubmissions.patch(
    resource,
    taskConfig.courseId,
    taskConfig.courseWorkId,
    submissionId,
    {
      updateMask: gradeField
    }
  );
}

/**
 * Prueba controlada de permisos para escribir calificacion.
 *
 * Recibe: nada; usa la primera tarea activa y la primera entrega TURNED_IN sin assignedGrade.
 * Devuelve: informacion de diagnostico.
 * Se usa: manualmente antes de apagar DRY_RUN.
 */
function testClassroomGradePermission() {
  const activeTasks = getActiveTaskConfigs();
  if (activeTasks.length === 0) {
    throw new Error("No se descubrieron tareas publicadas con una regla activa.");
  }

  const taskConfig = activeTasks[0];
  const submissions = getPendingSubmissionsForTask(taskConfig, getCourseWork(taskConfig.courseId, taskConfig.courseWorkId));
  if (submissions.length === 0) {
    throw new Error("No hay entregas TURNED_IN sin assignedGrade para probar.");
  }

  const submission = submissions[0];
  const testGrade = taskConfig.invalidGrade || CONFIG.INVALID_GRADE;

  console.log("Probando permisos con entrega: " + submission.id);

  if (CONFIG.DRY_RUN) {
    console.log("[DRY_RUN] Se probaria asignar " + (CONFIG.GRADE_FIELD_TO_WRITE || "assignedGrade") + "=" + testGrade + " a " + submission.id);
    return {
      dryRun: true,
      submissionId: submission.id,
      gradeFieldThatWouldBeAssigned: CONFIG.GRADE_FIELD_TO_WRITE || "assignedGrade",
      gradeThatWouldBeAssigned: testGrade
    };
  }

  try {
    const response = assignGradeToSubmission(taskConfig, submission.id, testGrade);
    console.log("Prueba de permisos completada: " + JSON.stringify(response));
    return response;
  } catch (error) {
    const diagnostic = diagnoseClassroomPermissionError(error);
    console.log("Diagnostico de permisos: " + diagnostic);
    throw new Error(diagnostic);
  }
}

/**
 * Lista entregas pendientes con datos legibles para identificar al estudiante y su evidencia.
 *
 * Recibe: nada; usa la primera tarea activa.
 * Devuelve: arreglo con tarea, usuario, entrega y adjuntos.
 * Se usa: manualmente antes de calificar para confirmar a quien corresponde cada submissionId.
 */
function testListPendingSubmissionDetails() {
  const activeTasks = getActiveTaskConfigs();
  if (activeTasks.length === 0) {
    throw new Error("No se descubrieron tareas publicadas con una regla activa.");
  }

  const taskConfig = activeTasks[0];
  const courseWork = getCourseWork(taskConfig.courseId, taskConfig.courseWorkId);
  const submissions = getPendingSubmissionsForTask(taskConfig, courseWork);

  const details = submissions.map(function (submission) {
    const profile = getClassroomUserProfile(submission.userId);
    const attachments = getSubmissionAttachments(submission).map(function (attachment) {
      if (!attachment.driveFile) {
        return attachment;
      }

      return {
        fileId: attachment.driveFile.id || "",
        title: attachment.driveFile.title || "",
        alternateLink: attachment.driveFile.alternateLink || ""
      };
    });

    return {
      courseId: taskConfig.courseId,
      courseWorkId: taskConfig.courseWorkId,
      courseWorkTitle: courseWork.title,
      submissionId: submission.id,
      submissionState: submission.state,
      assignedGrade: submission.assignedGrade || null,
      draftGrade: submission.draftGrade || null,
      userId: submission.userId,
      userName: profile && profile.name ? profile.name.fullName : "",
      userEmail: profile ? profile.emailAddress || "" : "",
      attachments: attachments
    };
  });

  console.log("Detalle de entregas pendientes: " + JSON.stringify(details));
  return details;
}

function testListAllSubmissionDetailsPruebasBot() {
  const courseId = "841460792596";
  const courseWorkId = "855309186752";

  const courseWork = getCourseWork(courseId, courseWorkId);
  const submissions = listStudentSubmissions(courseId, courseWorkId);

  const details = submissions.map(function (submission) {
    const profile = getClassroomUserProfile(submission.userId);

    const attachments = getSubmissionAttachments(submission).map(function (attachment) {
      if (!attachment.driveFile) {
        return attachment;
      }

      return {
        fileId: attachment.driveFile.id || "",
        title: attachment.driveFile.title || "",
        alternateLink: attachment.driveFile.alternateLink || ""
      };
    });

    return {
      courseId: courseId,
      courseWorkId: courseWorkId,
      courseWorkTitle: courseWork.title,
      submissionId: submission.id,
      submissionState: submission.state,
      assignedGrade: submission.assignedGrade || null,
      draftGrade: submission.draftGrade || null,
      userId: submission.userId,
      userName: profile && profile.name ? profile.name.fullName : "",
      userEmail: profile ? profile.emailAddress || "" : "",
      attachments: attachments
    };
  });

  console.log("Detalle de todas las entregas: " + JSON.stringify(details));
  return details;
}

function clearBothGradesFromSubmission(courseId, courseWorkId, submissionId) {
  if (!courseId) {
    throw new Error("Falta courseId.");
  }

  if (!courseWorkId) {
    throw new Error("Falta courseWorkId.");
  }

  if (!submissionId) {
    throw new Error("Falta submissionId.");
  }

  return Classroom.Courses.CourseWork.StudentSubmissions.patch(
    {
      draftGrade: null,
      assignedGrade: null
    },
    courseId,
    courseWorkId,
    submissionId,
    {
      updateMask: "draftGrade,assignedGrade"
    }
  );
}

function testClearBothGradesFromSubmission() {
  const courseId = "PEGA_AQUI_EL_COURSE_ID";
  const courseWorkId = "PEGA_AQUI_EL_COURSE_WORK_ID";
  const submissionId = "PEGA_AQUI_EL_SUBMISSION_ID";

  if (CONFIG.DRY_RUN) {
    console.log("[DRY_RUN] Se borrarian draftGrade y assignedGrade de submissionId=" + submissionId);
    return {
      dryRun: true,
      action: "clearBothGradesFromSubmission",
      courseId: courseId,
      courseWorkId: courseWorkId,
      submissionId: submissionId
    };
  }

  const response = clearBothGradesFromSubmission(courseId, courseWorkId, submissionId);
  console.log("Calificaciones borradas para submissionId=" + submissionId);
  return response;
}

/**
 * Limpia draftGrade y assignedGrade de todas las entregas calificadas en una tarea concreta.
 *
 * Recibe: courseId y courseWorkId.
 * Devuelve: resumen de limpieza.
 * Se usa: para deshacer pruebas masivas de una sola tarea, este o no descubierta por el bot.
 */
function clearBothGradesFromCourseWork(courseId, courseWorkId) {
  if (!courseId) {
    throw new Error("Falta courseId.");
  }

  if (!courseWorkId) {
    throw new Error("Falta courseWorkId.");
  }

  const courseWork = getCourseWork(courseId, courseWorkId);
  const submissions = listStudentSubmissions(courseId, courseWorkId);
  const summary = {
    dryRun: CONFIG.DRY_RUN === true,
    courseId: courseId,
    courseWorkId: courseWorkId,
    courseWorkTitle: courseWork.title,
    inspected: 0,
    cleared: 0,
    skippedWithoutGrade: 0,
    errors: 0,
    items: []
  };

  submissions.forEach(function (submission) {
    summary.inspected++;

    const hasDraftGrade = submission.draftGrade !== null &&
      submission.draftGrade !== undefined &&
      submission.draftGrade !== "";
    const hasAssignedGradeValue = submission.assignedGrade !== null &&
      submission.assignedGrade !== undefined &&
      submission.assignedGrade !== "";

    if (!hasDraftGrade && !hasAssignedGradeValue) {
      summary.skippedWithoutGrade++;
      return;
    }

    const item = {
      courseId: courseId,
      courseWorkId: courseWorkId,
      courseWorkTitle: courseWork.title,
      submissionId: submission.id,
      draftGradeFound: submission.draftGrade || null,
      assignedGradeFound: submission.assignedGrade || null
    };

    if (CONFIG.DRY_RUN) {
      summary.items.push(item);
      return;
    }

    try {
      clearBothGradesFromSubmission(courseId, courseWorkId, submission.id);
      summary.cleared++;
      summary.items.push(item);
    } catch (error) {
      summary.errors++;
      item.error = errorToPlainText(error);
      summary.items.push(item);
    }
  });

  console.log("Resumen de limpieza de calificaciones de tarea: " + JSON.stringify(summary));
  return summary;
}

function testClearBothGradesFromCourseWork() {
  const courseId = "841460792596";
  const courseWorkId = "855309186752";

  return clearBothGradesFromCourseWork(courseId, courseWorkId);
}

function testListCourseWorkForSetup() {
  return listCourseWorkForSetup("841460792596");
}

/**
 * Convierte un error de Classroom en una explicacion accionable.
 *
 * Recibe: error original.
 * Devuelve: texto de diagnostico.
 * Se usa: cuando falla studentSubmissions.patch.
 */
function diagnoseClassroomPermissionError(error) {
  const text = errorToPlainText(error);

  if (text.indexOf("The caller does not have permission") !== -1 || text.indexOf("PERMISSION_DENIED") !== -1) {
    return "Classroom rechazo la escritura de calificacion por permisos. Revisa que la cuenta sea profesor del curso, que el servicio avanzado Classroom este habilitado, que el dominio permita Classroom API y que el proyecto OAuth tenga scopes de coursework.students. En algunos dominios, las calificaciones solo pueden modificarse por el proyecto o cuenta autorizada para esa tarea.";
  }

  if (text.indexOf("ProjectPermissionDenied") !== -1 || text.indexOf("project") !== -1) {
    return "Google Classroom puede estar exigiendo que el proyecto que modifica la calificacion tenga permisos compatibles con la tarea. Alternativas: crear nuevas tareas desde este mismo Apps Script, probar draftGrade, o pedir al administrador que revise la politica del dominio. Error original: " + text;
  }

  return "Error de Classroom sin clasificar. Copia este mensaje para el administrador del dominio: " + text;
}

/**
 * Obtiene el perfil de un usuario de Classroom.
 *
 * Recibe: userId de la entrega.
 * Devuelve: UserProfile o null si no se puede leer.
 * Se usa: para enviar notificaciones por correo cuando el dominio lo permite.
 */
function getClassroomUserProfile(userId) {
  try {
    return Classroom.UserProfiles.get(userId);
  } catch (error) {
    console.log("No se pudo obtener perfil de usuario " + userId + ": " + errorToPlainText(error));
    return null;
  }
}


/**
 * Busca el primer PDF adjunto en una entrega.
 *
 * Recibe: StudentSubmission.
 * Devuelve: objeto con fileId, nombre y blob PDF; o null si no encuentra PDF.
 * Se usa: antes de llamar a OpenAI.
 */
function getFirstPdfEvidenceFromSubmission(submission) {
  const attachments = getSubmissionAttachments(submission);

  for (let index = 0; index < attachments.length; index++) {
    const attachment = attachments[index];
    if (!attachment.driveFile || !attachment.driveFile.id) {
      continue;
    }

    try {
      const fileData = getPdfBlobFromDriveFileId(attachment.driveFile.id, attachment.driveFile.title || "evidencia.pdf");
      if (fileData) {
        return fileData;
      }
    } catch (error) {
      console.log("No se pudo leer adjunto " + attachment.driveFile.id + ": " + errorToPlainText(error));
    }
  }

  return null;
}

/**
 * Obtiene adjuntos de una entrega de Classroom.
 *
 * Recibe: StudentSubmission.
 * Devuelve: arreglo de adjuntos.
 * Se usa: para inspeccionar archivos entregados por el estudiante.
 */
function getSubmissionAttachments(submission) {
  if (!submission.assignmentSubmission || !submission.assignmentSubmission.attachments) {
    return [];
  }

  return submission.assignmentSubmission.attachments;
}

/**
 * Descarga un archivo de Drive como PDF usando DriveApp primero.
 *
 * Recibe: fileId y nombre sugerido.
 * Devuelve: objeto con fileId, nombre, mimeType y blob.
 * Se usa: para evidencia del estudiante y documento ejemplo.
 */
function getPdfBlobFromDriveFileId(fileId, fallbackName) {
  /*
   * DriveApp es la ruta principal porque funciona dentro del entorno Google
   * y suele respetar los permisos de la cuenta que ejecuta Apps Script.
   */
  const file = DriveApp.getFileById(fileId);
  const mimeType = file.getMimeType();
  const fileName = file.getName() || fallbackName || "archivo.pdf";

  if (mimeType === MimeType.PDF || mimeType === "application/pdf") {
    return {
      fileId: fileId,
      name: ensurePdfFileName(fileName),
      mimeType: "application/pdf",
      blob: file.getBlob().setName(ensurePdfFileName(fileName))
    };
  }

  if (isGoogleWorkspaceMimeType(mimeType)) {
    const pdfBlob = file.getAs(MimeType.PDF).setName(ensurePdfFileName(fileName));
    return {
      fileId: fileId,
      name: pdfBlob.getName(),
      mimeType: "application/pdf",
      blob: pdfBlob
    };
  }

  /*
   * Si el archivo no es PDF ni documento convertible, se rechaza para evitar
   * enviar formatos inesperados a OpenAI.
   */
  throw new Error("El archivo " + fileName + " no es PDF ni documento Google convertible. MIME: " + mimeType);
}

/**
 * Determina si un MIME corresponde a un archivo nativo de Google.
 *
 * Recibe: mimeType.
 * Devuelve: true si Drive puede exportarlo a PDF.
 * Se usa: para aceptar Docs, Sheets, Slides o Drawings como evidencia convertible.
 */
function isGoogleWorkspaceMimeType(mimeType) {
  return mimeType === MimeType.GOOGLE_DOCS ||
    mimeType === MimeType.GOOGLE_SHEETS ||
    mimeType === MimeType.GOOGLE_SLIDES ||
    mimeType === MimeType.GOOGLE_DRAWINGS ||
    mimeType === "application/vnd.google-apps.document" ||
    mimeType === "application/vnd.google-apps.spreadsheet" ||
    mimeType === "application/vnd.google-apps.presentation" ||
    mimeType === "application/vnd.google-apps.drawing";
}

/**
 * Asegura que el nombre del blob termine en .pdf.
 *
 * Recibe: nombre original.
 * Devuelve: nombre terminado en .pdf.
 * Se usa: para que OpenAI reciba archivos con extension clara.
 */
function ensurePdfFileName(name) {
  if (!name) {
    return "archivo.pdf";
  }

  return name.toLowerCase().lastIndexOf(".pdf") === name.length - 4
    ? name
    : name + ".pdf";
}


/**
 * Envia recordatorios de pendientes y vencidos para una tarea.
 *
 * Recibe: configuracion, CourseWork y entregas sin enviar.
 * Devuelve: nada.
 * Se usa: despues de detectar entregas NEW, como hacia el workflow n8n recuperado.
 */
function sendPendingSubmissionNotifications(taskConfig, courseWork, submissions) {
  if (!taskConfig.sendStudentNotifications) {
    return;
  }

  submissions.forEach(function (submission) {
    const reminderKey = "tarea:" + taskConfig.courseId + ":" + taskConfig.courseWorkId + ":" + submission.userId;
    if (CONFIG.ENABLE_OVERDUE_NOTICES && isSubmissionOverdue(courseWork, submission)) {
      if (isScheduledReminderDue_(reminderKey, taskConfig.reminderEveryDays, taskConfig.reminderHour) &&
          sendOverdueReminder(taskConfig, courseWork, submission)) {
        markScheduledReminderSent_(reminderKey, taskConfig.reminderEveryDays, taskConfig.reminderHour);
      }
      return;
    }

    if (CONFIG.ENABLE_REMINDERS && getCourseWorkDueDate(courseWork) &&
        isScheduledReminderDue_(reminderKey, taskConfig.reminderEveryDays, taskConfig.reminderHour)) {
      if (sendDueSoonReminder(taskConfig, courseWork, submission)) {
        markScheduledReminderSent_(reminderKey, taskConfig.reminderEveryDays, taskConfig.reminderHour);
      }
    }
  });
}

/**
 * Envia recordatorio cuando falta poco para vencer.
 *
 * Recibe: configuracion, tarea y entrega.
 * Devuelve: nada.
 * Se usa: para pendientes dentro de la ventana de 24 horas.
 */
function sendDueSoonReminder(taskConfig, courseWork, submission) {
  const email = getEmailForSubmission(submission);
  if (!email) {
    console.log("No se encontro correo para recordatorio de usuario " + submission.userId);
    return false;
  }

  MailApp.sendEmail({
    to: email,
    subject: "Recordatorio (24h): " + courseWork.title,
    body: buildDueSoonEmailBody(courseWork, submission)
  });
  return true;
}

/**
 * Envia aviso cuando la evidencia esta vencida.
 *
 * Recibe: configuracion, tarea y entrega.
 * Devuelve: nada.
 * Se usa: para entregas late o despues de fecha limite.
 */
function sendOverdueReminder(taskConfig, courseWork, submission) {
  const email = getEmailForSubmission(submission);
  if (!email) {
    console.log("No se encontro correo para aviso vencido de usuario " + submission.userId);
    return false;
  }

  MailApp.sendEmail({
    to: email,
    subject: "Evidencia vencida: " + courseWork.title,
    body: buildOverdueEmailBody(courseWork, submission)
  });
  return true;
}

/**
 * Envia correo por error critico al responsable.
 *
 * Recibe: asunto y mensaje.
 * Devuelve: nada.
 * Se usa: cuando fallan permisos, OpenAI, Drive o Classroom.
 */
function sendCriticalErrorEmail(subject, message) {
  if (!CONFIG.ENABLE_ERROR_EMAILS || !CONFIG.ADMIN_EMAIL) {
    return;
  }

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: subject,
    body: message
  });
}

/**
 * Envia resumen opcional al finalizar un lote.
 *
 * Recibe: resumen del lote.
 * Devuelve: nada.
 * Se usa: al final de processPendingSubmissionsBatch.
 */
function sendBatchSummaryToTeacher(summary) {
  if (!CONFIG.ENABLE_BATCH_SUMMARY_EMAIL || !CONFIG.ADMIN_EMAIL) {
    return;
  }

  MailApp.sendEmail({
    to: CONFIG.ADMIN_EMAIL,
    subject: "Resumen del bot de Classroom",
    body: [
      "Evidencias revisadas: " + summary.processed,
      "Validas: " + summary.valid,
      "Invalidas: " + summary.invalid,
      "Errores: " + summary.errors,
      "Tiempo aproximado: " + Math.round(summary.elapsedMs / 1000) + " segundos"
    ].join("\n")
  });
}

/**
 * Obtiene correo del usuario de una entrega.
 *
 * Recibe: StudentSubmission.
 * Devuelve: correo o cadena vacia.
 * Se usa: para recordatorios al estudiante.
 */
function getEmailForSubmission(submission) {
  const userId = String(submission && submission.userId || "");
  if (Object.prototype.hasOwnProperty.call(REMINDER_EMAIL_CACHE_, userId)) {
    return REMINDER_EMAIL_CACHE_[userId];
  }
  const profile = getClassroomUserProfile(submission.userId);
  const email = profile && profile.emailAddress ? profile.emailAddress : "";
  REMINDER_EMAIL_CACHE_[userId] = email;
  return email;
}

// El mismo alumno aparece en muchas actividades; evita una llamada de perfil
// por cada entrega durante una misma ejecucion de Apps Script.
var REMINDER_EMAIL_CACHE_ = {};

/**
 * Indica si una entrega esta vencida.
 *
 * Recibe: CourseWork y StudentSubmission.
 * Devuelve: true si Classroom la marca late o si paso la fecha limite.
 * Se usa: para decidir aviso de evidencia vencida.
 */
function isSubmissionOverdue(courseWork, submission) {
  if (submission.late === true) {
    return true;
  }

  return isCourseWorkOverdue(courseWork);
}

/**
 * Indica si una actividad ya paso su fecha limite.
 *
 * Recibe: CourseWork y, opcionalmente, la fecha actual para pruebas.
 * Devuelve: false cuando no existe fecha limite o todavia no ha vencido.
 * Se usa: para filtrar el resumen general y decidir avisos vencidos.
 */
function isCourseWorkOverdue(courseWork, now) {
  const dueDate = getCourseWorkDueDate(courseWork);
  const currentDate = now || new Date();
  return dueDate ? currentDate.getTime() > dueDate.getTime() : false;
}

/**
 * Indica si la fecha limite esta dentro de la ventana de recordatorio.
 *
 * Recibe: CourseWork.
 * Devuelve: true si faltan menos de CONFIG.REMINDER_WINDOW_HOURS.
 * Se usa: para enviar recordatorio previo al vencimiento.
 */
function isCourseWorkDueWithinReminderWindow(courseWork) {
  const dueDate = getCourseWorkDueDate(courseWork);
  if (!dueDate) {
    return false;
  }

  const now = new Date().getTime();
  const due = dueDate.getTime();
  const windowMs = CONFIG.REMINDER_WINDOW_HOURS * 60 * 60 * 1000;

  return due > now && due - now <= windowMs;
}

/**
 * Construye la fecha limite de una tarea.
 *
 * Recibe: CourseWork.
 * Devuelve: Date o null.
 * Se usa: para recordatorios y vencidos.
 */
function getCourseWorkDueDate(courseWork) {
  if (!courseWork.dueDate) {
    return null;
  }

  // Classroom entrega dueTime en UTC, aunque la hoja y los horarios de los
  // recordatorios se muestren en la zona horaria del proyecto. Construir esta
  // fecha con `new Date(year, ...)` reinterpretaba, por ejemplo, 04:30 UTC
  // como 04:30 de Ciudad de Mexico y retrasaba seis horas el aviso vencido.
  if (courseWork.dueTime) {
    return new Date(Date.UTC(
      courseWork.dueDate.year,
      courseWork.dueDate.month - 1,
      courseWork.dueDate.day,
      courseWork.dueTime.hours || 0,
      courseWork.dueTime.minutes || 0,
      courseWork.dueTime.seconds || 0
    ));
  }

  // Sin dueTime, conserva el comportamiento documentado: la actividad vence
  // al terminar el dia civil configurado para el proyecto de Apps Script.
  return new Date(
    courseWork.dueDate.year,
    courseWork.dueDate.month - 1,
    courseWork.dueDate.day,
    23,
    59,
    0
  );
}

/**
 * Construye mensaje de recordatorio.
 *
 * Recibe: CourseWork y entrega.
 * Devuelve: cuerpo del correo.
 * Se usa: en sendDueSoonReminder.
 */
function buildDueSoonEmailBody(courseWork, submission) {
  return [
    "Hola.",
    "",
    "Tu evidencia de la tarea \"" + courseWork.title + "\" sigue pendiente de evaluacion.",
    "La fecha limite esta proxima. Revisa que tu archivo PDF este entregado correctamente en Google Classroom.",
    "",
    "Este mensaje fue enviado automaticamente."
  ].join("\n");
}

/**
 * Construye mensaje de evidencia vencida.
 *
 * Recibe: CourseWork y entrega.
 * Devuelve: cuerpo del correo.
 * Se usa: en sendOverdueReminder.
 */
function buildOverdueEmailBody(courseWork, submission) {
  return [
    "Hola.",
    "",
    "La evidencia de la tarea \"" + courseWork.title + "\" aparece como vencida o atrasada.",
    "Por favor revisa tu entrega en Google Classroom.",
    "",
    "Este mensaje fue enviado automaticamente."
  ].join("\n");
}


/**
 * Agrega resumen de ejecucion a Google Sheets si la bitacora esta activa.
 *
 * Recibe: resumen del lote.
 * Devuelve: nada.
 * Se usa: al terminar una ejecucion o ante error critico.
 */
function appendExecutionLogToSheet(summary) {
  if (!CONFIG.ENABLE_SHEETS_LOG) {
    return;
  }

  const sheet = getLogSheet();
  sheet.appendRow([
    new Date(),
    "batch",
    summary.processed,
    summary.valid,
    summary.invalid,
    summary.errors,
    summary.elapsedMs,
    summary.criticalError || ""
  ]);
}

/**
 * Agrega resultado de una evidencia a Google Sheets si la bitacora esta activa.
 *
 * Recibe: tarea, CourseWork, entrega, archivo, evaluacion y decision.
 * Devuelve: nada.
 * Se usa: despues de evaluar cada evidencia.
 */
function appendEvaluationLogToSheet(taskConfig, courseWork, submission, evidenceFile, evaluation, gradingDecision) {
  if (!CONFIG.ENABLE_SHEETS_LOG) {
    return;
  }

  const sheet = getLogSheet();
  sheet.appendRow([
    new Date(),
    "evaluation",
    taskConfig.courseId,
    taskConfig.courseWorkId,
    courseWork.title,
    submission.id,
    submission.userId,
    evidenceFile.fileId,
    gradingDecision.grade,
    gradingDecision.isValid,
    evaluation.motivo,
    JSON.stringify(evaluation.diferencias)
  ]);
}

/**
 * Agrega errores de una entrega a Google Sheets si la bitacora esta activa.
 *
 * Recibe: tarea, entrega y mensaje.
 * Devuelve: nada.
 * Se usa: cuando falla una evidencia individual.
 */
function appendErrorLogToSheet(taskConfig, submission, message) {
  if (!CONFIG.ENABLE_SHEETS_LOG) {
    return;
  }

  const sheet = getLogSheet();
  sheet.appendRow([
    new Date(),
    "error",
    taskConfig.courseId,
    taskConfig.courseWorkId,
    submission ? submission.id : "",
    submission ? submission.userId : "",
    message
  ]);
}

/**
 * Obtiene o crea la hoja de bitacora.
 *
 * Recibe: nada.
 * Devuelve: objeto Sheet.
 * Se usa: por todas las funciones append...ToSheet.
 */
function getLogSheet() {
  if (!CONFIG.SHEETS_LOG_ID) {
    throw new Error("ENABLE_SHEETS_LOG esta activo, pero SHEETS_LOG_ID esta vacio.");
  }

  const spreadsheet = SpreadsheetApp.openById(CONFIG.SHEETS_LOG_ID);
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEETS_LOG_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEETS_LOG_SHEET_NAME);
    sheet.appendRow([
      "timestamp",
      "type",
      "field_1",
      "field_2",
      "field_3",
      "field_4",
      "field_5",
      "field_6",
      "field_7",
      "field_8",
      "field_9",
      "field_10"
    ]);
  }

  return sheet;
}


/**
 * Crea el trigger automatico del bot.
 *
 * Recibe: nada.
 * Devuelve: nada.
 * Se usa: una vez, manualmente, despues de configurar el proyecto.
 */
function createHourlyTrigger() {
  loadConfigurationFromSpreadsheet();
  deleteClassroomBotTriggers();

  ScriptApp.newTrigger("processPendingSubmissionsBatch")
    .timeBased()
    .everyHours(CONFIG.TRIGGER_EVERY_HOURS)
    .create();

  console.log("Trigger creado cada " + CONFIG.TRIGGER_EVERY_HOURS + " hora(s).");
}

/**
 * Elimina triggers existentes del bot.
 *
 * Recibe: nada.
 * Devuelve: cantidad eliminada.
 * Se usa: antes de crear un nuevo trigger o para pausar automatizacion.
 */
function deleteClassroomBotTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0;

  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "processPendingSubmissionsBatch") {
      ScriptApp.deleteTrigger(trigger);
      deleted++;
    }
  });

  console.log("Triggers eliminados: " + deleted);
  return deleted;
}

/**
 * Lista triggers instalados.
 *
 * Recibe: nada.
 * Devuelve: arreglo con informacion simple.
 * Se usa: para diagnostico.
 */
function listClassroomBotTriggers() {
  return ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handlerFunction: trigger.getHandlerFunction(),
      eventType: String(trigger.getEventType()),
      source: String(trigger.getTriggerSource())
    };
  });
}
