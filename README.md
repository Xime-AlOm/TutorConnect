# TutorConnect
Plataforma web de tutorías y asesorías académicas del TecNM Campus Pachuca
## Usuarios de prueba — T04

| Correo | Rol en TutorConnect |
|---|---|
| coordinacion@pachuca.tecnm.mx | Coordinador |
| l23021613@pachuca.tecnm.mx | Estudiante |
| estudiante2@pachuca.tecnm.mx | Estudiante |
| estudiante3@pachuca.tecnm.mx | Estudiante |
| profesor1@pachuca.tecnm.mx | Profesor |
| profesor2@pachuca.tecnm.mx | Profesor |
| tutor1@pachuca.tecnm.mx | Estudiante con autorización de tutor par |

El tutor par está autorizado para asesorar Fundamentos de Programación.
El profesor1 está autorizado para asesorar Bases de Datos.

Las contraseñas se comparten únicamente por el chat del equipo.

Los datos de prueba están en `sql/datos_prueba.sql`.
Sus requisitos e instrucciones de ejecución se encuentran
al inicio del archivo.

## Escenarios de prueba — Semana 3 (T19b)

Ejecutar `sql/escenarios_sprint3.sql` completo en el SQL Editor del proyecto compartido, con el selector **postgres**, después del esquema V3 y los datos T04. No contiene contraseñas ni crea cuentas de Authentication.

| Escenario | Usuario con el que se prueba | Tarea | Datos del lote |
| --- | --- | --- | --- |
| 1. Franjas libres a 3 y 4 días | estudiante2 o estudiante3 | T15a, T15b | 4: profesor1/Base de Datos y tutor1/Fundamentos de Programación, ambas modalidades |
| 2. Solicitudes pendientes a más de 48 h | profesor1 y tutor1; solicitantes estudiante2 y estudiante3 | T16 | 3: 2 presenciales y 1 virtual |
| 3. Citas aceptadas cancelables/no cancelables | estudiante2: más de 48 h; estudiante3: menos de 48 h | T17 | 2 citas |
| 4. Citas terminadas sin cerrar | profesor1: cerca de 3 h; tutor1: cerca de 47 h | T20 / HU-008 | 2 aceptadas; consultar antigüedad real en la verificación |
| 5. Realizadas sin evaluación | estudiante2: hace 3 días; estudiante3: hace 8 días | HU-009 | 2: plazo vigente y vencido |
| 6. No realizada | estudiante2 | HU-009 | 1 cita con profesor1 |
| 7. Avisos no leídos | estudiante2 y profesor1 | T21 | 3 y 12 avisos, respectivamente; profesor1 permite probar «9+» |

Todos los correos terminan en `@pachuca.tecnm.mx`. Las contraseñas se obtienen por el canal privado del equipo.

### Fechas y repetición

- Las fechas se recalculan al ejecutar, con zona `America/Mexico_City`. Los datos persistentes sí envejecen: repetir el script para renovarlos cuando sea necesario.
- Por acuerdo con el Scrum Master, el escenario 4 usa horas válidas cercanas a 3 y 47 h porque el esquema solo admite inicios entre 07:00 y 20:00, en punto. La columna `detalle` muestra la antigüedad real; ambas citas terminan dentro de las últimas 48 h. Probar primero la cercana a 47 h.
- Los IDs cambian al renovar; consultar los IDs actuales en el resultado final. No fijarlos en el código de la aplicación.
- Se identifican las franjas con `ESC3 · T19b ·` y los avisos con `[ESC3]`. El esquema auxiliar privado `esc3_admin` registra los IDs propiedad del script. No eliminar ese inventario ni exponerlo mediante Data API.
- Se conservan los datos T04 y los demás datos del equipo. Si hay una reserva nueva sobre una franja del lote o una evaluación, el script se detiene sin borrar nada. Coordinar antes de renovar; no eliminar datos ajenos para forzar la ejecución.
- La repetición restablece los estados originales de las solicitudes creadas por el script. Avisar al equipo antes de ejecutarlo mientras haya pruebas en curso.
- Las URL `https://example.com/esc3/...` son de prueba. Para probar reuniones reales debe usarse un enlace válido de la plataforma correspondiente.
- Se agregan exactamente 3 y 12 avisos no leídos propios; los avisos preexistentes pueden aumentar el total mostrado por la aplicación.

### Verificación y evidencias

La consulta final debe devolver 7 filas con `Pasa` y conteos **4, 3, 2, 2, 2, 1, 15**. Ejecutar dos veces antes de que otros usen los escenarios y comprobar que se mantienen esos conteos.

Adjuntar a T19b: primera ejecución, segunda ejecución y `buscar.html` con sesión de estudiante2 mostrando las franjas del escenario 1. Compartir también el enlace al PR y, después del merge, al archivo en `qa`.
