// Referencia a Supabase (asumiendo que js/supabase.js expone 'db' o 'supabase')
const db = window.supabase || window.db;

// Variables globales para almacenar datos y filtrar sin consultar la BD a cada rato
let materias = [];
let carreras = [];

document.addEventListener('DOMContentLoaded', async () => {
    await cargarCarreras();
    await listarMaterias();
    configurarEventos();
});

function configurarEventos() {
    // Filtros
    document.getElementById('buscadorMateria').addEventListener('input', renderTabla);
    document.getElementById('filtroCarrera').addEventListener('change', renderTabla);
    document.getElementById('filtroEstado').addEventListener('change', renderTabla);

    // Modal
    document.getElementById('btnNuevaMateria').addEventListener('click', () => abrirModal());
    document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
    document.getElementById('formMateria').addEventListener('submit', guardarMateria);
}

// ---------------------------
// OBTENCIÓN DE DATOS
// ---------------------------
async function cargarCarreras() {
    try {
        const { data, error } = await db.from('carrera').select('id_carrera, nombre_carrera').order('nombre_carrera');
        if (error) throw error;
        
        carreras = data;
        const selectFiltro = document.getElementById('filtroCarrera');
        const selectModal = document.getElementById('materiaCarrera');
        
        carreras.forEach(c => {
            const optionFiltro = new Option(c.nombre_carrera, c.id_carrera);
            const optionModal = new Option(c.nombre_carrera, c.id_carrera);
            selectFiltro.add(optionFiltro);
            selectModal.add(optionModal);
        });
    } catch (error) {
        console.error("Error al cargar carreras:", error);
        mostrarToast("Error al cargar las carreras", "error");
    }
}

async function listarMaterias() {
    try {
        // Consulta requerida en la HU
        const { data, error } = await db
            .from('materia')
            .select('id_materia, nombre_materia, estado_activo, id_carrera, carrera(nombre_carrera)')
            .order('nombre_materia');
            
        if (error) throw error;
        
        materias = data;
        renderTabla();
    } catch (error) {
        console.error("Error al listar materias:", error);
        mostrarToast("Error al obtener el catálogo", "error");
    }
}

// ---------------------------
// RENDERIZADO DE TABLA
// ---------------------------
function renderTabla() {
    const tbody = document.getElementById('tablaMaterias');
    const estadoVacio = document.getElementById('estadoVacio');
    
    // Obtener valores de filtros
    const txtBuscar = document.getElementById('buscadorMateria').value.toLowerCase().trim();
    const idCarrera = document.getElementById('filtroCarrera').value;
    const estado = document.getElementById('filtroEstado').value;

    // Aplicar filtros localmente
    const filtradas = materias.filter(m => {
        const coincideTexto = m.nombre_materia.toLowerCase().includes(txtBuscar);
        const coincideCarrera = idCarrera === "" || m.id_carrera == idCarrera;
        const coincideEstado = estado === "todas" || 
                               (estado === "activas" && m.estado_activo) || 
                               (estado === "inactivas" && !m.estado_activo);
        return coincideTexto && coincideCarrera && coincideEstado;
    });

    tbody.innerHTML = '';

    if (filtradas.length === 0) {
        estadoVacio.classList.remove('hidden');
    } else {
        estadoVacio.classList.add('hidden');
        filtradas.forEach(m => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition border-b border-slate-100 last:border-0';
            
            const badgeClase = m.estado_activo ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200';
            const badgeTexto = m.estado_activo ? 'Activa' : 'Inactiva';
            const accionTexto = m.estado_activo ? 'Desactivar' : 'Reactivar';
            const accionClase = m.estado_activo ? 'text-rose-600 hover:bg-rose-50 border-rose-200' : 'text-emerald-600 hover:bg-emerald-50 border-emerald-200';

            tr.innerHTML = `
                <td class="px-4 py-3.5 font-medium text-slate-900">${m.nombre_materia}</td>
                <td class="px-4 py-3.5 text-slate-600">${m.carrera ? m.carrera.nombre_carrera : 'Sin carrera'}</td>
                <td class="px-4 py-3.5 text-center">
                    <span class="px-2 py-1 rounded text-xs font-bold border shadow-sm ${badgeClase}">${badgeTexto}</span>
                </td>
                <td class="px-4 py-3.5 text-center">
                    <div class="flex items-center justify-center space-x-2">
                        <button onclick="abrirModal(${m.id_materia})" class="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">Editar</button>
                        <button onclick="cambiarEstadoMateria(${m.id_materia}, ${m.estado_activo}, '${m.nombre_materia}')" class="bg-white border px-3 py-1.5 rounded text-xs font-bold transition shadow-sm ${accionClase}">${accionTexto}</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// ---------------------------
// LÓGICA DEL MODAL (ALTA Y EDICIÓN)
// ---------------------------
function abrirModal(id = null) {
    const modal = document.getElementById('modalMateria');
    const titulo = document.getElementById('modalTitulo');
    const inputId = document.getElementById('materiaId');
    const inputNombre = document.getElementById('materiaNombre');
    const selectCarrera = document.getElementById('materiaCarrera');
    const errorMsg = document.getElementById('modalError');

    errorMsg.classList.add('hidden');

    if (id) {
        // Modo Edición
        const materia = materias.find(m => m.id_materia === id);
        titulo.textContent = 'Editar materia';
        inputId.value = materia.id_materia;
        inputNombre.value = materia.nombre_materia;
        selectCarrera.value = materia.id_carrera;
    } else {
        // Modo Alta
        titulo.textContent = 'Agregar materia';
        document.getElementById('formMateria').reset();
        inputId.value = '';
    }

    modal.classList.remove('hidden');
    inputNombre.focus();
}

function cerrarModal() {
    document.getElementById('modalMateria').classList.add('hidden');
}

async function guardarMateria(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnGuardarMateria');
    const errorMsg = document.getElementById('modalError');
    
    // Trim para quitar espacios en blanco iniciales o finales (requisito)
    const nombreForm = document.getElementById('materiaNombre').value.trim();
    const idCarreraForm = document.getElementById('materiaCarrera').value;
    const idMateria = document.getElementById('materiaId').value;

    if (!nombreForm || !idCarreraForm) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
    errorMsg.classList.add('hidden');

    try {
        if (idMateria) {
            // EDITAR
            const { error } = await db.from('materia')
                .update({ nombre_materia: nombreForm, id_carrera: idCarreraForm })
                .eq('id_materia', idMateria);
                
            if (error) throw error;
            mostrarToast("Materia actualizada exitosamente");
        } else {
            // ALTA
            const { error } = await db.from('materia')
                .insert({ nombre_materia: nombreForm, id_carrera: idCarreraForm });
                
            if (error) throw error;
            mostrarToast("Materia creada exitosamente");
        }
        
        cerrarModal();
        await listarMaterias(); // Recargar lista
        
    } catch (error) {
        // Manejo del error de duplicado especificado en la HU (uq_materia_nombre_carrera)
        if (error.code === '23505' || error.message.includes('uq_materia_nombre_carrera') || error.message.includes('duplicate')) {
            errorMsg.textContent = "Esa materia ya existe en esta carrera";
            errorMsg.classList.remove('hidden');
        } else {
            errorMsg.textContent = "Ocurrió un error al guardar la materia.";
            errorMsg.classList.remove('hidden');
            console.error(error);
        }
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar';
    }
}

// ---------------------------
// BAJA LÓGICA
// ---------------------------
async function cambiarEstadoMateria(id, estadoActual, nombre) {
    const accion = estadoActual ? 'Desactivar' : 'Reactivar';
    const mensajeConfirmacion = estadoActual 
        ? `¿Desactivar ${nombre}? Dejará de aparecer para asesores y estudiantes, pero su historial se conserva.`
        : `¿Reactivar ${nombre}? Volverá a estar disponible para el registro de asesorías.`;

    if (!window.confirm(mensajeConfirmacion)) return;

    try {
        const { error } = await db.from('materia')
            .update({ estado_activo: !estadoActual })
            .eq('id_materia', id);

        if (error) throw error;
        
        mostrarToast(`Materia ${estadoActual ? 'desactivada' : 'reactivada'} exitosamente`);
        await listarMaterias(); // Recargar lista
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        mostrarToast("Error al cambiar el estado de la materia", "error");
    }
}

// ---------------------------
// TOASTS (Notificaciones)
// ---------------------------
function mostrarToast(mensaje, tipo = "success") {
    const contenedor = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const bgClase = tipo === "success" ? "bg-emerald-600" : "bg-rose-600";
    toast.className = `${bgClase} text-white px-4 py-3 rounded shadow-lg flex items-center gap-2 transform transition-all duration-300 opacity-0 translate-y-2`;
    
    toast.innerHTML = `
        <span class="text-sm font-bold">${mensaje}</span>
    `;
    
    contenedor.appendChild(toast);
    
    // Animar entrada
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
    });

    // Remover después de 3 segundos (requisito de la HU)
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}