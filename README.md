# Bot Classroom

Proyecto de Google Apps Script para revisar entregas de Google Classroom y
evaluar evidencias con OpenAI.

## Despliegue automático a Apps Script

El workflow `Deploy to Google Apps Script` publica los archivos `.gs` y el
manifiesto `appsscript.json` cuando se integran cambios en `main`. También puede
ejecutarse manualmente desde **Actions > Deploy to Google Apps Script > Run
workflow**.

### Configuración inicial en GitHub

1. En el repositorio, abre **Settings > Environments > New environment** y crea
   un environment llamado `google-apps-script`.
2. Dentro de ese environment, agrega estos **Environment secrets**:
   - `APPS_SCRIPT_ID`: el ID que aparece entre `/d/` y `/edit` en la URL del
     proyecto de Apps Script.
   - `CLASPRC_JSON`: el contenido completo del archivo `%USERPROFILE%\.clasprc.json`
     creado por `clasp login`. Es una credencial sensible: no debe añadirse al
     repositorio, pegarse en incidencias ni compartirse en capturas.
3. Abre la pestaña **Actions**, selecciona `Deploy to Google Apps Script` y usa
   **Run workflow** para probar el primer despliegue.
4. Comprueba el resultado en el editor de Apps Script antes de ejecutar el bot.

El repositorio es la fuente de verdad. El workflow utiliza `clasp push --force`,
por lo que los cambios realizados únicamente en el editor web de Apps Script se
reemplazarán en el siguiente despliegue.

### Renovar la autorización

Si Google revoca o vence la autorización, ejecuta nuevamente en una máquina
segura:

```text
clasp login --no-localhost
```

Después sustituye `CLASPRC_JSON` en el environment de GitHub por el contenido
del archivo de credenciales actualizado. Nunca confirmes ese archivo en Git.

## Configuración del proyecto

- Guarda `OPENAI_API_KEY` en las propiedades de secuencia de comandos de Apps
  Script; nunca en `config.gs` ni en secretos utilizados por el workflow.
- Revisa `ADMIN_EMAIL`, `COURSE_CONFIGS`, `TASK_RULES` y
  `COURSE_SETUP_TEMPLATE` en `config.gs`.
- Activa `DRY_RUN` para la primera prueba y revisa los registros antes de
  permitir que el bot escriba calificaciones.

## Una sola función y tres pestañas por curso

El flujo cotidiano se realiza desde una única hoja; no hace falta volver al
selector de funciones de Apps Script después de crearla:

1. En Apps Script ejecuta **`crearHojaDeCurso`** cada vez que quieras preparar
   un curso nuevo y concede los permisos solicitados. Cada ejecución crea una
   hoja de cálculo independiente y deja su URL en el registro; nunca reutiliza
   ni borra la hoja de un curso anterior.
2. Configura los datos generales en **Plantilla de curso**, selecciona las
   personas en **Participantes** y administra toda la configuración de cada
   actividad en **Tareas**. No existen otras pestañas de configuración.
3. En **Plantilla de curso**, pega el ID o la URL de la carpeta de Drive en
   `carpetaAlmacenamiento`, o déjalo vacío para conservar el archivo en su
   ubicación actual. Después marca la casilla verde
   **EJECUTAR**. La primera ejecución crea el curso, sus temas, tareas e
   invitaciones. El ID generado se escribe automáticamente en la misma hoja
   para impedir cursos duplicados, el archivo se renombra con el nombre del
   curso y se mueve a la carpeta elegida.
4. Para modificar el curso, edita esa misma hoja y vuelve a marcar
   **EJECUTAR**. Se actualizan los datos generales del curso y las tareas que ya
   coincidan por título; también se crean los temas, tareas e invitaciones
   nuevas. El estado, la fecha y el resultado de cada ejecución aparecen en
   **Plantilla de curso**.

Las hojas creadas permanecen disponibles en Drive. El registro interno relaciona
cada `courseId` con su hoja; ejecuta `listarHojasDeCursos` para obtener nuevamente
sus nombres y enlaces. El proyecto instala solo un trigger de edición por hoja y
un trigger global de recordatorios; no instala triggers de apertura, para no
agotar la cuota de Apps Script al administrar varios cursos.

En **Tareas**, cada fila reúne tema, nombre, descripción, modo de revisión,
ID del ejemplo, prompt personalizado, calificaciones válida e inválida, puntos,
estado, fecha y hora de entrega, además de la frecuencia y hora de sus
recordatorios. Para añadir actividades, completa sus filas y marca
**crearAhora** en todas las que quieras preparar. La selección no ejecuta nada
por sí sola: marca **EJECUTAR** en la plantilla para crearlas juntas. Las
casillas permanecen seleccionadas como referencia. El bot consulta tanto las
tareas publicadas como los borradores antes de crear y usa el nombre como
identificador único de la actividad: si ya existe en Classroom se actualiza y nunca se
crea un duplicado. La columna **enabled** no crea actividades; habilita la
revisión automática y los recordatorios de esa tarea.

En **Plantilla de curso**, `recordatorioInvitacionCadaDias` y
`horaRecordatorioInvitacion` controlan el seguimiento de invitaciones sin
aceptar. `recordatorioPendientesCadaDias` y `horaRecordatorioPendientes`
configuran el correo general con las actividades vencidas que siguen pendientes.
Las actividades cuya fecha limite aun no pasa y aquellas que no tienen fecha
limite no se incluyen en este recordatorio.
`intervaloTriggerRecordatoriosMinutos` es la frecuencia con la que el bot se
despierta para **comprobar** si hay algo que enviar (1, 5, 10, 15, 30, 60, 120,
240, 360, 480 o 720 minutos). No es la frecuencia de envío de correos. Por
ejemplo, con un intervalo de 5 minutos y una hora de recordatorio de las 09:00,
el bot puede revisar aproximadamente a las 08:55 y 09:00, pero solo la revisión
de las 09:00 o posterior queda habilitada para enviar. Después aplican también
`recordatorio...CadaDias` y la protección contra duplicados, por lo que no se
manda un correo cada 5 minutos. Usa 1 o 5 minutos para pruebas rápidas y un
intervalo mayor para reducir ejecuciones. La siguiente revisión solo se programa
cuando termina la actual, por lo que las ejecuciones no se acumulan aunque
Classroom tarde en responder. El cambio se
aplica al marcar **EJECUTAR**; como Apps Script utiliza un único trigger para
todos los cursos, el bot adopta el intervalo más corto de todas las hojas
registradas. El trigger evalúa estas opciones; cada fila de **Tareas** conserva su propia frecuencia y
hora, y el bot registra cada envío para no mandar más de un recordatorio por día.
Si cambias la hora o la frecuencia, esa combinación se considera una programación
nueva y una revisión realizada con el horario anterior ya no bloquea el envío.
Al marcar **EJECUTAR**, el curso vuelve a quedar elegible para revisión: así un
participante o una tarea agregados después de la revisión diaria no tienen que
esperar hasta el siguiente intervalo de días. Un error al consultar invitaciones
se registra, pero ya no impide intentar el resumen de actividades pendientes del
mismo curso.

**EJECUTAR aplica la configuración, pero no envía correos en esa misma
ejecución.** Los correos salen cuando corre el activador global y ya pasó la hora
configurada. Para probar o revisar sin esperar esa hora, vuelve a abrir la hoja y
elige **Bot Classroom > Revisar recordatorios ahora**. Esta acción adelanta la
primera revisión, pero conserva la frecuencia configurada y la protección que
evita repetir un correo ya procesado ese mismo día. Una fecha límite igual a la
fecha actual tampoco está vencida hasta que pase su hora límite; si la tarea no
tiene `dueTime`, Classroom la considera vencida al terminar el día.

Después de marcar **EJECUTAR**, el bot reemplaza el activador de recordatorios y
vuelve a iniciar el contador con el intervalo más corto registrado. El resultado
de la hoja y los registros indican en cuántos minutos se solicitó la próxima
revisión. El activador es de una sola ejecución y se vuelve a crear al terminar
cada revisión; por eso Apps Script lo muestra como un activador basado en tiempo,
no como un activador periódico `cada 5 minutos`. La ejecución es aproximada:
Apps Script puede iniciarla algunos minutos después del mínimo solicitado.

Los recordatorios de invitación se controlan de manera independiente por curso:
todo participante marcado en **Participantes**, sea alumno o profesor, puede
recibir un correo por cada curso cuya invitación no haya aceptado. Si un curso
fue eliminado o dejó de ser accesible, el error queda en
el registro de ejecución y no impide procesar los demás cursos.

Para diagnosticar una ejecución lenta, abre **Ejecuciones**, entra en la corrida
y consulta los registros que empiezan con `[RECORDATORIOS]`. Todos incluyen un
identificador de corrida, la etapa y los milisegundos transcurridos; las etapas
`CURSO_INICIO`, `RESUMEN_ACTIVIDAD` y `TAREA_INICIO` permiten identificar el
curso o actividad cuya llamada a Classroom se demoró. `CURSO_ERROR`,
`TAREA_ERROR` y `ERROR_FATAL` incluyen el mensaje y la pila del error. El proceso
deja de iniciar llamadas nuevas al llegar a su límite seguro, registra
`LIMITE_SEGURO` y programa la siguiente corrida en vez de esperar a que Apps
Script lo termine por tiempo máximo.

Google Sheets guarda cada edición automáticamente. No cambies nombres de
pestañas, encabezados ni los nombres de campo. Usa
`AAAA-MM-DD` para fechas (por ejemplo, `2026-08-31`) y `HH:MM` en formato de 24
horas (por ejemplo, `23:59`). Todas las horas se interpretan como hora de CDMX
con la zona `America/Mexico_City`; el bot las convierte a UTC al enviarlas a
Classroom. Si una fecha ya pasó, el bot la omite para que Classroom no rechace
los demás cambios; corrígela en **Tareas** y vuelve a marcar **EJECUTAR** para
actualizarla. La zona también aparece en el campo `zonaHoraria` de **Plantilla de curso**. Por
seguridad, el flujo no elimina
automáticamente participantes, temas ni tareas que quites de la hoja.

En **Participantes** puedes marcar o desmarcar cualquier persona en cualquier
momento. También puedes escribir nombre y correo en una fila vacía, elegir
**ALUMNO** o **PROFESOR** en la columna `rol` y marcar su casilla. Al volver a ejecutar los cambios, solo se intenta
invitar a las filas marcadas; quienes ya están inscritos o invitados se omiten
sin error. Classroom aplica a cada persona el rol elegido en la hoja.

La clave `OPENAI_API_KEY` sigue exclusivamente en Script Properties y nunca se
copia a Sheets.

## Preparacion de un curso desde la plantilla

- `COURSE_SETUP_TEMPLATE` incluye los temas `INICIO DEL CURSO`, `CURSO` y
  `FINAL DEL CURSO`, junto con las tareas base de cada etapa.
- Ejecuta `createNewCourseFromTemplate` para crear un curso nuevo con todos sus
  temas y tareas.
- La creacion individual es independiente de la plantilla del curso: configura
  una entrada en `COURSE_WORK_CREATION_CONFIGS`, activala y ejecuta
  `createConfiguredCourseWorkItems`. Puedes indicar `topicId` si la tarea debe
  quedar asociada a un tema existente.

## Descubrimiento automatico de tareas

- Agrega cada curso que deba revisarse en `COURSE_CONFIGS`.
- Agrega una entrada en `TASK_RULES` con el titulo exacto de cada tarea y
  relacionala con el PDF de ejemplo y las calificaciones correspondientes.
- La plantilla ya incluye una regla desactivada por cada tarea de
  `COURSE_SETUP_TEMPLATE`. Sustituye su valor `ID_PDF_*` por el ID real del
  documento de Drive y cambia `enabled` a `true`; las reglas permanecen
  desactivadas mientras conserven IDs de ejemplo para evitar revisiones
  accidentales.
- La comparacion ignora mayusculas y espacios al inicio o al final.
- Una tarea no publicada, que no sea una asignacion o cuyo titulo no coincida
  con una regla se omite de forma segura.

## Modos de revision

Cada entrada de `TASK_RULES` funciona como un switch independiente mediante
`reviewMode`:

- `REVIEW_MODES.DOCUMENT_ONLY`: aprueba cuando la entrega contiene un PDF
  accesible. No descarga referencia ni llama a OpenAI.
- `REVIEW_MODES.AI`: analiza el PDF mediante OpenAI. `exampleFileId` puede
  contener el ID de un PDF de referencia o quedar como cadena vacia para que la
  IA revise la evidencia sin documento ejemplo.

Para incorporar IA posteriormente basta cambiar `reviewMode` de
`DOCUMENT_ONLY` a `AI` y, si se desea una comparacion, agregar
`exampleFileId`.

## Checklist de participantes

Los profesores que cargaran evidencias se inscriben en Classroom con el rol de
alumno. La lista completa esta en `COURSE_SETUP_TEMPLATE.students`; cambia
`selected` a `true` solamente en las personas que deban aplicar a esa
plantilla. Al ejecutar `createNewCourseFromTemplate` se invita solo a las
personas seleccionadas. Para aplicar el checklist a un curso ya existente,
configura `existingCourseId` y ejecuta `inviteSelectedStudentsFromTemplate`.
