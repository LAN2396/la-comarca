// =========================================
// MÓDULO DE LOTES, PRODUCCIÓN Y ALIMENTACIÓN
// =========================================

function alternarErrorLote(mostrar, mensaje = "") {
    const fila = document.getElementById('filaDatosLote');
    const cajaError = document.getElementById('msjErrorLote');
    if(!fila || !cajaError) return;
    
    if(mostrar) {
        fila.classList.add('hidden');
        cajaError.classList.remove('hidden');
        cajaError.innerText = mensaje;
    } else {
        fila.classList.remove('hidden');
        cajaError.classList.add('hidden');
    }
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

async function cargarLotesActivos() {
    try {
        let res = await fetch('/lotes/activos');
        if (res.ok) {
            let lotes = await res.json();
            let opcionesHTML = '<option value="" disabled selected>Seleccione un Lote...</option>';
            lotes.forEach(l => { opcionesHTML += `<option value="${l.id}">${l.etiqueta}</option>`; });

            if(document.getElementById('lote_id_prod')) document.getElementById('lote_id_prod').innerHTML = opcionesHTML;
            if(document.getElementById('lote_id_alim')) document.getElementById('lote_id_alim').innerHTML = opcionesHTML;
            if(document.getElementById('select_grafico_lote')) document.getElementById('select_grafico_lote').innerHTML = opcionesHTML;
            if(document.getElementById('corr_prod_lote')) document.getElementById('corr_prod_lote').innerHTML = opcionesHTML;
            if(document.getElementById('corr_alim_lote')) document.getElementById('corr_alim_lote').innerHTML = opcionesHTML;
            
            let buscador = document.getElementById('buscador_lote');
            if(buscador) {
                buscador.innerHTML = opcionesHTML;
                if(lotes.length > 0) {
                    buscador.value = lotes[0].id;
                    consultarResumenLote(lotes[0].id);
                }
            }
        }
    } catch(e) { console.error("Error cargando los lotes", e); }
}

// --- FORMULARIOS OPERATIVOS Y CORRECTORES ---
document.addEventListener("DOMContentLoaded", () => {
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
            document.getElementById('formEditarLote').classList.add('hidden');
            cargarLotesActivos();
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
            mostrarRespuesta(await r.json());
            document.getElementById('formCorrProd').classList.add('hidden');
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
            mostrarRespuesta(await r.json());
            document.getElementById('formCorrAlim').classList.add('hidden');
        });
    }
});

// BÚSQUEDA EN CORRECTORES
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

// --- MOTOR HISTORIAL ---
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
        let totalHuevos = 0, totalMortalidad = 0, totalAlimento = 0;
        
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
                    <td class="px-6 py-3 text-gray-800 font-bold">${reg.lote_nombre}</td> 
                    <td class="px-6 py-3 text-right font-mono text-gray-700">${reg.huevos.toLocaleString('en-US')}</td>
                    <td class="px-6 py-3 text-right font-mono text-red-600">${reg.mortalidad}</td>
                    <td class="px-6 py-3 text-right font-mono text-gray-700">${reg.alimento.toFixed(2)}</td>
                </tr>`;
            });
            
            html += `<tr class="bg-green-100 border-t-2 border-green-600 font-black text-green-900">
                <td colspan="2" class="px-6 py-4 text-right uppercase tracking-wider">Total:</td>
                <td class="px-6 py-4 text-right font-mono text-lg">${totalHuevos.toLocaleString('en-US')}</td>
                <td class="px-6 py-4 text-right font-mono text-lg text-red-700">${totalMortalidad}</td>
                <td class="px-6 py-4 text-right font-mono text-lg">${totalAlimento.toFixed(2)} Kg</td>
            </tr>`;
        }
        if(document.getElementById('tabla-historial')) document.getElementById('tabla-historial').innerHTML = html;
    } catch(e) { console.error("Error cargando historial", e); }
}

// --- GRÁFICOS CHART.JS ---
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