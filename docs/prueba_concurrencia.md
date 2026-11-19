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

| # | Paso | Depende de | Estado |
|---|---|---|---|
| 1 | Registro | T10 | Pendiente de recorrer |
| 2 | Inicio de sesión | T11 | Pendiente de recorrer |
| 3 | Coordinador crea materia y aprueba asesor | T12 / T13 | Pendiente (T13 en curso) |
| 4 | Asesor publica | T14 | Pendiente de recorrer |
| 5 | Estudiante busca y solicita | T15a / T15b | Pendiente (en revisión / en curso) |
| 6 | Asesor acepta (con enlace) | T16 | Pendiente de recorrer |
| 7 | Estudiante ve la cita | T17 | Pendiente (por hacer) |
| 8 | Cancelación | T17 | Pendiente (por hacer) |

## Errores encontrados

| # | Pantalla | Pasos para reproducir | Esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| | | | | | |
