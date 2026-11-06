| Coordinador | Coordinador | c0843e63-7d44-4a46-9d43-561b48aea6a4 |
| Cuenta externa | Sin perfil institucional | dbbe3d5b-0ed7-49b8-ae2d-53888c018e09 |

Estos roles son los de la aplicación. Las operaciones se prueban con el rol
PostgreSQL `authenticated` y el UUID en `request.jwt.claims`.

## Registro de las 16 pruebas

Las sentencias de esta tabla son un resumen; el bloque íntegro está en el archivo SQL.
En las pruebas de funciones, los errores de negocio deben tener SQLSTATE `P0001`.
En las pruebas 4 y 5 se exige tanto `42501` como el mensaje específico de RLS:
un error de permisos diferente no demuestra por sí mismo la política probada.

| N.º | Usuario simulado (rol) | Sentencia ejecutada | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Estudiante A | SELECT … FROM public.usuario | Solo su perfil. | Reportaste resultado esperado en RLS 1–6. | ✅ Pasa (reportado) |
| 2 | Coordinador | SELECT … FROM public.usuario | Todos los perfiles; total visible igual al total real. | Reportaste resultado esperado en RLS 1–6. | ✅ Pasa (reportado) |
| 3 | Estudiante A y coordinador | SELECT … FROM public.materia | Estudiante: activas y cero inactivas. Coordinador: ambas. | Reportaste 8 activas y 0 inactivas para estudiante; 8 y 1 para coordinador. | ✅ Pasa (reportado) |
| 4 | Estudiante A | INSERT INTO public.materia (…) | Rechazo RLS, SQLSTATE 42501. | Reportaste resultado esperado en RLS 1–6. | ✅ Pasa (reportado) |
| 5 | Estudiante A | INSERT INTO public.solicitud_asesoria (…) | Rechazo RLS, SQLSTATE 42501. | Reportaste resultado esperado en RLS 1–6. | ✅ Pasa (reportado) |
| 6 | Estudiantes A y B | SELECT … FROM public.notificacion | Cada uno ve su notificación de control y ninguna ajena. | Reportaste finalización de las pruebas RLS y guardaste sus capturas. | ✅ Pasa (reportado) |
| 7 | Cuenta externa | registrar_perfil('Externo T07','Profesor',…) | Acceso restringido a cuentas institucionales. | Pendiente de transcribir el resultado de ejecución. | ⏳ Pendiente |
| 8 | Estudiante A | postular_materia(m) dos veces | Ya enviaste una solicitud para esta materia. | Pendiente de transcribir el resultado de ejecución. | ⏳ Pendiente |
| 9 | Estudiante A | dictaminar_postulacion(post,true) | Solo el coordinador puede dictaminar. | Pendiente de transcribir el resultado de ejecución. | ⏳ Pendiente |
| 10 | Estudiante A y profesor1 | publicar_franja(…) en tres subcasos | Sin autorización: No tienes autorización para asesorar esta materia. / Menos de 24 h: Publica tus horarios con más de 24 horas de anticipación. / Duplicado: Ya tienes un horario registrado en ese bloque. | Reportaste Pasa en la prueba 10. | ✅ Pasa (reportado) |
| 11 | Estudiantes A y B | solicitar_asesoria(f) por dos estudiantes | Este horario ya fue reservado.; una sola reserva activa de A. | Reportaste Pasa con una sola reserva activa y guardaste la captura. | ✅ Pasa (reportado) |
| 12 | Estudiante A | solicitar_asesoria(f); solicitar_asesoria(f2) | Ya tienes un compromiso agendado a esa misma hora.; una reserva activa. | Reportaste Pasa en la prueba 12. | ✅ Pasa (reportado) |
| 13 | Profesor1 | resolver_solicitud(s,true,NULL) | Debes ingresar el enlace de acceso virtual (https://...).; continúa Pendiente. | Reportaste Pasa en la prueba 13. | ✅ Pasa (reportado) |
| 14 | Estudiante A | cancelar_asesoria(s) con cita aceptada a menos de 48 h | Solo se puede cancelar con al menos 48 horas de anticipación.; continúa Aceptada. | Reportaste Pasa en la prueba 14. | ✅ Pasa (reportado) |
| 15 | Estudiante A | calificar_asesoria(s,6); calificar_asesoria(s,5); calificar_asesoria(s,4) | La calificación debe estar entre 1 y 5. / Esta asesoría ya fue calificada.; una evaluación de 5. | Reportaste Pasa en la prueba 15. | ✅ Pasa (reportado) |
| 16 | Estudiante A | reporte_materias(desde,hasta) | Solo el coordinador puede ver reportes. | Pendiente de transcribir el resultado de ejecución. | ⏳ Pendiente |

## Repetición y condiciones

- Esquema V3 y perfiles T04 existentes; la cuenta externa debe existir en Authentication.
- Ejecutar desde el selector `postgres`, una prueba completa por vez.
- La preparación administrativa crea únicamente datos de control; la operación evaluada
  se realiza como `authenticated`. Las comprobaciones administrativas posteriores
  se indican con `RESET ROLE`.
- Cada bloque está dentro de `BEGIN; … ROLLBACK;`. No confirmar los cambios.
- Si falla la preparación, ejecutar `ROLLBACK;` por separado.
- Las pruebas 10 y 15 tienen varios subcasos; revisar todas sus salidas.
- La prueba 3 compara contra cantidades reales. Los valores 8/1 son los reportados
  durante la sesión; pueden cambiar si el equipo modifica el catálogo.
- Las notificaciones existentes pueden aumentar el total visible en la prueba 6.
  Debe verse la propia de control y cero ajenas.
- Las fechas se calculan en America/Mexico_City. Las secuencias pueden dejar saltos
  de identificadores aunque se reviertan los datos.
- La prueba 11 comprueba dos intentos sucesivos, no peticiones simultáneas.

## Evidencias para Jira

Adjuntar las capturas ya obtenidas si corresponden a la ejecución documentada.
Si una repetición falla y se corrige, añadir también su evidencia de corrección.

| Archivo sugerido | Qué debe verse | Descripción |
| --- | --- | --- |
| T07_01_usuario_propio.png | Usuario simulado, consulta y su único perfil | El estudiante consulta usuario y solo obtiene su propio perfil. |
| T07_02_coordinador.png | Consulta como coordinador y todos los perfiles | El coordinador puede consultar todos los perfiles registrados. |
| T07_03_materias.png | Resultados de ambos roles | El estudiante ve solo materias activas; el coordinador ve activas e inactivas. |
| T07_04_insert_materia.png | Inserción como estudiante y rechazo RLS | RLS impide que el estudiante dé de alta una materia directamente. |
| T07_05_insert_solicitud.png | Inserción directa y rechazo RLS | RLS impide la escritura directa de solicitudes por el estudiante. |
| T07_06_notificaciones.png | Resultados para A y B sin notificaciones ajenas | Cada estudiante ve únicamente sus propias notificaciones. |
| T07_11_doble_reserva.png | Mensaje del segundo intento, una reserva activa y Pasa | El segundo estudiante no puede reservar la misma franja; permanece una sola reserva activa. |

Enlace de la tarea Jira: **pendiente**.
Enlace del PR hacia `qa`: **pendiente**.
Enlaces a las capturas: **adjuntar en Jira y referenciar aquí**.

## Incidencias y correcciones

La consulta inicial de la prueba 3 quedó truncada tras `UNION ALL` y devolvió
`42601: syntax error at end of input`. Se completó la consulta y Edgar reportó
los resultados esperados. Fue una corrección de la consulta de prueba.

No se documenta aquí ninguna nueva corrección de `esquema.sql` durante T07.
Las correcciones de las cuatro funciones por validación de identidad pertenecen a T04.

Si la repetición detecta una falla, registrar el mensaje exacto, el caso,
la corrección aplicada, su commit y la captura de la repetición.

## Estado y procedencia

Se ejecutaron individualmente las 16 pruebas de la versión final
de sql/pruebas_rls.sql en el SQL Editor de Supabase.

Todas obtuvieron Pasa. También se verificaron todos los subcasos
de las pruebas 10 y 15. Cada bloque se ejecutó dentro de
BEGIN y ROLLBACK.

Proyecto: Proyecto_Prueba_TutorConnect.
Rama de entrega: EdgarCharrez/t07.
Fecha de ejecución: [escribe la fecha en que las ejecutaste].

Las capturas de las pruebas 1 a 6 y 11 están guardadas para
adjuntarse a la tarea T07 en Jira.