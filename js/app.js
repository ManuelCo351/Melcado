// ==========================================
// 1. CONFIGURACIÓN SUPABASE
// ==========================================
const SUPABASE_URL = 'https://hlwjnvhqnviqdtjprcqy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AGycHAbKvjW5I81KoMSCzA_FlmWZhEx';

// CORRECCIÓN AQUÍ: Usamos 'window.supabase' para acceder a la librería
// y llamamos a nuestra variable 'db' para no confundir al navegador.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let perfilesCache = []; 
let perfilActualId = null;

// ==========================================
// 2. INICIALIZACIÓN Y REAL-TIME
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await cargarPerfiles();

    // Escuchar cambios (Usamos 'db' en vez de 'supabase')
    db.channel('tabla-trabajadoras')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trabajadoras' }, (payload) => {
            console.log('Cambio detectado!', payload);
            cargarPerfiles();
        })
        .subscribe();
});

// ==========================================
// 3. LÓGICA DE DATOS (CRUD)
// ==========================================

async function cargarPerfiles() {
    mostrarSkeleton(true);
    
    // Usamos 'db'
    const { data, error } = await db
        .from('trabajadoras')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error cargando:', error);
        // Si sale este error, es culpa de los permisos (Paso 2 de la solución)
        return;
    }

    perfilesCache = data;
    mostrarSkeleton(false);
    renderizar(perfilesCache);
}

async function guardarNuevoPerfil() {
    const btn = document.querySelector('#modal-agregar .btn-primary');
    btn.innerHTML = 'Guardando...'; btn.disabled = true;

    const nuevoPerfil = {
        nombre: document.getElementById('input-nombre').value,
        categoria: document.getElementById('input-categoria').value,
        precio: Number(document.getElementById('input-precio').value),
        oral: Number(document.getElementById('input-oral').value),
        movilidad: Number(document.getElementById('input-movilidad').value),
        whatsapp: document.getElementById('input-whatsapp').value,
        foto: document.getElementById('input-foto-url').value || 'assets/default-user.jpg'
    };

    if (!nuevoPerfil.nombre || !nuevoPerfil.precio) {
        alert("¡Faltan datos obligatorios!");
        btn.innerHTML = 'PUBLICAR AHORA'; btn.disabled = false;
        return; 
    }

    // Usamos 'db'
    const { error } = await db.from('trabajadoras').insert([nuevoPerfil]);

    if (error) {
        alert('Error al guardar: ' + error.message);
        console.error(error);
    } else {
        cerrarModales();
        limpiarFormulario();
    }
    
    btn.innerHTML = 'PUBLICAR AHORA'; btn.disabled = false;
}

// ==========================================
// 4. SISTEMA DE COMENTARIOS
// ==========================================

async function cargarComentarios(idTrabajadora) {
    const listaDiv = document.getElementById('lista-comentarios');
    // ... (Tu código de promedio va aquí, asegúrate de que esté) ...
    // Solo pondré la carga para resumir
    
    listaDiv.innerHTML = '<div class="spinner"></div>';

    // Usamos 'db'
    const { data, error } = await db
        .from('comentarios')
        .select('*')
        .eq('trabajadora_id', idTrabajadora)
        .order('created_at', { ascending: false });

    listaDiv.innerHTML = ''; 

    if (!data || data.length === 0) {
        listaDiv.innerHTML = '<p style="color:#666; font-style:italic;">Sé el primero en opinar...</p>';
        return;
    }

    // Aquí iría tu lógica de pintar comentarios y promedios...
    // (Asegúrate de copiar la lógica de promedios del mensaje anterior)
    
    data.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-bubble animate-fade-in';
        div.innerHTML = `<small>${new Date(c.created_at).toLocaleDateString()}</small><br>${c.texto}`;
        listaDiv.appendChild(div);
    });
}

async function publicarComentario() {
    const input = document.getElementById('txt-comentario');
    const puntaje = document.getElementById('puntaje-seleccionado')?.value || 5;
    const texto = input.value.trim();
    if (!texto) return;

    // Usamos 'db'
    const { error } = await db
        .from('comentarios')
        .insert([{ trabajadora_id: perfilActualId, texto: texto, puntaje: parseInt(puntaje) }]);

    if (error) alert('Error comentando');
    else {
        input.value = '';
        cargarComentarios(perfilActualId);
    }
}

// ==========================================
// 5. MANEJO DE IMÁGENES
// ==========================================

document.getElementById('input-file-api').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const previewDiv = document.getElementById('upload-preview');
    const imgPreview = document.getElementById('img-preview');
    const loader = document.getElementById('loading-api');
    
    previewDiv.classList.remove('hidden');
    loader.classList.remove('hidden');
    imgPreview.src = URL.createObjectURL(file);

    try {
        console.log("Subiendo...");
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`; // Limpieza de nombre
        
        // Usamos 'db' para storage también
        const { data, error } = await db.storage.from('fotos').upload(fileName, file);
        
        if(error) throw error;
        
        const urlFinal = db.storage.from('fotos').getPublicUrl(fileName).data.publicUrl;

        document.getElementById('input-foto-url').value = urlFinal;
        loader.classList.add('hidden'); 

    } catch (error) {
        console.error(error);
        alert("Falló la subida: " + error.message);
        loader.classList.add('hidden');
    }
});
// ==========================================
// 6. RENDERIZADO Y UI (Visual)
// ==========================================

function renderizar(lista) {
    const contenedor = document.getElementById('contenedor-cards');
    const noResults = document.getElementById('no-results');
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        noResults.classList.remove('hidden');
        return;
    } else {
        noResults.classList.add('hidden');
    }

    lista.forEach(item => {
        // Cálculo matemático
        const calidad = ((item.oral + item.movilidad) / 2);
        const ratio = item.precio > 0 ? ((calidad / item.precio) * 1000).toFixed(0) : 0;

        const card = document.createElement('div');
        card.className = 'card animate-zoom-in';
        card.innerHTML = `
            <div class="badge">${item.categoria}</div>
            <img src="${item.foto}" alt="${item.nombre}" loading="lazy">
            <div class="card-body">
                <h3>${item.nombre}</h3>
                <div class="card-price">$${item.precio}</div>
                <div style="font-size:0.85rem; color:#888; margin-bottom:10px;">
                    👄 ${item.oral} | 🏃 ${item.movilidad} <br>
                    🔥 Ratio: <strong>${ratio}</strong> pts
                </div>
                <button class="btn btn-primary" style="width:100%" onclick="abrirDetalle(${item.id})">
                    VER & CONTRATAR
                </button>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

async function abrirDetalle(id) {
    perfilActualId = id;
    const perfil = perfilesCache.find(p => p.id === id);
    const modal = document.getElementById('modal-detalle');
    const contenido = document.getElementById('detalle-content-dinamico');

    contenido.innerHTML = `
        <img src="${perfil.foto}" style="width:100%; height:250px; object-fit:cover; border-radius:8px; margin-bottom:15px;">
        <h2 style="font-size:2rem; margin-bottom:5px;">${perfil.nombre}</h2>
        <h3 style="color:var(--primary); font-size:1.5rem;">$ ${perfil.precio}</h3>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:20px 0; background:#111; padding:15px; border-radius:8px;">
            <div style="text-align:center">
                <span style="display:block; font-size:2rem;">👄</span>
                <strong>${perfil.oral}/10</strong><br><small>Oral</small>
            </div>
            <div style="text-align:center">
                <span style="display:block; font-size:2rem;">🏃</span>
                <strong>${perfil.movilidad}/10</strong><br><small>Movilidad</small>
            </div>
        </div>

        <button class="btn btn-primary glow" style="width:100%; background:#25D366; color:white;" 
            onclick="window.open('https://wa.me/${perfil.whatsapp}?text=Hola, te vi en Mercado Rojo...', '_blank')">
            <span class="material-icons-round">whatsapp</span> CONTACTAR AHORA
        </button>
    `;

    // Cargar comentarios
    cargarComentarios(id);
    
    modal.classList.remove('hidden');
}

// Filtros y Búsqueda
function filtrar(categoria, btn) {
    document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (categoria === 'todos') {
        renderizar(perfilesCache);
    } else {
        renderizar(perfilesCache.filter(p => p.categoria === categoria));
    }
}

document.getElementById('buscador').addEventListener('keyup', (e) => {
    const term = e.target.value.toLowerCase();
    const filtrados = perfilesCache.filter(p => p.nombre.toLowerCase().includes(term));
    renderizar(filtrados);
});

function ordenarProductos() {
    const criterio = document.getElementById('ordenar').value;
    let copia = [...perfilesCache];

    if (criterio === 'barato') copia.sort((a,b) => a.precio - b.precio);
    if (criterio === 'oral') copia.sort((a,b) => b.oral - a.oral);
    if (criterio === 'calidadPrecio') {
        copia.sort((a, b) => {
            const rA = ((a.oral + a.movilidad)/2) / a.precio;
            const rB = ((b.oral + b.movilidad)/2) / b.precio;
            return rB - rA;
        });
    }
    renderizar(copia);
}

// Utilidades UI
function mostrarSkeleton(show) {
    const skels = document.querySelectorAll('.skeleton');
    skels.forEach(s => s.style.display = show ? 'block' : 'none');
}

function abrirModalAgregar() { document.getElementById('modal-agregar').classList.remove('hidden'); }
function cerrarModales() { document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden')); }
function limpiarFormulario() {
    document.getElementById('input-nombre').value = '';
    document.getElementById('input-precio').value = '';
    document.getElementById('input-foto-url').value = '';
    document.getElementById('upload-preview').classList.add('hidden');
}
  
