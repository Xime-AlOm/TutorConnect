# T07 — Registro de pruebas RLS y funciones

## Validación realizada

Se ejecutaron individualmente las 16 pruebas de
sql/pruebas_rls.sql en el SQL Editor de Supabase.
Todas obtuvieron Pasa, incluidos los subcasos de las pruebas 10 y 15.

Cada prueba se ejecutó dentro de BEGIN y ROLLBACK.
Las operaciones evaluadas utilizaron SET LOCAL ROLE authenticated
y el UUID del usuario simulado en request.jwt.claims.

- Proyecto: Proyecto_Prueba_TutorConnect.
- Responsable: Edgar Charrez Dothi.
- Rama: EdgarCharrez/t07.
- Rama destino: qa.
- Fecha de ejecución: 2026-11-05.
- Pull request: https://github.com/Xime-AlOm/TutorConnect/pull/17
- Script: [pruebas_rls.sql](../sql/pruebas_rls.sql).

## Usuarios de prueba

| Identidad | Rol en TutorConnect | UUID |
| --- | --- | --- |
| Estudiante A — estudiante2 | Estudiante | be2247d6-268f-43df-9935-0bedfbafb574 |
| Estudiante B — estudiante3 | Estudiante | 1969699f-985c-4b56-bc02-0baf9dc0b6c5 |
| Profesor1 | Profesor | 43a01d3f-7481-45e7-89f0-953c858b4885 |
| Tutor1 | Estudiante autorizado como tutor par | a7e1912d-3290-43c8-a646-0a5fc2516520 |
| Coordinador | Coordinador | c0843e63-7d44-4a46-9d43-561b48aea6a4 |
| Cuenta externa | Sin perfil institucional | dbbe3d5b-0ed7-49b8-ae2d-53888c018e09 |

Estos son los roles de la aplicación.
El rol PostgreSQL utilizado para evaluar las operaciones es authenticated.

## Registro de las 16 pruebas

Las sentencias se resumen en esta tabla.
Los bloques completos, argumentos y datos de preparación están en
sql/pruebas_rls.sql, identificados por número de prueba.

En las sentencias siguientes:
- m: materia temporal creada para la prueba.
- f y f2: franjas temporales.
- s: solicitud temporal.
- post: postulación temporal.

| N.º | Usuario simulado (rol) | Sentencia ejecutada | Resultado esperado | Resultado obtenido | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Estudiante A | SELECT id_usuario, correo_institucional, rol FROM public.usuario; | Únicamente su propio perfil. | Un perfil visible, correspondiente al estudiante simulado. | ✅ Pasa |
| 2 | Coordinador | SELECT correo_institucional, rol FROM public.usuario; | Todos los perfiles registrados. | Total visible igual al total real de perfiles. | ✅ Pasa |
| 3 | Estudiante A y coordinador | Consulta de cantidades activas e inactivas en public.materia bajo ambos usuarios. | Estudiante: solo activas. Coordinador: activas e inactivas. | Ambos roles obtuvieron las cantidades esperadas; el estudiante no vio materias inactivas. | ✅ Pasa |
| 4 | Estudiante A | INSERT INTO public.materia(nombre_materia, id_carrera) VALUES (...); | Rechazo por RLS con SQLSTATE 42501. | Inserción rechazada por la política RLS de materia; SQLSTATE 42501. | ✅ Pasa |
| 5 | Estudiante A | INSERT INTO public.solicitud_asesoria(id_estudiante, id_disponibilidad) VALUES (auth.uid(), f); | Rechazo de escritura directa por RLS con SQLSTATE 42501. | Inserción rechazada por la política RLS de solicitud_asesoria; SQLSTATE 42501. | ✅ Pasa |
| 6 | Estudiantes A y B | Consulta de public.notificacion bajo cada usuario. | Cada estudiante ve su notificación de control y ninguna ajena. | Ambos estudiantes vieron su notificación propia y cero notificaciones ajenas. | ✅ Pasa |
| 7 | Cuenta externa | registrar_perfil('Externo T07', 'Profesor', 'T07-EXTERNO', NULL, NULL, 'Pruebas'); | Acceso restringido a cuentas institucionales. | Registro rechazado con el mensaje esperado y SQLSTATE P0001. | ✅ Pasa |
| 8 | Estudiante A | postular_materia(m), dos veces. | Ya enviaste una solicitud para esta materia. | La primera postulación se realizó y la segunda fue rechazada con el mensaje esperado y SQLSTATE P0001. | ✅ Pasa |
| 9 | Estudiante A | dictaminar_postulacion(post, true); | Solo el coordinador puede dictaminar. | Dictamen rechazado con el mensaje esperado y SQLSTATE P0001. | ✅ Pasa |
| 10 | Estudiante A y profesor1 | publicar_franja(...) sin autorización, con menos de 24 horas y con bloque duplicado. | Sin autorización: «No tienes autorización para asesorar esta materia.» Anticipación: «Publica tus horarios con más de 24 horas de anticipación.» Duplicado: «Ya tienes un horario registrado en ese bloque.» | Los tres subcasos fueron rechazados con sus mensajes esperados y SQLSTATE P0001; la publicación válida previa al intento duplicado se realizó. | ✅ Pasa |
| 11 | Estudiantes A y B | solicitar_asesoria(f), primero como A y después como B. | Este horario ya fue reservado.; una sola reserva activa. | El segundo intento fue rechazado con SQLSTATE P0001 y permaneció una sola reserva activa del estudiante A. | ✅ Pasa |
| 12 | Estudiante A | solicitar_asesoria(f); solicitar_asesoria(f2); para dos franjas a la misma hora. | Ya tienes un compromiso agendado a esa misma hora. | Segundo intento rechazado con el mensaje esperado y SQLSTATE P0001; permaneció únicamente la primera reserva activa. | ✅ Pasa |
| 13 | Profesor1 | resolver_solicitud(s, true, NULL); para una sesión virtual. | Debes ingresar el enlace de acceso virtual (https://...). | Aceptación rechazada con el mensaje esperado y SQLSTATE P0001; la solicitud permaneció Pendiente y sin URL. | ✅ Pasa |
| 14 | Estudiante A | cancelar_asesoria(s); para una cita aceptada con menos de 48 horas de anticipación. | Solo se puede cancelar con al menos 48 horas de anticipación. | Cancelación rechazada con el mensaje esperado y SQLSTATE P0001; la solicitud permaneció Aceptada. | ✅ Pasa |
| 15 | Estudiante A | calificar_asesoria(s, 6); calificar_asesoria(s, 5); calificar_asesoria(s, 4); | Puntuación 6: «La calificación debe estar entre 1 y 5.» Segunda evaluación: «Esta asesoría ya fue calificada.» | Ambos intentos inválidos fueron rechazados con sus mensajes esperados y SQLSTATE P0001; permaneció una única evaluación con puntuación 5. | ✅ Pasa |
| 16 | Estudiante A | reporte_materias(CURRENT_DATE - 30, CURRENT_DATE + 30); | Solo el coordinador puede ver reportes. | Consulta rechazada con el mensaje esperado y SQLSTATE P0001. | ✅ Pasa |

## Cómo repetir las pruebas

1. Abrir sql/pruebas_rls.sql.
2. Entrar al SQL Editor del proyecto de Supabase.
3. Mantener el selector inicial de rol en postgres.
4. Copiar una prueba completa, desde BEGIN hasta ROLLBACK.
5. Ejecutar y revisar todas sus salidas.
6. Confirmar que el resultado sea Pasa en todos sus subcasos.
7. Repetir con la siguiente prueba.

La preparación de datos se realiza como postgres.
La operación evaluada se realiza como authenticated con el UUID correspondiente.
RESET ROLE se utiliza únicamente para comprobaciones administrativas posteriores.

Los errores esperados se capturan y comparan por mensaje y SQLSTATE.
Una prueba pasa únicamente cuando todos sus subcasos cumplen el resultado esperado.

Si ocurre un error de preparación, ejecutar ROLLBACK por separado
antes de corregir y repetir el bloque.

## Requisitos y aislamiento

- Tener instalado el esquema V3 y los perfiles de prueba de T04.
- Tener la cuenta externa creada en Authentication con correo no institucional.
- Mantener al menos una materia inactiva para la prueba 3.
- Sustituir los UUID en el script si se recrean las cuentas.
- Ejecutar cada bloque completo para revertir sus datos temporales.
- Las fechas se calculan respecto al momento de ejecución en America/Mexico_City.
- Las secuencias pueden avanzar aunque se ejecute ROLLBACK; los saltos de ID son normales.
- Las funciones que procesan vencimientos pueden modificar temporalmente otras solicitudes; ejecutar los bloques completos y brevemente para liberar sus bloqueos.

La prueba 3 compara las cantidades visibles contra las cantidades reales
del catálogo, por lo que no depende de un total fijo.

La prueba 6 permite que existan otras notificaciones propias.
Debe ser visible la notificación de control y no debe verse ninguna ajena.

La prueba 11 comprueba dos intentos sucesivos de reserva.
No constituye una prueba de peticiones simultáneas.

## Evidencias

Se guardaron las siguientes capturas para adjuntarlas a la tarea T07 en Jira.

| Captura | Descripción |
| --- | --- |
| T07_01_usuario_propio.png | El estudiante autenticado únicamente puede consultar su propio perfil. |
| T07_02_coordinador.png | El coordinador autenticado puede consultar todos los perfiles. |
| T07_03_materias.png | El estudiante ve solo materias activas y el coordinador ve activas e inactivas. |
| T07_04_insert_materia.png | RLS rechaza la inserción directa de una materia por un estudiante. |
| T07_05_insert_solicitud.png | RLS rechaza la inserción directa de una solicitud de asesoría. |
| T07_06_notificaciones.png | Cada estudiante ve sus propias notificaciones y ninguna ajena. |
| T07_11_doble_reserva.png | El segundo estudiante no puede reservar la misma franja; permanece una sola reserva activa. |

## Incidencias y correcciones

La consulta inicial de la prueba 3 quedó incompleta después de UNION ALL
y devolvió el error 42601: syntax error at end of input.

Se completó la consulta y se volvió a ejecutar con el resultado esperado.
Esta corrección correspondió al código de la prueba.

No se requirieron nuevas correcciones del esquema durante esta validación final.
Las correcciones de identidad de las funciones realizadas en T04
ya forman parte del esquema utilizado.

## Resultado de la validación

Las 16 pruebas y todos sus subcasos obtuvieron Pasa.
La entrega queda disponible en el PR #17 hacia qa
para revisión y verificación del Scrum Master.