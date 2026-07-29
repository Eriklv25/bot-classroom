/**
 * Configuracion general del bot.
 *
 * Este archivo concentra los valores que normalmente cambia el profesor:
 * limites de ejecucion, correos, calificaciones, notificaciones y bitacora.
 *
 * No pongas API keys ni secretos aqui. Para eso se usa PropertiesService.
 */
const CONFIG = {
  DRY_RUN: true,
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
 * Cursos donde el bot descubre tareas publicadas de forma automatica.
 *
 * Solo se revisan tareas publicadas cuyo titulo coincide con una regla activa.
 */
const COURSE_CONFIGS = [
  {
    enabled: true,
    courseId: "841460792596",
    sendStudentNotifications: false
  }
];

/**
 * Reglas que relacionan el titulo exacto de una tarea con su documento ejemplo.
 *
 * La comparacion de title ignora espacios exteriores y mayusculas. Si una tarea
 * no coincide con una regla, se omite para evitar evaluarla por error.
 */
const TASK_RULES = [
  {
    enabled: true,
    title: "Prueba calificacion",
    exampleFileId: "10osK-b-4ikNS-kIVCBa6_qi6zKTnDfSv",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  // Sustituye cada ID_PDF_* por el ID del documento de referencia en Drive
  // y activa la regla cuando este lista para evaluarse.
  {
    enabled: false,
    title: "Evidencia de Instrumentación Didáctica",
    exampleFileId: "ID_PDF_INSTRUMENTACION_DIDACTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia de Socializar la Instrumentación Didáctica",
    exampleFileId: "ID_PDF_SOCIALIZAR_INSTRUMENTACION_DIDACTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación diagnóstica",
    exampleFileId: "ID_PDF_EVALUACION_DIAGNOSTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista primer parcial",
    exampleFileId: "ID_PDF_PASE_LISTA_PRIMER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia de Primer Parcial",
    exampleFileId: "ID_PDF_PRIMER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista segundo parcial",
    exampleFileId: "ID_PDF_PASE_LISTA_SEGUNDO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Segundo Parcial",
    exampleFileId: "ID_PDF_SEGUNDO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista tercer parcial",
    exampleFileId: "ID_PDF_PASE_LISTA_TERCER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Tercer Parcial",
    exampleFileId: "ID_PDF_TERCER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista cuarto parcial",
    exampleFileId: "ID_PDF_PASE_LISTA_CUARTO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Cuarto parcial",
    exampleFileId: "ID_PDF_CUARTO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación Departamental",
    exampleFileId: "ID_PDF_EVALUACION_DEPARTAMENTAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación Docente",
    exampleFileId: "ID_PDF_EVALUACION_DOCENTE",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Reporte Final",
    exampleFileId: "ID_PDF_REPORTE_FINAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "ACTAS FINALES de calificaciones",
    exampleFileId: "ID_PDF_ACTAS_FINALES",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  }
];

/**
 * Configuracion opcional para crear tareas desde Apps Script.
 *
 * Esto ayuda cuando Classroom exige que la tarea haya sido creada por el mismo
 * proyecto OAuth que despues intentara escribir calificaciones.
 *
 * Las tareas nuevas se descubren automaticamente si su titulo coincide con una
 * entrada activa de TASK_RULES.
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
 * 4. Ejecuta createNewCourseFromTemplate para crear todo.
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
    { name: "INICIO DEL CURSO" },
    { name: "CURSO" },
    { name: "FINAL DEL CURSO" }
  ],
  courseWork: [
    {
      enabled: true,
      topicName: "INICIO DEL CURSO",
      title: "Evidencia de Instrumentación Didáctica",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "INICIO DEL CURSO",
      title: "Evidencia de Socializar la Instrumentación Didáctica",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "INICIO DEL CURSO",
      title: "Evaluación diagnóstica",
      description: "Realiza la evaluación diagnóstica indicada.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista primer parcial",
      description: "Sube la evidencia del pase de lista correspondiente.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia de Primer Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista segundo parcial",
      description: "Sube la evidencia del pase de lista correspondiente.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Segundo Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista tercer parcial",
      description: "Sube la evidencia del pase de lista correspondiente.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Tercer Parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista cuarto parcial",
      description: "Sube la evidencia del pase de lista correspondiente.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Cuarto parcial",
      description: "Sube la evidencia correspondiente en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "Evaluación Departamental",
      description: "Realiza la evaluación departamental indicada.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "Evaluación Docente",
      description: "Realiza la evaluación docente indicada.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "Reporte Final",
      description: "Sube el reporte final en PDF.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "ACTAS FINALES de calificaciones",
      description: "Sube las actas finales de calificaciones.",
      dueDate: null
    }
  ]
};
