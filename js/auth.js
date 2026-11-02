// Manejo de autenticación e inicialización
function iniciarSesion(e) {
  e.preventDefault();
  const correo = document.getElementById('correo').value;
  // Validación de dominio requerida en el esquema SQL (usuario_correo)
  if(!correo.endsWith('@pachuca.tecnm.mx')) {
    alert("Debe usar correo institucional");
    return;
  }
}