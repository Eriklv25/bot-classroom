# Terminar la migracion del bot a Google Apps Script

Guardar los archivos en GitHub conserva el codigo, pero no despliega ni autoriza el bot.
La migracion termina cuando el repositorio queda vinculado a un proyecto de Apps Script,
se configuran los secretos y permisos, y se valida una ejecucion real antes de instalar
el trigger.

## 1. Crear o elegir el proyecto de Apps Script

1. Entra a [script.google.com](https://script.google.com/) con la cuenta docente que
   administra el curso.
2. Crea un proyecto independiente o abre el proyecto de destino.
3. Copia su **ID de secuencia de comandos** desde **Configuracion del proyecto**.
4. Instala `clasp` en tu equipo y autentica la misma cuenta:

   ```bash
   npm install --global @google/clasp
   clasp login
   ```

5. Desde la raiz de este repositorio, vincula el proyecto sin crear otro:

   ```bash
   clasp clone ID_DE_SECUENCIA /tmp/bot-classroom-apps-script
   cp /tmp/bot-classroom-apps-script/.clasp.json .clasp.json
   clasp push
   ```

No subas `.clasp.json` si la politica del equipo considera privado el ID del proyecto.
Nunca guardes la API key de OpenAI en GitHub.

## 2. Revisar la configuracion antes de ejecutar

En `config.gs`:

- Cambia `ADMIN_EMAIL` por el correo real del responsable.
- Confirma cada `courseId`, `courseWorkId` y `exampleFileId` de `TASK_CONFIGS`.
- Empieza con `DRY_RUN: true` para impedir escrituras de calificaciones.
- Deja `EVALUATE_WITH_OPENAI_IN_DRY_RUN: false` en la primera prueba para evitar
  consumo accidental; activalo solo cuando quieras validar la evaluacion completa.
- Mantén `MAX_EVIDENCES_PER_RUN: 1` durante las pruebas.
- Si habilitas la bitacora, completa `SHEETS_LOG_ID` y comparte la hoja con la cuenta
  que ejecuta el script.

El manifiesto ya declara el runtime V8, los servicios avanzados de Classroom y Drive,
y los scopes usados por el bot. Al abrir o ejecutar el proyecto, Google pedira que la
cuenta autorice esos permisos.

## 3. Configurar el secreto de OpenAI

En Apps Script abre **Configuracion del proyecto > Propiedades de secuencia de
comandos** y agrega:

```text
OPENAI_API_KEY = sk-...
```

La clave debe existir solo en Script Properties; no debe agregarse a `config.gs`, al
manifiesto ni a un commit.

## 4. Validar Classroom y Drive manualmente

Desde el editor de Apps Script, ejecuta en este orden y revisa **Registro de ejecucion**:

1. `listClassroomCoursesForSetup()` para confirmar que la cuenta ve el curso.
2. `listCourseWorkForSetup(courseId)` para confirmar los IDs de las tareas.
3. `testListPendingSubmissionDetails()` para comprobar que puede leer entregas y
   adjuntos.
4. `processPendingSubmissionsBatch()` con `DRY_RUN: true`.
5. Repite la funcion anterior con `EVALUATE_WITH_OPENAI_IN_DRY_RUN: true` para probar
   Drive y OpenAI sin escribir calificaciones.
6. `testClassroomGradePermission()` para verificar el permiso de escritura. Hazlo
   primero en un curso y una entrega de prueba.

La cuenta ejecutora debe ser profesora del curso, poder abrir el documento ejemplo y
los adjuntos, y tener permitido usar Classroom API en el dominio de Google Workspace.
Si una tarea existente rechaza la escritura por asociacion de proyecto, crea la tarea
desde este mismo proyecto de Apps Script y copia el nuevo `courseWorkId` a
`TASK_CONFIGS`.

## 5. Hacer una prueba real controlada

1. Usa un curso de prueba con una sola entrega PDF.
2. Cambia `DRY_RUN` a `false`.
3. Ejecuta `processPendingSubmissionsBatch()` manualmente.
4. Confirma en Classroom la calificacion, revisa los logs y comprueba que no se haya
   procesado una entrega equivocada.
5. Si habilitaste correos o Sheets, verifica tambien esos resultados.

No actives el trigger hasta completar esta prueba de punta a punta.

## 6. Activar la automatizacion

Ejecuta una sola vez `createHourlyTrigger()` desde Apps Script. Esta funcion elimina
los triggers anteriores del bot y crea uno para `processPendingSubmissionsBatch()` con
la frecuencia definida en `CONFIG.TRIGGER_EVERY_HOURS`.

Despues ejecuta `listClassroomBotTriggers()` y confirma que aparece un unico trigger.
Revisa **Ejecuciones** durante las primeras horas y conserva desactivadas las
notificaciones estudiantiles hasta validar los resultados.

## Lista de cierre

- [ ] Codigo enviado al proyecto correcto con `clasp push`.
- [ ] `ADMIN_EMAIL` e IDs reales revisados.
- [ ] `OPENAI_API_KEY` guardada en Script Properties.
- [ ] Autorizaciones de Google aceptadas por la cuenta docente.
- [ ] Lectura de cursos, tareas, entregas y archivos validada.
- [ ] Evaluacion de OpenAI validada en modo seco.
- [ ] Escritura de una calificacion validada en un curso de prueba.
- [ ] Trigger unico instalado y visible.
- [ ] Primera ejecucion automatica revisada sin errores.

