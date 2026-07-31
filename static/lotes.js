// =========================================
// MÓDULO DE LOTES, PRODUCCIÓN Y ALIMENTACIÓN
// =========================================

async function renderizarFichas(lote_id_especifico = "") {
    const contenedor = document.getElementById('contenedor-fichas-lotes');
    if(!contenedor) return;
    
    contenedor.innerHTML = '<div class="p-10 text-center text-gray-500 font-bold animate-pulse">Cargando base de datos...</div>';
    
    try {
        let ids_a_dibujar = [];
        
        if (lote_id_especifico === "") {
            let res = await fetch('/lotes/activos');
            let activos = await res.json();
            ids_a_dibujar = activos.map(a => a.id);
        } else {
            ids_a_dibujar = [lote_id_especifico];
        }

        if (ids_a_dibujar.length === 0) {
            contenedor.innerHTML = '<div class="p-10 text-center text-gray-400 font-bold italic">No hay lotes en producción actualmente. ¡Registra uno nuevo!</div>';
            return;
        }

        let htmlFinal = "";
        
        for (let id of ids_a_dibujar) {
            let r = await fetch(`/lotes/${id}/resumen`);
            if (r.ok) {
                let d = await r.json();
                
                let fn = d.fecha_nacimiento.split('-');
                let fn_fmt = `${fn[2]}/${fn[1]}/${fn[0]}`;
                let fi = d.fecha_ingreso.split('-');
                let fi_fmt = `${fi[2]}/${fi[1]}/${fi[0]}`;

                htmlFinal += `
                <div class="border-b-8 border-gray-200 last:border-b-0">
                    <div class="hidden md:grid md:grid-cols-5 bg-comarca-dorado text-black uppercase font-bold text-[10px] divide-x divide-yellow-600 border-b border-yellow-600">
                        <div class="px-4 py-2">Lote / Galpón</div>
                        <div class="px-4 py-2">Fechas Importantes</div>
                        <div class="px-4 py-2">Edad Actual</div>
                        <div class="px-4 py-2">Aves Hoy</div>
                        <div class="px-4 py-2">Desglose Levante</div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-gray-200 bg-white text-gray-800 text-sm">
                        <div class="px-4 py-4 flex flex-col justify-start hover:bg-gray-50 transition-colors">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Lote / Galpón</span>
                            <span class="font-black text-xl text-comarca-rojo leading-none mb-1">${d.codigo}</span>
                            <span class="text-xs text-gray-500">${d.raza}</span>
                            <span class="text-xs font-bold text-gray-800 mt-1">${d.galpon}</span>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-start text-xs hover:bg-gray-50 transition-colors">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Fechas Importantes</span>
                            <div><span class="text-gray-500 font-bold">Nacimiento:</span> <span class="font-mono font-bold text-gray-900">${fn_fmt}</span></div>
                            <div class="mt-1"><span class="text-gray-500 font-bold">Ingreso:</span> <span class="font-mono font-bold text-gray-900">${fi_fmt}</span></div>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-start hover:bg-gray-50 transition-colors">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Edad Actual</span>
                            <span class="font-bold text-base leading-none mb-1 text-gray-900">${d.edad_semanas} Semanas</span>
                            <span class="text-[10px] text-gray-400 font-bold">Faltan ${d.semanas_faltantes} sem.</span>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-start hover:bg-gray-50 transition-colors">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Aves Hoy</span>
                            <span class="font-black text-2xl leading-none mb-1 text-gray-900 font-mono">${d.aves_hoy.toLocaleString('en-US')}</span>
                            <span class="text-[10px] text-gray-500 font-bold mt-1">Bajas Totales: <span class="text-red-600 font-black text-xs">${d.porcentaje_mortalidad}%</span></span>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-start w-full hover:bg-gray-50 transition-colors">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-2 md:hidden">Desglose Levante</span>
                            <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] w-full">
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Aves:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.aves)}</span></div>
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Alim:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.alimento)}</span></div>
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Med:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.medicina)}</span></div>
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Sueldo:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.salarios)}</span></div>
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Aseo:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.higiene)}</span></div>
                                <div class="flex justify-between border-b border-gray-100 pb-1"><span class="text-gray-500 font-bold">Otros:</span> <span class="font-mono font-bold">${formMoneda(d.desglose.otros)}</span></div>
                            </div>
                            <div class="flex flex-wrap items-center justify-between mt-2 py-1 bg-red-50 px-2 rounded">
                                <span class="text-comarca-rojo font-black uppercase text-[10px]">Inversión:</span>
                                <span class="font-black text-comarca-rojo font-mono text-sm">${formMoneda(d.inversion_levante)}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }
        }
        
        contenedor.innerHTML = htmlFinal;

    } catch(e) {
        contenedor.innerHTML = '<div class="p-8 text-center text-red-600 font-bold">Error de conexión al generar las fichas.</div>';
    }
}

async function cargarLotesActivos() {
    try {
        let resActivos = await fetch('/lotes/activos');
        if (resActivos.ok) {
            let lotesActivos = await resActivos.json();
            let opcionesActivas = '<option value="" disabled selected>Seleccione un Lote...</option>';
            lotesActivos.forEach(l => { opcionesActivas += `<option value="${l.id}">${l.etiqueta}</option>`; });
            
            ['lote_id_prod', 'lote_id_alim', 'select_grafico_lote', 'corr_prod_lote', 'corr_alim_lote', 'gasto_levante_lote'].forEach(id => {
                if(document.getElementById(id)) document.getElementById(id).innerHTML = opcionesActivas;
            });
        }

        let resTodos = await fetch('/lotes/todos');
        if (resTodos.ok) {
            let todos = await resTodos.json();
            let opcionesTodos = '<option value="" selected>🌟 VER TODOS EN PRODUCCIÓN 🌟</option>';
            let opcionesEditar = '<option value="" disabled selected>Despliega y elige el lote a editar...</option>';
            
            todos.forEach(l => { 
                opcionesTodos += `<option value="${l.id}">${l.etiqueta}</option>`; 
                // Llenamos también el nuevo desplegable de editar
                opcionesEditar += `<option value="${l.id}">${l.etiqueta}</option>`; 
            });
            
            if(document.getElementById('buscador_lote')) document.getElementById('buscador_lote').innerHTML = opcionesTodos;
            if(document.getElementById('edit_buscar_id')) document.getElementById('edit_buscar_id').innerHTML = opcionesEditar;
        }

        renderizarFichas(document.getElementById('buscador_lote') ? document.getElementById('buscador_lote').value : "");

    } catch(e) { console.error("Error cargando lotes", e); }
}

// --- FORMULARIOS OPERATIVOS Y CORRECTORES ---
document.addEventListener("DOMContentLoaded", () => {
    
    let formGastoLevante = document.getElementById('formGastoLevante');
    if(formGastoLevante) {
        formGastoLevante.addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('gasto_levante_lote').value),
                tipo_gasto: document.getElementById('gasto_levante_tipo').value,
                concepto: document.getElementById('gasto_levante_concepto').value,
                monto: parseFloat(document.getElementById('gasto_levante_monto').value),
                fecha: document.getElementById('gasto_levante_fecha').value
            };
            try {
                let r = await fetch('/lotes/gasto-levante', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
                let res = await r.json();
                mostrarAviso(res.mensaje);
                document.getElementById('formGastoLevante').reset();
                if(typeof toggleFomulariosLote === 'function') toggleFomulariosLote('cerrar');
                cargarLotesActivos(); 
            } catch(e) {
                mostrarAviso("Error al registrar la inversión.", true);
            }
        });
    }

    let formLote = document.getElementById('formLote');
    if(formLote) {
        formLote.addEventListener('submit', async (e) => {
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
            
            cargarLotesActivos();
            if(typeof toggleFomulariosLote === 'function') toggleFomulariosLote('cerrar');
            document.getElementById('formLote').reset();
            if(typeof actualizarBalance === 'function') actualizarBalance();
        });
    }

    let formReporte = document.getElementById('formReporte');
    if(formReporte) {
        formReporte.addEventListener('submit', async (e) => {
            e.preventDefault();
            ultimoLoteTrabajado = document.getElementById('lote_id_prod').value;
            let datos = {
                lote_id: parseInt(document.getElementById('lote_id_prod').value),
                cantidad_huevos: parseInt(document.getElementById('cantidad_huevos').value),
                mortalidad: parseInt(document.getElementById('mortalidad').value),
                fecha: document.getElementById('fecha_prod').value
            };
            let r = await fetch('/produccion/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            
            cargarLotesActivos(); 
            if(typeof actualizarBalance === 'function') actualizarBalance();
        });
    }

    let formAlimento = document.getElementById('formAlimento');
    if(formAlimento) {
        formAlimento.addEventListener('submit', async (e) => {
            e.preventDefault();
            ultimoLoteTrabajado = document.getElementById('lote_id_alim').value;
            let datos = {
                lote_id: parseInt(document.getElementById('lote_id_alim').value),
                kilos_consumidos: parseFloat(document.getElementById('kilos_consumidos').value),
                fecha: document.getElementById('fecha_alim').value
            };
            let r = await fetch('/alimentacion/registrar-consumo', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json());
            if(typeof cargarInsumos === 'function') cargarInsumos();
        });
    }

    let formEditarLote = document.getElementById('formEditarLote');
    if(formEditarLote) {
        formEditarLote.addEventListener('submit', async (e) => {
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
            
            cargarLotesActivos(); 
            if(typeof toggleFomulariosLote === 'function') toggleFomulariosLote('cerrar');
        });
    }

    let formCorrProd = document.getElementById('formCorrProd');
    if(formCorrProd) {
        formCorrProd.addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('corr_prod_lote').value),
                fecha: document.getElementById('corr_prod_fecha').value,
                cantidad_huevos: parseInt(document.getElementById('nuevo_cant_huevos').value),
                mortalidad: parseInt(document.getElementById('nuevo_mortalidad').value)
            };
            let r = await fetch('/produccion/corregir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            let res = await r.json();
            
            if(r.ok) {
                mostrarAviso(res.mensaje);
                document.getElementById('formCorrProd').classList.add('hidden');
                cargarHistorial(30); 
                cargarLotesActivos(); 
            } else {
                mostrarAviso(res.detail || "Error al corregir el registro", true);
            }
        });
    }

    let formCorrAlim = document.getElementById('formCorrAlim');
    if(formCorrAlim) {
        formCorrAlim.addEventListener('submit', async (e) => {
            e.preventDefault();
            let datos = {
                lote_id: parseInt(document.getElementById('corr_alim_lote').value),
                fecha: document.getElementById('corr_alim_fecha').value,
                kilos_consumidos: parseFloat(document.getElementById('nuevo_kilos').value)
            };
            let r = await fetch('/alimento/corregir', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            let res = await r.json();
            
            if(r.ok) {
                mostrarAviso(res.mensaje);
                document.getElementById('formCorrAlim').classList.add('hidden');
                cargarHistorial(30); 
                if(typeof cargarInsumos === 'function') cargarInsumos();
            } else {
                mostrarAviso(res.detail || "Error al corregir el alimento", true);
            }
        });
    }
});

// =========================================
// FUNCIONES DE CORRECTORES Y BÚSQUEDAS
// =========================================
function mostrarAviso(mensaje, esError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-5 right-5 ${esError ? 'bg-red-600' : 'bg-blue-600'} text-white px-6 py-3 rounded-lg shadow-xl font-bold z-50 toast-exito`;
    toast.innerText = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

async function buscarLoteParaEditar() {
    let id = document.getElementById('edit_buscar_id').value;
    if(!id) {
        mostrarAviso("Por favor, selecciona un lote de la lista primero.", true);
        return;
    }
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
            mostrarAviso("Lote cargado. Listo para corregir.");
        } else {
            mostrarAviso("No se pudo cargar la información de ese Lote.", true);
            document.getElementById('formEditarLote').classList.add('hidden');
        }
    } catch(e) { mostrarAviso("Error de red al buscar.", true); }
}

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
            mostrarAviso("Registro de Producción encontrado.");
        } else {
            mostrarAviso("No hay registro de producción para esa fecha.", true);
            document.getElementById('formCorrProd').classList.add('hidden');
        }
    } catch(e) { mostrarAviso("Error de red al buscar.", true); }
}

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
            mostrarAviso(`El empleado registró: ${d.kilos_consumidos} Kg de alimento.`);
        } else {
            mostrarAviso("No hay registro de alimento para esa fecha.", true);
            document.getElementById('formCorrAlim').classList.add('hidden');
        }
    } catch(e) { mostrarAviso("Error de red.", true); }
}

// =========================================
// HISTORIAL ACUMULADO (POSTURA CORREGIDA)
// =========================================
async function cargarHistorial(dias) {
    // 1. Colorear el botón activo (Dorado)
    [7, 30, 0].forEach(d => {
        let btn = document.getElementById('btn-hist-' + d);
        if (btn) {
            if (d === dias) {
                btn.className = `px-4 py-2 text-[11px] font-black uppercase border ${d===7?'rounded-l':(d===0?'rounded-r':'border-t border-b')} bg-comarca-dorado text-black border-comarca-dorado transition-colors`;
            } else {
                btn.className = `px-4 py-2 text-[11px] font-black uppercase border ${d===7?'rounded-l':(d===0?'rounded-r':'border-t border-b')} bg-white text-gray-700 border-gray-300 hover:bg-gray-100 transition-colors`;
            }
        }
    });

    try {
        let r = await fetch('/historial/' + dias + '?_t=' + new Date().getTime());
        let datos = await r.json();
        let html = '';
        
        let totalHuevos = 0;
        let totalMortalidad = 0;
        let totalAlimento = 0;
        
        if (datos.length === 0) {
            html = `<div class="p-10 text-center text-gray-400 italic font-bold text-sm">No hay registros guardados para este periodo.</div>`;
        } else {
            // Encabezados para pantalla ancha
            html += `
            <div class="hidden lg:grid lg:grid-cols-7 bg-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-wider p-3 border-b border-gray-300">
                <div class="px-2">Fecha</div>
                <div class="col-span-2 px-2">Lote / Galpón</div>
                <div class="text-right px-2">Huevos</div>
                <div class="text-right px-2">Bajas</div>
                <div class="text-right px-2">Alimento (Kg)</div>
                <div class="text-center px-2">Rendimiento</div>
            </div>`;

            datos.forEach((reg, i) => {
                let bg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                let f = reg.fecha.split('-');
                let fechaFormateada = `${f[2]}/${f[1]}/${f[0]}`;
                
                totalHuevos += reg.huevos;
                totalMortalidad += reg.mortalidad;
                totalAlimento += reg.alimento;
                
                // Conversión de gramos por huevo
                let conversionStr = reg.conversion > 0 ? `${parseFloat(reg.conversion).toFixed(1)} g` : '-';
                
                // 🛠️ VALIDACIÓN BLINDADA PARA LA POSTURA
                let valPostura = reg.porcentaje_postura ?? reg.postura ?? reg.postura_pct ?? 0;
                let posturaStr = '-';
                
                if (typeof valPostura === 'string' && valPostura.includes('%')) {
                    posturaStr = valPostura;
                } else if (!isNaN(parseFloat(valPostura)) && parseFloat(valPostura) > 0) {
                    posturaStr = parseFloat(valPostura).toFixed(1) + '%';
                }

                html += `
                <div class="${bg} p-4 hover:bg-yellow-50/40 transition-colors flex flex-col lg:grid lg:grid-cols-7 lg:items-center gap-3 lg:gap-4 border-b border-gray-200">
                    
                    <div class="flex justify-between items-center lg:block px-2 lg:px-0">
                        <span class="font-mono font-bold text-gray-600 text-sm">${fechaFormateada}</span>
                        <span class="text-[10px] font-black text-comarca-rojo lg:hidden uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">${reg.lote_nombre}</span>
                    </div>
                    
                    <div class="hidden lg:block col-span-2 px-2">
                        <span class="text-comarca-rojo font-black text-sm uppercase">${reg.lote_nombre}</span>
                    </div>

                    <div class="grid grid-cols-3 lg:col-span-4 lg:grid-cols-4 gap-2 lg:gap-0">
                        <div class="flex flex-col lg:text-right bg-gray-50 lg:bg-transparent p-2 lg:p-0 rounded border border-gray-200 lg:border-0 lg:px-2">
                            <span class="text-[9px] font-black text-gray-400 uppercase lg:hidden mb-0.5">Huevos</span>
                            <span class="font-mono font-black text-gray-800 text-sm sm:text-base">${reg.huevos.toLocaleString('en-US')}</span>
                        </div>
                        <div class="flex flex-col lg:text-right bg-red-50 lg:bg-transparent p-2 lg:p-0 rounded border border-red-100 lg:border-0 lg:px-2">
                            <span class="text-[9px] font-black text-red-400 uppercase lg:hidden mb-0.5">Bajas</span>
                            <span class="font-mono font-black text-red-600 text-sm sm:text-base">${reg.mortalidad}</span>
                        </div>
                        <div class="flex flex-col lg:text-right bg-yellow-50 lg:bg-transparent p-2 lg:p-0 rounded border border-yellow-200 lg:border-0 lg:px-2">
                            <span class="text-[9px] font-black text-yellow-600 uppercase lg:hidden mb-0.5">Alim (Kg)</span>
                            <span class="font-mono font-black text-gray-800 text-sm sm:text-base">${reg.alimento.toFixed(2)}</span>
                        </div>
                        
                        <div class="col-span-3 lg:col-span-1 flex flex-row lg:flex-col justify-around lg:justify-center items-center bg-blue-50 lg:bg-transparent p-2 lg:p-0 rounded border border-blue-100 lg:border-0 mt-1 lg:mt-0 lg:px-2">
                            <div class="text-center w-1/2 lg:w-full">
                                <span class="text-[9px] font-black text-blue-400 uppercase lg:hidden mr-1">Postura:</span>
                                <span class="font-bold text-blue-700 text-sm">${posturaStr}</span>
                            </div>
                            <div class="hidden lg:block w-full border-t border-gray-200 my-0.5"></div>
                            <div class="text-center w-1/2 lg:w-full border-l border-blue-100 lg:border-0">
                                <span class="text-[9px] font-black text-amber-500 uppercase lg:hidden mr-1 ml-2 lg:ml-0">Conv:</span>
                                <span class="font-bold text-amber-600 text-sm">${conversionStr}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            });
            
            // Barra de Totales
            html += `
            <div class="bg-yellow-100 border-t-4 border-comarca-dorado p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div class="text-center sm:text-left">
                    <span class="text-yellow-900 font-black uppercase tracking-wider text-sm">Total del Periodo Seleccionado</span>
                </div>
                <div class="grid grid-cols-3 gap-2 sm:gap-8 text-center sm:text-right">
                    <div>
                        <span class="block text-[9px] font-black text-yellow-700 uppercase mb-0.5">Huevos</span>
                        <span class="font-mono font-black text-xl text-yellow-900">${totalHuevos.toLocaleString('en-US')}</span>
                    </div>
                    <div>
                        <span class="block text-[9px] font-black text-red-500 uppercase mb-0.5">Bajas</span>
                        <span class="font-mono font-black text-xl text-red-700">${totalMortalidad}</span>
                    </div>
                    <div>
                        <span class="block text-[9px] font-black text-yellow-700 uppercase mb-0.5">Alimento</span>
                        <span class="font-mono font-black text-xl text-yellow-900">${totalAlimento.toFixed(2)} Kg</span>
                    </div>
                </div>
            </div>`;
        }
        
        let cont = document.getElementById('tabla-historial');
        if(cont) cont.innerHTML = html;
        
    } catch(e) { console.error("Error cargando historial", e); }
}

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

        let ctxPostura = document.getElementById('chartPostura');
        if(ctxPostura) {
            graficoPostura = new Chart(ctxPostura.getContext('2d'), {
                type: 'line',
                data: {
                    labels: etiquetas,
                    datasets: [{
                        label: '% de Postura',
                        data: datosPostura,
                        borderColor: '#8B0000',
                        backgroundColor: 'rgba(139, 0, 0, 0.1)',
                        borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#EAA000', fill: true, tension: 0.4
                    }]
                },
                options: { responsive: true, plugins: { title: { display: true, text: 'Curva de Producción Diaria (%)' } }, scales: { y: { beginAtZero: true, max: 100 } } }
            });
        }

        let ctxAlimento = document.getElementById('chartAlimento');
        if(ctxAlimento) {
            graficoAlimento = new Chart(ctxAlimento.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: etiquetas,
                    datasets: [{
                        label: 'Gramos por Ave (g)',
                        data: datosAlimento,
                        backgroundColor: '#EAA000', borderColor: '#B8860B', borderWidth: 1, borderRadius: 4
                    }]
                },
                options: { responsive: true, plugins: { title: { display: true, text: 'Ingesta Diaria de Alimento' } }, scales: { y: { beginAtZero: true } } }
            });
        }
    } catch(e) { console.error("Error al generar gráficos", e); }
}

// Inicializador Automático
document.addEventListener("DOMContentLoaded", () => {
    cargarHistorial(30);
    cargarLotesActivos(); 
});