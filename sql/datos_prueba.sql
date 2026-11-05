-- T04: datos de prueba de TutorConnect.
--
-- REQUISITOS
-- 1. Haber ejecutado esquema.sql y tener las tres carreras iniciales.
-- 2. Tener creadas en Authentication las siete cuentas:
--    coordinacion@pachuca.tecnm.mx
--    l23021613@pachuca.tecnm.mx
--    estudiante2@pachuca.tecnm.mx
--    estudiante3@pachuca.tecnm.mx
--    profesor1@pachuca.tecnm.mx
--    profesor2@pachuca.tecnm.mx
--    tutor1@pachuca.tecnm.mx
-- 3. Los UUID de este archivo corresponden al proyecto compartido
--    Proyecto_Prueba_TutorConnect. Si se recrean las cuentas o se usa
--    otro proyecto, sustituirlos por los UUID de Authentication.
--
-- EJECUCION
-- Abrir SQL Editor como administrador, con el rol postgres.
-- Pegar y ejecutar el archivo completo, respetando el orden.
-- Cada bloque tiene su propia transaccion BEGIN / COMMIT.
-- Si un bloque falla, los anteriores pueden haber quedado guardados.
-- Revisar el error y ejecutar ROLLBACK si la transaccion sigue abierta.
--
-- REPETICIONES
-- ON CONFLICT DO NOTHING omite registros que ya existen.
-- Los registros existentes conservan sus valores actuales.
-- Los horarios se calculan para dentro de 3 y 4 dias, tomando
-- la fecha de Ciudad de Mexico al momento de la ejecucion.
-- Ejecutar en otra fecha puede agregar nuevos horarios.
--
-- VERIFICACION
-- Comprobar perfiles, materias, postulaciones y horarios.
-- Consultar v_franjas_disponibles simulando un estudiante autenticado.
--
-- Las contrasenas se comparten unicamente por el chat del equipo.

BEGIN;

-- Materias de Ingeniería en Sistemas Computacionales.
INSERT INTO public.materia (
  nombre_materia,
  id_carrera,
  estado_activo
)
SELECT
  datos.nombre,
  carrera.id_carrera,
  datos.activa
FROM public.carrera AS carrera
CROSS JOIN (
  VALUES
    ('Cálculo Diferencial', TRUE),
    ('Cálculo Integral', TRUE),
    ('Programación Orientada a Objetos', TRUE),
    ('Estructuras de Datos', TRUE),
    ('Bases de Datos', TRUE),
    ('Álgebra Lineal', TRUE),
    ('Probabilidad y Estadística', TRUE),
    ('Fundamentos de Programación', TRUE),
    ('Redes de Computadoras', FALSE)
) AS datos(nombre, activa)
WHERE carrera.nombre_carrera =
  'Ingeniería en Sistemas Computacionales'
ON CONFLICT (nombre_materia, id_carrera) DO NOTHING;

COMMIT;

BEGIN;

INSERT INTO public.usuario (
  id_usuario,
  correo_institucional,
  nombre_completo,
  rol,
  matricula_num_empleado,
  id_carrera,
  semestre
)
SELECT
  datos.id::UUID,
  datos.correo,
  datos.nombre,
  'Estudiante',
  datos.matricula,
  c.id_carrera,
  3
FROM public.carrera AS c
CROSS JOIN (
  VALUES
    (
      'be2247d6-268f-43df-9935-0bedfbafb574',
      'estudiante2@pachuca.tecnm.mx',
      'Estudiante de prueba 2',
      'PRUEBA-EST-02'
    ),
    (
      '1969699f-985c-4b56-bc02-0baf9dc0b6c5',
      'estudiante3@pachuca.tecnm.mx',
      'Estudiante de prueba 3',
      'PRUEBA-EST-03'
    )
) AS datos(id, correo, nombre, matricula)
WHERE c.nombre_carrera =
  'Ingeniería en Sistemas Computacionales'
ON CONFLICT (id_usuario) DO NOTHING;

COMMIT;

BEGIN;

INSERT INTO public.usuario (
  id_usuario,
  correo_institucional,
  nombre_completo,
  rol,
  matricula_num_empleado,
  departamento
)
VALUES
  (
    '43a01d3f-7481-45e7-89f0-953c858b4885',
    'profesor1@pachuca.tecnm.mx',
    'Profesor de prueba 1',
    'Profesor',
    'PRUEBA-PROF-01',
    'Sistemas y Computación'
  ),
  (
    '378e8b4a-573c-4ad8-a935-729e07fc5806',
    'profesor2@pachuca.tecnm.mx',
    'Profesor de prueba 2',
    'Profesor',
    'PRUEBA-PROF-02',
    'Sistemas y Computación'
  )
ON CONFLICT (id_usuario) DO NOTHING;

COMMIT;

BEGIN;

INSERT INTO public.usuario (
  id_usuario,
  correo_institucional,
  nombre_completo,
  rol,
  matricula_num_empleado,
  id_carrera,
  semestre
)
SELECT
  'a7e1912d-3290-43c8-a646-0a5fc2516520'::UUID,
  'tutor1@pachuca.tecnm.mx',
  'Tutor de prueba 1',
  'Estudiante',
  'PRUEBA-TUTOR-01',
  id_carrera,
  5
FROM public.carrera
WHERE nombre_carrera =
  'Ingeniería en Sistemas Computacionales'
ON CONFLICT (id_usuario) DO NOTHING;

COMMIT;

-- Perfil del primer estudiante.
-- Su cuenta debe existir previamente en Authentication.
BEGIN;

INSERT INTO public.usuario (
  id_usuario,
  correo_institucional,
  nombre_completo,
  rol,
  matricula_num_empleado,
  id_carrera,
  semestre,
  departamento
)
SELECT
  'db30401b-0454-4799-8585-90b839438052'::UUID,
  'l23021613@pachuca.tecnm.mx',
  'Prueba',
  'Estudiante',
  '23021613',
  id_carrera,
  5,
  'ISC'
FROM public.carrera
WHERE nombre_carrera =
  'Ingeniería en Sistemas Computacionales'
ON CONFLICT (id_usuario) DO NOTHING;

COMMIT;

-- Perfil del coordinador.
-- Su cuenta debe existir previamente en Authentication.
BEGIN;

INSERT INTO public.usuario (
  id_usuario,
  correo_institucional,
  nombre_completo,
  rol,
  matricula_num_empleado,
  departamento
)
VALUES (
  'c0843e63-7d44-4a46-9d43-561b48aea6a4',
  'coordinacion@pachuca.tecnm.mx',
  'Coordinador de prueba',
  'Coordinador',
  'EMP-0001',
  'Sistemas y Computación'
)
ON CONFLICT (id_usuario) DO NOTHING;

COMMIT;

BEGIN;

-- Datos de prueba: autorizaciones y postulaciones.
INSERT INTO public.asesor_materia (
  id_asesor,
  id_materia,
  estado_autorizacion,
  id_coordinador_aprobador,
  fecha_dictamen
)
SELECT
  u.id_usuario,
  m.id_materia,
  datos.estado,
  CASE
    WHEN datos.estado <> 'Pendiente'
    THEN coordinador.id_usuario
  END,
  CASE
    WHEN datos.estado <> 'Pendiente'
    THEN now()
  END
FROM (
  VALUES
    (
      'tutor1@pachuca.tecnm.mx',
      'Fundamentos de Programación',
      'Aprobada'
    ),
    (
      'profesor1@pachuca.tecnm.mx',
      'Bases de Datos',
      'Aprobada'
    ),
    (
      'profesor2@pachuca.tecnm.mx',
      'Cálculo Diferencial',
      'Pendiente'
    ),
    (
      'profesor2@pachuca.tecnm.mx',
      'Álgebra Lineal',
      'Rechazada'
    )
) AS datos(correo, materia, estado)
JOIN public.usuario AS u
  ON u.correo_institucional = datos.correo
JOIN public.carrera AS c
  ON c.nombre_carrera = 'Ingeniería en Sistemas Computacionales'
JOIN public.materia AS m
  ON m.nombre_materia = datos.materia
  AND m.id_carrera = c.id_carrera
JOIN public.usuario AS coordinador
  ON coordinador.correo_institucional = 'coordinacion@pachuca.tecnm.mx'
  AND coordinador.rol = 'Coordinador'
ON CONFLICT (id_asesor, id_materia) DO NOTHING;

COMMIT;

BEGIN;

-- Horarios de prueba para dentro de 3 y 4 días,
-- tomando como referencia la fecha de Ciudad de México.
INSERT INTO public.franja_disponibilidad (
  id_asesor,
  id_materia,
  fecha,
  hora_inicio,
  modalidad,
  ubicacion_presencial
)
SELECT
  u.id_usuario,
  m.id_materia,
  (now() AT TIME ZONE 'America/Mexico_City')::DATE
    + datos.dias,
  datos.hora,
  datos.modalidad,
  datos.ubicacion
FROM (
  VALUES
    (
      'profesor1@pachuca.tecnm.mx',
      'Bases de Datos',
      3, TIME '10:00', 'Presencial', 'Aula de prueba A1'
    ),
    (
      'profesor1@pachuca.tecnm.mx',
      'Bases de Datos',
      4, TIME '11:00', 'Virtual', NULL
    ),
    (
      'tutor1@pachuca.tecnm.mx',
      'Fundamentos de Programación',
      3, TIME '10:00', 'Virtual', NULL
    ),
    (
      'tutor1@pachuca.tecnm.mx',
      'Fundamentos de Programación',
      4, TIME '12:00', 'Presencial', 'Biblioteca de prueba'
    )
) AS datos(correo, materia, dias, hora, modalidad, ubicacion)
JOIN public.usuario AS u
  ON u.correo_institucional = datos.correo
JOIN public.asesor_materia AS a
  ON a.id_asesor = u.id_usuario
  AND a.estado_autorizacion = 'Aprobada'
JOIN public.materia AS m
  ON m.id_materia = a.id_materia
  AND m.nombre_materia = datos.materia
  AND m.estado_activo
ON CONFLICT (id_asesor, fecha, hora_inicio) DO NOTHING;

COMMIT;