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
    courseId: "841460792596"
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
  reminderTriggerEveryMinutes: 60,
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
    { selected: false, name: "AGUILAR CANUTO ANTONIO", email: "aguilarcanuto0@gmail.com" },
    { selected: false, name: "ALCARAZ CARACHEO LUIS ALEJANDRO", email: "alejandro.alcaraz@itcelaya.edu.mx" },
    { selected: false, name: "AMEZCUA ALVAREZ CARLOS MANUEL", email: "carlos.amezcua@itcelaya.edu.mx" },
    { selected: false, name: "ARROYO RAMÍREZ BENJAMÍN", email: "benjamin.arroyo@itcelaya.edu.mx" },
    { selected: false, name: "ARRIAGA GONZÁLEZ EFREN", email: "efren.arriaga@itcelaya.edu.mx" },
    { selected: false, name: "ARRIAGA MEDINA ROBERTO EDU", email: "roberto.arriaga@itcelaya.edu.mx" },
    { selected: false, name: "CAMARILLO GÓMEZ KARLA ANHEL", email: "karla.camarillo@itcelaya.edu.mx" },
    { selected: false, name: "COORDINADOR MECÁNICA", email: "coordmec@itcelaya.edu.mx" },
    { selected: false, name: "GALLARDO ALVARADO JAIME", email: "jaime.gallardo@itcelaya.edu.mx" },
    { selected: false, name: "GARCÍA MIRANDA J. SANTOS", email: "santos.garcia@itcelaya.edu.mx" },
    { selected: false, name: "GUERRERO NAVARRETE ÁNGEL", email: "angel.guerrero@itcelaya.edu.mx" },
    { selected: false, name: "GUERRERO CHÁVEZ NICOLAS", email: "nicolas.guerrero@itcelaya.edu.mx" },
    { selected: false, name: "JAIRO SORIA", email: "jesoriap@gmail.com" },
    { selected: false, name: "ERIK LOPEZ VARGAS", email: "d2403041@itcelaya.edu.mx" },
    { selected: false, name: "ERIK LOPEZ VARGAS", email: "erik.lopez@itcelaya.edu.mx", rol: "ALUMNO" },
    { selected: false, name: "MAEDA SÁNCHEZ ARNOLDO", email: "arnoldo.maeda@itcelaya.edu.mx" },
    { selected: false, name: "MORENO BELLO KARLA JUDITH", email: "karla.moreno@itcelaya.edu.mx" },
    { selected: false, name: "OROZCO MENDOZA HORACIO", email: "horacio.orozco@itcelaya.edu.mx" },
    { selected: false, name: "PANTOJA CUARENTA VICTOR ANTONIO", email: "victor.pantoja@itcelaya.edu.mx" },
    { selected: false, name: "PÉREZ GONZÁLEZ LUCIANO", email: "luciano.perez@itcelaya.edu.mx" },
    { selected: false, name: "POSADA VILLARREAL HUGO ALFREDO", email: "hugo.posada@itcelaya.edu.mx" },
    { selected: false, name: "RAMÍREZ HERNÁNDEZ MIGUEL ÁNGEL", email: "miguelangel.ramirez@itcelaya.edu.mx" },
    { selected: false, name: "RICO BAEZA GENARO", email: "genaro.rico@itcelaya.edu.mx" },
    { selected: false, name: "RODRÍGUEZ GARCÍA SAÚL SANTOS", email: "saul.rodriguez@itcelaya.edu.mx" },
    { selected: false, name: "RODRÍGUEZ CASTRO RAMÓN", email: "ramon.rodriguez@itcelaya.edu.mx" },
    { selected: false, name: "RUÍZ MONDRAGÓN GILBERTO", email: "gilberto.ruiz@itcelaya.edu.mx" },
    { selected: false, name: "SÁNCHEZ RODRÍGUEZ ÁLVARO", email: "alvaro.sanchez@itcelaya.edu.mx" },
    { selected: false, name: "SALMORAN SALGADO ROBERTO CARLOS", email: "sasaroca1023@gmail.com" },
    { selected: false, name: "SILVA GARCÍA MIGUEL ANGEL", email: "masgtic@gmail.com" },
    { selected: false, name: "SOTO LÓPEZ HUMBERTO", email: "humberto.soto@itcelaya.edu.mx" },
    { selected: false, name: "TINOCO VILLAGÓMEZ ANTONIO", email: "antonio.tinoco@itcelaya.edu.mx" },
    { selected: false, name: "TORRES VERA ESTEBAN FRANCISCO", email: "esteban.torres@itcelaya.edu.mx" },
    { selected: false, name: "ULISES", email: "m2203067@itcelaya.edu.mx" },
    { selected: false, name: "VALADEZ GONZALEZ ELIAS", email: "d2303005@itcelaya.edu.mx" },
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
      description: "Cargar la Instrumentación Didáctica correspondiente a cada uno de sus grupos.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – ID – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-ID-MEC-AUTO IND-B\nLVE-ID-MECTR-MEC MAT-A\nLVE-ID-AMB-FLUIDOS-A\nLVE-ID-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "INICIO DEL CURSO",
      title: "Evidencia de Socializar la Instrumentación Didáctica",
      description: "Cargar la Lista de enterados con firmas, correspondiente a cada uno de sus grupos.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – LE – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-LE-MEC-AUTO IND-B\nLVE-LE-MECTR-MEC MAT-A\nLVE-LE-AMB-FLUIDOS-A\nLVE-LE-IND-PROP MAT-B\n\nNOTAS:\nDescargue e imprima el formato \"LISTA DE ENTERADOS DE INSTRUMENTACIÓN DIDÁCTICA\" en el apartado de OPCIONES de cada uno de sus grupos registrados en el sistema CETECH.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "INICIO DEL CURSO",
      title: "Evaluación diagnóstica",
      description: "Cargar un ejemplar de la Evaluación Diagnóstica correspondiente a cada uno de sus grupos.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – ED – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-ED-MEC-AUTO IND-B\nLVE-ED-MECTR-MEC MAT-A\nLVE-ED-AMB-FLUIDOS-A\nLVE-ED-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista primer parcial",
      description: "Cargar la evidencia de pase de lista del parcial de cada uno de sus grupos asignados del semestre en curso.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – PL1 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-PL1-MEC-AUTO IND-B\nLVE-PL1-MECTR-MEC MAT-A\nLVE-PL1-AMB-FLUIDOS-A\nLVE-PL1-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia de Primer Parcial",
      description: "Cargar las evidencias del primer parcial de cada grupo asignado en el semestre en curso.\nCargar un archivo .ZIP o .RAR por grupo, que incluya todas las evidencias de aprendizaje de un solo estudiante (examen, reportes, presentaciones, tareas, etc.).\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – EP1 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-EP1-MEC-AUTO IND-B\nLVE-EP1-MECTR-MEC MAT-A\nLVE-EP1-AMB-FLUIDOS-A\nLVE-EP1-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista segundo parcial",
      description: "Cargar la evidencia de pase de lista del parcial de cada uno de sus grupos asignados del semestre en curso.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – PL2 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-PL2-MEC-AUTO IND-B\nLVE-PL2-MECTR-MEC MAT-A\nLVE-PL2-AMB-FLUIDOS-A\nLVE-PL2-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Segundo Parcial",
      description: "Cargar las evidencias del segundo parcial de cada grupo asignado en el semestre en curso.\nCargar un archivo .ZIP o .RAR por grupo, que incluya todas las evidencias de aprendizaje de un solo estudiante (examen, reportes, presentaciones, tareas, etc.).\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – EP2 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-EP2-MEC-AUTO IND-B\nLVE-EP2-MECTR-MEC MAT-A\nLVE-EP2-AMB-FLUIDOS-A\nLVE-EP2-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista tercer parcial",
      description: "Cargar la evidencia de pase de lista del parcial de cada uno de sus grupos asignados del semestre en curso.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – PL3 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-PL3-MEC-AUTO IND-B\nLVE-PL3-MECTR-MEC MAT-A\nLVE-PL3-AMB-FLUIDOS-A\nLVE-PL3-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Tercer Parcial",
      description: "Cargar las evidencias del tercer parcial de cada grupo asignado en el semestre en curso.\nCargar un archivo .ZIP o .RAR por grupo, que incluya todas las evidencias de aprendizaje de un solo estudiante (examen, reportes, presentaciones, tareas, etc.).\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – EP3 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-EP3-MEC-AUTO IND-B\nLVE-EP3-MECTR-MEC MAT-A\nLVE-EP3-AMB-FLUIDOS-A\nLVE-EP3-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia pase de lista cuarto parcial",
      description: "Cargar la evidencia de pase de lista del parcial de cada uno de sus grupos asignados del semestre en curso.\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – PL4 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-PL4-MEC-AUTO IND-B\nLVE-PL4-MECTR-MEC MAT-A\nLVE-PL4-AMB-FLUIDOS-A\nLVE-PL4-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "CURSO",
      title: "Evidencia del Cuarto parcial",
      description: "Cargar las evidencias del cuarto parcial de cada grupo asignado en el semestre en curso.\nCargar un archivo .ZIP o .RAR por grupo, que incluya todas las evidencias de aprendizaje de un solo estudiante (examen, reportes, presentaciones, tareas, etc.).\nCada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – EP4 – abreviación de la carrera – abreviación de la asignatura – grupo.\nEjemplos:\nLVE-EP4-MEC-AUTO IND-B\nLVE-EP4-MECTR-MEC MAT-A\nLVE-EP4-AMB-FLUIDOS-A\nLVE-EP4-IND-PROP MAT-B",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "Reporte Final",
      description: "Cargar su reporte final sin firmas. El archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – RF\nEjemplos:\nLVE-RF\n\nDicho reporte estará disponible una vez que se haya realizado el registro de calificaciones de todos sus grupos. Podrá descargarlo desde el apartado Portal académico del menú principal de opciones del CETECH, seleccionando el periodo en curso.\n\nUna vez cargado el reporte en esta plataforma, deberá acudir con la compañera Marce, quien realizará la impresión correspondiente, a fin de que usted pueda firmarlo con tinta azul.",
      dueDate: null
    },
    {
      enabled: true,
      topicName: "FINAL DEL CURSO",
      title: "ACTAS FINALES de calificaciones",
      description: "Cargar sus actas de calificaciones (sin firmas) de cada una de sus asignaturas del semestre, incluyendo las del programa de posgrado, en caso de que aplique. Cada archivo deberá identificarse utilizando la siguiente estructura:\nIniciales del docente (Apellido paterno, Apellido materno y nombres) – LIC/MC/DC – abreviación del programa – abreviación de la asignatura – grupo\nEjemplos:\nEJEMPLO MATERIA LICENCIATURA: LVE-LIC-MEC-AUTO IND-B\nEJEMPLO MATERIA LICENCIATURA: LVE-LIC-MECTR-MEC MAT-A\nEJEMPLO MATERIA LICENCIATURA: LVE-LIC-AMB-FLUIDOS-A\nEJEMPLO MATERIA LICENCIATURA: LVE-LIC-IND-PROP MAT-A\nEJEMPLO MATERIA POSGRADO: LVE-MC-MEC-MAT AV-A\n\nEl acta de calificaciones puede descargarse desde el mismo apartado en el que se capturan las calificaciones, una vez que el registro haya sido realizado.\n\nUna vez cargadas las actas en esta plataforma, deberá acudir con la compañera Marce para que ella realice la impresión correspondiente y pueda usted firmarlas con tinta azul.",
      dueDate: null
    }
  ]
};
