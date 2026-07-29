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

## Interfaz de configuración en Google Sheets

Ya no es necesario editar los arreglos de `config.gs` para el uso cotidiano:

1. Despliega esta version y, en el editor de Apps Script, selecciona la funcion
   `crearHojaDeConfiguracion` en la lista superior y pulsa **Ejecutar**. Acepta
   los permisos de Google la primera vez.
2. La hoja se crea en **Google Drive > Mi unidad** con el nombre
   **Configuracion - Bot Classroom**. Al terminar la ejecucion, copia la URL
   mostrada en **Registro de ejecucion** y abre esa direccion. Si cerraste el
   registro, ejecuta `verEnlaceHojaDeConfiguracion` para volver a mostrarla.
   Ejecutar nuevamente `crearHojaDeConfiguracion` tambien devuelve la hoja ya
   existente y no crea duplicados.
3. La primera pestaña, **INICIO**, vuelve a explicar la mecanica dentro del
   propio archivo. Configura las pestañas **General**,
   **Cursos**, **Reglas de tareas**, **Crear tareas**, **Plantilla del curso**,
   **Participantes**, **Temas** y **Tareas de plantilla**.
4. Usa las casillas para activar opciones y filas. En fechas escribe
   `AAAA-MM-DD`; en horas, `HH:MM`; y no cambies los encabezados.
5. No hay boton **Guardar**: Google Sheets guarda los cambios automaticamente.
   Ejecuta normalmente el bot o las funciones de creacion. La configuracion se
   lee de la hoja al inicio de cada operacion, por lo que no hay que volver a
   desplegar al cambiar valores.

La clave `OPENAI_API_KEY` sigue exclusivamente en Script Properties y nunca se
copia a Sheets. `resetConfigurationSpreadsheetFromCode` restaura todas las
pestañas desde los valores predeterminados del codigo y **sobrescribe los datos
de la hoja**, por lo que debe usarse con precaucion.

### Una hoja independiente por curso

- `createNewCourseFromTemplate` crea y registra automaticamente una hoja
  **Configuracion - Nombre del curso**. Las reglas de esa hoja quedan ligadas a
  su `courseId`, por lo que no cambian el comportamiento de otros cursos.
- Para un curso que ya existe, ejecuta
  `crearHojaDeConfiguracionParaCurso(courseId, courseName)`. Si ya esta
  registrado, devuelve la hoja existente en lugar de crear un duplicado.
- Para elegir la ubicacion, ejecuta primero
  `configurarCarpetaDeHojas(folderIdOrUrl)` con el ID o la URL de una carpeta de
  Drive. `configurarCarpetaDeHojas("")` hace que las hojas nuevas vuelvan a
  guardarse en **Mi unidad**.
- Durante la revision por lotes, el bot lee todas las hojas por curso
  registradas. La hoja general anterior sigue funcionando mientras no existan
  hojas por curso.

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
