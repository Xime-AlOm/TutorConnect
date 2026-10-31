// =============================================================
// js/sesion.js — TutorConnect
// Protección de páginas por sesión y por rol, cabecera, menú
// y cierre de sesión. Se carga DESPUÉS de js/supabase.js.
//
// Marcas que deben existir en el HTML de las páginas protegidas:
//   <span id="nombre-usuario"></span>      → nombre del usuario
//   <span id="rol-usuario"></span>         → rol del usuario
//   <a data-rol="Coordinador">…</a>        → solo visible para esos roles
//                                            (varios: data-rol="Estudiante Coordinador")
//   <a data-asesor>…</a>                   → solo visible si es asesor aprobado
//                                            (Publicar disponibilidad, Mi agenda)
//   <button id="btn-cerrar-sesion">…</button>
// =============================================================

// Perfil del usuario con sesión (rol, nombre, correo, matrícula, etc.).
let usuarioActual = null;

// 1 y 2. Lee la sesión; si no hay, manda a index.html.
//        Si hay, lee su perfil de la tabla "usuario" y lo guarda en usuarioActual.
async function obtenerUsuario() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  const user = session.user;

  const { data, error } = await db
    .from('usuario')
    .select('*')
    .eq('id_usuario', user.id)
    .single();

  if (error || !data) {
    // Hay sesión pero no perfil: se cierra la sesión para no quedar en un estado raro.
    await db.auth.signOut();
    window.location.href = 'index.html';
    return null;
  }

  usuarioActual = data;
  return usuarioActual;
}

// 3. Si el rol del usuario no está en la lista, lo manda a panel.html.
//    Ejemplo en admin.html: exigirRol('Coordinador');
function exigirRol(...roles) {
  if (!usuarioActual || !roles.includes(usuarioActual.rol)) {
    window.location.href = 'panel.html';
    return false;
  }
  return true;
}

// 4. Devuelve true si el usuario tiene al menos una materia aprobada
//    como asesor (cap. 13.7). Ajusta 'id_usuario' si en v_postulaciones
//    la columna se llama distinto (p. ej. id_estudiante).
async function esAsesorAprobado() {
  if (!usuarioActual) return false;
  const { data, error } = await db
    .from('v_postulaciones')
    .select('estado_autorizacion')
    .eq('id_usuario', usuarioActual.id_usuario)
    .eq('estado_autorizacion', 'Aprobada')
    .limit(1);

  if (error) { mostrarError(error.message); return false; }
  return data.length > 0;
}

// 5. Pinta nombre y rol en la cabecera y muestra/oculta opciones del menú.
async function pintarCabecera() {
  const nombre = document.getElementById('nombre-usuario');
  const rol = document.getElementById('rol-usuario');
  if (nombre) nombre.textContent = usuarioActual.nombre;
  if (rol) rol.textContent = usuarioActual.rol;

  // Opciones por rol
  document.querySelectorAll('[data-rol]').forEach((el) => {
    const permitidos = el.dataset.rol.split(' ');
    el.classList.toggle('hidden', !permitidos.includes(usuarioActual.rol));
  });

  // Opciones solo para asesores aprobados
  const opcionesAsesor = document.querySelectorAll('[data-asesor]');
  if (opcionesAsesor.length) {
    const asesor = await esAsesorAprobado();
    opcionesAsesor.forEach((el) => el.classList.toggle('hidden', !asesor));
  }
}

// 6. Botón Cerrar sesión.
function activarCerrarSesion() {
  const boton = document.getElementById('btn-cerrar-sesion');
  if (!boton) return;
  boton.addEventListener('click', async () => {
    mostrarCargando(boton, true);
    await db.auth.signOut();
    window.location.href = 'index.html';
  });
}

// 7. Procesa citas/solicitudes vencidas (RF-007 / RN-09).
//    Se llama al cargar cada página protegida. Si la función no se
//    puede invocar desde el cliente (permisos), solo se avisa en la
//    consola y el llamado se deja dentro de las operaciones que lo requieran.
async function procesarVencimientos() {
  const { error } = await db.rpc('procesar_vencimientos');
  if (error) console.warn('procesar_vencimientos:', error.message);
}

// Función que llama cada página protegida al cargar.
// Sin argumentos: cualquier usuario con sesión.
// Con roles: solo esos roles. Ej.: iniciarPaginaProtegida('Coordinador')
async function iniciarPaginaProtegida(...roles) {
  const usuario = await obtenerUsuario();
  if (!usuario) return null;
  if (roles.length && !exigirRol(...roles)) return null;

  await pintarCabecera();
  activarCerrarSesion();
  procesarVencimientos(); // sin await: no frena la carga de la página
  return usuario;
}