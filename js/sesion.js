/* =========================================================
   TutorConnect — js/sesion.js
   Protección de páginas por sesión y por rol.
   Requiere cargar antes js/supabase.js (usa db y ejecutar).

   Uso en cada página protegida (al final del <body>):
     <script>iniciarPaginaProtegida();</script>
   Solo para el coordinador (admin.html):
     <script>iniciarPaginaProtegida('Coordinador');</script>

   Elementos que la página puede tener en su cabecera:
     <span id="nombre-usuario"></span>
     <span id="rol-usuario"></span>
     <button id="btn-cerrar-sesion">Cerrar sesión</button>
   Opciones del menú:
     data-rol="Coordinador"   → solo se ve para ese rol (o varios separados por coma)
     data-asesor              → solo se ve si es asesor aprobado
                                (Publicar disponibilidad, Mi agenda)
   ========================================================= */

// Perfil del usuario con sesión (rol, nombre, correo, matrícula, etc.).
let usuarioActual = null;

/* ---------------------------------------------------------
   obtenerUsuario()
   Revisa la sesión. Sin sesión → manda a index.html.
   Con sesión → lee su perfil de la tabla usuario y lo
   guarda en usuarioActual.
   --------------------------------------------------------- */
async function obtenerUsuario() {
  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    window.location.replace('index.html');
    return null;
  }

  const user = session.user;
  const { data, error } = await db
    .from('usuario')
    .select('*')
    .eq('id_usuario', user.id)
    .single();

  if (error || !data) {
    // Hay sesión pero no hay perfil: se cierra para evitar estados raros.
    mostrarError(error ? error.message : 'No se encontró el perfil del usuario.');
    await db.auth.signOut();
    window.location.replace('index.html');
    return null;
  }

  usuarioActual = data;
  return usuarioActual;
}

/* ---------------------------------------------------------
   exigirRol(...roles)
   Si el rol del usuario no está en la lista → manda a panel.html.
   Regresa true si sí tiene permiso.
   Ej.: exigirRol('Coordinador')
   --------------------------------------------------------- */
function exigirRol(...roles) {
  if (!usuarioActual || !roles.includes(usuarioActual.rol)) {
    window.location.replace('panel.html');
    return false;
  }
  return true;
}

/* ---------------------------------------------------------
   esAsesorAprobado()
   true si el usuario tiene al menos una materia con
   estado_autorizacion = 'Aprobada' en v_postulaciones.
   --------------------------------------------------------- */
async function esAsesorAprobado() {
  if (!usuarioActual) return false;

  // v_postulaciones ya limita los resultados al usuario autenticado
  // (o devuelve todas las filas si el usuario es Coordinador).
  const { count, error } = await db
    .from('v_postulaciones')
    .select('id_asesor_materia', { count: 'exact', head: true })
    .eq('estado_autorizacion', 'Aprobada');

  if (error) {
    mostrarError(error.message);
    return false;
  }
  return count > 0;
}

/* ---------------------------------------------------------
   pintarCabecera()
   Escribe nombre y rol en la cabecera.
   --------------------------------------------------------- */
function pintarCabecera() {
  const nombre = document.getElementById('nombre-usuario');
  const rol = document.getElementById('rol-usuario');
  if (nombre) nombre.textContent = usuarioActual.nombre;
  if (rol) rol.textContent = usuarioActual.rol;
}

/* ---------------------------------------------------------
   configurarMenu()
   Muestra u oculta opciones según el rol y si es asesor aprobado.
   --------------------------------------------------------- */
async function configurarMenu() {
  // Opciones limitadas por rol
  document.querySelectorAll('[data-rol]').forEach((el) => {
    const permitidos = el.dataset.rol.split(',').map((r) => r.trim());
    el.classList.toggle('hidden', !permitidos.includes(usuarioActual.rol));
  });

  // Opciones solo para asesores aprobados
  const opcionesAsesor = document.querySelectorAll('[data-asesor]');
  if (opcionesAsesor.length > 0) {
    const aprobado = await esAsesorAprobado();
    opcionesAsesor.forEach((el) => el.classList.toggle('hidden', !aprobado));
  }
}

/* ---------------------------------------------------------
   cerrarSesion()
   Cierra la sesión y regresa a index.html.
   --------------------------------------------------------- */
async function cerrarSesion() {
  await db.auth.signOut();
  window.location.replace('index.html');
}

/* ---------------------------------------------------------
   iniciarPaginaProtegida(...roles)
   Hace todo en orden al cargar una página protegida:
   sesión → rol → vencimientos → cabecera → menú → cerrar sesión.
   Sin roles = cualquier usuario con sesión puede entrar.
   --------------------------------------------------------- */
async function iniciarPaginaProtegida(...roles) {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;

  if (roles.length > 0 && !exigirRol(...roles)) return null;

  // RF-007 / RN-09: actualizar asesorías vencidas en cada carga.
  // Si la función no se puede llamar desde el cliente, mostrará el error;
  // en ese caso se documenta y el llamado pasa a las operaciones.
  await ejecutar('procesar_vencimientos');

  pintarCabecera();
  await configurarMenu();

  const btnSalir = document.getElementById('btn-cerrar-sesion');
  if (btnSalir) btnSalir.addEventListener('click', cerrarSesion);

  return usuarioActual;
}