// =========================================
// MÓDULO DE SEGURIDAD, LOGIN Y PERMISOS
// =========================================
const TODAS_LAS_PESTANAS = [
    { id: 'panel-diario', nombre: '📝 Registro Diario' },
    { id: 'panel-lotes', nombre: '🐔 Ficha de Lotes' },
    { id: 'panel-almacen', nombre: '🏭 Almacén de Insumos' },
    { id: 'panel-productos', nombre: '📦 Catálogo de Productos' },
    { id: 'panel-empaque', nombre: '🥚 Clasificación y Empaque' },
    { id: 'panel-facturacion', nombre: '🛒 Punto de Venta' },
    { id: 'panel-clientes', nombre: '👥 Directorio de Clientes' },
    { id: 'panel-historial-facturas', nombre: '🧾 Historial de Facturas' },
    { id: 'panel-finanzas', nombre: '💰 Finanzas y Balances' },
    { id: 'panel-graficos', nombre: '📊 Gráficos Estadísticos' },
    { id: 'panel-historial', nombre: '📚 Historial General' },
    { id: 'panel-corrector', nombre: '✏️ Corrector de Bitácoras' },
    { id: 'panel-usuarios', nombre: '🛡️ Gestión de Usuarios' }
];

document.addEventListener("DOMContentLoaded", () => {
    extraerTasaBCV();
    verificarSesionActiva(); 
});

function verificarSesionActiva() {
    let sesion = localStorage.getItem("sesionLaComarca");
    let tiempoLogin = localStorage.getItem("tiempoLogin");

    if (sesion === "activa" && tiempoLogin) {
        let tiempoActual = Date.now();
        let tiempoPasado = tiempoActual - parseInt(tiempoLogin);
        
        if (tiempoPasado < 259200000) { // <-- AQUÍ (72 Horas)
            usuarioActual = localStorage.getItem("usuarioGuardado");
            rolActual = localStorage.getItem("rolGuardado");
            let permisos = localStorage.getItem("permisosGuardados");

            let pantallaLogin = document.getElementById('pantalla-login');
            if(pantallaLogin) pantallaLogin.classList.add('hidden');
            
            aplicarPermisosVisuales(permisos, usuarioActual);
        } else {
            localStorage.clear();
        }
    }
}

function cerrarSesionManual() {
    localStorage.clear();
    location.reload(); 
}

let formLogin = document.getElementById('formLogin');
if(formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        let btn = document.querySelector('#formLogin button');
        btn.innerHTML = '<span>Verificando...</span> <span>⏳</span>';
        
        let user = document.getElementById('login_user').value.trim().toLowerCase();
        let pass = document.getElementById('login_pass').value;
        let errorDiv = document.getElementById('login_error');
        errorDiv.classList.add('hidden');
        
        try {
            let r = await fetch('/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: user, password: pass})
            });
            let res = await r.json();
            
            if (r.ok) {
                usuarioActual = res.username;
                rolActual = res.rol;
                
                localStorage.setItem("sesionLaComarca", "activa");
                localStorage.setItem("tiempoLogin", Date.now().toString());
                localStorage.setItem("usuarioGuardado", res.username);
                localStorage.setItem("rolGuardado", res.rol);
                localStorage.setItem("permisosGuardados", res.permisos);

                document.getElementById('pantalla-login').classList.add('hidden');
                aplicarPermisosVisuales(res.permisos, res.username); 
            } else {
                errorDiv.innerText = res.detail;
                errorDiv.classList.remove('hidden');
            }
        } catch (err) {
            errorDiv.innerText = "Error de conexión con el servidor.";
            errorDiv.classList.remove('hidden');
        } finally {
            btn.innerHTML = '<span>Ingresar al Sistema</span> <span>🔒</span>';
        }
    });
}

function aplicarPermisosVisuales(permisosStr, username) {
    const botonesMenu = document.querySelectorAll('.pestana-btn');
    botonesMenu.forEach(btn => btn.classList.add('hidden')); 

    if (username === 'luis armando' || permisosStr === 'TODOS') {
        botonesMenu.forEach(btn => btn.classList.remove('hidden'));
        document.getElementById('btn-panel-usuarios').classList.remove('hidden'); 
        if(typeof cambiarPestana === 'function') cambiarPestana('panel-facturacion');
        return;
    }

    let panelesPermitidos = permisosStr ? permisosStr.split(',') : [];
    panelesPermitidos.forEach(idPanel => {
        let btn = document.getElementById(`btn-${idPanel}`);
        if(btn) btn.classList.remove('hidden');
    });

    if(panelesPermitidos.length > 0) {
        if(typeof cambiarPestana === 'function') cambiarPestana(panelesPermitidos[0]);
    } else {
        document.getElementById('pantalla-login').classList.remove('hidden');
        alert("⚠️ Tu cuenta no tiene pestañas asignadas. El Administrador debe configurarte.");
    }
}

// ---------------- GESTIÓN DE USUARIOS ----------------
async function crearUsuarioNuevo(e) {
    e.preventDefault(); 
    let btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = "Procesando...";
    
    let datos = {
        username: document.getElementById('nuevo_user_nombre').value.trim().toLowerCase(),
        password: document.getElementById('nuevo_user_pass').value,
        rol: document.getElementById('nuevo_user_rol').value
    };
    
    try {
        let r = await fetch('/usuarios/crear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User': usuarioActual },
            body: JSON.stringify(datos)
        });
        let res = await r.json();
        if (r.ok) {
            mostrarRespuesta(res);
            document.getElementById('formUsuario').reset();
            cargarUsuarios(); 
        } else {
            alert("⚠️ Error: " + res.detail);
        }
    } catch(err) { alert("Fallo de red."); } finally { btn.innerText = "Generar Credenciales"; }
}

async function cargarUsuarios() {
    try {
        let r = await fetch('/usuarios', { headers: { 'X-User': usuarioActual } }); 
        if(!r.ok) return; 
        
        let usuarios = await r.json();
        let html = '';
        
        usuarios.forEach(u => {
            let colorRol = u.rol === 'Administrador' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800';
            let botones = u.username === 'luis armando' 
                ? `<span class="text-[10px] text-gray-400 font-bold uppercase">Maestro</span>` 
                : `<button onclick="abrirModalPermisos(${u.id}, '${u.username}', '${u.permisos || ''}')" class="bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 px-3 py-1.5 rounded text-xs shadow-sm transition mr-2">🔧 Accesos</button>
                   <button onclick="eliminarUsuario(${u.id}, '${u.username}')" class="bg-red-50 text-red-600 font-bold hover:bg-red-100 px-3 py-1.5 rounded text-xs shadow-sm transition">❌ Revocar</button>`;

            html += `<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="px-4 py-3 font-mono font-black text-gray-800 text-base">@${u.username}</td><td class="px-4 py-3"><span class="px-2 py-1 rounded text-[11px] font-black uppercase tracking-wider border ${colorRol}">${u.rol}</span></td><td class="px-4 py-3 text-center whitespace-nowrap">${botones}</td></tr>`;
        });
        document.getElementById('tabla-usuarios').innerHTML = html;
    } catch(e) { console.error(e); }
}

async function eliminarUsuario(id, username) {
    if(!confirm(`⚠️ ¿ESTÁS SEGURO?\nVas a eliminar permanentemente a @${username}.`)) return;
    try {
        let r = await fetch(`/usuarios/eliminar/${id}`, { method: 'POST', headers: { 'X-User': usuarioActual } });
        let res = await r.json();
        if (r.ok) { mostrarRespuesta(res); cargarUsuarios(); } 
        else { alert("Error: " + res.detail); }
    } catch(e) { console.error(e); }
}

let usuarioEditandoId = null;
function abrirModalPermisos(id, username, permisosActuales) {
    usuarioEditandoId = id;
    document.getElementById('tituloModalPermisos').innerText = `🔧 Accesos: @${username}`;
    let container = document.getElementById('listaCheckboxesPermisos');
    container.innerHTML = ''; 
    let listaPermitida = permisosActuales ? permisosActuales.split(',') : [];

    TODAS_LAS_PESTANAS.forEach(pestana => {
        let checkeado = listaPermitida.includes(pestana.id) ? 'checked' : '';
        container.innerHTML += `<label class="flex items-center gap-2 p-2 border border-gray-300 rounded hover:bg-blue-50 cursor-pointer"><input type="checkbox" value="${pestana.id}" class="permiso-checkbox w-4 h-4 text-blue-600" ${checkeado}><span class="text-sm font-bold text-gray-700">${pestana.nombre}</span></label>`;
    });
    document.getElementById('modalPermisos').classList.remove('hidden');
}

let btnGuardarPermisos = document.getElementById('btnGuardarPermisos');
if(btnGuardarPermisos) {
    btnGuardarPermisos.addEventListener('click', async () => {
        let checkboxes = document.querySelectorAll('.permiso-checkbox:checked');
        let panelesSeleccionados = Array.from(checkboxes).map(cb => cb.value).join(',');
        btnGuardarPermisos.innerText = "Guardando...";

        try {
            let r = await fetch(`/usuarios/permisos/${usuarioEditandoId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-User': usuarioActual }, body: JSON.stringify({ permisos_str: panelesSeleccionados })
            });
            let res = await r.json();
            if(r.ok) {
                mostrarRespuesta(res);
                document.getElementById('modalPermisos').classList.add('hidden');
                cargarUsuarios(); 
            } else { alert("⚠️ Error: " + res.detail); }
        } catch(e) { alert("Fallo de red."); } finally { btnGuardarPermisos.innerText = "💾 Guardar Cambios"; }
    });
}