# Prueba de concurrencia y flujo principal — T18–T19 (TC-21)

Responsable: Ximena Alcantara Omaña · Rama: `Ximena/Sp1`

## Datos de prueba

| Rol | Usuario | UUID |
|---|---|---|
| Asesor A | profesor1@pachuca.tecnm.mx (Bases de Datos, materia 5) | 43a01d3f-7481-45e7-89f0-953c858b4885 |
| Asesor B | tutor1@pachuca.tecnm.mx (Fundamentos de Programación, materia 8) | a7e1912d-3290-43c8-a646-0a5fc2516520 |
| Estudiante E1 | estudiante2@pachuca.tecnm.mx | be2247d6-268f-43df-9935-0bedfbafb574 |
| Estudiante E2 | estudiante3@pachuca.tecnm.mx | 1969699f-985c-4b56-bc02-0baf9dc0b6c5 |

Franjas creadas con `publicar_franja` (miércoles 18/11/2026):

| id_disponibilidad | Asesor | Hora | Ubicación |
|---|---|---|---|
| 87 | A (profesor1) | 12:00 | T18 · Aula A |
| 88 | A (profesor1) | 13:00 | T18 · Aula A |
| 89 | B (tutor1) | 12:00 | T18 · Aula B |

## Parte 1 — T18: pruebas 1 a 6

Fase 1 (13/11/2026): pruebas ejecutadas en Supabase → SQL Editor, simulando a cada usuario con
`set local role authenticated` y `request.jwt.claims` (mismas funciones que llama la interfaz).

| # | Paso | Usuario / navegador | Acción | Resultado esperado | Resultado obtenido | ✅/❌ |
|---|---|---|---|---|---|---|
| 1 | Reserva inicial | E1 · SQL Editor | `solicitar_asesoria(87)` | Solicitud creada en estado Pendiente | Solicitud 66 creada, Pendiente | ✅ |
| 2 | Doble reserva | E2 · SQL Editor | `solicitar_asesoria(87)` sobre la misma franja | «Este horario ya fue reservado.» | «Este horario ya fue reservado.» | ✅ |
| 3 | Solapamiento del estudiante | E1 · SQL Editor | `solicitar_asesoria(89)` (asesor B, misma hora) | «Ya tienes un compromiso agendado a esa misma hora.» | «Ya tienes un compromiso agendado a esa misma hora.» | ✅ |
| 4 | Solapamiento del asesor | Asesor A · SQL Editor | `publicar_franja(5, '2026-11-18', '12:00', ...)` | «Ya tienes un horario registrado en ese bloque.» | «Ya tienes un horario registrado en ese bloque.» | ✅ |
| 5 | Liberación y nueva reserva | Asesor A y E2 · SQL Editor | Asesor rechaza la solicitud 66; E2 solicita la franja 87 | La franja se libera y E2 puede reservarla (DBAUD-001) | 66 Rechazada; solicitud 68 de E2 creada, Pendiente | ✅ |
| 6 | Una sola solicitud activa | Table Editor / SQL | Revisar `solicitud_asesoria` con `id_disponibilidad = 87` | Una sola fila Pendiente o Aceptada | 66 Rechazada y 68 Pendiente (una sola activa) | ✅ |

Fase 2 (18–19/11/2026): doble reserva desde la interfaz (`buscar.html` → «Solicitar asesoría» →
«Confirmar solicitud») con dos navegadores lado a lado, confirmando al mismo tiempo (cuenta 3, 2, 1).

### Doble reserva con dos navegadores — repeticiones

E1 = estudiante2 en Chrome (incógnito) · E2 = estudiante3 en Edge.
Por acuerdo con el Scrum Master se dejaron 3 repeticiones (la tarea pedía 5).
Entre intentos, el asesor rechazó la solicitud ganadora para liberar la franja.

| Intento | Franja | Ganó | Mensaje del otro | Lista del otro | Filas activas en la franja | ✅/❌ |
|---|---|---|---|---|---|---|
| 1 (video) | 101 · sáb 21/11 15:00 | E1 (estudiante2) | «Este horario ya fue reservado.» | Recargada | 1 | ✅ |
| 2 | 105 · sáb 21/11 07:00 | E2 (estudiante3) | «Este horario ya fue reservado.» | Recargada | 1 | ✅ |
| 3 | 105 · sáb 21/11 07:00 | E1 (estudiante2) | «Este horario ya fue reservado.» | Recargada («0 horarios disponibles») | 1 | ✅ |

Ganaron ambos estudiantes en distintos intentos, por lo que el resultado no depende del navegador
sino del índice único parcial `idx_solasesoria_activa_slot`.

### Tiempos de respuesta (RNF-003, meta ≤ 2.0 s)

Medidos en F12 → Red (Network) durante la fase 2.

| Operación | Tiempo | ✅/❌ |
|---|---|---|
| `v_franjas_disponibles` (búsqueda) | 134–444 ms | ✅ |
| `solicitar_asesoria` (ya reservado, 400) | 128–176 ms | ✅ |

## Parte 2 — T19: recorrido del flujo principal

Recorrido hecho el 19/11/2026 en pantalla (incógnito, F12 → Console abierta), con cuentas nuevas:
estudiante `estudiantet19@pachuca.tecnm.mx` y profesor `t19.profesor@pachuca.tecnm.mx`.

| # | Paso | Depende de | Qué se hizo | Evidencia | ✔ |
|---|---|---|---|---|---|
| 1 | Registro | T10 | Registro del estudiante y del profesor T19 | T19-1a, T19-1b | ✔ |
| 2 | Inicio de sesión | T11 | Contraseña incorrecta → «Correo o contraseña incorrectos»; correcta → panel | T19-2a, T19-2b | ✔ |
| 3 | Coordinador crea materia y aprueba asesor | T12 / T13 | Alta de «Tópicos Avanzados de Programción»; el profesor T19 se postula (Pendiente) y el coordinador lo aprueba | T19-3a, T19-3b, T19-3c | ✔ |
| 4 | Asesor publica | T14 | Profesor T19 publica lun 23/11 16:00 Virtual → Libre | T19-4 | ✔ |
| 5 | Estudiante busca y solicita | T15a / T15b | Búsqueda por materia y fecha; solicitud confirmada → Pendiente | T19-5a, T19-5b | ✔ |
| 6 | Asesor acepta (con enlace) | T16 | Acepta con https://meet.google.com/t19-abcd-efg → Aceptada | T19-6 | ✔ |
| 7 | Estudiante ve la cita | T17 | Próximas: cita Aceptada con enlace clicable | T19-7 | ✔ |
| 8 | Cancelación | T17 | Cancelar (> 48 h) → confirmación → Cancelada en Historial | T19-8 | ✔ |

## Errores encontrados

| # | Pantalla | Pasos para reproducir | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| 1 | Cabecera (campana) y panel → Notificaciones | Con un estudiante que tiene una cita aceptada, abrir la campana o ver «Notificaciones» en el panel | Ver el aviso «Tu asesoría del … fue confirmada.» | La campana no responde y el panel muestra «No tienes notificaciones nuevas» (el aviso sí existe en la tabla `notificacion`) | Pendiente — corresponde a T21 (notificaciones internas) |
| 2 | Datos de prueba (catálogo) | Revisar el nombre de la materia 5 en Administración | «Bases de Datos» | Sigue como «Taller de Base de Datos» desde las pruebas de T12 | Pendiente — renombrar desde Administración |
