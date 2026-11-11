-- T19b · Semana 3. Ejecutar COMPLETO en SQL Editor, selector postgres.
-- Requisitos: esquema V3 y datos_prueba.sql instalados; no crea cuentas.
-- Fechas calculadas en America/Mexico_City en cada ejecución.
-- Acuerdo: escenario 4 usa horas legales cercanas a 3 h y 47 h;
-- el resultado muestra la antigüedad REAL, siempre menor que 48 h.
-- Repetir renueva SOLO los IDs registrados por este script y cambia sus IDs.
-- Si alguien reserva una franja libre o evalúa una cita del lote, se detiene
-- para proteger su trabajo: coordinar con esa persona antes de renovar.
-- No borrar esc3_admin: contiene el inventario de propiedad del lote.
-- Las ubicaciones virtuales contienen una etiqueta de control, no un aula.
-- Las URL example.com son datos de prueba, no salas de videollamada reales.
-- Los avisos ajenos se conservan; el total no leído puede superar 3 y 12.
-- Si ocurre un error, ejecutar ROLLBACK; y corregir la causa antes de repetir.

BEGIN;
SET LOCAL TIME ZONE 'America/Mexico_City';
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(731919);
CREATE SCHEMA IF NOT EXISTS esc3_admin;
REVOKE ALL ON SCHEMA esc3_admin FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS esc3_admin.franjas (
  id BIGINT PRIMARY KEY, codigo TEXT UNIQUE NOT NULL, escenario INT NOT NULL,
  solicitud BIGINT UNIQUE, etiqueta TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS esc3_admin.avisos (id BIGINT PRIMARY KEY);
REVOKE ALL ON ALL TABLES IN SCHEMA esc3_admin FROM PUBLIC, anon, authenticated;
LOCK TABLE public.franja_disponibilidad, public.solicitud_asesoria,
  public.evaluacion, public.notificacion IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  profesor UUID; tutor UUID; estudiante2 UUID; estudiante3 UUID;
  bd BIGINT; fundamentos BIGINT;
  hoy DATE := (now() AT TIME ZONE 'America/Mexico_City')::date;
  r RECORD; candidato RECORD; asesor UUID; alumno UUID; materia BIGINT;
  franja BIGINT; solicitud BIGINT; aviso BIGINT; etiqueta TEXT; i INT;
BEGIN
  SELECT id_usuario INTO profesor FROM public.usuario
    WHERE correo_institucional='profesor1@pachuca.tecnm.mx' AND rol='Profesor';
  SELECT id_usuario INTO tutor FROM public.usuario
    WHERE correo_institucional='tutor1@pachuca.tecnm.mx' AND rol='Estudiante';
  SELECT id_usuario INTO estudiante2 FROM public.usuario
    WHERE correo_institucional='estudiante2@pachuca.tecnm.mx' AND rol='Estudiante';
  SELECT id_usuario INTO estudiante3 FROM public.usuario
    WHERE correo_institucional='estudiante3@pachuca.tecnm.mx' AND rol='Estudiante';
  SELECT m.id_materia INTO bd FROM public.materia m JOIN public.carrera c USING(id_carrera)
    WHERE m.nombre_materia='Base de Datos' AND m.estado_activo
      AND c.nombre_carrera='Ingeniería en Sistemas Computacionales';
  SELECT m.id_materia INTO fundamentos FROM public.materia m JOIN public.carrera c USING(id_carrera)
    WHERE m.nombre_materia='Fundamentos de Programación' AND m.estado_activo
      AND c.nombre_carrera='Ingeniería en Sistemas Computacionales';
  IF profesor IS NULL OR tutor IS NULL OR estudiante2 IS NULL OR estudiante3 IS NULL
     OR bd IS NULL OR fundamentos IS NULL THEN
    RAISE EXCEPTION 'Faltan perfiles o materias activas de T04. No se modificó el lote.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.asesor_materia WHERE id_asesor=profesor
      AND id_materia=bd AND estado_autorizacion='Aprobada')
     OR NOT EXISTS (SELECT 1 FROM public.asesor_materia WHERE id_asesor=tutor
      AND id_materia=fundamentos AND estado_autorizacion='Aprobada') THEN
    RAISE EXCEPTION 'Falta autorización aprobada para profesor1 o tutor1.';
  END IF;

  -- Proteger referencias creadas por compañeros y cualquier evaluación.
  IF EXISTS (SELECT 1 FROM public.solicitud_asesoria s JOIN esc3_admin.franjas f
      ON f.id=s.id_disponibilidad WHERE s.id_solicitud_asesoria IS DISTINCT FROM f.solicitud)
    OR EXISTS (SELECT 1 FROM public.evaluacion e JOIN esc3_admin.franjas f
      ON f.solicitud=e.id_solicitud_asesoria)
    OR EXISTS (SELECT 1 FROM public.solicitud_asesoria s JOIN esc3_admin.franjas f
      ON f.solicitud=s.id_solicitud_asesoria WHERE s.id_disponibilidad<>f.id)
    OR EXISTS (SELECT 1 FROM public.franja_disponibilidad p JOIN esc3_admin.franjas f
      ON f.id=p.id_disponibilidad WHERE p.ubicacion_presencial IS DISTINCT FROM f.etiqueta) THEN
    RAISE EXCEPTION 'ESC3 tiene reservas/evaluaciones nuevas o referencias modificadas. Coordinar con el equipo; no se borró nada.';
  END IF;
  DELETE FROM public.solicitud_asesoria s USING esc3_admin.franjas f
    WHERE s.id_solicitud_asesoria=f.solicitud AND s.id_disponibilidad=f.id;
  DELETE FROM public.franja_disponibilidad p USING esc3_admin.franjas f
    WHERE p.id_disponibilidad=f.id;
  DELETE FROM public.notificacion n USING esc3_admin.avisos a WHERE n.id_notificacion=a.id;
  DELETE FROM esc3_admin.franjas;
  DELETE FROM esc3_admin.avisos;

  -- A/P = profesor1/Bases; T = tutor1/Fundamentos. Alumno 2 o 3.
  -- dias fija el día local; edad busca un fin cercano en horas, dentro del rango.
  FOR r IN SELECT * FROM (VALUES
    ('E1-P3',1,'P',3,10,'Presencial',NULL::text,2,NULL::int,0,0),
    ('E1-P4',1,'P',4,10,'Virtual',NULL,2,NULL,0,0),
    ('E1-T3',1,'T',3,10,'Virtual',NULL,2,NULL,0,0),
    ('E1-T4',1,'T',4,10,'Presencial',NULL,2,NULL,0,0),
    ('E2-P2',2,'P',5,10,'Presencial','Pendiente',2,NULL,0,0),
    ('E2-T3',2,'T',5,11,'Presencial','Pendiente',3,NULL,0,0),
    ('E2-PV',2,'P',6,10,'Virtual','Pendiente',3,NULL,0,0),
    ('E3-MAS48',3,'P',3,14,'Presencial','Aceptada',2,NULL,0,0),
    ('E3-MENOS48',3,'T',1,12,'Virtual','Aceptada',3,NULL,0,0),
    ('E4-CERCA3',4,'P',0,10,'Presencial','Aceptada',2,3,0,24),
    ('E4-CERCA47',4,'T',0,10,'Virtual','Aceptada',3,47,24,48),
    ('E5-DIA3',5,'P',-3,10,'Presencial','Realizada',2,NULL,0,0),
    ('E5-DIA8',5,'T',-8,12,'Virtual','Realizada',3,NULL,0,0),
    ('E6-NOREAL',6,'P',-2,14,'Presencial','No realizada',2,NULL,0,0)
  ) AS v(codigo,escenario,quien,dias,hora,modalidad,estado,estudiante,edad,minedad,maxedad)
  LOOP
    asesor := CASE r.quien WHEN 'P' THEN profesor ELSE tutor END;
    materia := CASE r.quien WHEN 'P' THEN bd ELSE fundamentos END;
    alumno := CASE r.estudiante WHEN 2 THEN estudiante2 ELSE estudiante3 END;
    SELECT x.* INTO candidato FROM (
      SELECT hoy+d AS fecha, make_time(h,0,0) AS hora,
        public.hora_local(hoy+d,make_time(h,0,0)) AS inicio,
        public.hora_local(hoy+d,make_time(h+1,0,0)) AS fin
      FROM generate_series(-3,6) d CROSS JOIN generate_series(7,20) h
      WHERE (r.edad IS NOT NULL OR d=r.dias)
      UNION ALL
      SELECT hoy+r.dias,make_time(h,0,0),
        public.hora_local(hoy+r.dias,make_time(h,0,0)),
        public.hora_local(hoy+r.dias,make_time(h+1,0,0))
      FROM generate_series(7,20) h WHERE r.edad IS NULL AND r.dias < -3
    ) x
    WHERE (r.edad IS NULL OR (x.fin < now()-make_interval(hours=>r.minedad)
      AND x.fin > now()-make_interval(hours=>r.maxedad)))
      AND NOT EXISTS (SELECT 1 FROM public.franja_disponibilidad f
        WHERE f.id_asesor=asesor AND f.inicio=x.inicio)
      AND (r.estado IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.solicitud_asesoria s JOIN public.franja_disponibilidad f USING(id_disponibilidad)
        WHERE s.id_estudiante=alumno AND s.estado IN ('Pendiente','Aceptada') AND f.inicio=x.inicio))
    ORDER BY CASE WHEN r.edad IS NOT NULL
      THEN abs(extract(epoch FROM (x.fin-(now()-make_interval(hours=>r.edad)))))
      ELSE abs(extract(hour FROM x.hora)-r.hora) END, x.inicio
    LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'No hay bloque legal libre para %. No se aplicó ningún cambio.',r.codigo; END IF;
    etiqueta := 'ESC3 · T19b · '||r.codigo||CASE WHEN r.modalidad='Presencial' THEN ' · Aula de prueba' ELSE ' · Virtual' END;
    INSERT INTO public.franja_disponibilidad
      (id_asesor,id_materia,fecha,hora_inicio,modalidad,ubicacion_presencial)
      VALUES (asesor,materia,candidato.fecha,candidato.hora,r.modalidad,etiqueta)
      RETURNING id_disponibilidad INTO franja;
    solicitud := NULL;
    IF r.estado IS NOT NULL THEN
      INSERT INTO public.solicitud_asesoria
        (id_estudiante,id_disponibilidad,estado,url_videollamada,fecha_creacion,fecha_actualizacion)
      VALUES (alumno,franja,r.estado,
        CASE WHEN r.modalidad='Virtual' AND r.estado<>'Pendiente' THEN 'https://example.com/esc3/'||r.codigo END,
        least(now(),candidato.inicio-interval '3 days'),least(now(),candidato.fin))
      RETURNING id_solicitud_asesoria INTO solicitud;
    END IF;
    INSERT INTO esc3_admin.franjas VALUES(franja,r.codigo,r.escenario,solicitud,etiqueta);
  END LOOP;
  FOR i IN 1..15 LOOP
    INSERT INTO public.notificacion(id_usuario,mensaje,leida)
    VALUES(CASE WHEN i<=3 THEN estudiante2 ELSE profesor END,
      '[ESC3] T19b · Aviso de prueba '||i,FALSE) RETURNING id_notificacion INTO aviso;
    INSERT INTO esc3_admin.avisos VALUES(aviso);
  END LOOP;
END $$;

-- Verificación del estado real, no solo del número de filas insertadas.
DROP TABLE IF EXISTS pg_temp.esc3_verificacion;
CREATE TEMP TABLE esc3_verificacion ON COMMIT PRESERVE ROWS AS
WITH lote AS (
 SELECT a.*, f.inicio,f.fin,f.modalidad,s.estado,
   NOT EXISTS(SELECT 1 FROM public.evaluacion e WHERE e.id_solicitud_asesoria=a.solicitud) sin_evaluacion
 FROM esc3_admin.franjas a JOIN public.franja_disponibilidad f ON f.id_disponibilidad=a.id
 LEFT JOIN public.solicitud_asesoria s ON s.id_solicitud_asesoria=a.solicitud
), resultados AS (
 SELECT escenario,count(*)::int cantidad,
   bool_and(CASE escenario
     WHEN 1 THEN inicio>now()+interval '24 hours' AND NOT EXISTS
       (SELECT 1 FROM public.solicitud_asesoria s WHERE s.id_disponibilidad=lote.id AND s.estado IN ('Pendiente','Aceptada'))
     WHEN 2 THEN estado='Pendiente' AND inicio>now()+interval '48 hours'
     WHEN 3 THEN estado='Aceptada' AND CASE codigo WHEN 'E3-MAS48' THEN inicio>now()+interval '48 hours'
       ELSE inicio>now() AND inicio<now()+interval '48 hours' END
     WHEN 4 THEN estado='Aceptada' AND fin<now() AND fin>now()-interval '48 hours'
     WHEN 5 THEN estado='Realizada' AND sin_evaluacion AND CASE codigo WHEN 'E5-DIA3'
       THEN fin<now() AND fin>now()-interval '7 days' ELSE fin<now()-interval '7 days' END
     WHEN 6 THEN estado='No realizada' AND sin_evaluacion END) correcto,
   string_agg(codigo||': franja '||id||coalesce(', solicitud '||solicitud,'')||
     CASE WHEN escenario=4 THEN ', fin hace '||round(extract(epoch FROM(now()-fin))/3600,2)||' h' ELSE '' END,'; ' ORDER BY codigo) detalle
 FROM lote GROUP BY escenario
 UNION ALL
 SELECT 7,count(*)::int,
   count(*) FILTER(WHERE NOT n.leida AND u.correo_institucional='estudiante2@pachuca.tecnm.mx')=3
   AND count(*) FILTER(WHERE NOT n.leida AND u.correo_institucional='profesor1@pachuca.tecnm.mx')=12,
   '3 avisos no leídos para estudiante2; 12 para profesor1. Se conservan avisos ajenos.'
 FROM esc3_admin.avisos a JOIN public.notificacion n ON n.id_notificacion=a.id
 JOIN public.usuario u USING(id_usuario)
)
SELECT e.numero AS escenario,e.nombre,e.esperado,coalesce(r.cantidad,0) AS obtenido,
 CASE WHEN r.cantidad=e.esperado AND r.correcto THEN 'Pasa' ELSE 'Falla' END AS estado,r.detalle
FROM (VALUES (1,'Franjas libres',4),(2,'Solicitudes pendientes: 2 presenciales y 1 virtual',3),
 (3,'Aceptadas: más y menos de 48 h',2),(4,'Aceptadas sin cerrar: antigüedad aproximada',2),
 (5,'Realizadas: dentro y fuera de 7 días',2),(6,'No realizada',1),(7,'Avisos no leídos',15)) e(numero,nombre,esperado)
LEFT JOIN resultados r ON r.escenario=e.numero;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_temp.esc3_verificacion WHERE estado<>'Pasa') THEN
   RAISE EXCEPTION 'Falló la verificación ESC3. Se revierte el lote completo.';
 END IF;
END $$;
COMMIT;
SELECT * FROM pg_temp.esc3_verificacion ORDER BY escenario;
