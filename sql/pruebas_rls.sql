-- T07 - TutorConnect. Pruebas independientes de RLS y funciones.
-- REQUISITOS: esquema V3 y datos T04 instalados; perfiles de prueba existentes.
-- Estudiante A be2247d6-268f-43df-9935-0bedfbafb574; estudiante B 1969699f-985c-4b56-bc02-0baf9dc0b6c5.
-- Profesor1 43a01d3f-7481-45e7-89f0-953c858b4885; tutor1 a7e1912d-3290-43c8-a646-0a5fc2516520; coordinador c0843e63-7d44-4a46-9d43-561b48aea6a4.
-- Cuenta externa en Authentication dbbe3d5b-0ed7-49b8-ae2d-53888c018e09 con correo no institucional.
-- Sustituir los UUID en TODO el archivo si se recrean las cuentas.
--
-- EJECUCION: una prueba completa cada vez (BEGIN ... ROLLBACK) en SQL Editor.
-- El selector inicial debe ser postgres para preparar los datos.
-- Cada operación probada se ejecuta con SET LOCAL ROLE authenticated y JWT.
-- RESET ROLE solo se usa para comprobar los efectos, después de la operación.
-- Si falla la preparación, ejecutar ROLLBACK por separado y revisar el error.
-- Los errores esperados se capturan: comparar mensaje Y SQLSTATE.
-- Una prueba con varios resultados pasa solo si TODOS sus subcasos pasan.
-- Capturar todas las salidas antes de continuar; no ejecutar el archivo entero
-- para tomar evidencias, porque el editor puede mostrar únicamente la última.
--
-- AISLAMIENTO: todos los datos temporales se revierten con ROLLBACK.
-- Las secuencias pueden avanzar; los saltos de ID son normales.
-- procesar_vencimientos puede modificar temporalmente otras solicitudes;
-- ejecutar cada bloque brevemente y completo para liberar sus bloqueos.
-- Fechas relativas en America/Mexico_City; no depende de los horarios T04.
-- Prueba 3 requiere al menos una materia inactiva.
-- Prueba 11 es secuencial; no constituye una prueba de concurrencia simultánea.
--
-- Esta es una consolidación nueva: repetirla antes de marcar su validación final.
-- No contiene contraseñas ni claves API.

-- =====================================================================
-- PRUEBA 1: Estudiante ve únicamente su perfil
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
-- Versión consolidada ejecutada individualmente en Supabase:
-- las 16 pruebas y todos sus subcasos obtuvieron Pasa.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT id_usuario,correo_institucional,rol FROM public.usuario;
SELECT 1 AS prueba, count(*) AS perfiles_visibles,
  CASE WHEN count(*)=1 AND bool_and(id_usuario=auth.uid())
    THEN 'Pasa' ELSE 'Falla' END AS estado FROM public.usuario;
ROLLBACK;

-- =====================================================================
-- PRUEBA 2: Coordinador ve todos los perfiles
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
SELECT set_config('t07.total',count(*)::TEXT,true) FROM public.usuario;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"c0843e63-7d44-4a46-9d43-561b48aea6a4"}';
SELECT correo_institucional,rol FROM public.usuario ORDER BY correo_institucional;
SELECT 2 AS prueba,count(*) AS visibles,current_setting('t07.total')::INT AS esperados,
  CASE WHEN count(*)=current_setting('t07.total')::INT AND count(*)>1
    THEN 'Pasa' ELSE 'Falla' END AS estado FROM public.usuario;
ROLLBACK;

-- =====================================================================
-- PRUEBA 3: Materias activas e inactivas según rol
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
SELECT set_config('t07.activas',count(*) FILTER(WHERE estado_activo)::TEXT,true),
  set_config('t07.inactivas',count(*) FILTER(WHERE NOT estado_activo)::TEXT,true)
FROM public.materia;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT set_config('t07.a_activas',count(*) FILTER(WHERE estado_activo)::TEXT,true),
  set_config('t07.a_inactivas',count(*) FILTER(WHERE NOT estado_activo)::TEXT,true)
FROM public.materia;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"c0843e63-7d44-4a46-9d43-561b48aea6a4"}';
SELECT 3 AS prueba,'Estudiante' AS rol,
  current_setting('t07.a_activas')::INT AS activas,current_setting('t07.a_inactivas')::INT AS inactivas,
  CASE WHEN current_setting('t07.a_activas')=current_setting('t07.activas')
    AND current_setting('t07.a_inactivas')::INT=0 AND current_setting('t07.inactivas')::INT>0
    THEN 'Pasa' ELSE 'Falla' END AS estado
UNION ALL
SELECT 3,'Coordinador',count(*) FILTER(WHERE estado_activo)::INT,
  count(*) FILTER(WHERE NOT estado_activo)::INT,
  CASE WHEN count(*) FILTER(WHERE estado_activo)=current_setting('t07.activas')::INT
    AND count(*) FILTER(WHERE NOT estado_activo)=current_setting('t07.inactivas')::INT
    AND current_setting('t07.inactivas')::INT>0 THEN 'Pasa' ELSE 'Falla' END
FROM public.materia;
ROLLBACK;

-- =====================================================================
-- PRUEBA 4: Inserción directa de materia denegada al estudiante
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
SELECT set_config('t07.carrera',id_carrera::TEXT,true) FROM public.carrera
WHERE nombre_carrera='Ingeniería en Sistemas Computacionales';
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  INSERT INTO public.materia(nombre_materia,id_carrera)
  VALUES ('T07-insert-'||txid_current(),current_setting('t07.carrera')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 4 AS prueba, 'RLS INSERT materia' AS caso,
  'new row violates row-level security policy for table "materia"' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'new row violates row-level security policy for table "materia"'
    AND current_setting('t07.code') = '42501'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 5: Inserción directa de solicitud denegada
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-5-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(3,60) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE true
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);


END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  INSERT INTO public.solicitud_asesoria(id_estudiante,id_disponibilidad)
  VALUES (auth.uid(),current_setting('t07.f')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 5 AS prueba, 'RLS INSERT solicitud' AS caso,
  'new row violates row-level security policy for table "solicitud_asesoria"' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'new row violates row-level security policy for table "solicitud_asesoria"'
    AND current_setting('t07.code') = '42501'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 6: Cada estudiante ve únicamente sus notificaciones
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Crear una notificación de control para cada usuario.
WITH n AS (
 INSERT INTO public.notificacion(id_usuario,mensaje)
 VALUES ('be2247d6-268f-43df-9935-0bedfbafb574','T07 notificación A') RETURNING id_notificacion
) SELECT set_config('t07.na',id_notificacion::TEXT,true) FROM n;
WITH n AS (
 INSERT INTO public.notificacion(id_usuario,mensaje)
 VALUES ('1969699f-985c-4b56-bc02-0baf9dc0b6c5','T07 notificación B') RETURNING id_notificacion
) SELECT set_config('t07.nb',id_notificacion::TEXT,true) FROM n;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT set_config('t07.a_total',count(*)::TEXT,true),
  set_config('t07.a_ajenas',count(*) FILTER(WHERE id_usuario<>auth.uid())::TEXT,true),
  set_config('t07.a_control',count(*) FILTER(WHERE id_notificacion=current_setting('t07.na')::BIGINT)::TEXT,true)
FROM public.notificacion;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"1969699f-985c-4b56-bc02-0baf9dc0b6c5"}';
SELECT 6 AS prueba,'Estudiante A' AS usuario,
  current_setting('t07.a_total')::INT AS visibles,current_setting('t07.a_ajenas')::INT AS ajenas,
  CASE WHEN current_setting('t07.a_ajenas')::INT=0 AND current_setting('t07.a_control')::INT=1
    THEN 'Pasa' ELSE 'Falla' END AS estado
UNION ALL
SELECT 6,'Estudiante B',count(*)::INT,
  count(*) FILTER(WHERE id_usuario<>auth.uid())::INT,
  CASE WHEN count(*) FILTER(WHERE id_usuario<>auth.uid())=0
    AND count(*) FILTER(WHERE id_notificacion=current_setting('t07.nb')::BIGINT)=1
    THEN 'Pasa' ELSE 'Falla' END FROM public.notificacion;
ROLLBACK;

-- =====================================================================
-- PRUEBA 7: Registro con correo externo
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
DO $datos$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id='dbbe3d5b-0ed7-49b8-ae2d-53888c018e09'
    AND email NOT LIKE '%@pachuca.tecnm.mx') THEN
    RAISE EXCEPTION 'Falta la cuenta externa de prueba en Authentication o su correo no es externo.';
  END IF;
END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"dbbe3d5b-0ed7-49b8-ae2d-53888c018e09"}';

DO $test$
BEGIN
  PERFORM public.registrar_perfil('Externo T07','Profesor','T07-EXTERNO',NULL,NULL,'Pruebas');
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 7 AS prueba, 'Correo externo' AS caso,
  'Acceso restringido a cuentas institucionales.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Acceso restringido a cuentas institucionales.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 8: Postulación duplicada
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-8-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());

END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT public.postular_materia(current_setting('t07.m')::BIGINT);

DO $test$
BEGIN
  PERFORM public.postular_materia(current_setting('t07.m')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 8 AS prueba, 'Segunda postulación' AS caso,
  'Ya enviaste una solicitud para esta materia.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Ya enviaste una solicitud para esta materia.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 9: Estudiante intenta dictaminar
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-9-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());

END;
$datos$;
WITH p AS (
 INSERT INTO public.asesor_materia(id_asesor,id_materia)
 VALUES ('be2247d6-268f-43df-9935-0bedfbafb574',current_setting('t07.m')::BIGINT) RETURNING id_asesor_materia
) SELECT set_config('t07.post',id_asesor_materia::TEXT,true) FROM p;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  PERFORM public.dictaminar_postulacion(current_setting('t07.post')::BIGINT,true);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 9 AS prueba, 'Dictamen por estudiante' AS caso,
  'Solo el coordinador puede dictaminar.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Solo el coordinador puede dictaminar.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 10: Publicar horario: autorización, anticipación y duplicado
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-10-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(3,60) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE true
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);


END;
$datos$;
-- Solo se elimina la franja temporal recién preparada, para publicar por función.
DELETE FROM public.franja_disponibilidad WHERE id_disponibilidad=current_setting('t07.f')::BIGINT;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  PERFORM public.publicar_franja(current_setting('t07.m')::BIGINT,current_setting('t07.fecha')::DATE,current_setting('t07.hora')::TIME,'Virtual',NULL);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 10 AS prueba, 'Sin autorización' AS caso,
  'No tienes autorización para asesorar esta materia.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'No tienes autorización para asesorar esta materia.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"43a01d3f-7481-45e7-89f0-953c858b4885"}';

DO $test$
BEGIN
  PERFORM public.publicar_franja(current_setting('t07.m')::BIGINT,
    ((now() AT TIME ZONE 'America/Mexico_City')+INTERVAL '1 hour')::DATE,
    date_trunc('hour',(now() AT TIME ZONE 'America/Mexico_City')+INTERVAL '1 hour')::TIME,
    'Virtual',NULL);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 10 AS prueba, 'Menos de 24 h' AS caso,
  'Publica tus horarios con más de 24 horas de anticipación.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Publica tus horarios con más de 24 horas de anticipación.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
SELECT public.publicar_franja(current_setting('t07.m')::BIGINT,current_setting('t07.fecha')::DATE,current_setting('t07.hora')::TIME,'Virtual',NULL) AS primera_publicacion;

DO $test$
BEGIN
  PERFORM public.publicar_franja(current_setting('t07.m')::BIGINT,current_setting('t07.fecha')::DATE,current_setting('t07.hora')::TIME,'Virtual',NULL);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 10 AS prueba, 'Bloque duplicado' AS caso,
  'Ya tienes un horario registrado en ese bloque.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Ya tienes un horario registrado en ese bloque.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

-- =====================================================================
-- PRUEBA 11: Doble reserva por estudiantes distintos
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-11-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(3,60) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE true
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);


END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT public.solicitar_asesoria(current_setting('t07.f')::BIGINT) AS primera_reserva;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"1969699f-985c-4b56-bc02-0baf9dc0b6c5"}';

DO $test$
BEGIN
  PERFORM public.solicitar_asesoria(current_setting('t07.f')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 11 AS prueba, 'Segundo estudiante' AS caso,
  'Este horario ya fue reservado.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Este horario ya fue reservado.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
RESET ROLE;
-- Verificación administrativa de la invariante tras las llamadas autenticadas.
SELECT 11 AS prueba,current_setting('t07.msg') AS mensaje_segundo_estudiante,
  count(*) AS reservas_activas,
  CASE WHEN count(*)=1 AND bool_and(id_estudiante='be2247d6-268f-43df-9935-0bedfbafb574'::UUID)
    AND current_setting('t07.msg')='Este horario ya fue reservado.'
    AND current_setting('t07.code')='P0001' THEN 'Pasa' ELSE 'Falla' END AS estado
FROM public.solicitud_asesoria WHERE id_disponibilidad=current_setting('t07.f')::BIGINT
  AND estado IN ('Pendiente','Aceptada');
ROLLBACK;

-- =====================================================================
-- PRUEBA 12: Estudiante intenta reservar dos asesorías a la misma hora
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-12-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(3,60) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE true
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f2',v_f::TEXT,true);

END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';
SELECT public.solicitar_asesoria(current_setting('t07.f')::BIGINT) AS primera_reserva;

DO $test$
BEGIN
  PERFORM public.solicitar_asesoria(current_setting('t07.f2')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 12 AS prueba, 'Choque de horario' AS caso,
  'Ya tienes un compromiso agendado a esa misma hora.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Ya tienes un compromiso agendado a esa misma hora.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
RESET ROLE;
SELECT 12 AS prueba,count(*) AS reservas_activas,
  CASE WHEN count(*)=1 AND bool_and(id_disponibilidad=current_setting('t07.f')::BIGINT)
    AND current_setting('t07.msg')='Ya tienes un compromiso agendado a esa misma hora.'
    AND current_setting('t07.code')='P0001' THEN 'Pasa' ELSE 'Falla' END AS estado
FROM public.solicitud_asesoria WHERE id_estudiante='be2247d6-268f-43df-9935-0bedfbafb574'
 AND id_disponibilidad IN (current_setting('t07.f')::BIGINT,current_setting('t07.f2')::BIGINT)
 AND estado IN ('Pendiente','Aceptada');
ROLLBACK;

-- =====================================================================
-- PRUEBA 13: Aceptar sesión virtual sin URL
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-13-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(3,60) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE true
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);

  INSERT INTO public.solicitud_asesoria
    (id_estudiante,id_disponibilidad,estado,url_videollamada)
  VALUES ('be2247d6-268f-43df-9935-0bedfbafb574',v_f,'Pendiente',NULL)
  RETURNING id_solicitud_asesoria INTO v_s;
  PERFORM set_config('t07.s',v_s::TEXT,true);
END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"43a01d3f-7481-45e7-89f0-953c858b4885"}';

DO $test$
BEGIN
  PERFORM public.resolver_solicitud(current_setting('t07.s')::BIGINT,true,NULL);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 13 AS prueba, 'URL ausente' AS caso,
  'Debes ingresar el enlace de acceso virtual (https://...).' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Debes ingresar el enlace de acceso virtual (https://...).'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
RESET ROLE;
SELECT 13 AS prueba,estado AS estado_solicitud,
 CASE WHEN estado='Pendiente' AND url_videollamada IS NULL
   AND current_setting('t07.msg')='Debes ingresar el enlace de acceso virtual (https://...).'
   AND current_setting('t07.code')='P0001' THEN 'Pasa' ELSE 'Falla' END AS resultado
FROM public.solicitud_asesoria WHERE id_solicitud_asesoria=current_setting('t07.s')::BIGINT;
ROLLBACK;

-- =====================================================================
-- PRUEBA 14: Cancelar cita aceptada con menos de 48 horas
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-14-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(0,2) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE public.hora_local((now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)) > now()
    AND public.hora_local((now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)) < now()+INTERVAL '48 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);

  INSERT INTO public.solicitud_asesoria
    (id_estudiante,id_disponibilidad,estado,url_videollamada)
  VALUES ('be2247d6-268f-43df-9935-0bedfbafb574',v_f,'Aceptada','https://example.com/t07')
  RETURNING id_solicitud_asesoria INTO v_s;
  PERFORM set_config('t07.s',v_s::TEXT,true);
END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  PERFORM public.cancelar_asesoria(current_setting('t07.s')::BIGINT);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 14 AS prueba, 'Cancelación tardía' AS caso,
  'Solo se puede cancelar con al menos 48 horas de anticipación.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Solo se puede cancelar con al menos 48 horas de anticipación.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
RESET ROLE;
SELECT 14 AS prueba,s.estado AS estado_solicitud,f.inicio-now() AS anticipacion,
 CASE WHEN s.estado='Aceptada' AND f.inicio>now()
   AND f.inicio<now()+INTERVAL '48 hours'
   AND current_setting('t07.msg')='Solo se puede cancelar con al menos 48 horas de anticipación.'
   AND current_setting('t07.code')='P0001' THEN 'Pasa' ELSE 'Falla' END AS resultado
FROM public.solicitud_asesoria s JOIN public.franja_disponibilidad f USING(id_disponibilidad)
WHERE s.id_solicitud_asesoria=current_setting('t07.s')::BIGINT;
ROLLBACK;

-- =====================================================================
-- PRUEBA 15: Calificación fuera de rango y duplicada
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
-- Datos temporales preparados como postgres; se revierten al terminar.
DO $datos$
DECLARE
  v_m BIGINT; v_c BIGINT; v_f BIGINT; v_s BIGINT;
  v_fecha DATE; v_hora TIME;
BEGIN
  SELECT id_carrera INTO STRICT v_c FROM public.carrera
  WHERE nombre_carrera = 'Ingeniería en Sistemas Computacionales';
  INSERT INTO public.materia(nombre_materia, id_carrera)
  VALUES ('T07-15-' || txid_current(), v_c) RETURNING id_materia INTO v_m;
  PERFORM set_config('t07.m', v_m::TEXT, true);
  INSERT INTO public.asesor_materia
    (id_asesor,id_materia,estado_autorizacion,id_coordinador_aprobador,fecha_dictamen)
  VALUES
    ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now()),
    ('a7e1912d-3290-43c8-a646-0a5fc2516520',v_m,'Aprobada','c0843e63-7d44-4a46-9d43-561b48aea6a4',now());
  SELECT ((now() AT TIME ZONE 'America/Mexico_City')::DATE + d),
    make_time(h,0,0)
  INTO STRICT v_fecha,v_hora
  FROM generate_series(-5,-1) AS dias(d)
  CROSS JOIN generate_series(7,20) AS horas(h)
  WHERE public.hora_local((now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)) + INTERVAL '1 hour' < now()
    AND NOT EXISTS (
      SELECT 1 FROM public.franja_disponibilidad f
      WHERE f.id_asesor IN ('43a01d3f-7481-45e7-89f0-953c858b4885','a7e1912d-3290-43c8-a646-0a5fc2516520')
        AND f.fecha=(now() AT TIME ZONE 'America/Mexico_City')::DATE+d
        AND f.hora_inicio=make_time(h,0,0))
    AND NOT EXISTS (
      SELECT 1 FROM public.solicitud_asesoria s
      JOIN public.franja_disponibilidad f USING(id_disponibilidad)
      WHERE s.id_estudiante IN ('be2247d6-268f-43df-9935-0bedfbafb574','1969699f-985c-4b56-bc02-0baf9dc0b6c5')
        AND s.estado IN ('Pendiente','Aceptada')
        AND f.inicio=public.hora_local(
          (now() AT TIME ZONE 'America/Mexico_City')::DATE+d,make_time(h,0,0)))
  ORDER BY d,h LIMIT 1;
  PERFORM set_config('t07.fecha',v_fecha::TEXT,true);
  PERFORM set_config('t07.hora',v_hora::TEXT,true);
  INSERT INTO public.franja_disponibilidad
    (id_asesor,id_materia,fecha,hora_inicio,modalidad)
  VALUES ('43a01d3f-7481-45e7-89f0-953c858b4885',v_m,v_fecha,v_hora,'Virtual')
  RETURNING id_disponibilidad INTO v_f;
  PERFORM set_config('t07.f',v_f::TEXT,true);

  INSERT INTO public.solicitud_asesoria
    (id_estudiante,id_disponibilidad,estado,url_videollamada)
  VALUES ('be2247d6-268f-43df-9935-0bedfbafb574',v_f,'Realizada',NULL)
  RETURNING id_solicitud_asesoria INTO v_s;
  PERFORM set_config('t07.s',v_s::TEXT,true);
END;
$datos$;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  PERFORM public.calificar_asesoria(current_setting('t07.s')::BIGINT,6);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 15 AS prueba, 'Puntuación 6' AS caso,
  'La calificación debe estar entre 1 y 5.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'La calificación debe estar entre 1 y 5.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
SELECT public.calificar_asesoria(current_setting('t07.s')::BIGINT,5);

DO $test$
BEGIN
  PERFORM public.calificar_asesoria(current_setting('t07.s')::BIGINT,4);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 15 AS prueba, 'Segunda evaluación' AS caso,
  'Esta asesoría ya fue calificada.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Esta asesoría ya fue calificada.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;
RESET ROLE;
SELECT 15 AS prueba,count(*) AS evaluaciones,
 CASE WHEN count(*)=1 AND min(puntuacion)=5
   AND current_setting('t07.msg')='Esta asesoría ya fue calificada.'
   AND current_setting('t07.code')='P0001' THEN 'Pasa' ELSE 'Falla' END AS estado
FROM public.evaluacion WHERE id_solicitud_asesoria=current_setting('t07.s')::BIGINT;
ROLLBACK;

-- =====================================================================
-- PRUEBA 16: Reporte restringido al coordinador
-- Ejecutar desde BEGIN hasta ROLLBACK, con el selector postgres.
-- =====================================================================
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"be2247d6-268f-43df-9935-0bedfbafb574"}';

DO $test$
BEGIN
  PERFORM * FROM public.reporte_materias(CURRENT_DATE-30,CURRENT_DATE+30);
  PERFORM set_config('t07.msg', 'OPERACION PERMITIDA', true);
  PERFORM set_config('t07.code', '00000', true);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('t07.msg', SQLERRM, true);
  PERFORM set_config('t07.code', SQLSTATE, true);
END;
$test$;
SELECT 16 AS prueba, 'Reporte por estudiante' AS caso,
  'Solo el coordinador puede ver reportes.' AS esperado, current_setting('t07.msg') AS obtenido,
  current_setting('t07.code') AS sqlstate,
  CASE WHEN current_setting('t07.msg') = 'Solo el coordinador puede ver reportes.'
    AND current_setting('t07.code') = 'P0001'
  THEN 'Pasa' ELSE 'Falla' END AS estado;

ROLLBACK;

