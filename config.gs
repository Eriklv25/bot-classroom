/**
 * Configuracion general del bot.
 *
 * Este archivo concentra los valores que normalmente cambia el profesor:
 * limites de ejecucion, correos, calificaciones, notificaciones y bitacora.
 *
 * No pongas API keys ni secretos aqui. Para eso se usa PropertiesService.
 */
const CONFIG = {
  DRY_RUN: false,
  EVALUATE_WITH_OPENAI_IN_DRY_RUN: false,

  MAX_RUNTIME_MS: 5 * 60 * 1000,
  SAFETY_MARGIN_MS: 45 * 1000,
  MAX_EVIDENCES_PER_RUN: 1,

  ENABLE_REMINDERS: true,
  ENABLE_OVERDUE_NOTICES: true,
  ENABLE_ERROR_EMAILS: true,
  ENABLE_BATCH_SUMMARY_EMAIL: false,

  ENABLE_SHEETS_LOG: false,
  SHEETS_LOG_ID: "",
  SHEETS_LOG_SHEET_NAME: "bitacora",

  ADMIN_EMAIL: "correo_del_profesor@dominio.edu.mx",

  VALID_GRADE: 100,
  INVALID_GRADE: 60,
  GRADE_FIELD_TO_WRITE: "assignedGrade",
  USE_ASSIGNED_GRADE_AS_MARKER: true,

  REMINDER_WINDOW_HOURS: 24,
  OPENAI_MODEL: "gpt-4.1-mini",
  OPENAI_TIMEOUT_MS: 60000,
  OPENAI_MAX_RETRIES: 2,

  TRIGGER_EVERY_HOURS: 1
};

/**
 * Nombres de propiedades sensibles guardadas en Script Properties.
 *
 * OPENAI_API_KEY debe configurarse desde Apps Script:
 * Configuracion del proyecto > Propiedades de secuencia de comandos.
 */
const PROPERTY_KEYS = {
  OPENAI_API_KEY: "OPENAI_API_KEY"
};


/**
 * Tareas que el bot debe revisar.
 *
 * Cada objeto representa una tarea de Google Classroom y su documento ejemplo.
 * Puedes agregar nuevas tareas copiando un bloque y cambiando los IDs.
 */
const TASK_CONFIGS = [
  {
    enabled: true,
    name: "Prueba calificacion",
    courseId: "841460792596",
    courseWorkId: "855309186752",
    exampleFileId: "10osK-b-4ikNS-kIVCBa6_qi6zKTnDfSv",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60,
    sendStudentNotifications: false
  }
];

/**
 * Configuracion opcional para crear tareas desde Apps Script.
 *
 * Esto ayuda cuando Classroom exige que la tarea haya sido creada por el mismo
 * proyecto OAuth que despues intentara escribir calificaciones.
 *
 * Despues de crear una tarea, copia el courseWorkId que aparezca en logs y
 * pegalo en TASK_CONFIGS para que el bot pueda evaluarla.
 */
const COURSE_WORK_CREATION_CONFIGS = [
  {
    enabled: false,
    courseId: "ID_DEL_CURSO",
    title: "Titulo de la tarea creada por Apps Script",
    description: "Instrucciones para el estudiante.",
    maxPoints: 100,
    state: "DRAFT",
    dueDate: {
      year: 2026,
      month: 1,
      day: 31
    },
    dueTime: {
      hours: 23,
      minutes: 59
    }
  }
];

/**
 * Plantilla para crear e inicializar un curso nuevo cada semestre.
 *
 * Uso recomendado:
 * 1. Ajusta los datos de course.
 * 2. Agrega correos de profesores en teachers.
 * 3. Ajusta topics y courseWork.
 * 4. Ejecuta createNewCourseFromTemplate.
 * 5. Copia el courseId creado en existingCourseId para continuar ajustes sin crear otro curso.
 */
const COURSE_SETUP_TEMPLATE = {
  createNewCourse: true,
  existingCourseId: "",
  course: {
    name: "Semestre Agosto-Diciembre 2026",
    section: "Grupo A",
    descriptionHeading: "Curso creado desde Bot Classroom",
    description: "Curso inicializado automaticamente desde Apps Script.",
    room: "",
    ownerId: "me",
    courseState: "ACTIVE"
  },
  teachers: [
    "erik.lopez@itcelaya.edu.mx",
    "d2403041@itcelaya.edu.mx"
  ],
  teacherInvitationReminder: {
    enabled: true,
    subject: "Recordatorio: acepta la invitacion al curso de Classroom",
    bodyIntro: "Hola. Sigue pendiente tu invitacion como profesor al curso de Classroom."
  },
  skipExistingCourseWork: true,
  defaultState: "DRAFT",
  defaultMaxPoints: 100,
  topics: [
    { name: "Primer parcial" },
    { name: "Segundo parcial" },
    { name: "Tercer parcial" },
    { name: "Cuarto parcial" },
    { name: "Cierre de semestre" }
  ],
  courseWork: [
    {
      enabled: true,
      topicName: "Primer parcial",
      title: "Evidencia de Primer Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "Segundo parcial",
      title: "Evidencia del Segundo Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "Tercer parcial",
      title: "Evidencia del Tercer Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "Cuarto parcial",
      title: "Evidencia del Cuarto parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "Cierre de semestre",
      title: "Reporte Final",
      description: "Sube el reporte final en PDF.",
      dueDate: null
    }
  ]
};
