# T27 — Reporte de pruebas de TutorConnect

- Sitio: https://synapsesolutions-tutorconnect.github.io/TutorConnect/
- Tarea: https://sinon-marsh.atlassian.net/browse/TC-29
- Coordinador del reporte: Edgar Charrez Dothi.
- Entorno: sitio publicado en GitHub Pages.
- Versión publicada: pendiente de identificar.
- Evidencias: docs/capturas/pruebas/ y adjuntos de TC-29.
- Estados: ✅ Aprobada, ❌ Fallida, ⏳ Pendiente.
- La aprobación final corresponde al Scrum Master.

## 1. Escenarios de aceptación

| ID | Responsable | Precondiciones | Pasos | Datos usados | Resultado esperado | Resultado obtenido | Estado | Fecha |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ESC-001 | Edgar | Correo nuevo; incógnito y sin sesión | Completar registro, crear cuenta y comprobar panel y perfil | MARIO SALVADOR; l25200500@pachuca.tecnm.mx; matrícula 25200500; Sistemas Computacionales; semestre 7 | Cuenta creada, rol Estudiante y redirección al panel | Cuenta creada; acceso directo sin confirmación por correo; perfil con los datos y rol Estudiante | ✅ | 20/11/2026 |
| ESC-002 | Yael | Franja libre a más de 24 h; dos estudiantes | Solicitar con uno; consultar agenda y buscar con el otro | Pendiente de registrar IDs y usuarios | Pendiente, franja Congelado y oculta al otro estudiante | Pendiente de ejecución | ⏳ | Pendiente |
| ESC-003 | Carlos | Solicitud virtual Pendiente | Aceptar con URL y revisar como estudiante | Pendiente de registrar solicitud y URL | Aceptada y enlace visible para el estudiante | Pendiente de ejecución | ⏳ | Pendiente |
| ESC-004 | Gamaliel | Cita Aceptada que comienza en 12 h | Abrir la cita y revisar cancelación | Pendiente de registrar ID y horario | Botón bloqueado con aviso de 48 h | Pendiente de ejecución | ⏳ | Pendiente |
| ESC-005 | Gamaliel | Cita Realizada hace 3 días, sin evaluación | Registrar promedio, calificar con 4 estrellas y comprobar promedio | Pendiente de registrar cita y promedio anterior | Evaluación sin texto y promedio actualizado correctamente | Pendiente de ejecución | ⏳ | Pendiente |

## 2. Reglas de negocio

Cada fila se aprueba únicamente cuando pasan todos sus subcasos.

| ID | Responsable | Precondiciones | Pasos | Datos usados | Resultado esperado | Resultado obtenido | Estado | Fecha |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RN-01 | Carlos | Registro sin sesión | Intentar registro con Gmail | Pendiente | Correo rechazado | Pendiente de ejecución | ⏳ | Pendiente |
| RN-02 | Ximena | Usuario sin materia aprobada | Intentar publicar una franja | Pendiente | Publicación rechazada | Pendiente de ejecución | ⏳ | Pendiente |
| RN-03 | Gamaliel | Asesor con bloque y estudiante con cita activa | Intentar duplicar bloque y solicitar otra cita a la misma hora | Pendiente | Ambos solapamientos rechazados | Pendiente de ejecución | ⏳ | Pendiente |
| RN-04 | Yael | Dos estudiantes y franja libre | Intentar doble reserva; comprobar liberación por rechazo y por cancelación | Pendiente | Segunda reserva rechazada; franja liberada en ambos casos | Pendiente de ejecución | ⏳ | Pendiente |
| RN-05 | Carlos | Solicitud Pendiente cuyo inicio está a menos de 24 h | Ejecutar el flujo que procesa vencimientos y revisar estado | Pendiente | Solicitud Caducada | Pendiente de ejecución | ⏳ | Pendiente |
| RN-06 | Gamaliel | Citas Aceptadas a más y menos de 48 h | Intentar cancelar ambas | Pendiente | Permitida a más de 48 h y bloqueada a menos de 48 h | Pendiente de ejecución | ⏳ | Pendiente |
| RN-07 | Carlos | Citas Realizadas dentro y fuera de 7 días | Calificar dentro del plazo, repetir e intentar fuera del plazo; revisar ausencia de texto | Pendiente | Solo una evaluación dentro de 7 días y sin texto | Pendiente de ejecución | ⏳ | Pendiente |
| RN-09 / RN-10 | Yael | Cita sin cerrar desde hace más de 48 h y casos a menos de 24 h | Procesar vencimiento; intentar publicar y solicitar dentro del límite | Pendiente | Sin registro; publicación y solicitud rechazadas | Pendiente de ejecución | ⏳ | Pendiente |

## 3. Requisitos no funcionales y permisos

| ID | Responsable | Precondiciones | Pasos | Datos usados | Resultado esperado | Resultado obtenido | Estado | Fecha |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RNF-001 | Gamaliel | Sesión de estudiante en el sitio publicado | Intentar escritura directa desde consola y registrar error completo | Pendiente | Escritura rechazada por permisos | Pendiente; un error de campos obligatorios por sí solo no demuestra protección de permisos | ⏳ | Pendiente |
| RNF-002 | Yael | Matriz y capturas de T24 disponibles | Revisar matriz de 8 pantallas en 360, 768 y 1440 px y estados de interfaz | Pendiente de enlazar matriz | Cumplimiento responsive documentado | Pendiente de revisión | ⏳ | Pendiente |
| RNF-003 | Yael | Network abierto, conservación del registro y sin limitación de velocidad | Medir las operaciones de los cinco escenarios | Mediciones parciales de ESC-001 en tabla inferior | Cada operación medida ≤ 2000 ms | signup: 1090 ms; registrar_perfil: 297 ms; faltan las demás operaciones | ⏳ | Parcial: 20/11/2026 |
| Permisos | Carlos | Sesión de estudiante | Intentar acceder a reporte y administración de materias | Pendiente | Acceso y operaciones no autorizadas bloqueados | Pendiente de ejecución | ⏳ | Pendiente |

### Mediciones por petición

| Escenario | Petición | HTTP | Tiempo | Resultado | Ejecutor | Fecha |
| --- | --- | --- | --- | --- | --- | --- |
| ESC-001 | signup | 200 | 1090 ms | Cumple ≤ 2000 ms | Edgar | 20/11/2026 |
| ESC-001 | registrar_perfil | 204 | 297 ms | Cumple ≤ 2000 ms | Edgar | 20/11/2026 |

Estas mediciones corresponden a peticiones individuales, no al tiempo total
hasta que el panel estuvo listo. RNF-003 permanece pendiente hasta completar
las mediciones requeridas de los cinco escenarios.

## 4. Evidencias

### ESC-001

- [Formulario de registro](capturas/pruebas/ESC-001_01_formulario.png)
- [Resultado del registro](capturas/pruebas/ESC-001_02_resultado.png)
- [Panel del estudiante](capturas/pruebas/ESC-001_03_panel.png)
- [Perfil y tiempos de Network](capturas/pruebas/ESC-001_04_perfil_tiempos.png)

Ejecución realizada con MARIO SALVADOR,
l25200500@pachuca.tecnm.mx.

Evidencias también adjuntas en TC-29.

### Pruebas restantes

Pendientes de recibir, revisar y enlazar.

## 5. Bugs

No hay fallos registrados hasta este corte parcial.
Esto no implica que las pruebas pendientes estén aprobadas.

Por cada fila fallida se registrará el Bug enlazado en Jira, con pasos,
resultado esperado, resultado obtenido, captura y prioridad.

| Prueba fallida | Bug Jira | Prioridad | Evidencia |
| --- | --- | --- | --- |
| No aplica al corte actual | No hay Bugs registrados en este reporte | No aplica | No aplica |

## 6. Resumen parcial

| Concepto | Cantidad |
| --- | ---: |
| Pruebas principales planificadas | 17 |
| Aprobadas en ejecución, pendientes de validación del Scrum Master | 1 |
| Fallidas registradas | 0 |
| Pendientes | 16 |

Comprobación: 1 + 0 + 16 = 17.

T27 continúa en curso. Las mediciones parciales no se cuentan como pruebas
principales adicionales.