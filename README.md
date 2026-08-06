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

Para retirar un ID antiguo, pega el `courseId` en la celda roja **B10**, junto a
**RETIRAR ID ANTIGUO**, y presiona Enter. El resultado aparecerá arriba en la
misma hoja. También puedes ejecutar desde Apps Script
`retirarCursoDelRegistro("ID_DEL_CURSO")`. Esta acción solamente quita el curso
del recorrido de recordatorios y limpia su historial de programación: no borra
el curso de Classroom ni su hoja de cálculo. Usa primero
`listarHojasDeCursos()` si necesitas consultar los IDs registrados.

**No restaures las hojas que ya están en la papelera.** El registro de IDs se
guarda en las propiedades del proyecto y es independiente de Drive: vaciar la
papelera tampoco elimina esos IDs. Ejecuta una vez
`limpiarRegistroDeCursosEnPapelera()` desde Apps Script; retirará en bloque las
entradas cuyas hojas estén en la papelera o ya se hayan eliminado
definitivamente. Las revisiones programadas hacen también esta limpieza antes de
recorrer los cursos, de modo que esas entradas dejan de consumir recursos. El
campo rojo se guarda como texto para conservar exactamente IDs largos al usar
`retirarCursoDelRegistro` de forma individual.

En **Tareas**, cada fila reúne selección de creación, habilitación de revisión,
publicación, estado, tema, nombre, texto de actividad, links adjuntos, modo de
revisión, liga del ejemplo, prompt personalizado, calificaciones válida e
inválida, puntos, fecha y hora de entrega. La plantilla marca por defecto las
primeras columnas de control y la columna **state**; si **state** queda marcada,
la tarea se crea o actualiza como publicada, y si se desmarca queda como
**DRAFT**. Para añadir actividades, completa sus filas y marca **EJECUTAR** en la
plantilla para crearlas juntas. Las casillas permanecen seleccionadas como
referencia. El bot consulta tanto las tareas publicadas como los borradores antes
de crear y usa el nombre como identificador único de la actividad: si ya existe
en Classroom se actualiza y nunca se crea un duplicado. La columna **enabled** no
crea actividades; habilita únicamente la revisión automática de esa tarea.
`textoActividad` controla el texto visible en Classroom y reemplaza a la antigua
columna `descripcion`. `linksAdjuntos` acepta una o varias ligas separadas por
coma o salto de linea para agregarlas como materiales cuando la tarea se crea
desde la hoja. `exampleLink` acepta una liga de Drive; el bot extrae el ID del
archivo automaticamente para usarlo como ejemplo al revisar con OpenAI. En tareas
que ya existen, Classroom no permite actualizar materiales con
`courseWork.patch`; el bot omite esos links y deja un registro para que los
agregues manualmente si hace falta.

En **Plantilla de curso**, `recordatorioInvitacionCadaDias` y
`horaRecordatorioInvitacion` controlan el seguimiento de invitaciones sin
aceptar. `textoRecordatorioInvitacion` permite editar el texto del correo; el
bot usa la columna `emailName` de **Participantes** como saludo editable.
`recordatorioPendientesCadaDias`, `horaRecordatorioPendientes` y
`textoRecordatorioPendientes` configuran el correo general con las actividades
vencidas que siguen pendientes.
Las actividades cuya fecha limite aun no pasa y aquellas que no tienen fecha
limite no se incluyen en este recordatorio.
La comparación respeta también la hora límite UTC informada por Classroom y la
convierte al instante real antes de compararla. Por ejemplo, `04:30` UTC es
`22:30` del día anterior en Ciudad de México (horario estándar), por lo que a la
`01:23` local la actividad ya está vencida y no espera hasta las `04:30` locales.
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
aplica al marcar **EJECUTAR**. Apps Script utiliza un único trigger para todos
los cursos y siempre conserva el intervalo de la hoja donde se presionó
**EJECUTAR** por última vez. Por ejemplo, si una hoja activa `10` minutos y
después otra activa `5`, todas las revisiones globales quedan programadas cada
`5` minutos hasta que se vuelva a ejecutar cualquier hoja con otro valor. El
resultado de **EJECUTAR** confirma el intervalo global que acaba de quedar
activo. El trigger evalúa
únicamente estas opciones de **Plantilla de
curso** y el bot registra cada envío para no repetirlo durante el periodo
configurado. No se envían recordatorios individuales configurados por fila de
**Tareas**.
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
vuelve a iniciar el contador con el intervalo de esa hoja, reemplazando el que
hubiera activado anteriormente cualquier otra hoja. El resultado
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
`CURSO_INICIO` y `RESUMEN_ACTIVIDAD` permiten identificar el curso o actividad
cuya llamada a Classroom se demoró. `CURSO_ERROR` y `ERROR_FATAL` incluyen el
mensaje y la pila del error. Los registros se escriben con `console.info`, por lo
que Apps Script muestra **Información** como nivel. La palabra **Depuración** era
el nivel automático asignado por Apps Script a `console.log`, no parte del
mensaje. El proceso deja de iniciar llamadas nuevas al llegar a su límite seguro, registra
`LIMITE_SEGURO` y programa la siguiente corrida en vez de esperar a que Apps
Script lo termine por tiempo máximo.

Cuando Classroom no encuentra uno o varios cursos, busca la etapa
`RESUMEN_CURSOS_NO_DISPONIBLES` al final de la ejecución. Incluye una sola fila
por curso con `courseId`, el nombre conservado en su hoja y `spreadsheetUrl`.
Así puedes verificar la hoja correspondiente antes de pegar el ID en
**RETIRAR ID ANTIGUO**.

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
momento. La columna `emailName` define el saludo exacto para los correos de
recordatorio; si queda vacía en hojas antiguas, el bot conserva el saludo
heredado con el campo `name`. También puedes escribir nombre, saludo y correo en
una fila vacía, elegir
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

## Deteccion y calificacion de entregas

Google Classroom no expone a Apps Script un activador que se dispare exactamente
al presionar **Entregar**. El bot instala un detector global de una sola
ejecucion que consulta Classroom y se vuelve a programar al terminar. En
**Plantilla de curso**, `intervaloDeteccionEntregasMinutos` permite elegir 1, 5,
10, 15, 30, 60, 120, 240, 360, 480 o 720 minutos. Al marcar **EJECUTAR**, el
valor de esa hoja reemplaza el intervalo global anterior, sin importar qué hoja
lo hubiera establecido. Solo toma
entregas con estado `TURNED_IN` que aun no tengan calificacion en borrador ni
asignada; adjuntar un archivo sin presionar **Entregar** no inicia la revision.

En cada activacion se procesan tantas entregas como permita el margen seguro de
la ejecucion de Apps Script. No existe un limite fijo de una evidencia por
recorrido. Si el tiempo se termina, las entregas restantes conservan su estado
sin calificar y se retoman automáticamente en la siguiente activacion.

Cada entrega conserva la regla de su propia fila en **Tareas**. Si esa fila tiene
`reviewMode=AI` y un `prompt` no vacio, OpenAI recibe ese prompt personalizado.
Si el `prompt` de esa fila esta vacio, `buildEvaluationPrompt` vuelve al prompt
general, aunque la entrega anterior haya usado uno personalizado. Las reglas no
se heredan entre tareas. `DOCUMENT_ONLY` valida el archivo sin llamar a OpenAI.

El modo se controla con la casilla `modoSimulacion` de **Plantilla de curso**.
Después de cambiarla, marca **EJECUTAR** para aplicarla globalmente; si existen
varias hojas de curso, prevalece la última donde se presionó **EJECUTAR**. Con
la casilla activada, el detector encuentra y revisa el flujo, pero solo registra la
calificacion que habria asignado: no modifica `draftGrade` ni `assignedGrade`.
Por eso Classroom sigue devolviendo la entrega como pendiente y el bot vuelve a
procesarla en cada activacion. El mensaje `Calificacion simulada` en los
registros confirma que no se califico realmente. Desactiva `modoSimulacion` y
presiona **EJECUTAR** para que la calificacion se escriba y las ejecuciones
posteriores omitan esa entrega. `CONFIG.DRY_RUN` sigue siendo el valor inicial
para hojas nuevas o instalaciones que aún no hayan guardado esta preferencia.

`defaultState` también es una casilla en **Plantilla de curso**. Marcada crea
las tareas asignadas/publicadas; la API de Classroom denomina ese estado
`PUBLISHED`. Sin marcar las crea como borrador (`DRAFT`). Las hojas antiguas que
contenían el texto `PUBLISHED` o `DRAFT` se convierten automáticamente a la
casilla equivalente sin perder su selección.

## Checklist de participantes

Los profesores que cargaran evidencias se inscriben en Classroom con el rol de
alumno. La lista completa esta en `COURSE_SETUP_TEMPLATE.students`; cambia
`selected` a `true` solamente en las personas que deban aplicar a esa
plantilla. Al ejecutar `createNewCourseFromTemplate` se invita solo a las
personas seleccionadas. Para aplicar el checklist a un curso ya existente,
configura `existingCourseId` y ejecuta `inviteSelectedStudentsFromTemplate`.
