// =====================================================================
// js/auth.js · Inicio de sesión (T11 · TC-14) y registro por rol (T10 · TC-38)
// HU-001 · CU-001 · RF-001 · RN-01
// Requiere: js/supabase.js (cliente `db`, mostrarError, mostrarExito,
// mostrarCargando). El cierre de sesión vive en js/sesion.js.
// =====================================================================

const DOMINIO = '@pachuca.tecnm.mx';
const MSG_DOMINIO = 'Acceso restringido a cuentas institucionales';
const MSG_CREDENCIALES = 'Correo o contraseña incorrectos';

// ¿El correo termina en el dominio institucional? (RN-01)
function esCorreoInstitucional(correo) {
  return correo.trim().toLowerCase().endsWith(DOMINIO);
}

// ---------------------------------------------------------------------
// INICIO DE SESIÓN (T11)
// ---------------------------------------------------------------------

// Muestra u oculta el error general del formulario de login
function mostrarErrorLogin(mensaje) {
  const caja = document.getElementById('login-error');
  if (!caja) return;
  caja.textContent = mensaje;
  caja.classList.toggle('hidden', !mensaje);
}

// Bloquea el botón mientras se espera la respuesta (evita doble clic)
function botonCargando(boton, cargando) {
  boton.disabled = cargando;
  boton.textContent = cargando ? 'Procesando…' : 'Iniciar sesión';
}

// Inicia sesión con Supabase Auth y manda al panel
async function iniciarSesion(evento) {
  evento.preventDefault();
  mostrarErrorLogin('');

  const correo = document.getElementById('login-correo').value.trim();
  const password = document.getElementById('login-password').value;
  const boton = document.getElementById('btn-login');

  if (!correo || !password) {
    mostrarErrorLogin('Escribe tu correo y tu contraseña.');
    return;
  }
  if (!esCorreoInstitucional(correo)) {
    mostrarErrorLogin(MSG_DOMINIO);
    return;
  }

  botonCargando(boton, true);
  try {
    const { error } = await db.auth.signInWithPassword({ email: correo, password });
    if (error) {
      // Mensaje genérico: no revela si el correo existe (CU-001 EX-01)
      mostrarErrorLogin(MSG_CREDENCIALES);
      return;
    }
    window.location.href = 'panel.html';
  } catch (e) {
    mostrarErrorLogin('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  } finally {
    botonCargando(boton, false);
  }
}

// Si ya hay sesión activa, no tiene caso mostrar el login
async function redirigirSiHaySesion() {
  const { data } = await db.auth.getSession();
  if (data.session) window.location.href = 'panel.html';
}

// Cambia entre las secciones Iniciar sesión / Registro
function activarPestana(cual) {
  const esLogin = cual === 'login';
  document.getElementById('seccion-login').classList.toggle('hidden', !esLogin);
  document.getElementById('seccion-registro').classList.toggle('hidden', esLogin);
}

// ---------------------------------------------------------------------
// REGISTRO POR ROL (T10)
// ---------------------------------------------------------------------

// Llena el select de carreras desde la tabla `carrera`
async function cargarCarreras() {
  const select = document.getElementById('reg-carrera');
  const { data, error } = await db
    .from('carrera')
    .select('id_carrera, nombre_carrera')
    .order('nombre_carrera');

  if (error) {
    select.innerHTML = '<option value="">No se pudieron cargar</option>';
    mostrarError(error.message);
    return;
  }
  select.innerHTML = '<option value="">Selecciona tu carrera</option>';
  data.forEach((c) => {
    const opcion = document.createElement('option');
    opcion.value = c.id_carrera;
    opcion.textContent = c.nombre_carrera;
    select.appendChild(opcion);
  });
}

// Muestra los campos del rol elegido y oculta los del otro
function cambiarRol() {
  const esEstudiante = document.getElementById('reg-rol').value === 'Estudiante';
  document.getElementById('campos-estudiante').classList.toggle('hidden', !esEstudiante);
  document.getElementById('campos-profesor').classList.toggle('hidden', esEstudiante);
}

// Valida el dominio al salir del campo: aviso debajo y botón deshabilitado
function validarCorreoRegistro() {
  const correo = document.getElementById('reg-correo').value.trim();
  const invalido = correo !== '' && !esCorreoInstitucional(correo);
  document.getElementById('reg-correo-aviso').classList.toggle('hidden', !invalido);
  document.getElementById('btn-registro').disabled = invalido;
  return !invalido;
}

// Lee el formulario y devuelve un mensaje de error, o null si todo está bien
function validarRegistro(d) {
  if (!d.nombre || !d.correo || !d.password || !d.password2) {
    return 'Completa todos los campos.';
  }
  if (!esCorreoInstitucional(d.correo)) return MSG_DOMINIO;
  if (d.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
  if (d.password !== d.password2) return 'Las contraseñas no coinciden.';

  if (d.rol === 'Estudiante') {
    if (!d.matricula) return 'Escribe tu matrícula.';
    if (!d.idCarrera) return 'Selecciona tu carrera.';
    if (!Number.isInteger(d.semestre) || d.semestre < 1 || d.semestre > 12) {
      return 'El semestre debe ser un número del 1 al 12.';
    }
  } else {
    if (!d.empleado) return 'Escribe tu número de empleado.';
    if (!d.departamento) return 'Escribe tu departamento.';
  }
  return null;
}

// Crea la cuenta en Supabase Auth y luego su perfil con registrar_perfil
async function registrarUsuario(evento) {
  evento.preventDefault();
  document.getElementById('zona-error').innerHTML = '';

  const valor = (id) => document.getElementById(id).value.trim();
  const d = {
    nombre: valor('reg-nombre'),
    correo: valor('reg-correo').toLowerCase(),
    password: document.getElementById('reg-password').value,
    password2: document.getElementById('reg-password2').value,
    rol: valor('reg-rol'),
    matricula: valor('reg-matricula'),
    idCarrera: valor('reg-carrera'),
    semestre: parseInt(valor('reg-semestre'), 10),
    empleado: valor('reg-empleado'),
    departamento: valor('reg-departamento'),
  };

  // Si falta algo, no se envía nada
  const problema = validarRegistro(d);
  if (problema) { mostrarError(problema); return; }

  const boton = document.getElementById('btn-registro');
  mostrarCargando(boton, true);
  try {
    // 1. Crear la cuenta en Supabase Auth
    const { data, error } = await db.auth.signUp({ email: d.correo, password: d.password });
    if (error) { mostrarError(error.message); return; }
    if (!data.session) {
      mostrarError('La cuenta se creó, pero falta confirmar el correo. Revisa tu bandeja e inicia sesión.');
      return;
    }

    // 2. Crear el perfil en la tabla usuario
    //    Se usa db.rpc (igual que ejecutar) para saber si falló:
    //    registrar_perfil puede no devolver datos aunque salga bien.
    const esEstudiante = d.rol === 'Estudiante';
    const { error: errorPerfil } = await db.rpc('registrar_perfil', {
      p_nombre: d.nombre,
      p_rol: d.rol,
      p_matricula: esEstudiante ? d.matricula : d.empleado,
      p_id_carrera: esEstudiante ? Number(d.idCarrera) : null,
      p_semestre: esEstudiante ? d.semestre : null,
      p_departamento: esEstudiante ? null : d.departamento,
    });
    if (errorPerfil) {
      mostrarError(errorPerfil.message);
      await db.auth.signOut(); // no dejar una sesión sin perfil
      return;
    }

    // 3. Todo bien
    mostrarExito('Cuenta creada correctamente');
    setTimeout(() => (window.location.href = 'panel.html'), 1500);
  } catch (e) {
    mostrarError('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.');
  } finally {
    mostrarCargando(boton, false);
  }
}

// ---------------------------------------------------------------------
// Conecta los eventos solo si estamos en index.html
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  if (!form) return;

  redirigirSiHaySesion();
  form.addEventListener('submit', iniciarSesion);

  // Login: validación del dominio al salir del campo (onBlur, cap. 13.5)
  const campoCorreo = document.getElementById('login-correo');
  campoCorreo.addEventListener('blur', () => {
    const invalido = campoCorreo.value.trim() !== '' && !esCorreoInstitucional(campoCorreo.value);
    document.getElementById('login-correo-aviso').classList.toggle('hidden', !invalido);
    document.getElementById('btn-login').disabled = invalido;
  });

  // Cambiar de pestaña
  document.getElementById('ir-registro').addEventListener('click', (e) => {
    e.preventDefault();
    activarPestana('registro');
  });
  document.getElementById('ir-login').addEventListener('click', (e) => {
    e.preventDefault();
    activarPestana('login');
  });

  // Registro
  const formRegistro = document.getElementById('form-registro');
  if (formRegistro) {
    cargarCarreras();
    cambiarRol();
    document.getElementById('reg-rol').addEventListener('change', cambiarRol);
    document.getElementById('reg-correo').addEventListener('blur', validarCorreoRegistro);
    formRegistro.addEventListener('submit', registrarUsuario);
  }
});