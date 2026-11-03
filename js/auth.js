// =====================================================================
// js/auth.js · Inicio y cierre de sesión (T11 · TC-14 · HU-001 · CU-001)
// Requiere: js/supabase.js (crea el cliente `db`)
// El cierre de sesión vive en js/sesion.js (cerrarSesion), que usan
// todas las páginas protegidas.
// =====================================================================

const DOMINIO = '@pachuca.tecnm.mx';
const MSG_DOMINIO = 'Acceso restringido a cuentas institucionales';
const MSG_CREDENCIALES = 'Correo o contraseña incorrectos';

// ¿El correo termina en el dominio institucional? (RN-01)
function esCorreoInstitucional(correo) {
  return correo.trim().toLowerCase().endsWith(DOMINIO);
}

// Muestra u oculta el error general del formulario
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

  // Validaciones en pantalla (la base de datos vuelve a validar el dominio)
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

// Cambia entre las secciones Iniciar sesión / Registro (T10)
function activarPestana(cual) {
  const esLogin = cual === 'login';
  document.getElementById('seccion-login').classList.toggle('hidden', !esLogin);
  document.getElementById('seccion-registro').classList.toggle('hidden', esLogin);
}

// Conecta los eventos solo si estamos en index.html
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('form-login');
  if (!form) return;

  redirigirSiHaySesion();
  form.addEventListener('submit', iniciarSesion);

  // Validación del dominio al salir del campo (onBlur, cap. 13.5)
  const campoCorreo = document.getElementById('login-correo');
  campoCorreo.addEventListener('blur', () => {
    const invalido = campoCorreo.value.trim() !== '' && !esCorreoInstitucional(campoCorreo.value);
    document.getElementById('login-correo-aviso').classList.toggle('hidden', !invalido);
    document.getElementById('btn-login').disabled = invalido;
  });

  document.getElementById('ir-registro').addEventListener('click', (e) => {
    e.preventDefault();
    activarPestana('registro');
  });
  document.getElementById('ir-login').addEventListener('click', (e) => {
    e.preventDefault();
    activarPestana('login');
  });
});
