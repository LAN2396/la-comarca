// =========================================
// MÓDULO DE SEGURIDAD Y PERMISOS EXACTOS
// =========================================
let usuarioActual = null;
let rolActual = null;

// Variable global para usar la tasa en todo el sistema (facturas, pagos, etc.)
let TASA_BCV_ACTUAL = 0.0;

async function extraerTasaBCV() {
    const display = document.getElementById('tasa-bcv-display');
    display.innerText = "Calculando...";
    
    try {
        let r = await fetch('/api/tasa-bcv');
        let data = await r.json();
        
        if (data.exito) {
            TASA_BCV_ACTUAL = data.tasa;
            display.innerText = `Bs ${TASA_BCV_ACTUAL.toFixed(2)}`;
            display.classList.remove('text-red-600', 'text-amber-600');
            display.classList.add('text-blue-700');
        } else {
            // Plan B: El BCV está caído
            lanzarFallbackBCV(display);
        }
    } catch (error) {
        lanzarFallbackBCV(display);
    }
}

function lanzarFallbackBCV(display) {
    display.classList.replace('text-blue-700', 'text-amber-600');
    let tasaManual = prompt("⚠️ La página del BCV no responde o está caída.\n\nPor favor, ingresa la tasa oficial de hoy manualmente (Ej: 42.50):");
    
    if (tasaManual && !isNaN(tasaManual.replace(',', '.'))) {
        TASA_BCV_ACTUAL = parseFloat(tasaManual.replace(',', '.'));
        display.innerText = `Bs ${TASA_BCV_ACTUAL.toFixed(2)} (Manual)`;
    } else {
        display.innerText = "Sin Tasa ⚠️";
        display.classList.replace('text-amber-600', 'text-red-600');
    }
}

// Hacemos que se cargue la tasa automáticamente ni bien la página cargue
document.addEventListener("DOMContentLoaded", () => {
    extraerTasaBCV();
    verificarSesionActiva(); // Verificamos si ya estaba logueado
});

// ---> NUEVA FUNCIÓN: Mantiene la sesión abierta si no ha pasado 1 hora
function verificarSesionActiva() {
    let sesion = localStorage.getItem("sesionLaComarca");
    let tiempoLogin = localStorage.getItem("tiempoLogin");

    if (sesion === "activa" && tiempoLogin) {
        let tiempoActual = Date.now();
        let tiempoPasado = tiempoActual - parseInt(tiempoLogin);
        
        // 3600000 milisegundos = 1 hora exacta
        if (tiempoPasado < 3600000) {
            // Restaurar variables globales desde la memoria
            usuarioActual = localStorage.getItem("usuarioGuardado");
            rolActual = localStorage.getItem("rolGuardado");
            let permisos = localStorage.getItem("permisosGuardados");

            // Ocultar login y encender los botones sin pedir clave
            let pantallaLogin = document.getElementById('pantalla-login');
            if(pantallaLogin) pantallaLogin.classList.add('hidden');
            
            aplicarPermisosVisuales(permisos, usuarioActual);
            console.log("Sesión restaurada correctamente.");
        } else {
            // Si ya pasó la hora, limpiamos la memoria para exigir login
            localStorage.clear();
        }
    }
}

// ---> NUEVA FUNCIÓN: Para el botón de "Cerrar Sesión" (Cuando lo agregues)
function cerrarSesionManual() {
    localStorage.clear();
    location.reload(); // Recarga la página para devolverlo al login limpio
}

// 1. EL LOGIN: Ahora lee qué casillas tiene permitidas el usuario
document.getElementById('formLogin').addEventListener('submit', async (e) => {
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
            
            // ---> NUEVO: Guardar sesión y datos en el teléfono por 1 hora
            localStorage.setItem("sesionLaComarca", "activa");
            localStorage.setItem("tiempoLogin", Date.now().toString());
            localStorage.setItem("usuarioGuardado", res.username);
            localStorage.setItem("rolGuardado", res.rol);
            localStorage.setItem("permisosGuardados", res.permisos);

            document.getElementById('pantalla-login').classList.add('hidden');
            
            // 🚀 Llamamos a la función mágica que enciende los botones
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

// 2. EL MOTOR DE CASILLAS: Decide qué botones del menú se encienden
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

function aplicarPermisosVisuales(permisosStr, username) {
    const botonesMenu = document.querySelectorAll('.pestana-btn');
    botonesMenu.forEach(btn => btn.classList.add('hidden')); // Apagamos todo de golpe

    // Si es el Administrador Maestro, le encendemos todo automáticamente
    if (username === 'luis armando' || permisosStr === 'TODOS') {
        botonesMenu.forEach(btn => btn.classList.remove('hidden'));
        document.getElementById('btn-panel-usuarios').classList.remove('hidden'); 
        cambiarPestana('panel-lotes');
        return;
    }

    // Si es un empleado, leemos su lista de permisos y encendemos solo esos
    let panelesPermitidos = permisosStr ? permisosStr.split(',') : [];
    
    panelesPermitidos.forEach(idPanel => {
        let btn = document.getElementById(`btn-${idPanel}`);
        if(btn) btn.classList.remove('hidden');
    });

    // Lo aterrizamos en su primera pestaña autorizada
    if(panelesPermitidos.length > 0) {
        cambiarPestana(panelesPermitidos[0]);
    } else {
        document.getElementById('pantalla-login').classList.remove('hidden');
        alert("⚠️ Tu cuenta no tiene pestañas asignadas. El Administrador debe configurarte.");
    }
}

// 3. CREAR, VER Y BORRAR USUARIOS
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
            
            // El botón azul de "Accesos" abre la ventanita
            let botones = u.username === 'luis armando' 
                ? `<span class="text-[10px] text-gray-400 font-bold uppercase">Maestro</span>` 
                : `<button onclick="abrirModalPermisos(${u.id}, '${u.username}', '${u.permisos || ''}')" class="bg-blue-50 text-blue-600 font-bold hover:bg-blue-100 px-3 py-1.5 rounded text-xs shadow-sm transition border border-blue-100 mr-2">🔧 Accesos</button>
                   <button onclick="eliminarUsuario(${u.id}, '${u.username}')" class="bg-red-50 text-red-600 font-bold hover:bg-red-100 px-3 py-1.5 rounded text-xs shadow-sm transition border border-red-100">❌ Revocar</button>`;

            html += `
            <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors">
                <td class="px-4 py-3 font-mono font-black text-gray-800 text-base">@${u.username}</td>
                <td class="px-4 py-3"><span class="px-2 py-1 rounded text-[11px] font-black uppercase tracking-wider border ${colorRol}">${u.rol}</span></td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${botones}</td>
            </tr>`;
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

// 4. LA VENTANITA DE LAS CASILLAS (MODAL)
let usuarioEditandoId = null;

function abrirModalPermisos(id, username, permisosActuales) {
    usuarioEditandoId = id;
    document.getElementById('tituloModalPermisos').innerText = `🔧 Accesos: @${username}`;
    
    let container = document.getElementById('listaCheckboxesPermisos');
    container.innerHTML = ''; 
    let listaPermitida = permisosActuales ? permisosActuales.split(',') : [];

    // Dibuja la lista de opciones
    TODAS_LAS_PESTANAS.forEach(pestana => {
        let checkeado = listaPermitida.includes(pestana.id) ? 'checked' : '';
        container.innerHTML += `
            <label class="flex items-center gap-2 p-2 border border-gray-300 rounded hover:bg-blue-50 cursor-pointer transition">
                <input type="checkbox" value="${pestana.id}" class="permiso-checkbox w-4 h-4 text-blue-600 focus:ring-blue-500 rounded" ${checkeado}>
                <span class="text-sm font-bold text-gray-700">${pestana.nombre}</span>
            </label>
        `;
    });
    document.getElementById('modalPermisos').classList.remove('hidden');
}

// Guarda lo que marcaste y se lo envía a la base de datos
document.getElementById('btnGuardarPermisos').addEventListener('click', async () => {
    let checkboxes = document.querySelectorAll('.permiso-checkbox:checked');
    let panelesSeleccionados = Array.from(checkboxes).map(cb => cb.value).join(',');

    let btn = document.getElementById('btnGuardarPermisos');
    btn.innerText = "Guardando...";

    try {
        let r = await fetch(`/usuarios/permisos/${usuarioEditandoId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User': usuarioActual },
            body: JSON.stringify({ permisos_str: panelesSeleccionados })
        });
        
        let res = await r.json();
        if(r.ok) {
            mostrarRespuesta(res);
            document.getElementById('modalPermisos').classList.add('hidden');
            cargarUsuarios(); 
        } else {
            alert("⚠️ Error: " + res.detail);
        }
    } catch(e) { alert("Fallo de red."); } finally { btn.innerText = "💾 Guardar Cambios"; }
});

// Calculamos la fecha respetando la zona horaria local exacta
        const fechaLocal = new Date();
        const anio = fechaLocal.getFullYear();
        const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
        const dia = String(fechaLocal.getDate()).padStart(2, '0');
        const hoy = `${anio}-${mes}-${dia}`;

        function esFechaFutura(fechaStr) {
            return fechaStr > hoy; 
        }
        
        // Bloque de límites de fecha
        const inputsFecha = ['fecha_prod', 'fecha_alim', 'lote_fecha', 'corr_prod_fecha', 'corr_alim_fecha', 'fecha_empaque'];
        inputsFecha.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.max = hoy;
        });

        document.getElementById('fecha_prod').value = hoy;
        document.getElementById('fecha_alim').value = hoy;
        document.getElementById('lote_fecha').value = hoy;
        document.getElementById('corr_prod_fecha').value = hoy;
        document.getElementById('corr_alim_fecha').value = hoy;

        function cambiarPestana(panelId) {
            document.querySelectorAll('.panel-seccion').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.pestana-btn').forEach(el => {
                el.classList.remove('bg-red-900', 'text-white', 'shadow-inner');
                el.classList.add('text-red-100', 'hover:bg-red-900/50');
            });
            
            document.getElementById(panelId).classList.remove('hidden');
            let btn = document.getElementById('btn-' + panelId);
            if (btn) {
                btn.classList.remove('text-red-100', 'hover:bg-red-900/50');
                btn.classList.add('bg-red-900', 'text-white', 'shadow-inner');
            }

            const titulos = {
                'panel-lotes': 'Ficha Técnica y Control de Lotes',
                'panel-diario': 'Registro Diario de Producción y Consumo',
                'panel-finanzas': 'Finanzas y Balances Monetarios',
                'panel-productos': 'Catálogo de Inventario y Productos',
                'panel-empaque': 'Centro de Clasificación y Empaque',
                'panel-facturacion': 'Punto de Venta y Facturación Comercial', 
                'panel-clientes': 'Directorio de Clientes',
                'panel-historial-facturas': 'Historial de Facturas Emitidas',
                'panel-corrector': 'Corrector de Bitácoras Históricas',
                'panel-historial': 'Historial Acumulado de Registros',
                'panel-graficos': 'Gráficos Estadísticos de Rendimiento',
                'panel-almacen': 'Almacén General de Insumos',
                'panel-usuarios': 'Centro de Seguridad y Accesos'
            };
            document.getElementById('titulo-seccion').innerText = titulos[panelId] || 'Panel de Control';

            if (panelId === 'panel-productos') {
                cargarProductos();
            }
            if (panelId === 'panel-historial-facturas') {
                cargarHistorialFacturas();
            }
            if (panelId === 'panel-facturacion') {
                cargarClientesPOS();
                cargarProductosPOS();
                document.getElementById('pos-fecha').innerText = hoy;
            }
            if (panelId === 'panel-clientes') {
                cargarDirectorioClientes();
            }
            if (panelId === 'panel-finanzas') {
                cargarDashboardFinanzas();
            }
            if (panelId === 'panel-usuarios') {
                cargarUsuarios();
            }
        }

        // =========================================
        // MÓDULO DE FINANZAS Y CAJA GENERAL
        // =========================================
        let chartDistribucionGastos = null;
        let cacheFinanzas = [];
        let deudaGlobalFinanzas = 0;

        async function cargarDashboardFinanzas() {
    // 🛑 NUEVA LÍNEA DE SEGURIDAD: 
    // Si no hay usuario logueado, detenemos la función aquí mismo y evitamos el error 403
    if (!usuarioActual) return; 

    try {
        let r = await fetch(`/finanzas/dashboard?tasa_actual=${TASA_BCV_ACTUAL}`, { headers: { 'X-User': usuarioActual } });
        if(!r.ok) {
            let error = await r.json();
            alert("⚠️ Error del Servidor:\n" + (error.detail || "Fallo desconocido."));
            return;
        }
        
        let data = await r.json();
        
        // 1. Mostrar tarjetas de Bolívares y Dólares
        if(document.getElementById('lbl_caja_usd')) document.getElementById('lbl_caja_usd').innerText = formMoneda(data.caja_usd);
        
        let lblBanco = document.getElementById('lbl_banco_ves');
        if(lblBanco) lblBanco.innerHTML = `Bs ${data.banco_ves.toLocaleString('es-VE', {minimumFractionDigits: 2})}<br><span class="text-sm text-gray-500 font-normal">Eqv: ${formMoneda(data.usd_real_banco)}</span>`;

        let lblPerdida = document.getElementById('lbl_perdida_cambiaria');
        if(lblPerdida) {
            if(data.perdida_cambiaria > 0) {
                lblPerdida.innerText = "-" + formMoneda(data.perdida_cambiaria);
                lblPerdida.classList.add('text-red-600');
            } else {
                lblPerdida.innerText = "$0.00";
                lblPerdida.classList.remove('text-red-600');
            }
        }
        
        if(document.getElementById('lbl_capital_total')) document.getElementById('lbl_capital_total').innerText = formMoneda(data.capital_total);
        if(document.getElementById('lbl_por_cobrar')) document.getElementById('lbl_por_cobrar').innerText = formMoneda(data.por_cobrar);

        // 2. ¡La magia que devuelve la tabla y los gráficos!
        cacheFinanzas = data.transacciones;
        deudaGlobalFinanzas = data.por_cobrar;
        filtrarFinanzas(); 
        
    } catch(e) { console.error("Error crítico cargando finanzas:", e); }
}

        // 📅 Función auxiliar para mostrar los calendarios personalizados
        function cambiarFiltroFechaFinanzas() {
            let tipo = document.getElementById('filtro_finanzas_fecha').value;
            let divRango = document.getElementById('rango_fechas_finanzas');
            if (tipo === 'Personalizado') {
                divRango.classList.remove('hidden');
            } else {
                divRango.classList.add('hidden');
            }
            filtrarFinanzas();
        }

        // 🔍 Motor Principal de Filtrado y Dibujo
        function filtrarFinanzas() {
            let tipoFecha = document.getElementById('filtro_finanzas_fecha').value;
            let strDesde = document.getElementById('filtro_fin_desde').value;
            let strHasta = document.getElementById('filtro_fin_hasta').value;

            let hoyObj = new Date();
            hoyObj.setHours(0,0,0,0);

            // 1. Filtrar las transacciones por fecha
            let transFiltradas = cacheFinanzas.filter(t => {
                if (tipoFecha === "Todas") return true;

                let partes = t.fecha_raw.split('-'); // Lee el YYYY-MM-DD
                let tObj = new Date(partes[0], partes[1] - 1, partes[2]);

                if (tipoFecha === "Hoy") return tObj.getTime() === hoyObj.getTime();
                if (tipoFecha === "Semana") {
                    let semanaAtras = new Date(hoyObj);
                    semanaAtras.setDate(semanaAtras.getDate() - 7);
                    return tObj >= semanaAtras && tObj <= hoyObj;
                }
                if (tipoFecha === "Mes") return tObj.getMonth() === hoyObj.getMonth() && tObj.getFullYear() === hoyObj.getFullYear();
                if (tipoFecha === "Personalizado" && strDesde && strHasta) {
                    let dDesde = new Date(strDesde.split('-')[0], strDesde.split('-')[1] - 1, strDesde.split('-')[2]);
                    let dHasta = new Date(strHasta.split('-')[0], strHasta.split('-')[1] - 1, strHasta.split('-')[2]);
                    return tObj >= dDesde && tObj <= dHasta;
                }
                return true;
            });

            // 2. Realizar las sumas matemáticas
            let ingresos = 0, gastos = 0;
            let entradas_efectivo = 0, entradas_banco = 0;
            let categorias_gastos = {};
            let htmlTabla = '';

            if (transFiltradas.length === 0) {
                htmlTabla = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic font-medium">No hay movimientos en este periodo.</td></tr>`;
            } else {
                transFiltradas.forEach((t, i) => {
                    if (t.tipo === "Ingreso") {
                        ingresos += t.monto;
                        // 🕵️ Inteligencia: Leer la caja destino del texto
                        let txt = t.concepto.toLowerCase();
                        if (txt.includes("efectivo")) entradas_efectivo += t.monto;
                        else if (txt.includes("transferencia") || txt.includes("pago móvil") || txt.includes("zelle")) entradas_banco += t.monto;
                    } else {
                        gastos += t.monto;
                        categorias_gastos[t.categoria] = (categorias_gastos[t.categoria] || 0) + t.monto;
                    }

                    // Dibujar la fila de la tabla
                    let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                    let esIngreso = t.tipo === "Ingreso";
                    let colorPildora = esIngreso ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200';
                    let colorMonto = esIngreso ? 'text-emerald-600' : 'text-red-600';
                    let signo = esIngreso ? '+' : '-';
                    let detalle = t.categoria ? `<br><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${t.categoria}</span>` : '';

                    htmlTabla += `
                    <tr class="${bg} hover:bg-gray-100 transition-colors border-b border-gray-100">
                        <td class="px-4 py-3 text-xs font-mono font-bold text-gray-600">${t.fecha}</td>
                        <td class="px-4 py-3 text-center">
                            <span class="px-2 py-0.5 rounded border font-black text-[10px] uppercase tracking-wider ${colorPildora}">${t.tipo}</span>
                        </td>
                        <td class="px-4 py-3 font-bold text-gray-800 leading-tight">${t.concepto}${detalle}</td>
                        <td class="px-4 py-3 text-right font-mono font-black ${colorMonto} text-base">${signo} ${formMoneda(t.monto)}</td>
                    </tr>`;
                });
            }

            // 3. Estampar resultados en las tarjetas visuales (Protegido contra nulos)
            let balance = ingresos - gastos;
            
            if (document.getElementById('dash_ingresos')) document.getElementById('dash_ingresos').innerText = formMoneda(ingresos);
            if (document.getElementById('dash_egresos')) document.getElementById('dash_egresos').innerText = formMoneda(gastos);
            
            let lblBalance = document.getElementById('dash_balance');
            if (lblBalance) {
                lblBalance.innerText = formMoneda(balance);
                lblBalance.className = `text-3xl font-black mt-1 font-mono z-10 ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
            }

            // Estampar el dinero separado por Cajas
            if (document.getElementById('dash_efectivo')) document.getElementById('dash_efectivo').innerText = formMoneda(entradas_efectivo);
            if (document.getElementById('dash_banco')) document.getElementById('dash_banco').innerText = formMoneda(entradas_banco);
            if (document.getElementById('dash_porcobrar')) document.getElementById('dash_porcobrar').innerText = formMoneda(deudaGlobalFinanzas);

            // AHORA SÍ DIBUJAMOS LA TABLA AL FINAL
            document.getElementById('tabla-finanzas-body').innerHTML = htmlTabla;

            // 4. Dibujar Gráfica Redonda de Gastos
            let ctx = document.getElementById('chartFinanzas').getContext('2d');
            if (chartDistribucionGastos) chartDistribucionGastos.destroy();
            
            let labels = Object.keys(categorias_gastos);
            let valores = Object.values(categorias_gastos);
            if(valores.length === 0) { labels = ["Sin Gastos"]; valores = [1]; }

            chartDistribucionGastos = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{ data: valores, backgroundColor: ['#f97316', '#8b0000', '#3b82f6', '#10b981', '#8b5cf6', '#eab308'], borderWidth: 2, borderColor: '#ffffff' }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } }, tooltip: { callbacks: { label: function(context) { return " " + formMoneda(context.raw); } } } },
                    cutout: '65%'
                }
            });
        }

        function actualizarBalance() {
            cargarDashboardFinanzas();
        }

        function alternarErrorLote(mostrar, mensaje = "") {
            const fila = document.getElementById('filaDatosLote');
            const cajaError = document.getElementById('msjErrorLote');
            if(mostrar) {
                fila.classList.add('hidden');
                cajaError.classList.remove('hidden');
                cajaError.innerText = mensaje;
            } else {
                fila.classList.remove('hidden');
                cajaError.classList.add('hidden');
            }
        }

        function formMoneda(valor) {
            return "$" + parseFloat(valor).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }

        async function consultarResumenLote(id) {
            if(!id || id <= 0) {
                alternarErrorLote(true, "Por favor ingrese un ID de lote válido.");
                return;
            }
            try {
                let res = await fetch(`/lotes/${id}/resumen`);
                if (res.ok) {
                    let d = await res.json();
                    alternarErrorLote(false);
                    document.getElementById('f_codigo').innerText = d.codigo;
                    document.getElementById('f_raza').innerText = d.raza;
                    document.getElementById('f_galpon').innerText = d.galpon;
                    
                    let fn = d.fecha_nacimiento.split('-');
                    let fi = d.fecha_ingreso.split('-');
                    document.getElementById('f_fnac').innerText = `${fn[2]}/${fn[1]}/${fn[0]}`;
                    document.getElementById('f_fing').innerText = `${fi[2]}/${fi[1]}/${fi[0]}`;
                    
                    document.getElementById('f_edad').innerText = d.edad_semanas + " Semanas";
                    document.getElementById('f_mortalidad').innerText = d.porcentaje_mortalidad + "%";
                    document.getElementById('f_aves_hoy').innerText = d.aves_hoy;
                    document.getElementById('f_faltante').innerText = d.semanas_faltantes + " sem.";

                    document.getElementById('f_lev_aves').innerText = formMoneda(d.desglose.aves);
                    document.getElementById('f_lev_ali').innerText = formMoneda(d.desglose.alimento);
                    document.getElementById('f_lev_med').innerText = formMoneda(d.desglose.medicina);
                    document.getElementById('f_lev_total').innerText = formMoneda(d.inversion_levante);
                } else {
                    alternarErrorLote(true, "Lote no encontrado.");
                }
            } catch (e) {
                alternarErrorLote(true, "Error de conexión.");
            }
        }

        async function mostrarRespuesta(objeto) {
            const toast = document.createElement('div');
            toast.className = "fixed bottom-5 right-5 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl font-bold z-50 toast-exito";
            toast.innerText = objeto.mensaje || "✅ ¡Datos procesados con éxito!";
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3000);

            let formsAExcluir = ['formProducto'];
            document.querySelectorAll('form').forEach(form => {
                if(!formsAExcluir.includes(form.id)) form.reset();
            });
            
            const inputsFecha = ['fecha_prod', 'fecha_alim', 'lote_fecha', 'corr_prod_fecha', 'corr_alim_fecha'];
            inputsFecha.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = hoy;
            });

            let idBuscador = parseInt(document.getElementById('buscador_lote').value);
            if(idBuscador > 0) consultarResumenLote(idBuscador);
            cargarHistorial(30); 
        }

        document.getElementById('formProducto').addEventListener('submit', async (e) => {
            e.preventDefault();
            let id = document.getElementById('prod_id').value;
            
            let stockIngresado = parseFloat(document.getElementById('prod_stock').value) || 0;
            let stockActual = parseFloat(document.getElementById('prod_stock_actual').value) || 0;
            
            let datos = {
                codigo: document.getElementById('prod_codigo').value.toUpperCase(),
                nombre: document.getElementById('prod_nombre').value,
                descripcion: document.getElementById('prod_descripcion').value,
                precio_carton: parseFloat(document.getElementById('prod_precio_carton').value),
                precio_caja: parseFloat(document.getElementById('prod_precio_caja').value),
                stock_cartones: id ? (stockActual + stockIngresado) : stockIngresado 
            };

            let url = id ? '/productos/editar' : '/productos/crear';
            if (id) datos.producto_id = parseInt(id);

            try {
                let r = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(datos)
                });
                let resJson = await r.json();
                mostrarRespuesta(resJson);
                limpiarFormProducto();
                cargarProductos();
            } catch(err) {
                mostrarRespuesta({mensaje: "Error de conexión."});
            }
        });

        function cargarProductoFormulario(p) {
            document.getElementById('titulo-form-producto').innerText = "🛠️ Modificar Producto";
            document.getElementById('btn-guardar-producto').innerText = "Actualizar Producto";
            document.getElementById('btn-cancelar-producto').classList.remove('hidden');
            
            document.getElementById('prod_id').value = p.id;
            document.getElementById('prod_codigo').value = p.codigo;
            document.getElementById('prod_nombre').value = p.nombre;
            document.getElementById('prod_descripcion').value = p.descripcion || '';
            document.getElementById('prod_precio_carton').value = p.precio_carton;
            document.getElementById('prod_precio_caja').value = p.precio_caja;
            
            document.getElementById('lbl_prod_stock').innerText = "CARTONES A SUMAR (Deja 0 si solo cambias precios)";
            document.getElementById('lbl_prod_stock').classList.replace('text-gray-500', 'text-blue-600');
            
            document.getElementById('prod_stock_actual').value = p.stock_cartones; 
            document.getElementById('prod_stock').value = 0; 
        }

        function limpiarFormProducto() {
            document.getElementById('titulo-form-producto').innerText = "📦 Registrar Nuevo Producto";
            document.getElementById('btn-guardar-producto').innerText = "Guardar Producto";
            document.getElementById('btn-cancelar-producto').classList.add('hidden');
            document.getElementById('formProducto').reset();
            document.getElementById('prod_id').value = '';
            
            document.getElementById('lbl_prod_stock').innerText = "CARTONES DISPONIBLES (STOCK INICIAL)";
            document.getElementById('lbl_prod_stock').classList.replace('text-blue-600', 'text-gray-500');
            document.getElementById('prod_stock_actual').value = 0;
        }

        async function eliminarProducto(id) {
            if(!confirm("¿Seguro que deseas eliminar este producto del catálogo?")) return;
            try {
                let r = await fetch(`/productos/eliminar/${id}`, { method: 'POST' });
                mostrarRespuesta(await r.json());
                cargarProductos();
            } catch(e) {
                mostrarRespuesta({mensaje: "Acción procesada."});
            }
        }

        async function cargarProductos() {
            try {
                let res = await fetch('/productos');
                if (!res.ok) return;
                let productos = await res.json();
                let html = '';

                document.querySelector('#tabla-productos').previousElementSibling.innerHTML = `
                    <tr>
                        <th class="px-4 py-3 font-semibold text-gray-700">Código</th>
                        <th class="px-4 py-3 font-semibold text-gray-700">Producto</th>
                        <th class="px-4 py-3 font-semibold text-gray-700 text-center">Precios</th>
                        <th class="px-4 py-3 font-semibold text-gray-700 text-right">Stock Disponible</th>
                        <th class="px-4 py-3 font-semibold text-gray-700 text-center">Acciones</th>

                    </tr>
                `;

                if (productos.length === 0) {
                    html = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic">Catálogo vacío.</td></tr>`;
                } else {
                    productos.forEach((p, i) => {
                        let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                        
                        // LÓGICA MATEMÁTICA PARA CAJAS Y HUEVOS SUELTOS
                        let stockEntero = Math.floor(p.stock_cartones);
                        let huevosSueltos = Math.round((p.stock_cartones - stockEntero) * 30);
                        
                        let cajasEnteras = Math.floor(stockEntero / 12);
                        let cartonesSueltosCaja = stockEntero % 12;
                        
                        let textoStock = `<span class="font-mono font-black text-xl ${stockEntero <= 0 && huevosSueltos <= 0 ? 'text-red-600' : 'text-gray-800'}">${stockEntero}</span> <span class="text-xs font-bold text-gray-500">CTN</span>`;
                        if (huevosSueltos > 0) {
                            textoStock += ` <span class="font-mono font-black text-lg text-orange-600 ml-1">+${huevosSueltos}</span> <span class="text-[10px] font-bold text-gray-400 uppercase">sueltos</span>`;
                        }
                        
                        let detalleCajas = `<br><span class="text-[10px] text-gray-500 font-normal">Equivale a: <b>${cajasEnteras} Cajas</b>`;
                        if (cartonesSueltosCaja > 0) detalleCajas += ` y ${cartonesSueltosCaja} cartones`;
                        detalleCajas += `</span>`;

                        // --- El HTML de la fila += `<tr class="${bg}... queda igual abajo de esto ---

                        html += `<tr class="${bg} hover:bg-red-50/20 transition-colors">
                            <td class="px-4 py-3 font-mono font-black text-gray-900 text-lg">${p.codigo}</td>
                            <td class="px-4 py-3"><span class="font-bold text-gray-800 text-base">${p.nombre}</span></td>
                            <td class="px-4 py-3 text-center">
                                <div class="text-xs"><span class="text-gray-500">Cartón:</span> <span class="font-bold text-emerald-600">${formMoneda(p.precio_carton)}</span></div>
                                <div class="text-xs"><span class="text-gray-500">Caja:</span> <span class="font-bold text-blue-600">${formMoneda(p.precio_caja)}</span></div>
                            </td>
                            <td class="px-4 py-3 text-right leading-tight">
                                ${textoStock}
                                ${detalleCajas}
                            </td>
                            <td class="px-4 py-3 text-center space-x-1 whitespace-nowrap">
                                <button onclick='cargarProductoFormulario(${JSON.stringify(p)})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold shadow-sm text-sm">🛠️ Editar</button>
                                <button onclick="eliminarProducto(${p.id})" class="bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold shadow-sm text-sm">❌ Borrar</button>
                            </td>
                        </tr>`;
                    });
                }
                document.getElementById('tabla-productos').innerHTML = html;
            } catch(e) { console.error(e); }
        }

        /* --- EDICIÓN BÁSICA DE LOTES --- */
        async function buscarLoteParaEditar() {
            let id = document.getElementById('edit_buscar_id').value;
            if(!id) return;
            try {
                let res = await fetch(`/lotes/${id}/editar-info`);
                if(res.ok) {
                    let d = await res.json();
                    document.getElementById('edit_lote_id').value = id;
                    document.getElementById('edit_lote_nombre').value = d.nombre;
                    document.getElementById('edit_lote_galpon').value = d.galpon;
                    document.getElementById('edit_lote_raza').value = d.raza;
                    document.getElementById('edit_lote_fecha').value = d.fecha_ingreso;
                    document.getElementById('edit_lote_edad').value = d.edad_valor;
                    document.getElementById('edit_lote_edad_unidad').value = d.edad_unidad;
                    
                    document.getElementById('formEditarLote').classList.remove('hidden');
                    mostrarRespuesta({mensaje: "Lote listo para ser corregido."});
                } else {
                    mostrarRespuesta({error: "No existe ese Lote."});
                    document.getElementById('formEditarLote').classList.add('hidden');
                }
            } catch(e) { mostrarRespuesta({error: "Error de red al buscar."}); }
        }

        document.getElementById('formEditarLote').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('edit_lote_id').value),
                nombre: document.getElementById('edit_lote_nombre').value,
                galpon: document.getElementById('edit_lote_galpon').value,
                raza: document.getElementById('edit_lote_raza').value,
                fecha_ingreso: document.getElementById('edit_lote_fecha').value,
                edad_valor: parseInt(document.getElementById('edit_lote_edad').value),
                edad_unidad: document.getElementById('edit_lote_edad_unidad').value
            };
            let r = await fetch('/lotes/editar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            
            document.getElementById('formEditarLote').classList.add('hidden');
            let idActual = parseInt(document.getElementById('buscador_lote').value);
            if(idActual === datos.lote_id) consultarResumenLote(idActual);
        });
        /* --- LÓGICA DEL PANEL DE EMPAQUE ACTUALIZADA --- */
        async function cargarFormularioEmpaque() {
            try {
                let res = await fetch('/productos');
                if (!res.ok) return;
                let productos = await res.json();
                let html = '';

                if (productos.length === 0) {
                    html = '<p class="text-sm text-red-500 font-bold">⚠️ No hay productos en el catálogo. Crea primero tus "Huevos Tipo A", "Tipo B", etc.</p>';
                } else {
                    productos.forEach(p => {
                        // Calculamos para mostrar el stock actual bonito
                        let stockEntero = Math.floor(p.stock_cartones);
                        let huevosStock = Math.round((p.stock_cartones - stockEntero) * 30);
                        let txtStock = stockEntero + " CTN";
                        if(huevosStock > 0) txtStock += " y " + huevosStock + " uds";

                        html += `
                        <div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded border border-gray-200 shadow-sm gap-2">
                            <div>
                                <span class="font-bold text-gray-800">${p.nombre}</span>
                                <span class="text-[10px] text-gray-500 ml-2 block md:inline">Stock actual: ${txtStock}</span>
                            </div>
                            <div class="flex items-center gap-2 self-end md:self-auto">
                                <input type="number" min="0" data-id="${p.id}" placeholder="0" class="input-empaque-cartones w-16 p-2 bg-gray-50 border border-gray-300 rounded text-center font-bold text-emerald-700">
                                <span class="text-xs font-bold text-gray-500">CTN</span>
                                <span class="text-gray-300 font-bold px-1">+</span>
                                <input type="number" min="0" max="29" data-id="${p.id}" placeholder="0" class="input-empaque-sueltos w-16 p-2 bg-gray-50 border border-gray-300 rounded text-center font-bold text-orange-600">
                                <span class="text-xs font-bold text-gray-500">Sueltos</span>
                            </div>
                        </div>`;
                    });
                }
                document.getElementById('contenedor-productos-empaque').innerHTML = html;
            } catch(e) { console.error(e); }
        }

        document.getElementById('formEmpaque').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let items = [];
            // Buscamos todos los inputs de cartones en pantalla
            document.querySelectorAll('.input-empaque-cartones').forEach(inputCarton => {
                let id = inputCarton.getAttribute('data-id');
                // Buscamos a su hermano (el input de sueltos) usando el mismo ID
                let inputSuelto = document.querySelector(`.input-empaque-sueltos[data-id="${id}"]`);
                
                let cartones = parseInt(inputCarton.value) || 0;
                let sueltos = parseInt(inputSuelto.value) || 0;
                
                if (cartones > 0 || sueltos > 0) {
                    // Convertimos los huevos sueltos a fracción de cartón para la base de datos
                    let totalFloat = cartones + (sueltos / 30.0);
                    items.push({ producto_id: parseInt(id), cantidad_cartones: totalFloat });
                }
            });

            if(items.length === 0) {
                alert("Debes empacar al menos 1 cartón o 1 huevo suelto para procesar.");
                return;
            }

            let datos = {
                fecha: document.getElementById('fecha_empaque').value,
                huevos_descarte: parseInt(document.getElementById('huevos_descarte').value) || 0,
                items: items
            };

            try {
                let r = await fetch('/empaque/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
                mostrarRespuesta(await r.json());
                cargarFormularioEmpaque(); 
                if (typeof cargarProductos === "function") cargarProductos(); 
            } catch(err) { mostrarRespuesta({mensaje: "Error de red al registrar."}); }
        });
        /* --- CARGAR DESPLEGABLES --- */
        async function cargarLotesActivos() {
            try {
                let res = await fetch('/lotes/activos');
                if (res.ok) {
                    let lotes = await res.json();
                    let opcionesHTML = '<option value="" disabled selected>Seleccione un Lote...</option>';
                    lotes.forEach(l => { opcionesHTML += `<option value="${l.id}">${l.etiqueta}</option>`; });

                    document.getElementById('lote_id_prod').innerHTML = opcionesHTML;
                    document.getElementById('lote_id_alim').innerHTML = opcionesHTML;
                    document.getElementById('select_grafico_lote').innerHTML = opcionesHTML;
                    
                    let buscador = document.getElementById('buscador_lote');
                    buscador.innerHTML = opcionesHTML;
                    if(lotes.length > 0) {
                        buscador.value = lotes[0].id;
                        consultarResumenLote(lotes[0].id);
                    }
                }
            } catch(e) { console.error("Error cargando los lotes", e); }
        }

        /* --- CORRECTOR DE REGISTROS --- */
        async function buscarProdParaCorregir() {
            let lote_id = document.getElementById('corr_prod_lote').value;
            let fecha = document.getElementById('corr_prod_fecha').value;
            if(!lote_id || !fecha) return;
            try {
                let res = await fetch(`/produccion/buscar/${lote_id}/${fecha}`);
                if(res.ok) {
                    let d = await res.json();
                    document.getElementById('nuevo_cant_huevos').value = d.cantidad_huevos;
                    document.getElementById('nuevo_mortalidad').value = d.mortalidad;
                    document.getElementById('formCorrProd').classList.remove('hidden');
                    mostrarRespuesta({mensaje: "Registro de Producción encontrado."});
                } else {
                    mostrarRespuesta({error: "No hay registro de producción para esa fecha."});
                    document.getElementById('formCorrProd').classList.add('hidden');
                }
            } catch(e) { mostrarRespuesta({error: "Error de red."}); }
        }

        document.getElementById('formCorrProd').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('corr_prod_lote').value),
                fecha: document.getElementById('corr_prod_fecha').value,
                cantidad_huevos: parseInt(document.getElementById('nuevo_cant_huevos').value),
                mortalidad: parseInt(document.getElementById('nuevo_mortalidad').value)
            };
            let r = await fetch('/produccion/corregir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            document.getElementById('formCorrProd').classList.add('hidden');
        });

        async function buscarAlimParaCorregir() {
            let lote_id = document.getElementById('corr_alim_lote').value;
            let fecha = document.getElementById('corr_alim_fecha').value;
            if(!lote_id || !fecha) return;
            try {
                let res = await fetch(`/alimento/buscar/${lote_id}/${fecha}`);
                if(res.ok) {
                    let d = await res.json();
                    document.getElementById('nuevo_kilos').value = d.kilos_consumidos;
                    document.getElementById('formCorrAlim').classList.remove('hidden');
                    mostrarRespuesta({mensaje: "Registro de Alimento encontrado."});
                } else {
                    mostrarRespuesta({error: "No hay registro de alimento para esa fecha."});
                    document.getElementById('formCorrAlim').classList.add('hidden');
                }
            } catch(e) { mostrarRespuesta({error: "Error de red."}); }
        }

        document.getElementById('formCorrAlim').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('corr_alim_lote').value),
                fecha: document.getElementById('corr_alim_fecha').value,
                kilos_consumidos: parseFloat(document.getElementById('nuevo_kilos').value)
            };
            let r = await fetch('/alimento/corregir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            document.getElementById('formCorrAlim').classList.add('hidden');
        });

        /* --- FORMULARIOS OPERATIVOS --- */
        document.getElementById('formReporte').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('lote_id_prod').value),
                cantidad_huevos: parseInt(document.getElementById('cantidad_huevos').value),
                mortalidad: parseInt(document.getElementById('mortalidad').value),
                fecha: document.getElementById('fecha_prod').value
            };
            let r = await fetch('/produccion/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            actualizarBalance();
        });

        document.getElementById('formAlimento').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('lote_id_alim').value),
                kilos_consumidos: parseFloat(document.getElementById('kilos_consumidos').value),
                fecha: document.getElementById('fecha_alim').value
            };
            let r = await fetch('/alimentacion/registrar-consumo', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
        });

        document.getElementById('formLote').addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                nombre: document.getElementById('lote_nombre').value,
                galpon: document.getElementById('lote_galpon').value,
                cantidad_inicial: parseInt(document.getElementById('lote_inicial').value),
                raza: document.getElementById('lote_raza').value,
                fecha_ingreso: document.getElementById('lote_fecha').value,
                edad_valor: parseInt(document.getElementById('lote_edad').value),
                edad_unidad: document.getElementById('lote_edad_unidad').value,
                costo_adquisicion: parseFloat(document.getElementById('lote_costo').value)
            };
            let r = await fetch('/lotes/crear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            actualizarBalance();
        });

        /* --- MOTOR HISTORIAL --- */
        async function cargarHistorial(dias) {
            [7, 30, 0].forEach(d => {
                let btn = document.getElementById('btn-hist-' + d);
                if (btn) {
                    if (d === dias) {
                        btn.className = `px-4 py-2 text-sm font-medium border ${d===7?'rounded-l-lg':(d===0?'rounded-r-lg':'border-t border-b')} bg-green-600 text-white border-green-600`;
                    } else {
                        btn.className = `px-4 py-2 text-sm font-medium border ${d===7?'rounded-l-lg':(d===0?'rounded-r-lg':'border-t border-b')} bg-white text-gray-700 border-gray-200 hover:bg-gray-50`;
                    }
                }
            });

            try {
                let r = await fetch('/historial/' + dias);
                let datos = await r.json();
                let html = '';
                
                let totalHuevos = 0;
                let totalMortalidad = 0;
                let totalAlimento = 0;
                
                if (datos.length === 0) {
                    html = `<tr><td colspan="5" class="px-6 py-10 text-center text-gray-400 italic">No hay registros guardados para este periodo.</td></tr>`;
                } else {
                    datos.forEach((reg, i) => {
                        let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                        let f = reg.fecha.split('-');
                        let fechaFormateada = `${f[2]}/${f[1]}/${f[0]}`;
                        
                        totalHuevos += reg.huevos;
                        totalMortalidad += reg.mortalidad;
                        totalAlimento += reg.alimento;
                        
                        html += `<tr class="${bg} hover:bg-green-50/40 transition-colors">
                            <td class="px-6 py-3 font-medium text-gray-900">${fechaFormateada}</td>
                            <td class="px-6 py-3 text-gray-600 font-bold">Lote ${reg.lote_id}</td>
                            <td class="px-6 py-3 text-right font-mono text-gray-700">${reg.huevos.toLocaleString('en-US')}</td>
                            <td class="px-6 py-3 text-right font-mono text-red-600">${reg.mortalidad}</td>
                            <td class="px-6 py-3 text-right font-mono text-gray-700">${reg.alimento.toFixed(2)}</td>
                        </tr>`;
                    });
                    
                    html += `<tr class="bg-green-100 border-t-2 border-green-600 font-black text-green-900">
                        <td colspan="2" class="px-6 py-4 text-right uppercase tracking-wider">Total del Periodo Seleccionado:</td>
                        <td class="px-6 py-4 text-right font-mono text-lg">${totalHuevos.toLocaleString('en-US')}</td>
                        <td class="px-6 py-4 text-right font-mono text-lg text-red-700">${totalMortalidad}</td>
                        <td class="px-6 py-4 text-right font-mono text-lg">${totalAlimento.toFixed(2)} Kg</td>
                    </tr>`;
                }
                document.getElementById('tabla-historial').innerHTML = html;
            } catch(e) { console.error("Error cargando historial", e); }
        }

        /* --- GRÁFICOS CHART.JS --- */
        let graficoPostura = null;
        let graficoAlimento = null;

        async function dibujarGraficos(lote_id) {
            if(!lote_id) return;
            try {
                let res = await fetch('/api/graficos/' + lote_id);
                let datos = await res.json();

                let etiquetas = datos.map(d => d.fecha);
                let datosPostura = datos.map(d => d.postura);
                let datosAlimento = datos.map(d => d.alimento);

                if(graficoPostura) graficoPostura.destroy();
                if(graficoAlimento) graficoAlimento.destroy();

                let ctxPostura = document.getElementById('chartPostura').getContext('2d');
                graficoPostura = new Chart(ctxPostura, {
                    type: 'line',
                    data: {
                        labels: etiquetas,
                        datasets: [{
                            label: '% de Postura',
                            data: datosPostura,
                            borderColor: '#8B0000',
                            backgroundColor: 'rgba(139, 0, 0, 0.1)',
                            borderWidth: 3,
                            pointRadius: 4,
                            pointBackgroundColor: '#EAA000',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { title: { display: true, text: 'Curva de Producción Diaria (%)' } },
                        scales: { y: { beginAtZero: true, max: 100 } }
                    }
                });

                let ctxAlimento = document.getElementById('chartAlimento').getContext('2d');
                graficoAlimento = new Chart(ctxAlimento, {
                    type: 'bar',
                    data: {
                        labels: etiquetas,
                        datasets: [{
                            label: 'Gramos por Ave (g)',
                            data: datosAlimento,
                            backgroundColor: '#EAA000',
                            borderColor: '#B8860B',
                            borderWidth: 1,
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { title: { display: true, text: 'Ingesta Diaria de Alimento (Gramos/Ave)' } },
                        scales: { y: { beginAtZero: true } }
                    }
                });
            } catch(e) { console.error("Error al generar gráficos", e); }
        }

// =========================================
// MÓDULO DE ALMACÉN E INSUMOS
// =========================================

async function cargarInsumos() {
    try {
        let res = await fetch('/almacen/insumos');
        if (!res.ok) return;
        let insumos = await res.json();
        
        let htmlTabla = '';
        let htmlSelect = '<option value="" disabled selected>Seleccione un insumo...</option>';
        
        if (insumos.length === 0) {
            htmlTabla = '<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400 italic font-bold">No hay insumos registrados.</td></tr>';
        } else {
            insumos.forEach(i => {
                htmlSelect += `<option value="${i.id}">${i.nombre} (${i.unidad_medida})</option>`;
                
                let colorStock = i.stock_actual <= 0 ? 'text-red-600' : 'text-gray-900';
                
                // 📦 LÓGICA DE EQUIVALENCIA EN BULTOS DE ALIMENTO (40 KG)
                let detalleBultos = "";
                if (i.categoria === "Alimento" && i.unidad_medida === "Kg" && i.stock_actual > 0) {
                    let bultosEnteros = Math.floor(i.stock_actual / 40);
                    let kilosSueltos = i.stock_actual % 40;
                    
                    if (bultosEnteros > 0) {
                        detalleBultos = `<br><span class="text-[11px] text-purple-600 font-bold"> ${bultosEnteros} ${bultosEnteros === 1 ? 'bulto' : 'bultos'}`;
                        if (kilosSueltos > 0) {
                            detalleBultos += ` y ${kilosSueltos} Kg sueltos`;
                        }
                        detalleBultos += `</span>`;
                    } else {
                        detalleBultos = `<br><span class="text-[10px] text-gray-500 italic">Menos de 1 bulto completo</span>`;
                    }
                }
                
                htmlTabla += `
                <tr class="hover:bg-gray-50 border-b border-gray-100">
                    <td class="px-4 py-3 font-bold text-gray-800">${i.nombre}</td>
                    <td class="px-4 py-3 text-xs"><span class="bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold">${i.categoria}</span></td>
                    <td class="px-4 py-3 text-right font-mono leading-tight">
                        <span class="font-black text-lg ${colorStock}">${i.stock_actual.toLocaleString('en-US')}</span> 
                        <span class="text-xs font-bold text-gray-500">${i.unidad_medida}</span>
                        ${detalleBultos} </td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="eliminarInsumo(${i.id})" class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold hover:bg-red-200 text-xs shadow-sm">Eliminar</button>
                    </td>
                </tr>`;
            });
        }
        
        document.getElementById('tabla-insumos-body').innerHTML = htmlTabla;        
        if(document.getElementById('compra_insumo_id')) document.getElementById('compra_insumo_id').innerHTML = htmlSelect;
        if(document.getElementById('ajuste_insumo_id')) document.getElementById('ajuste_insumo_id').innerHTML = htmlSelect;
    } catch(e) { console.error("Error cargando insumos", e); }
}

async function eliminarInsumo(id) {
    if(!confirm("¿Seguro que quieres borrar este insumo?")) return;
    try {
        await fetch(`/almacen/insumos/eliminar/${id}`, { method: 'POST' });
        cargarInsumos();
    } catch(e) { alert("Error al eliminar."); }
}

// Escuchadores de eventos para formularios
document.addEventListener('DOMContentLoaded', () => {
    const formInsumo = document.getElementById('formInsumo');
    if (formInsumo) {
        formInsumo.onsubmit = async (e) => {
            e.preventDefault();
            let datos = {
                nombre: document.getElementById('insumo_nombre').value,
                categoria: document.getElementById('insumo_cat').value,
                unidad_medida: document.getElementById('insumo_unidad').value,
                stock_actual: 0
            };
            await fetch('/almacen/insumos/crear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            cargarInsumos();
            formInsumo.reset();
        };
    }

    const formCompra = document.getElementById('formCompraInsumo');
    if (formCompra) {
        formCompra.onsubmit = async (e) => {
            e.preventDefault();
            let costoUsd = parseFloat(document.getElementById('compra_costo').value);
            
            // Truco: Preguntamos rápido si fue en Bs sin necesidad de cambiar el HTML
            let pagaEnBolivares = false;
            if(costoUsd > 0) {
                pagaEnBolivares = confirm("¿Vas a pagar esta compra en Bolívares (Pago Móvil/Transferencia)?\n\nDale a 'Aceptar' si es Bolívares, o 'Cancelar' si pagas en Efectivo/Zelle.");
            }

            let datos = {
                insumo_id: parseInt(document.getElementById('compra_insumo_id').value),
                cantidad_comprada: parseFloat(document.getElementById('compra_cantidad').value),
                es_saco: document.getElementById('compra_es_saco').checked,
                costo_total: costoUsd,
                moneda: pagaEnBolivares ? "VES" : "USD",
                tasa_cambio: pagaEnBolivares ? TASA_BCV_ACTUAL : 1.0,
                monto_ves: pagaEnBolivares ? (costoUsd * TASA_BCV_ACTUAL) : 0.0
            };
            
            await fetch('/almacen/comprar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            cargarInsumos();
            actualizarBalance();
            formCompra.reset();
        };
    }

    const formAjuste = document.getElementById('formAjusteInsumo');
    if (formAjuste) {
        formAjuste.onsubmit = async (e) => {
            e.preventDefault();
            let datos = {
                insumo_id: parseInt(document.getElementById('ajuste_insumo_id').value),
                cantidad_reducir: parseFloat(document.getElementById('ajuste_cantidad').value),
                motivo: document.getElementById('ajuste_motivo').value
            };
            await fetch('/almacen/ajustar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            cargarInsumos();
            formAjuste.reset();
        };
    }
    
    // INICIALIZACIÓN FINAL
    actualizarBalance();
    // consultarResumenLote(1); // Si sigue dando error, mantenlo comentado
    cargarHistorial(30);
    cargarLotesActivos(); 
    cargarFormularioEmpaque();
    cargarInsumos();
});

// =========================================
// MÓDULO PUNTO DE VENTA Y FACTURACIÓN (POS)
// =========================================

let carritoPOS = [];
let productosCachePOS = [];

async function cargarClientesPOS() {
    try {
        let r = await fetch('/clientes');
        let clientes = await r.json();
        let html = '<option value="" disabled selected>Seleccione un cliente...</option>';
        clientes.forEach(c => {
            html += `<option value="${c.id}">${c.nombre} (${c.documento})</option>`;
        });
        document.getElementById('fact_cliente_id').innerHTML = html;
    } catch(e) { console.error("Error cargando clientes POS", e); }
}

async function registrarClienteRapidoPOS() {
    let docInput = document.getElementById('c_doc').value.trim();
    let nomInput = document.getElementById('c_nombre').value.trim();
    let tlfInput = document.getElementById('c_tlf').value.trim();

    // Ahora SOLO el nombre es obligatorio
    if(!nomInput) { 
        alert("El Nombre completo es un campo obligatorio."); 
        return; 
    }

    // MAGIA: Si no hay cédula, generamos un identificador de "Consumidor Final"
    let documentoFinal = docInput;
    if(!docInput) {
        documentoFinal = "CF-" + Math.floor(Math.random() * 10000000);
    }

    let datos = {
        documento: documentoFinal.toUpperCase(),
        nombre: nomInput,
        telefono: tlfInput || null,
        direccion: null
    };

    try {
        let r = await fetch('/clientes/crear', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        let res = await r.json();
        
        if (r.ok) {
            mostrarRespuesta(res);
            document.getElementById('form-rapido-cliente').classList.add('hidden');
            document.getElementById('c_doc').value = '';
            document.getElementById('c_nombre').value = '';
            document.getElementById('c_tlf').value = '';
            
            // Refrescamos la lista de clientes en segundo plano
            await cargarClientesPOS();
            
            // Auto-seleccionamos al cliente recién creado sin recargar la página
            let selector = document.getElementById('fact_cliente_id');
            for (let i = 0; i < selector.options.length; i++) {
                if (selector.options[i].text.includes(datos.documento)) {
                    selector.selectedIndex = i;
                    break;
                }
            }
        } else {
            alert("Error: " + res.detail);
        }
    } catch(e) { console.error(e); }
}

async function cargarProductosPOS() {
    try {
        let r = await fetch('/productos');
        productosCachePOS = await r.json();
        let html = '<option value="" disabled selected>Seleccione un tipo de huevo...</option>';
        productosCachePOS.forEach(p => {
            html += `<option value="${p.id}">${p.nombre} (${p.codigo})</option>`;
        });
        document.getElementById('fact_producto_id').innerHTML = html;
    } catch(e) { console.error("Error cargando productos POS", e); }
}
function actualizarPrecioSugeridoPOS() {
    // La dejamos vacía a propósito para que el HTML no se asuste.
    // El precio ya se calcula solo en agregarAlCarritoPOS.
}

function agregarAlCarritoPOS() {
    let prodId = parseInt(document.getElementById('fact_producto_id').value);
    let cartones = parseInt(document.getElementById('fact_cant_cartones').value) || 0;
    let cajas = parseInt(document.getElementById('fact_cant_cajas').value) || 0;

    if(!prodId) { alert("Por favor, elija un producto del catálogo primero."); return; }
    if(cartones === 0 && cajas === 0) { alert("Establezca una cantidad en cartones o cajas para ingresar."); return; }

    let prod = productosCachePOS.find(x => x.id === prodId);

    // 📦 PROCESAR CAJAS PRIMERO (Si el usuario ingresó cajas)
    if (cajas > 0) {
        let totalCartonesCaja = cajas * 12; // Convertimos a base cartón para el inventario
        let precioCajaPorCarton = prod.precio_caja / 12; // Calculamos cuánto cuesta cada cartón a precio de mayor
        
        // Buscamos si ya existe una fila de este producto vendida como CAJA
        let existeCaja = carritoPOS.find(x => x.producto_id === prodId && x.tipo_venta === "Caja");
        if(existeCaja) {
            existeCaja.cantidad_cartones += totalCartonesCaja;
            existeCaja.subtotal = existeCaja.cantidad_cartones * existeCaja.precio_unitario;
        } else {
            carritoPOS.push({
                producto_id: prodId,
                nombre: `${prod.nombre} (Al Mayor - Cajas)`,
                cantidad_cartones: totalCartonesCaja,
                precio_unitario: precioCajaPorCarton, // Guardamos el equivalente por cartón
                tipo_venta: "Caja",
                subtotal: totalCartonesCaja * precioCajaPorCarton
            });
        }
    }

    // 🥚 PROCESAR CARTONES SEGUNDO (Si el usuario también ingresó cartones sueltos)
    if (cartones > 0) {
        let existeCarton = carritoPOS.find(x => x.producto_id === prodId && x.tipo_venta === "Cartón");
        if(existeCarton) {
            existeCarton.cantidad_cartones += cartones;
            existeCarton.subtotal = existeCarton.cantidad_cartones * existeCarton.precio_unitario;
        } else {
            carritoPOS.push({
                producto_id: prodId,
                nombre: `${prod.nombre} (Al Detal - Cartones)`,
                cantidad_cartones: cartones,
                precio_unitario: prod.precio_carton, // Precio normal de cartón
                tipo_venta: "Cartón",
                subtotal: cartones * prod.precio_carton
            });
        }
    }

    // Reseteamos los campos del formulario
    document.getElementById('fact_cant_cartones').value = 0;
    document.getElementById('fact_cant_cajas').value = 0;
    actualizarTablaCarritoPOS();
}

function actualizarTablaCarritoPOS() {
    let html = '';
    let totalBruto = 0;

    if(carritoPOS.length === 0) {
        html = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic font-medium">El carrito de ventas está totalmente vacío.</td></tr>`;
    } else {
        carritoPOS.forEach((item, index) => {
            totalBruto += item.subtotal;
            let txtCant = item.tipo_venta === "Caja" 
                ? `${item.cantidad_cartones / 12} CJ` 
                : `${item.cantidad_cartones} CTN`;
            let txtPrecioMostrar = item.tipo_venta === "Caja" 
                ? `${formMoneda(item.precio_unitario * 12)} /CJ` 
                : `${formMoneda(item.precio_unitario)} /CTN`;

            html += `
            <tr class="hover:bg-gray-50 border-b border-gray-100">
                <td class="px-4 py-3 font-bold text-gray-800">${item.nombre}</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-gray-900">${txtCant}</td>
                <td class="px-4 py-3 text-right font-mono text-emerald-600 font-bold">${txtPrecioMostrar}</td>
                <td class="px-4 py-3 text-right font-mono font-black text-gray-900">${formMoneda(item.subtotal)}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="quitarDelCarritoPOS(${index})" class="bg-red-50 text-red-600 font-bold hover:bg-red-100 px-2 py-0.5 rounded text-xs shadow-sm transition">Quitar</button>
                </td>
            </tr>`;
        });
    }

    // Calcular descuento visual en vivo (Soporta % y $)
    let descTipo = document.getElementById('fact_desc_tipo').value;
    let descValor = parseFloat(document.getElementById('fact_descuento').value) || 0;
    let descMonto = 0;
    
    if (descTipo === "%") {
        descMonto = totalBruto * (descValor / 100.0);
    } else {
        descMonto = descValor; // Descuento directo en dinero
    }

    let totalNeto = totalBruto - descMonto;
    if (totalNeto < 0) totalNeto = 0; // Evitamos que la factura quede en negativo

    document.getElementById('tabla-carrito-body').innerHTML = html;
    document.getElementById('fact_total_lbl').innerText = formMoneda(totalNeto);
    actualizarTotalBCV();
}

function actualizarTotalBCV() {
    let metodo = document.getElementById('fact_condicion').value;
    let lblBs = document.getElementById('fact_total_bs_lbl');
    
    // Obtenemos el total en dólares que está en la pantalla
    let totalStr = document.getElementById('fact_total_lbl').innerText.replace('$', '').trim();
    let totalUsd = parseFloat(totalStr) || 0;

    // Si pagan con método en Bs, hacemos el cálculo
    if (metodo === 'Transferencia' || metodo === 'Pago Móvil') {
        let totalBs = totalUsd * TASA_BCV_ACTUAL;
        lblBs.innerText = `Bs ${totalBs.toFixed(2)} (Tasa: ${TASA_BCV_ACTUAL})`;
        lblBs.classList.remove('hidden');
    } else {
        // Si es Efectivo o Crédito, ocultamos los bolívares
        lblBs.classList.add('hidden');
    }
}

// =========================================
// MÓDULO DIRECTORIO DE CLIENTES
// =========================================

async function cargarDirectorioClientes() {
    try {
        let r = await fetch('/clientes');
        let clientes = await r.json();
        let html = '';
        
        if (clientes.length === 0) {
            html = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic font-medium">No hay clientes registrados en el sistema.</td></tr>`;
        } else {
            clientes.forEach((c, i) => {
                let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                html += `
                <tr class="${bg} hover:bg-blue-50/20 transition-colors">
                    <td class="px-4 py-3 font-mono font-bold text-gray-800">${c.documento}</td>
                    <td class="px-4 py-3 font-bold text-gray-900">${c.nombre}</td>
                    <td class="px-4 py-3 text-gray-600">${c.telefono || 'N/A'}</td>
                    <td class="px-4 py-3 text-center">
                        <button onclick='cargarFormularioCliente(${JSON.stringify(c)})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 transition shadow-sm text-xs">🛠️ Editar</button>
                    </td>
                </tr>`;
            });
        }
        document.getElementById('tabla-directorio-clientes').innerHTML = html;
    } catch(e) { console.error("Error al cargar clientes", e); }
}

function cargarFormularioCliente(c) {
    document.getElementById('titulo-form-cliente').innerText = "🛠️ Editar Cliente";
    document.getElementById('btn-guardar-cliente').innerText = "Actualizar";
    document.getElementById('btn-cancelar-cliente').classList.remove('hidden');
    
    document.getElementById('dir_cliente_id').value = c.id;
    document.getElementById('dir_cliente_doc').value = c.documento;
    document.getElementById('dir_cliente_nombre').value = c.nombre;
    document.getElementById('dir_cliente_tlf').value = c.telefono || '';
}

function limpiarFormCliente() {
    document.getElementById('titulo-form-cliente').innerText = "➕ Registrar Cliente";
    document.getElementById('btn-guardar-cliente').innerText = "Guardar";
    document.getElementById('btn-cancelar-cliente').classList.add('hidden');
    document.getElementById('formDirCliente').reset();
    document.getElementById('dir_cliente_id').value = '';
}

// Escuchador de envío del formulario de Directorio
document.getElementById('formDirCliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    let id = document.getElementById('dir_cliente_id').value;
    
    let datos = {
        documento: document.getElementById('dir_cliente_doc').value.toUpperCase(),
        nombre: document.getElementById('dir_cliente_nombre').value,
        telefono: document.getElementById('dir_cliente_tlf').value
    };

    let url = '/clientes/crear';
    if(id) {
        url = '/clientes/editar';
        datos.cliente_id = parseInt(id);
    } else if (!datos.documento) {
        datos.documento = "CF-" + Math.floor(Math.random() * 10000000);
    }

    try {
        let r = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        mostrarRespuesta(await r.json());
        limpiarFormCliente();
        cargarDirectorioClientes();
    } catch(err) { mostrarRespuesta({mensaje: "Error de conexión."}); }
});
function alternarDiasCreditoPOS() {
    let condicion = document.getElementById('fact_condicion').value;
    let contenedor = document.getElementById('contenedor_dias_credito');
    if (condicion === "Crédito") {
        contenedor.classList.remove('hidden');
    } else {
        contenedor.classList.add('hidden');
        document.getElementById('fact_dias_credito').value = 0;
    }
}

// =========================================
// FUNCIÓN PRINCIPAL DE REGISTRO
// =========================================
async function procesarFacturaFinalPOS() {
    let clienteSelect = document.getElementById('fact_cliente_id');
    let clienteId = parseInt(clienteSelect.value);
    
    if(!clienteId) { alert("Debe seleccionar un cliente para poder emitir la factura."); return; }
    if(carritoPOS.length === 0) { alert("No puede procesar una venta sin artículos en el carrito."); return; }

    // --- NUEVA LÓGICA BCV ---
    let condicionPago = document.getElementById('fact_condicion').value;
    // Capturamos el total en dólares limpiando el símbolo de $
    let totalUsd = parseFloat(document.getElementById('fact_total_lbl').innerText.replace('$', '').trim()) || 0;
    
    let usaBolivares = (condicionPago === 'Transferencia' || condicionPago === 'Pago Móvil' || condicionPago === 'Transferencia Bancaria');
    let tasaParaBD = usaBolivares ? TASA_BCV_ACTUAL : 1.0;
    let vesParaBD = usaBolivares ? (totalUsd * TASA_BCV_ACTUAL) : 0.0;
    // ------------------------

    let datos = {
        cliente_id: clienteId,
        fecha: hoy,
        condicion: condicionPago,
        dias_credito: parseInt(document.getElementById('fact_dias_credito').value) || 0,
        descuento_tipo: document.getElementById('fact_desc_tipo').value,
        descuento_valor: parseFloat(document.getElementById('fact_descuento').value) || 0,
        total: totalUsd, // Por si tu backend lo requiere
        tasa_cambio: tasaParaBD, // Inyectamos la tasa BCV
        monto_ves: vesParaBD,    // Inyectamos el total exacto en Bs
        items: carritoPOS.map(x => ({
            producto_id: x.producto_id,
            cantidad_cartones: x.cantidad_cartones,
            precio_unitario: x.precio_unitario
        }))
    };

    try {
        let r = await fetch('/facturacion/procesar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        let res = await r.json();
        
        if(r.ok) {
            // 🖨️ 1. CAPTURAMOS DATOS Y MANDAMOS A IMPRIMIR ANTES DE LIMPIAR TODO
            let clienteNombre = clienteSelect.options[clienteSelect.selectedIndex].text;
            let totalFinalFormateado = document.getElementById('fact_total_lbl').innerText;

            // 2. Notificamos éxito visualmente
            mostrarRespuesta(res);
            
            // 3. Limpiamos el carrito
            carritoPOS = [];
            actualizarTablaCarritoPOS();
            
            // 4. Reseteamos el formulario visual
            document.getElementById('fact_cliente_id').value = "";
            document.getElementById('fact_condicion').value = "Efectivo";
            document.getElementById('fact_desc_tipo').value = "%";
            document.getElementById('fact_descuento').value = 0;
            alternarDiasCreditoPOS();
            if(typeof actualizarTotalBCV === 'function') actualizarTotalBCV(); // Refresca el label de Bs si existe
            
            // 5. Actualizamos los balances de finanzas
            actualizarBalance();
        } else {
            alert("⚠️ Error en Facturación:\n" + res.detail);
        }
    } catch(e) { 
        alert("Ocurrió un error crítico de comunicación de red al procesar la factura."); 
        console.error(e);
    }
}

// =========================================
// MÓDULO HISTORIAL DE FACTURAS Y REPORTES
// =========================================

let cacheFacturas = []; // Aquí guardaremos las facturas en memoria para filtrar súper rápido

async function cargarHistorialFacturas() {
    try {
        let r = await fetch('/facturacion/historial?_t=' + new Date().getTime());
        cacheFacturas = await r.json();
        filtrarFacturas(); // Llama al motor de filtrado automáticamente
    } catch(e) { 
        console.error("Error al cargar el historial de facturas", e); 
    }
}

// 🔍 Motor inteligente de búsqueda y filtrado
// 📅 Auxiliar para mostrar/ocultar los calendarios personalizados
function cambiarFiltroFechaPOS() {
    let tipo = document.getElementById('filtro_fact_fecha').value;
    let divRango = document.getElementById('rango_fechas_pos');
    if (tipo === 'Personalizado') {
        divRango.classList.remove('hidden');
    } else {
        divRango.classList.add('hidden');
    }
    filtrarFacturas();
}

// 📅 Auxiliar para convertir "DD/MM/YYYY" a objeto Fecha real
function parsearFechaPOS(fechaStr) {
    let partes = fechaStr.split('/');
    return new Date(partes[2], partes[1] - 1, partes[0]);
}

// 🔍 Motor inteligente de búsqueda y filtrado
function filtrarFacturas() {
    let textoBusqueda = document.getElementById('filtro_fact_cliente').value.toLowerCase();
    let condicionBusqueda = document.getElementById('filtro_fact_condicion').value;
    let tipoFecha = document.getElementById('filtro_fact_fecha').value;
    
    let strDesde = document.getElementById('filtro_fecha_desde').value;
    let strHasta = document.getElementById('filtro_fecha_hasta').value;

    // Calculamos el "Hoy" a las 00:00:00 para comparar exacto
    let hoyObj = new Date();
    hoyObj.setHours(0,0,0,0);

    let facturasFiltradas = cacheFacturas.filter(f => {
        let coincideTexto = f.cliente.toLowerCase().includes(textoBusqueda) || f.numero_factura.toLowerCase().includes(textoBusqueda);
        
        // --- AQUÍ ESTÁ LA CORRECCIÓN DE LA TILDE ---
        let condFactura = f.condicion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let condBusqueda = condicionBusqueda.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // CORRECCIÓN: Usamos condBusqueda (que ya está forzada a minúsculas) en la primera validación
        let coincideCondicion = condBusqueda === "todas" || condFactura === condBusqueda || condFactura.includes(condBusqueda);
        // -------------------------------------------
                    
        // --- 📅 LÓGICA DE FECHAS ---
        let coincideFecha = true;
        if (tipoFecha !== "Todas") {
            let fObj = parsearFechaPOS(f.fecha);
            
            if (tipoFecha === "Hoy") {
                coincideFecha = fObj.getTime() === hoyObj.getTime();
            } 
            else if (tipoFecha === "Semana") {
                let semanaAtras = new Date(hoyObj);
                semanaAtras.setDate(semanaAtras.getDate() - 7);
                coincideFecha = fObj >= semanaAtras && fObj <= hoyObj;
            } 
            else if (tipoFecha === "Mes") {
                coincideFecha = fObj.getMonth() === hoyObj.getMonth() && fObj.getFullYear() === hoyObj.getFullYear();
            } 
            else if (tipoFecha === "Personalizado") {
                if (strDesde && strHasta) {
                    let dDesde = new Date(strDesde.split('-')[0], strDesde.split('-')[1] - 1, strDesde.split('-')[2]);
                    let dHasta = new Date(strHasta.split('-')[0], strHasta.split('-')[1] - 1, strHasta.split('-')[2]);
                    coincideFecha = fObj >= dDesde && fObj <= dHasta;
                }
            }
        }

        return coincideTexto && coincideCondicion && coincideFecha;
    });

    renderizarTablaFacturas(facturasFiltradas);
}

// 🧮 Motor de dibujo y matemáticas
function renderizarTablaFacturas(facturas) {
    let html = '';
    let totalFacturado = 0;
    let totalCobrado = 0;
    let totalCredito = 0;

    if (facturas.length === 0) {
        html = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic font-medium">No se encontraron facturas con los filtros seleccionados.</td></tr>`;
    } else {
        facturas.forEach((f, i) => {
            let saldo = f.saldo_pendiente || 0;
            
            // 💰 Cálculos matemáticos en vivo
            totalFacturado += f.total;
            totalCredito += saldo;
            totalCobrado += (f.total - saldo); // Solo lo que ya se pagó

            // 🎨 Estilos visuales inteligentes
            let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
            let colorCondicion = saldo > 0 ? 'text-red-700 bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-100 border-emerald-200';
            let textoCondicion = saldo > 0 ? f.condicion : 'Pagado';
            
            // Botones interactivos
            let botonCobrar = saldo > 0 
                ? `<button onclick="abrirModalCobro('${f.numero_factura}', ${saldo}, '${f.cliente}')" class="bg-emerald-600 text-white hover:bg-emerald-700 px-2.5 py-1.5 rounded shadow-sm text-xs font-bold transition">💳 Cobrar</button>` 
                : `<span class="px-2 py-1 text-xs text-gray-400 font-bold italic">Sin deuda</span>`;
            
            html += `
            <tr class="${bg} hover:bg-gray-100 transition-colors border-b border-gray-100">
                <td class="px-3 py-3 font-mono font-black text-gray-800">${f.numero_factura}</td>
                <td class="px-3 py-3 font-bold text-gray-900">${f.cliente}</td>
                <td class="px-3 py-3 text-center">
                    <span class="px-2 py-1 rounded font-bold text-[11px] border ${colorCondicion}">${textoCondicion}</span>
                </td>
                <td class="px-3 py-3 text-right font-mono font-bold text-gray-600 text-sm">${formMoneda(f.total)}</td>
                <td class="px-3 py-3 text-right font-mono font-black ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'} text-base">${formMoneda(saldo)}</td>
                <td class="px-3 py-3 text-center whitespace-nowrap flex justify-center items-center gap-1">
                    ${botonCobrar}
                    <button onclick="reimprimirFactura('${f.numero_factura}')" class="bg-gray-800 text-white hover:bg-black px-2.5 py-1.5 rounded shadow-sm text-xs font-bold transition">🖨️ Ticket</button>
                </td>
            </tr>`;
        });
    }

    // Dibujamos la tabla y estampamos los totales en las tarjetas
    document.getElementById('tabla-historial-facturas').innerHTML = html;
    document.getElementById('lbl_fact_total').innerText = formMoneda(totalFacturado);
    document.getElementById('lbl_fact_cobrado').innerText = formMoneda(totalCobrado);
    document.getElementById('lbl_fact_credito').innerText = formMoneda(totalCredito);
}

function reimprimirFactura(numFac) {
    let f = cacheFacturas.find(x => x.numero_factura === numFac);
    if(!f) return;
    
    // 💡 CAMBIO: Ahora le pasamos la moneda, los bolívares y el saldo a la impresora
    imprimirTicketPOS(
        f.numero_factura, 
        f.cliente, 
        f.condicion, 
        f.total, 
        f.detalles, 
        f.descuento_tipo, 
        f.descuento_valor, 
        f.fecha_vencimiento, 
        f.tasa_cambio, 
        f.monto_ves, 
        f.moneda, 
        f.saldo_pendiente
    );
}

function imprimirTicketPOS(numeroFactura, clienteNombre, condicion, totalUsd, items, descTipo, descValor, fechaVencimiento, tasaCambio, montoBs, moneda, saldoPendiente) {
    items = items || [];
    let ventanilla = window.open('', '_blank', 'width=350,height=600');
    let fecha = new Date().toLocaleString('es-VE');
    
    let htmlItems = '';
    items.forEach(item => {
        let txtCant = (item.cantidad_cartones >= 12 && item.cantidad_cartones % 12 === 0) ? `${item.cantidad_cartones / 12} CJ` : `${item.cantidad_cartones} CT`;
        htmlItems += `
            <tr>
                <td style="padding: 4px 0;">${item.nombre}</td>
                <td style="text-align:center; padding: 4px 0;">${txtCant}</td>
                <td style="text-align:right; padding: 4px 0;">${formMoneda(item.subtotal)}</td>
            </tr>
        `;
    });

    let textoDescuento = '';
    if (descValor > 0) {
        let desc = descTipo === '%' ? `${descValor}%` : `$${descValor}`;
        textoDescuento = `<p style="text-align:right; margin: 4px 0;"><strong>Descuento:</strong> -${desc}</p>`;
    }

    // 🔥 NUEVA LÓGICA: Determinar si ya pagó su deuda para borrar la fecha de vencimiento
    let textoCondicion = condicion;
    let textoVencimiento = '';
    if (condicion === 'Crédito') {
        if (saldoPendiente <= 0) {
            textoCondicion = 'Crédito (PAGADO)';
        } else if (fechaVencimiento) {
            textoVencimiento = `<p><strong>Vence:</strong> ${fechaVencimiento}</p>`;
        }
    }

    // 🔥 NUEVA LÓGICA: Forzar el dibujo de los Bolívares leyendo la base de datos
    let bloqueTotalHTML = '';
    if (moneda === 'VES') {
        let tasa = tasaCambio || TASA_BCV_ACTUAL; 
        let totalEnBs = montoBs > 0 ? montoBs : (parseFloat(totalUsd) * tasa);
        
        bloqueTotalHTML = `
            <div class="total" style="font-size: 15px;">TOTAL: Bs ${totalEnBs.toFixed(2)}</div>
            <div class="center" style="font-size: 11px; margin-top: 3px;">
                (Eqv. a ${formMoneda(totalUsd)} - Tasa: ${tasa.toFixed(2)})
            </div>
        `;
    } else {
        bloqueTotalHTML = `<div class="total">TOTAL: ${formMoneda(totalUsd)}</div>`;
    }

    let html = `
    <html>
    <head>
        <title>Ticket ${numeroFactura}</title>
        <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0 auto; padding: 10px; width: 80mm; color: #000; }
            h2 { text-align: center; margin: 5px 0; font-size: 16px; font-weight: 900; text-transform: uppercase; }
            p { margin: 3px 0; }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { border-bottom: 1px dashed #000; padding-bottom: 5px; text-align: left; }
            .total { font-size: 15px; font-weight: 900; text-align: right; margin-top: 10px; }
            .nofiscal { text-align: center; font-size: 14px; font-weight: 900; margin-bottom: 5px; letter-spacing: 1px;}
            
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { width: 80mm; margin: 0; padding: 5mm; }
            }
        </style>
    </head>
    <body>
        <div class="nofiscal">*** NO FISCAL ***</div>
        <h2>Granja La Comarca</h2>
        <p class="center">Gestión Avícola</p>
        <p class="center">El Vigía, Edo. Mérida</p>
        <div class="divider"></div>
        <p><strong>Factura:</strong> ${numeroFactura}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Cliente:</strong> ${clienteNombre}</p>
        <p><strong>Condición:</strong> ${textoCondicion}</p>
        ${textoVencimiento}
        <div class="divider"></div>
        <table>
            <thead>
                <tr>
                    <th>Producto</th>
                    <th style="text-align:center">Cant</th>
                    <th style="text-align:right">SubT</th>
                </tr>
            </thead>
            <tbody>
                ${htmlItems}
            </tbody>
        </table>
        <div class="divider"></div>
        ${textoDescuento}
        
        ${bloqueTotalHTML}
        
        <div class="divider"></div>
        <p class="center" style="font-size: 10px; margin-top: 15px;">*** GRACIAS POR SU COMPRA ***</p>
        
        <script>
            window.onload = function() { 
                setTimeout(() => { 
                    window.print(); 
                }, 500);
            }
        </script>
    </body>
    </html>
    `;
    
    ventanilla.document.write(html);
    ventanilla.document.close();
}

// =========================================
// MÓDULO DE COBRANZA
// =========================================
function abrirModalCobro(factura, deuda, cliente) {
    document.getElementById('cobro_cliente').innerText = cliente;
    document.getElementById('cobro_factura').innerText = factura;
    document.getElementById('cobro_deuda').innerText = deuda.toFixed(2);
    document.getElementById('cobro_monto').value = '';
    document.getElementById('cobro_monto').max = deuda; 
    document.getElementById('modalCobro').classList.remove('hidden');
}

function cerrarModalCobro() {
    document.getElementById('modalCobro').classList.add('hidden');
}

async function procesarCobro(e) {
    e.preventDefault();
    let btnSubmit = e.target.querySelector('button[type="submit"]');
    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerText = "Procesando...";
    }

    let montoCobradoUsd = parseFloat(document.getElementById('cobro_monto').value);
    let metodoSeleccionado = document.getElementById('cobro_metodo').value;

    let usaBolivares = (metodoSeleccionado === 'Transferencia Bancaria' || metodoSeleccionado === 'Pago Móvil' || metodoSeleccionado === 'Transferencia');
    let tasaParaBD = usaBolivares ? TASA_BCV_ACTUAL : 1.0;
    let vesParaBD = usaBolivares ? (montoCobradoUsd * TASA_BCV_ACTUAL) : 0.0;

    // Capturamos los textos del cliente y la factura directamente de la ventanita
    let facturaTxt = document.getElementById('cobro_factura').innerText;
    let clienteTxt = document.getElementById('cobro_cliente').innerText;

    let datos = {
        numero_factura: facturaTxt,
        monto: montoCobradoUsd,
        metodo_pago: metodoSeleccionado,
        tasa_cambio: tasaParaBD, 
        monto_ves: vesParaBD     
    };

    try {
        let r = await fetch('/facturacion/abonar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(datos)
        });
        let res = await r.json();
        
        if(r.ok) {
            mostrarRespuesta(res);
            cerrarModalCobro();
            cargarHistorialFacturas(); 
            actualizarBalance();       

            // 🔥 IMPRESIÓN OPCIONAL: Pregunta antes de imprimir
            setTimeout(() => {
                if(confirm("✅ El dinero ingresó a la caja correctamente.\n\n¿Deseas imprimir el comprobante de este abono?")) {
                    imprimirTicketCobro(facturaTxt, clienteTxt, montoCobradoUsd, metodoSeleccionado, tasaParaBD, vesParaBD);
                }
            }, 400); // Pausa breve para que no choque con la notificación verde

        } else {
            alert("⚠️ Error: " + res.detail);
        }
    } catch(err) {
        alert("Error de conexión al procesar el cobro.");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Procesar Ingreso a Caja";
        }
    }
}

function imprimirTicketCobro(numeroFactura, clienteNombre, montoUsd, metodo, tasa, montoBs) {
    let ventanilla = window.open('', '_blank', 'width=350,height=600');
    let fecha = new Date().toLocaleString('es-VE');

    // 🔥 LÓGICA INTELIGENTE DE MONEDA PARA EL ABONO
    let bloqueTotalHTML = '';
    if (metodo === 'Efectivo' || metodo === 'Zelle') {
        bloqueTotalHTML = `<div class="total">TOTAL: ${formMoneda(montoUsd)}</div>`;
    } else {
        bloqueTotalHTML = `
            <div class="total" style="font-size: 15px;">TOTAL: Bs ${montoBs.toFixed(2)}</div>
            <div class="center" style="font-size: 11px; margin-top: 3px;">
                (Eqv. a ${formMoneda(montoUsd)} - Tasa: ${tasa.toFixed(2)})
            </div>
        `;
    }

    // Usamos EXACTAMENTE la misma estructura HTML, CSS y de Tablas de la factura original
    let html = `
    <html>
    <head>
        <title>Recibo Abono ${numeroFactura}</title>
        <style>
            body { font-family: 'Courier New', Courier, monospace; font-size: 12px; margin: 0 auto; padding: 10px; width: 80mm; color: #000; }
            h2 { text-align: center; margin: 5px 0; font-size: 16px; font-weight: 900; text-transform: uppercase; }
            p { margin: 3px 0; }
            .center { text-align: center; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { border-bottom: 1px dashed #000; padding-bottom: 5px; text-align: left; }
            .total { font-size: 15px; font-weight: 900; text-align: right; margin-top: 10px; }
            .nofiscal { text-align: center; font-size: 14px; font-weight: 900; margin-bottom: 5px; letter-spacing: 1px;}
            
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { width: 80mm; margin: 0; padding: 5mm; }
            }
        </style>
    </head>
    <body>
        <div class="nofiscal">*** NO FISCAL ***</div>
        <h2>Granja La Comarca</h2>
        <p class="center">Gestión Avícola</p>
        <p class="center">El Vigía, Edo. Mérida</p>
        <div class="divider"></div>
        <p><strong>Factura:</strong> ${numeroFactura}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Cliente:</strong> ${clienteNombre}</p>
        <p><strong>Condición:</strong> Abono a Deuda</p>
        <div class="divider"></div>
        <table>
            <thead>
                <tr>
                    <th>Concepto</th>
                    <th style="text-align:center">Método</th>
                    <th style="text-align:right">SubT</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 4px 0;">Pago parcial</td>
                    <td style="text-align:center; padding: 4px 0;">${metodo}</td>
                    <td style="text-align:right; padding: 4px 0;">${formMoneda(montoUsd)}</td>
                </tr>
            </tbody>
        </table>
        <div class="divider"></div>
        
        ${bloqueTotalHTML}
        
        <div class="divider"></div>
        <p class="center" style="font-size: 10px; margin-top: 15px;">*** TRANSACCIÓN APROBADA ***</p>
        
        <script>
            window.onload = function() { 
                setTimeout(() => { 
                    window.print(); 
                }, 500);
            }
        </script>
    </body>
    </html>
    `;
    
    ventanilla.document.write(html);
    ventanilla.document.close();
}

// =========================================
// MÓDULO DE GASTOS
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. CORRECCIÓN: El ID exacto que está en el HTML
    const formGasto = document.getElementById('formOtroGasto'); 
    
    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault(); // Esto detiene la recarga molesta de la página
            
            let boton = e.target.querySelector('button[type="submit"]');
            if (boton) {
                boton.disabled = true;
                boton.innerText = "Guardando...";
            }

            let costoUsd = parseFloat(document.getElementById('gasto_monto').value); 
            
            let pagaEnBolivares = false;
            if(costoUsd > 0) {
                pagaEnBolivares = confirm("¿Pagaste este gasto en Bolívares (Pago Móvil/Transferencia)?\n\nDale a 'Aceptar' para Bolívares, o 'Cancelar' para Efectivo/Zelle.");
            }

            let inputFecha = document.getElementById('gasto_fecha') ? document.getElementById('gasto_fecha').value.trim() : "";
            let fechaSegura = inputFecha !== "" ? inputFecha : hoy;

            // Agregamos lote_id y formateamos mejor los datos
            let datos = {
                lote_id: 1, // ¡Este era el dato que exigía FastAPI para no dar error 422!
                concepto: document.getElementById('gasto_concepto').value,
                total_gasto: costoUsd,
                fecha: fechaSegura,
                categoria: document.getElementById('gasto_cat').value, 
                
                moneda: pagaEnBolivares ? "VES" : "USD",
                tasa_cambio: pagaEnBolivares ? TASA_BCV_ACTUAL : 1.0,
                monto_ves: pagaEnBolivares ? (costoUsd * TASA_BCV_ACTUAL) : 0.0
            };

            try {
                let r = await fetch('/finanzas/registrar-gasto', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(datos)
                });
                let res = await r.json();
                
                if(r.ok) {
                    formGasto.reset();
                    actualizarBalance(); 
                    mostrarRespuesta({mensaje: "✅ Gasto registrado y restado de la caja correctamente"});
                } else {
                    // Si FastAPI manda un array de errores (como el 422), lo convertimos a texto legible
                    let msjError = typeof res.detail === 'string' ? res.detail : JSON.stringify(res.detail);
                    alert("⚠️ Error del Servidor:\n" + msjError);
                }
            } catch (error) {
                alert("Error de red al guardar el gasto.");
            } finally {
                if (boton) {
                    boton.disabled = false;
                    boton.innerText = "Restar de la Caja General";
                }
            }
        });
    }
});

// =========================================
// INTERFAZ MÓVIL
// =========================================
function toggleMenu() {
    document.getElementById('sidebarMenu').classList.toggle('-translate-x-full');
}

// Sobrescribimos la función cambiarPestana para que cierre el menú al tocar una opción en el celular
const cambiarPestanaOriginal = cambiarPestana;
cambiarPestana = function(panelId) {
    cambiarPestanaOriginal(panelId);
    // Si estamos en un celular (pantalla pequeña), cerramos el menú automáticamente
    if (window.innerWidth < 768) {
        document.getElementById('sidebarMenu').classList.add('-translate-x-full');
    }
};