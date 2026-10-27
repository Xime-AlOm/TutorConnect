-- =====================================================================
-- PROYECTO: TutorConnect - TecNM Campus Pachuca
-- ESQUEMA DE BASE DE DATOS - VERSION V3 (alcance alcanzable)
-- Gestor: PostgreSQL (Supabase). Se ejecuta completo en el SQL Editor.

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------
CREATE TABLE carrera (
  id_carrera      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_carrera  VARCHAR(100) NOT NULL,
  CONSTRAINT uq_carrera_nombre UNIQUE (nombre_carrera)
);

CREATE TABLE usuario (
  id_usuario             UUID PRIMARY KEY REFERENCES auth.users(id),
  correo_institucional   VARCHAR(150) NOT NULL,
  nombre_completo        VARCHAR(150) NOT NULL,
  rol                    VARCHAR(20)  NOT NULL,
  matricula_num_empleado VARCHAR(20)  NOT NULL,
  id_carrera             BIGINT,        -- solo estudiantes
  semestre               INT,           -- solo estudiantes
  departamento           VARCHAR(100),  -- profesores y coordinadores
  fecha_registro         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_usuario_correo    UNIQUE (correo_institucional),
  CONSTRAINT uq_usuario_matricula UNIQUE (matricula_num_empleado),
  CONSTRAINT fk_usuario_carrera   FOREIGN KEY (id_carrera) REFERENCES carrera(id_carrera),
  CONSTRAINT chk_usuario_correo   CHECK (correo_institucional LIKE '%@pachuca.tecnm.mx'),
  CONSTRAINT chk_usuario_rol      CHECK (rol IN ('Estudiante', 'Profesor', 'Coordinador')),
  CONSTRAINT chk_usuario_semestre CHECK (semestre IS NULL OR semestre BETWEEN 1 AND 14),
  CONSTRAINT chk_usuario_datos_estudiante
    CHECK (rol <> 'Estudiante' OR (id_carrera IS NOT NULL AND semestre IS NOT NULL))
);

CREATE TABLE materia (
  id_materia     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre_materia VARCHAR(150) NOT NULL,
  id_carrera     BIGINT NOT NULL,
  estado_activo  BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_materia_carrera FOREIGN KEY (id_carrera) REFERENCES carrera(id_carrera),
  CONSTRAINT uq_materia_nombre_carrera UNIQUE (nombre_materia, id_carrera)
);

-- Autorizacion por materia: la usan alumnos tutores y profesores.
CREATE TABLE asesor_materia (
  id_asesor_materia        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_asesor                UUID   NOT NULL,
  id_materia               BIGINT NOT NULL,
  estado_autorizacion      VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
  id_coordinador_aprobador UUID,
  fecha_solicitud          TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_dictamen           TIMESTAMPTZ,
  CONSTRAINT uq_asemat_asesor_materia UNIQUE (id_asesor, id_materia),
  CONSTRAINT fk_asemat_asesor      FOREIGN KEY (id_asesor) REFERENCES usuario(id_usuario),
  CONSTRAINT fk_asemat_materia     FOREIGN KEY (id_materia) REFERENCES materia(id_materia),
  CONSTRAINT fk_asemat_coordinador FOREIGN KEY (id_coordinador_aprobador) REFERENCES usuario(id_usuario),
  CONSTRAINT chk_asemat_estado CHECK (estado_autorizacion IN ('Pendiente', 'Aprobada', 'Rechazada'))
);

-- Convierte fecha + hora local (Ciudad de Mexico) a un instante con zona horaria.
-- Se declara IMMUTABLE para poder usarla en columnas calculadas; es seguro porque
-- Mexico ya no aplica horario de verano (UTC-6 todo el año).
CREATE OR REPLACE FUNCTION hora_local(p_fecha DATE, p_hora TIME) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql IMMUTABLE AS $$ BEGIN RETURN timezone('America/Mexico_City', p_fecha + p_hora); END $$;

CREATE TABLE franja_disponibilidad (
  id_disponibilidad    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_asesor            UUID   NOT NULL,
  id_materia           BIGINT NOT NULL,
  fecha                DATE   NOT NULL,
  hora_inicio          TIME   NOT NULL,
  modalidad            VARCHAR(20) NOT NULL,
  ubicacion_presencial VARCHAR(255),
  -- inicio y fin calculados en hora de la Ciudad de Mexico
  inicio TIMESTAMPTZ GENERATED ALWAYS AS (hora_local(fecha, hora_inicio)) STORED,
  fin    TIMESTAMPTZ GENERATED ALWAYS AS (hora_local(fecha, hora_inicio + INTERVAL '1 hour')) STORED,
  CONSTRAINT fk_franja_asesor  FOREIGN KEY (id_asesor)  REFERENCES usuario(id_usuario),
  CONSTRAINT fk_franja_materia FOREIGN KEY (id_materia) REFERENCES materia(id_materia),
  -- bloques cerrados de 1 hora: inicio en hora exacta (07:00 ... 20:00)
  CONSTRAINT chk_franja_hora CHECK (date_part('minute', hora_inicio) = 0
                                    AND date_part('second', hora_inicio) = 0
                                    AND hora_inicio BETWEEN TIME '07:00' AND TIME '20:00'),
  CONSTRAINT chk_franja_modalidad CHECK (modalidad IN ('Presencial', 'Virtual')),
  CONSTRAINT chk_franja_ubicacion CHECK (modalidad = 'Virtual'
                                         OR (ubicacion_presencial IS NOT NULL AND btrim(ubicacion_presencial) <> '')),
  -- un asesor no puede publicar dos franjas en el mismo bloque
  CONSTRAINT uq_franja_asesor_bloque UNIQUE (id_asesor, fecha, hora_inicio)
);

CREATE TABLE solicitud_asesoria (
  id_solicitud_asesoria BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_estudiante         UUID   NOT NULL,
  id_disponibilidad     BIGINT NOT NULL,
  estado                VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
  url_videollamada      VARCHAR(255),
  fecha_creacion        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_actualizacion   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_solasesoria_estudiante FOREIGN KEY (id_estudiante) REFERENCES usuario(id_usuario),
  CONSTRAINT fk_solasesoria_disponibilidad FOREIGN KEY (id_disponibilidad)
    REFERENCES franja_disponibilidad(id_disponibilidad),
  CONSTRAINT chk_solasesoria_estado CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Cancelada',
                                                      'Caducada', 'Realizada', 'No realizada', 'Sin registro')),
  CONSTRAINT chk_solasesoria_url CHECK (url_videollamada IS NULL OR url_videollamada LIKE 'https://%')
);

CREATE TABLE evaluacion (
  id_evaluacion         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_solicitud_asesoria BIGINT NOT NULL,
  puntuacion            INT NOT NULL,
  fecha_registro        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- sin campos de texto: RN-07 se garantiza desde el esquema
  CONSTRAINT uq_evaluacion_solicitud UNIQUE (id_solicitud_asesoria),
  CONSTRAINT fk_evaluacion_solicitud FOREIGN KEY (id_solicitud_asesoria)
    REFERENCES solicitud_asesoria(id_solicitud_asesoria) ON DELETE CASCADE,
  CONSTRAINT chk_evaluacion_puntuacion CHECK (puntuacion BETWEEN 1 AND 5)
);

-- Notificaciones internas (sustituyen al correo en esta version)
CREATE TABLE notificacion (
  id_notificacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_usuario      UUID NOT NULL,
  mensaje         VARCHAR(255) NOT NULL,
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  fecha           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_notificacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

-- ---------------------------------------------------------------------
-- 2. INDICES
-- ---------------------------------------------------------------------
-- Una sola solicitud activa por franja (protege la doble reserva aunque
-- dos peticiones lleguen al mismo tiempo).
CREATE UNIQUE INDEX idx_solasesoria_activa_slot
  ON solicitud_asesoria (id_disponibilidad)
  WHERE estado IN ('Pendiente', 'Aceptada');

CREATE INDEX idx_franja_busqueda        ON franja_disponibilidad (id_materia, fecha);
CREATE INDEX idx_solasesoria_estudiante ON solicitud_asesoria (id_estudiante, estado);
CREATE INDEX idx_notificacion_usuario   ON notificacion (id_usuario, leida);

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE APOYO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mi_rol() RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM usuario WHERE id_usuario = auth.uid();
$$;

CREATE OR REPLACE FUNCTION notificar(p_usuario UUID, p_mensaje TEXT) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO notificacion (id_usuario, mensaje) VALUES (p_usuario, left(p_mensaje, 255));
$$;

-- Procesa todos los vencimientos de tiempo. Se llama al inicio de cada
-- operacion y al cargar las pantallas; tambien puede programarse con pg_cron.
CREATE OR REPLACE FUNCTION procesar_vencimientos() RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  -- RN-05: pendientes a 24 h o menos de la cita pasan a Caducada
  FOR r IN
    UPDATE solicitud_asesoria s SET estado = 'Caducada', fecha_actualizacion = now()
    FROM franja_disponibilidad f
    WHERE s.id_disponibilidad = f.id_disponibilidad
      AND s.estado = 'Pendiente'
      AND f.inicio <= now() + INTERVAL '24 hours'
    RETURNING s.id_estudiante, f.id_asesor, f.fecha, f.hora_inicio
  LOOP
    PERFORM notificar(r.id_estudiante, 'Tu solicitud del ' || r.fecha || ' ' || to_char(r.hora_inicio, 'HH24:MI') || ' caducó: el asesor no respondió a tiempo.');
    PERFORM notificar(r.id_asesor, 'La solicitud del ' || r.fecha || ' ' || to_char(r.hora_inicio, 'HH24:MI') || ' caducó por falta de respuesta.');
  END LOOP;

  -- RN-09: aceptadas que el asesor no cerro 48 h despues del fin pasan a Sin registro
  UPDATE solicitud_asesoria s SET estado = 'Sin registro', fecha_actualizacion = now()
  FROM franja_disponibilidad f
  WHERE s.id_disponibilidad = f.id_disponibilidad
    AND s.estado = 'Aceptada'
    AND f.fin + INTERVAL '48 hours' <= now();
END;
$$;

-- ---------------------------------------------------------------------
-- 4. OPERACIONES DEL SISTEMA (se llaman desde JavaScript con supabase.rpc)
-- ---------------------------------------------------------------------

-- RF-001: crear el perfil despues de supabase.auth.signUp
CREATE OR REPLACE FUNCTION registrar_perfil(
  p_nombre TEXT, p_rol TEXT, p_matricula TEXT,
  p_id_carrera BIGINT DEFAULT NULL, p_semestre INT DEFAULT NULL, p_departamento TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_correo TEXT;
BEGIN
  SELECT email INTO v_correo FROM auth.users WHERE id = auth.uid();
  IF v_correo IS NULL THEN RAISE EXCEPTION 'Debes iniciar sesión.'; END IF;
  IF v_correo NOT LIKE '%@pachuca.tecnm.mx' THEN
    RAISE EXCEPTION 'Acceso restringido a cuentas institucionales.';
  END IF;
  IF p_rol NOT IN ('Estudiante', 'Profesor') THEN
    RAISE EXCEPTION 'Solo estudiantes y profesores pueden registrarse.';
  END IF;
  INSERT INTO usuario (id_usuario, correo_institucional, nombre_completo, rol,
                       matricula_num_empleado, id_carrera, semestre, departamento)
  VALUES (auth.uid(), v_correo, p_nombre, p_rol, p_matricula,
          CASE WHEN p_rol = 'Estudiante' THEN p_id_carrera END,
          CASE WHEN p_rol = 'Estudiante' THEN p_semestre END,
          CASE WHEN p_rol = 'Profesor' THEN p_departamento END);
END;
$$;

-- RF-003: un estudiante o profesor pide autorizacion para asesorar una materia
CREATE OR REPLACE FUNCTION postular_materia(p_id_materia BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF mi_rol() NOT IN ('Estudiante', 'Profesor') THEN RAISE EXCEPTION 'Operación no permitida.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM materia WHERE id_materia = p_id_materia AND estado_activo) THEN
    RAISE EXCEPTION 'La materia no existe o está inactiva.';
  END IF;
  IF EXISTS (SELECT 1 FROM asesor_materia WHERE id_asesor = auth.uid() AND id_materia = p_id_materia) THEN
    RAISE EXCEPTION 'Ya enviaste una solicitud para esta materia.';
  END IF;
  INSERT INTO asesor_materia (id_asesor, id_materia) VALUES (auth.uid(), p_id_materia);
END;
$$;

-- RF-003: el coordinador aprueba o rechaza
CREATE OR REPLACE FUNCTION dictaminar_postulacion(p_id BIGINT, p_aprobar BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_asesor UUID; v_materia TEXT;
BEGIN
  IF mi_rol() IS DISTINCT FROM 'Coordinador' THEN RAISE EXCEPTION 'Solo el coordinador puede dictaminar.'; END IF;
  UPDATE asesor_materia
     SET estado_autorizacion = CASE WHEN p_aprobar THEN 'Aprobada' ELSE 'Rechazada' END,
         id_coordinador_aprobador = auth.uid(), fecha_dictamen = now()
   WHERE id_asesor_materia = p_id AND estado_autorizacion = 'Pendiente'
  RETURNING id_asesor INTO v_asesor;
  IF v_asesor IS NULL THEN RAISE EXCEPTION 'La postulación no existe o ya fue dictaminada.'; END IF;
  SELECT m.nombre_materia INTO v_materia FROM asesor_materia a JOIN materia m USING (id_materia)
   WHERE a.id_asesor_materia = p_id;
  PERFORM notificar(v_asesor, 'Tu solicitud para asesorar ' || v_materia || ' fue '
                    || CASE WHEN p_aprobar THEN 'aprobada.' ELSE 'rechazada.' END);
END;
$$;

-- RF-004: publicar una franja de 1 hora
CREATE OR REPLACE FUNCTION publicar_franja(
  p_id_materia BIGINT, p_fecha DATE, p_hora TIME, p_modalidad TEXT, p_ubicacion TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM asesor_materia a JOIN materia m USING (id_materia)
                 WHERE a.id_asesor = auth.uid() AND a.id_materia = p_id_materia
                   AND a.estado_autorizacion = 'Aprobada' AND m.estado_activo) THEN
    RAISE EXCEPTION 'No tienes autorización para asesorar esta materia.';
  END IF;
  IF hora_local(p_fecha, p_hora) <= now() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Publica tus horarios con más de 24 horas de anticipación.';
  END IF;
  IF EXISTS (SELECT 1 FROM franja_disponibilidad
             WHERE id_asesor = auth.uid() AND fecha = p_fecha AND hora_inicio = p_hora) THEN
    RAISE EXCEPTION 'Ya tienes un horario registrado en ese bloque.';
  END IF;
  INSERT INTO franja_disponibilidad (id_asesor, id_materia, fecha, hora_inicio, modalidad, ubicacion_presencial)
  VALUES (auth.uid(), p_id_materia, p_fecha, p_hora, p_modalidad,
          CASE WHEN p_modalidad = 'Presencial' THEN p_ubicacion END)
  RETURNING id_disponibilidad INTO v_id;
  RETURN v_id;
END;
$$;

-- Retirar una franja propia que nadie ha solicitado
CREATE OR REPLACE FUNCTION eliminar_franja(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM solicitud_asesoria WHERE id_disponibilidad = p_id) THEN
    RAISE EXCEPTION 'No se puede eliminar: el horario ya tiene solicitudes registradas.';
  END IF;
  DELETE FROM franja_disponibilidad WHERE id_disponibilidad = p_id AND id_asesor = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Horario no encontrado.'; END IF;
END;
$$;

-- RF-005: solicitar una asesoria (congela la franja)
CREATE OR REPLACE FUNCTION solicitar_asesoria(p_id_disponibilidad BIGINT)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f franja_disponibilidad%ROWTYPE; v_id BIGINT;
BEGIN
  PERFORM procesar_vencimientos();
  IF mi_rol() IS DISTINCT FROM 'Estudiante' THEN RAISE EXCEPTION 'Solo los estudiantes pueden solicitar asesorías.'; END IF;
  SELECT * INTO f FROM franja_disponibilidad WHERE id_disponibilidad = p_id_disponibilidad;
  IF NOT FOUND THEN RAISE EXCEPTION 'El horario no existe.'; END IF;
  IF f.id_asesor = auth.uid() THEN RAISE EXCEPTION 'No puedes solicitar tu propio horario.'; END IF;
  IF f.inicio <= now() + INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'Solo puedes solicitar horarios con más de 24 horas de anticipación.';
  END IF;
  -- RN-03: el estudiante no puede tener otra cita activa en el mismo bloque
  IF EXISTS (SELECT 1 FROM solicitud_asesoria s JOIN franja_disponibilidad x USING (id_disponibilidad)
             WHERE s.id_estudiante = auth.uid() AND s.estado IN ('Pendiente', 'Aceptada')
               AND x.inicio = f.inicio) THEN
    RAISE EXCEPTION 'Ya tienes un compromiso agendado a esa misma hora.';
  END IF;
  BEGIN
    INSERT INTO solicitud_asesoria (id_estudiante, id_disponibilidad)
    VALUES (auth.uid(), p_id_disponibilidad) RETURNING id_solicitud_asesoria INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horario ya fue reservado.';
  END;
  PERFORM notificar(f.id_asesor, 'Nueva solicitud de asesoría para el ' || f.fecha || ' a las ' || to_char(f.hora_inicio, 'HH24:MI') || '.');
  RETURN v_id;
END;
$$;

-- RF-006: aceptar (con URL si es virtual) o rechazar
CREATE OR REPLACE FUNCTION resolver_solicitud(p_id BIGINT, p_aceptar BOOLEAN, p_url TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s solicitud_asesoria%ROWTYPE; f franja_disponibilidad%ROWTYPE;
BEGIN
  PERFORM procesar_vencimientos();
  SELECT * INTO s FROM solicitud_asesoria WHERE id_solicitud_asesoria = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  SELECT * INTO f FROM franja_disponibilidad WHERE id_disponibilidad = s.id_disponibilidad;
  IF f.id_asesor <> auth.uid() THEN RAISE EXCEPTION 'Esta solicitud no es tuya.'; END IF;
  IF s.estado <> 'Pendiente' THEN RAISE EXCEPTION 'La solicitud ya no está pendiente (%).', s.estado; END IF;

  IF NOT p_aceptar THEN
    UPDATE solicitud_asesoria SET estado = 'Rechazada', fecha_actualizacion = now() WHERE id_solicitud_asesoria = p_id;
    PERFORM notificar(s.id_estudiante, 'Tu solicitud del ' || f.fecha || ' ' || to_char(f.hora_inicio, 'HH24:MI') || ' fue rechazada.');
    RETURN;
  END IF;

  IF f.modalidad = 'Virtual' AND (p_url IS NULL OR p_url NOT LIKE 'https://_%') THEN
    RAISE EXCEPTION 'Debes ingresar el enlace de acceso virtual (https://...).';
  END IF;
  -- RN-03: el asesor no puede tener otra cita aceptada en el mismo bloque
  -- (se cubre con uq_franja_asesor_bloque: una franja por bloque)
  UPDATE solicitud_asesoria
     SET estado = 'Aceptada',
         url_videollamada = CASE WHEN f.modalidad = 'Virtual' THEN p_url END,
         fecha_actualizacion = now()
   WHERE id_solicitud_asesoria = p_id;
  PERFORM notificar(s.id_estudiante, 'Tu asesoría del ' || f.fecha || ' ' || to_char(f.hora_inicio, 'HH24:MI') || ' fue confirmada.');
END;
$$;

-- RF-008: cancelar. Pendiente: el estudiante puede retirarla en cualquier momento.
-- Aceptada: estudiante o asesor, con al menos 48 h de anticipacion.
CREATE OR REPLACE FUNCTION cancelar_asesoria(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s solicitud_asesoria%ROWTYPE; f franja_disponibilidad%ROWTYPE; v_otro UUID;
BEGIN
  PERFORM procesar_vencimientos();
  SELECT * INTO s FROM solicitud_asesoria WHERE id_solicitud_asesoria = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  SELECT * INTO f FROM franja_disponibilidad WHERE id_disponibilidad = s.id_disponibilidad;
  IF auth.uid() NOT IN (s.id_estudiante, f.id_asesor) THEN RAISE EXCEPTION 'Esta asesoría no es tuya.'; END IF;

  IF s.estado = 'Pendiente' AND auth.uid() = s.id_estudiante THEN
    NULL; -- retiro de una solicitud pendiente
  ELSIF s.estado = 'Aceptada' THEN
    IF f.inicio - now() < INTERVAL '48 hours' THEN
      RAISE EXCEPTION 'Solo se puede cancelar con al menos 48 horas de anticipación.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Esta asesoría no se puede cancelar (%).', s.estado;
  END IF;

  UPDATE solicitud_asesoria SET estado = 'Cancelada', fecha_actualizacion = now() WHERE id_solicitud_asesoria = p_id;
  v_otro := CASE WHEN auth.uid() = s.id_estudiante THEN f.id_asesor ELSE s.id_estudiante END;
  PERFORM notificar(v_otro, 'La asesoría del ' || f.fecha || ' ' || to_char(f.hora_inicio, 'HH24:MI') || ' fue cancelada.');
END;
$$;

-- RF-009: el asesor marca el resultado cuando termina la hora
CREATE OR REPLACE FUNCTION marcar_resultado(p_id BIGINT, p_realizada BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s solicitud_asesoria%ROWTYPE; f franja_disponibilidad%ROWTYPE;
BEGIN
  PERFORM procesar_vencimientos();
  SELECT * INTO s FROM solicitud_asesoria WHERE id_solicitud_asesoria = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada.'; END IF;
  SELECT * INTO f FROM franja_disponibilidad WHERE id_disponibilidad = s.id_disponibilidad;
  IF f.id_asesor <> auth.uid() THEN RAISE EXCEPTION 'Esta asesoría no es tuya.'; END IF;
  IF s.estado <> 'Aceptada' THEN RAISE EXCEPTION 'Solo se cierran asesorías aceptadas (%).', s.estado; END IF;
  IF now() < f.fin THEN RAISE EXCEPTION 'La asesoría aún no termina.'; END IF;
  UPDATE solicitud_asesoria
     SET estado = CASE WHEN p_realizada THEN 'Realizada' ELSE 'No realizada' END,
         fecha_actualizacion = now()
   WHERE id_solicitud_asesoria = p_id;
END;
$$;

-- RF-010: calificar de 1 a 5, dentro de los 7 dias posteriores a la sesion
CREATE OR REPLACE FUNCTION calificar_asesoria(p_id BIGINT, p_puntuacion INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s solicitud_asesoria%ROWTYPE; f franja_disponibilidad%ROWTYPE;
BEGIN
  SELECT * INTO s FROM solicitud_asesoria WHERE id_solicitud_asesoria = p_id;
  IF NOT FOUND OR s.id_estudiante <> auth.uid() THEN RAISE EXCEPTION 'Asesoría no encontrada.'; END IF;
  IF s.estado <> 'Realizada' THEN RAISE EXCEPTION 'Solo se califican asesorías realizadas.'; END IF;
  SELECT * INTO f FROM franja_disponibilidad WHERE id_disponibilidad = s.id_disponibilidad;
  IF now() > f.fin + INTERVAL '7 days' THEN RAISE EXCEPTION 'El periodo de evaluación ha expirado.'; END IF;
  IF p_puntuacion NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'La calificación debe estar entre 1 y 5.'; END IF;
  BEGIN
    INSERT INTO evaluacion (id_solicitud_asesoria, puntuacion) VALUES (p_id, p_puntuacion);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Esta asesoría ya fue calificada.';
  END;
END;
$$;

CREATE OR REPLACE FUNCTION marcar_notificaciones_leidas()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notificacion SET leida = TRUE WHERE id_usuario = auth.uid() AND NOT leida;
$$;

-- RF-012: reporte del coordinador por periodo
CREATE OR REPLACE FUNCTION reporte_materias(p_desde DATE, p_hasta DATE)
RETURNS TABLE (materia TEXT, solicitadas BIGINT, realizadas BIGINT, no_realizadas BIGINT,
               canceladas BIGINT, caducadas BIGINT, promedio NUMERIC)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF mi_rol() IS DISTINCT FROM 'Coordinador' THEN RAISE EXCEPTION 'Solo el coordinador puede ver reportes.'; END IF;
  RETURN QUERY
  SELECT m.nombre_materia::TEXT,
         count(s.*),
         count(*) FILTER (WHERE s.estado = 'Realizada'),
         count(*) FILTER (WHERE s.estado IN ('No realizada', 'Sin registro')),
         count(*) FILTER (WHERE s.estado = 'Cancelada'),
         count(*) FILTER (WHERE s.estado IN ('Caducada', 'Rechazada')),
         round(avg(e.puntuacion), 2)
  FROM solicitud_asesoria s
  JOIN franja_disponibilidad f USING (id_disponibilidad)
  JOIN materia m USING (id_materia)
  LEFT JOIN evaluacion e USING (id_solicitud_asesoria)
  WHERE f.fecha BETWEEN p_desde AND p_hasta
  GROUP BY m.nombre_materia
  ORDER BY count(s.*) DESC;
END;
$$;

-- ---------------------------------------------------------------------
-- 5. VISTAS DE LECTURA (una por pantalla; filtran por el usuario conectado)
-- ---------------------------------------------------------------------
-- Promedio publico por asesor
CREATE VIEW v_promedio_asesor AS
SELECT f.id_asesor, round(avg(e.puntuacion), 1) AS promedio, count(e.*) AS num_evaluaciones
FROM evaluacion e
JOIN solicitud_asesoria s USING (id_solicitud_asesoria)
JOIN franja_disponibilidad f USING (id_disponibilidad)
GROUP BY f.id_asesor;

-- SCR-003: franjas libres para buscar (sin solicitud activa, con mas de 24 h)
CREATE VIEW v_franjas_disponibles AS
SELECT f.id_disponibilidad, f.fecha, f.hora_inicio, f.modalidad, f.ubicacion_presencial,
       m.id_materia, m.nombre_materia, u.id_usuario AS id_asesor, u.nombre_completo AS asesor,
       (u.rol = 'Estudiante') AS es_tutor_par, p.promedio, coalesce(p.num_evaluaciones, 0) AS num_evaluaciones
FROM franja_disponibilidad f
JOIN materia m ON m.id_materia = f.id_materia AND m.estado_activo
JOIN usuario u ON u.id_usuario = f.id_asesor
LEFT JOIN v_promedio_asesor p ON p.id_asesor = f.id_asesor
WHERE f.inicio > now() + INTERVAL '24 hours'
  AND auth.uid() IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM solicitud_asesoria s
                  WHERE s.id_disponibilidad = f.id_disponibilidad AND s.estado IN ('Pendiente', 'Aceptada'));

-- SCR-004: agenda del asesor con el estado de cada franja calculado
CREATE VIEW v_mi_agenda AS
SELECT f.id_disponibilidad, f.fecha, f.hora_inicio, f.modalidad, f.ubicacion_presencial,
       m.nombre_materia,
       CASE (SELECT s.estado FROM solicitud_asesoria s
              WHERE s.id_disponibilidad = f.id_disponibilidad AND s.estado IN ('Pendiente', 'Aceptada'))
         WHEN 'Pendiente' THEN 'Congelado'
         WHEN 'Aceptada'  THEN 'Ocupado'
         ELSE CASE WHEN f.inicio <= now() THEN 'Vencido' ELSE 'Libre' END
       END AS estado_franja
FROM franja_disponibilidad f
JOIN materia m USING (id_materia)
WHERE f.id_asesor = auth.uid();

-- SCR-005: citas del usuario (como estudiante o como asesor)
CREATE VIEW v_mis_citas AS
SELECT s.id_solicitud_asesoria, s.estado, s.fecha_creacion,
       f.fecha, f.hora_inicio, f.modalidad, f.ubicacion_presencial,
       CASE WHEN s.estado IN ('Aceptada', 'Realizada', 'No realizada', 'Sin registro')
            THEN s.url_videollamada END AS url_videollamada,
       m.nombre_materia,
       ue.nombre_completo AS estudiante, ua.nombre_completo AS asesor,
       CASE WHEN s.id_estudiante = auth.uid() THEN 'Estudiante' ELSE 'Asesor' END AS mi_papel,
       e.puntuacion,
       (s.estado = 'Aceptada' AND f.inicio > now() AND f.inicio <= now() + INTERVAL '24 hours') AS es_proxima,
       ((s.estado = 'Pendiente' AND s.id_estudiante = auth.uid())
         OR (s.estado = 'Aceptada' AND f.inicio - now() >= INTERVAL '48 hours')) AS puede_cancelar,
       (s.estado = 'Aceptada' AND f.id_asesor = auth.uid() AND now() >= f.fin) AS puede_marcar,
       (s.estado = 'Realizada' AND s.id_estudiante = auth.uid() AND e.id_evaluacion IS NULL
         AND now() <= f.fin + INTERVAL '7 days') AS puede_calificar,
       CASE WHEN s.estado = 'Realizada' AND e.id_evaluacion IS NOT NULL THEN 'Evaluada'
            WHEN s.estado = 'Realizada' AND now() > f.fin + INTERVAL '7 days' THEN 'Cerrada sin evaluar'
            ELSE s.estado END AS estado_mostrado
FROM solicitud_asesoria s
JOIN franja_disponibilidad f USING (id_disponibilidad)
JOIN materia m ON m.id_materia = f.id_materia
JOIN usuario ue ON ue.id_usuario = s.id_estudiante
JOIN usuario ua ON ua.id_usuario = f.id_asesor
LEFT JOIN evaluacion e ON e.id_solicitud_asesoria = s.id_solicitud_asesoria
WHERE s.id_estudiante = auth.uid() OR f.id_asesor = auth.uid();

-- SCR-006 / SCR-007: postulaciones (el usuario ve las suyas; el coordinador, todas)
CREATE VIEW v_postulaciones AS
SELECT a.id_asesor_materia, a.estado_autorizacion, a.fecha_solicitud, a.fecha_dictamen,
       m.id_materia, m.nombre_materia, u.nombre_completo AS solicitante, u.rol AS rol_solicitante
FROM asesor_materia a
JOIN materia m USING (id_materia)
JOIN usuario u ON u.id_usuario = a.id_asesor
WHERE a.id_asesor = auth.uid() OR mi_rol() = 'Coordinador';

-- ---------------------------------------------------------------------
-- 6. SEGURIDAD POR FILAS (RLS)
-- Regla general: se puede LEER lo necesario; las ESCRITURAS se hacen solo
-- con las funciones anteriores. Sin politica de escritura = escritura denegada.
-- ---------------------------------------------------------------------
ALTER TABLE carrera               ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario               ENABLE ROW LEVEL SECURITY;
ALTER TABLE materia               ENABLE ROW LEVEL SECURITY;
ALTER TABLE asesor_materia        ENABLE ROW LEVEL SECURITY;
ALTER TABLE franja_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitud_asesoria    ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluacion            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacion          ENABLE ROW LEVEL SECURITY;

-- Carreras: cualquiera puede leerlas (se necesitan en el formulario de registro)
CREATE POLICY carreras_lectura ON carrera FOR SELECT USING (true);

-- Usuario: cada quien ve su perfil; el coordinador ve todos
CREATE POLICY usuario_propio ON usuario FOR SELECT TO authenticated
  USING (id_usuario = auth.uid() OR mi_rol() = 'Coordinador');

-- Materias: todos leen las activas; el coordinador lee y administra todas (RF-002)
CREATE POLICY materias_lectura ON materia FOR SELECT TO authenticated
  USING (estado_activo OR mi_rol() = 'Coordinador');
CREATE POLICY materias_coordinador_alta ON materia FOR INSERT TO authenticated
  WITH CHECK (mi_rol() = 'Coordinador');
CREATE POLICY materias_coordinador_cambio ON materia FOR UPDATE TO authenticated
  USING (mi_rol() = 'Coordinador') WITH CHECK (mi_rol() = 'Coordinador');

-- Notificaciones: cada quien lee las suyas
CREATE POLICY notificaciones_propias ON notificacion FOR SELECT TO authenticated
  USING (id_usuario = auth.uid());

-- Las demas tablas se leen a traves de las vistas de la seccion 5.
-- Permisos de las vistas y funciones para usuarios autenticados:
-- (Supabase da permisos por defecto a anon y authenticated; aqui se ajustan)
REVOKE ALL ON v_franjas_disponibles, v_mi_agenda, v_mis_citas, v_postulaciones, v_promedio_asesor FROM anon, authenticated;
GRANT SELECT ON v_franjas_disponibles, v_mi_agenda, v_mis_citas, v_postulaciones, v_promedio_asesor TO authenticated;
-- notificar() es interna: nadie la llama desde el navegador
REVOKE EXECUTE ON FUNCTION notificar(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. DATOS INICIALES (ejemplo; ajustar a la reticula real)
-- ---------------------------------------------------------------------
INSERT INTO carrera (nombre_carrera) VALUES
  ('Ingeniería en Sistemas Computacionales'),
  ('Ingeniería Industrial'),
  ('Ingeniería Civil');

-- ---------------------------------------------------------------------
-- 8. OPCIONAL: programar los vencimientos cada 15 minutos con pg_cron
-- (Supabase: Database > Extensions > activar pg_cron). Si no se activa,
-- el sistema funciona igual porque cada operacion llama a
-- procesar_vencimientos() antes de trabajar.
-- ---------------------------------------------------------------------
-- SELECT cron.schedule('procesar-vencimientos', '*/15 * * * *', 'SELECT procesar_vencimientos()');

-- ---------------------------------------------------------------------
-- 9. ALTA MANUAL DEL COORDINADOR (una sola vez)
-- 1) Authentication > Users > Add user (correo @pachuca.tecnm.mx y contraseña).
-- 2) Copiar su id y ejecutar:
-- INSERT INTO usuario (id_usuario, correo_institucional, nombre_completo, rol, matricula_num_empleado, departamento)
-- VALUES ('<uuid>', 'coordinacion@pachuca.tecnm.mx', 'Nombre del coordinador', 'Coordinador', 'EMP-0001', 'Sistemas y Computación');
-- =====================================================================