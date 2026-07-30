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
  OPENAI_API_KEY: "OPENAI_API_KEY",
  CONFIG_SPREADSHEET_ID: "CONFIG_SPREADSHEET_ID",
  COURSE_CONFIG_SPREADSHEETS: "COURSE_CONFIG_SPREADSHEETS",
  CONFIG_FOLDER_ID: "CONFIG_FOLDER_ID"
};

/** Modos disponibles para el switch de revision de cada tarea. */
const REVIEW_MODES = {
  DOCUMENT_ONLY: "DOCUMENT_ONLY",
  AI: "AI"
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
 * Reglas que relacionan una tarea con su modo de revision. DOCUMENT_ONLY solo
 * comprueba que se cargo un PDF; AI puede usar exampleFileId o dejarlo vacio.
 *
 * La comparacion de title ignora espacios exteriores y mayusculas. Si una tarea
 * no coincide con una regla, se omite para evitar evaluarla por error.
 */
const TASK_RULES = [
  {
    enabled: true,
    title: "Prueba calificacion",
    reviewMode: REVIEW_MODES.AI,
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
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_INSTRUMENTACION_DIDACTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia de Socializar la Instrumentación Didáctica",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_SOCIALIZAR_INSTRUMENTACION_DIDACTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación diagnóstica",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_EVALUACION_DIAGNOSTICA",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista primer parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_PASE_LISTA_PRIMER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia de Primer Parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_PRIMER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista segundo parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_PASE_LISTA_SEGUNDO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Segundo Parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_SEGUNDO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista tercer parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_PASE_LISTA_TERCER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Tercer Parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_TERCER_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia pase de lista cuarto parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_PASE_LISTA_CUARTO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evidencia del Cuarto parcial",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_CUARTO_PARCIAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación Departamental",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_EVALUACION_DEPARTAMENTAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Evaluación Docente",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_EVALUACION_DOCENTE",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "Reporte Final",
    reviewMode: REVIEW_MODES.AI,
    exampleFileId: "ID_PDF_REPORTE_FINAL",
    promptType: "visual_structure",
    validGrade: 100,
    invalidGrade: 60
  },
  {
    enabled: false,
    title: "ACTAS FINALES de calificaciones",
    reviewMode: REVIEW_MODES.AI,
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
 * 2. Marca selected: true en los profesores que participaran como alumnos.
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
  // Checklist: cambia selected a true solo para quienes aplican a la plantilla.
  students: [
    { selected: false, name: "ACEVES SABORIO SALVADOR MARTÍN", email: "salvador.aceves@itcelaya.edu.mx" },
    { selected: false, name: "AGUILAR NÁJERA CARLOS RAFAEL", email: "rafael.aguilar@itcelaya.edu.mx" },
    { selected: false, name: "AGUILERA CAMACHO LUIS DANIEL", email: "daniel.aguilera@itcelaya.edu.mx" },
    { selected: false, name: "ALCARAZ CARACHEO LUIS ALEJANDRO", email: "alejandro.alcaraz@itcelaya.edu.mx" },
    { selected: false, name: "AMEZCUA ALVAREZ CARLOS MANUEL", email: "carlos.amezcua@itcelaya.edu.mx" },
    { selected: false, name: "ARROYO RAMÍREZ BENJAMÍN", email: "benjamin.arroyo@itcelaya.edu.mx" },
    { selected: false, name: "CAMARILLO GÓMEZ KARLA ANHEL", email: "karla.camarillo@itcelaya.edu.mx" },
    { selected: false, name: "COORDINADOR MECÁNICA", email: "coordmec@itcelaya.edu.mx" },
    { selected: false, name: "GALLARDO ALVARADO JAIME", email: "jaime.gallardo@itcelaya.edu.mx" },
    { selected: false, name: "GARCÍA MIRANDA J. SANTOS", email: "santos.garcia@itcelaya.edu.mx" },
    { selected: false, name: "GUERRERO NAVARRETE ÁNGEL", email: "angel.guerrero@itcelaya.edu.mx" },
    { selected: false, name: "JAIRO SORIA", email: "jesoriap@gmail.com" },
    { selected: false, name: "ERIK LOPEZ VARGAS", email: "d2403041@itcelaya.edu.mx" },
    { selected: false, name: "MAEDA SÁNCHEZ ARNOLDO", email: "arnoldo.maeda@itcelaya.edu.mx" },
    { selected: false, name: "MORENO BELLO KARLA JUDITH", email: "karla.moreno@itcelaya.edu.mx" },
    { selected: false, name: "OROZCO MENDOZA HORACIO", email: "horacio.orozco@itcelaya.edu.mx" },
    { selected: false, name: "PÉREZ GONZÁLEZ LUCIANO", email: "luciano.perez@itcelaya.edu.mx" },
    { selected: false, name: "POSADA VILLARREAL HUGO ALFREDO", email: "hugo.posada@itcelaya.edu.mx" },
    { selected: false, name: "RODRÍGUEZ CASTRO RAMÓN", email: "ramon.rodriguez@itcelaya.edu.mx" },
    { selected: false, name: "RUÍZ MONDRAGÓN GILBERTO", email: "gilberto.ruiz@itcelaya.edu.mx" },
    { selected: false, name: "SÁNCHEZ RODRÍGUEZ ÁLVARO", email: "alvaro.sanchez@itcelaya.edu.mx" },
    { selected: false, name: "SILVA GARCÍA MIGUEL ANGEL", email: "masgtic@gmail.com" },
    { selected: false, name: "SOTO LÓPEZ HUMBERTO", email: "humberto.soto@itcelaya.edu.mx" },
    { selected: false, name: "TINOCO VILLAGÓMEZ ANTONIO", email: "antonio.tinoco@itcelaya.edu.mx" },
    { selected: false, name: "TORRES VERA ESTEBAN FRANCISCO", email: "esteban.torres@itcelaya.edu.mx" },
    { selected: false, name: "ULISES", email: "m2203067@itcelaya.edu.mx" },
    { selected: false, name: "ZAVALA BUSTOS JOSÉ ALBERTO", email: "jose.zavala@itcelaya.edu.mx" },
  ],
  teacherInvitationReminder: {
    enabled: true,
    everyDays: 2,
    hour: "09:00",
    subject: "Recordatorio: acepta la invitacion al curso de Classroom",
    bodyIntro: "Hola. Sigue pendiente tu invitacion como profesor al curso de Classroom."
  },
  pendingActivitiesReminder: {
    enabled: true,
    everyDays: 2,
    hour: "10:00"
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
