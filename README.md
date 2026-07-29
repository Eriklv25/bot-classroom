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
