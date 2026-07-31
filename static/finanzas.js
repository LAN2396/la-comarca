// =========================================
// MÓDULO DE FINANZAS Y CAJA GENERAL
// =========================================
let chartDistribucionGastos = null;
let cacheFinanzas = [];
let deudaGlobalFinanzas = 0;

async function cargarDashboardFinanzas() {
    if (!usuarioActual) return;
    try {
        let r = await fetch(`/finanzas/dashboard?tasa_actual=${TASA_BCV_ACTUAL}`, { headers: { 'X-User': usuarioActual } });
        if(!r.ok) { let error = await r.json(); alert("⚠️ Error:\n" + (error.detail || "Fallo desconocido.")); return; }
        let data = await r.json();
        
        if(document.getElementById('lbl_caja_usd')) document.getElementById('lbl_caja_usd').innerText = formMoneda(data.caja_usd);
        let lblBanco = document.getElementById('lbl_banco_ves');
        if(lblBanco) lblBanco.innerHTML = `Bs ${data.banco_ves.toLocaleString('es-VE', {minimumFractionDigits: 2})}<br><span class="text-[10px] text-gray-500 font-bold tracking-wider uppercase">Eqv: ${formMoneda(data.usd_real_banco)}</span>`;

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
        
        if(document.getElementById('lbl_por_cobrar')) document.getElementById('lbl_por_cobrar').innerText = formMoneda(data.por_cobrar);

        cacheFinanzas = data.transacciones;
        deudaGlobalFinanzas = data.por_cobrar;
        filtrarFinanzas(); 
    } catch(e) { console.error("Error cargando finanzas:", e); }
}

function cambiarFiltroFechaFinanzas() {
    let tipo = document.getElementById('filtro_finanzas_fecha').value;
    let divRango = document.getElementById('rango_fechas_finanzas');
    if (tipo === 'Personalizado') divRango.classList.remove('hidden');
    else divRango.classList.add('hidden');
    filtrarFinanzas();
}

function filtrarFinanzas() {
    let tipoFecha = document.getElementById('filtro_finanzas_fecha').value;
    let strDesde = document.getElementById('filtro_fin_desde').value;
    let strHasta = document.getElementById('filtro_fin_hasta').value;
    let hoyObj = new Date(); hoyObj.setHours(0,0,0,0);

    let transFiltradas = cacheFinanzas.filter(t => {
        if (tipoFecha === "Todas") return true;
        let partes = t.fecha_raw.split('-'); 
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

    let ingresos = 0, gastos = 0;
    let categorias_gastos = {};
    let htmlTabla = '';

    if (transFiltradas.length === 0) {
        htmlTabla = `<div class="p-8 text-center text-gray-400 italic font-bold text-sm">No hay movimientos en este periodo.</div>`;
    } else {
        // ENCABEZADOS PC
        htmlTabla += `
        <div class="hidden lg:grid lg:grid-cols-6 bg-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-wider p-3 border-b border-gray-300">
            <div class="px-2">Fecha</div>
            <div class="text-center px-2">Tipo</div>
            <div class="col-span-3 px-2">Concepto del Movimiento</div>
            <div class="text-right px-2">Monto ($)</div>
        </div>`;

        transFiltradas.forEach((t, i) => {
            if (t.tipo === "Ingreso") {
                ingresos += t.monto;
                // Le quitamos las tildes al texto para que no haya margen de error
                let txt = t.concepto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                if (txt.includes("transferencia") || txt.includes("pago movil")) {
                    entradas_banco += t.monto;
                } else {
                    entradas_efectivo += t.monto;
                }
            } else {
                gastos += t.monto;
                categorias_gastos[t.categoria] = (categorias_gastos[t.categoria] || 0) + t.monto;
            }


            let bg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
            let esIngreso = t.tipo === "Ingreso";
            let colorPildora = esIngreso ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200';
            let colorMonto = esIngreso ? 'text-emerald-600' : 'text-red-600';
            let signo = esIngreso ? '+' : '-';

            // TARJETA RESPONSIVA TIPO APP BANCARIA
            htmlTabla += `
            <div class="${bg} p-4 hover:bg-gray-100 transition-colors flex flex-col lg:grid lg:grid-cols-6 lg:items-center gap-2 lg:gap-0 border-b border-gray-200">
                
                <!-- MÓVIL: Fila superior (Tipo y Fecha) -->
                <div class="flex justify-between items-center lg:hidden mb-2 border-b border-gray-100 pb-2">
                    <span class="px-2 py-1 rounded border font-black text-[10px] uppercase tracking-wider ${colorPildora}">${t.tipo}</span>
                    <span class="font-mono font-bold text-gray-500 text-xs">${t.fecha}</span>
                </div>

                <!-- PC: Fecha -->
                <div class="hidden lg:block font-mono font-bold text-gray-600 text-sm px-2">
                    ${t.fecha}
                </div>

                <!-- PC: Tipo -->
                <div class="hidden lg:block text-center px-2">
                    <span class="px-2 py-1 rounded border font-black text-[10px] uppercase tracking-wider ${colorPildora}">${t.tipo}</span>
                </div>
                
                <!-- AMBOS: Concepto y Categoría -->
                <div class="flex flex-col lg:col-span-3 px-2">
                    <span class="font-black text-gray-800 text-sm sm:text-base leading-tight">${t.concepto}</span>
                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-1">${t.categoria || 'GENERAL'}</span>
                </div>
                
                <!-- AMBOS: Monto -->
                <div class="text-right mt-2 lg:mt-0 pt-2 lg:pt-0 border-t border-gray-100 lg:border-none px-2">
                    <span class="font-mono font-black ${colorMonto} text-xl sm:text-2xl">${signo} ${formMoneda(t.monto)}</span>
                </div>
            </div>`;
        });
    }

    let balance = ingresos - gastos;
    let porcentajeGanancia = ingresos > 0 ? (balance / ingresos) * 100 : 0;
    
    if (document.getElementById('dash_ingresos')) document.getElementById('dash_ingresos').innerText = formMoneda(ingresos);
    if (document.getElementById('dash_egresos')) document.getElementById('dash_egresos').innerText = formMoneda(gastos);
    
    let lblGanancia = document.getElementById('lbl_porcentaje_ganancia');
    if (lblGanancia) {
        lblGanancia.innerText = porcentajeGanancia.toFixed(2) + "%";
        lblGanancia.className = `text-2xl font-black font-mono mt-1 ${porcentajeGanancia >= 0 ? 'text-yellow-600' : 'text-red-600'}`;
    }

    document.getElementById('tabla-finanzas-body').innerHTML = htmlTabla;

    let ctx = document.getElementById('chartFinanzas');
    if(ctx) {
        if (chartDistribucionGastos) chartDistribucionGastos.destroy();
        let labels = Object.keys(categorias_gastos);
        let valores = Object.values(categorias_gastos);
        if(valores.length === 0) { labels = ["Sin Gastos"]; valores = [1]; }

        chartDistribucionGastos = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: valores, 
                    backgroundColor: ['#8B0000', '#EAA000', '#4B5563', '#1F2937', '#9CA3AF', '#DC2626', '#D97706'], 
                    borderWidth: 2, borderColor: '#ffffff' 
                }] 
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } }, tooltip: { callbacks: { label: function(c) { return " " + formMoneda(c.raw); } } } }, 
                cutout: '70%' 
            }
        });
    }
}

function actualizarBalance() {
    if(typeof cargarDashboardFinanzas === 'function') cargarDashboardFinanzas();
}

document.addEventListener('DOMContentLoaded', () => {
    const formGasto = document.getElementById('formOtroGasto'); 
    if (formGasto) {
        formGasto.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            let boton = e.target.querySelector('button[type="submit"]');
            if (boton) { boton.disabled = true; boton.innerText = "Guardando..."; }

            let costoUsd = parseFloat(document.getElementById('gasto_monto').value); 
            let pagaEnBolivares = false;
            if(costoUsd > 0) pagaEnBolivares = confirm("¿Pagaste este gasto en Bolívares (Pago Móvil/Transferencia)?\n\nDale a 'Aceptar' para Bolívares, o 'Cancelar' para Efectivo/Zelle.");

            let inputFecha = document.getElementById('gasto_fecha') ? document.getElementById('gasto_fecha').value.trim() : "";
            
            let datos = {
                lote_id: 1, 
                concepto: document.getElementById('gasto_concepto').value,
                total_gasto: costoUsd,
                fecha: inputFecha !== "" ? inputFecha : hoy,
                categoria: document.getElementById('gasto_cat').value, 
                moneda: pagaEnBolivares ? "VES" : "USD",
                tasa_cambio: pagaEnBolivares ? TASA_BCV_ACTUAL : 1.0,
                monto_ves: pagaEnBolivares ? (costoUsd * TASA_BCV_ACTUAL) : 0.0
            };

            try {
                let r = await fetch('/finanzas/registrar-gasto', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
                let res = await r.json();
                if(r.ok) {
                    formGasto.reset();
                    actualizarBalance(); 
                    mostrarRespuesta({mensaje: "✅ Gasto registrado y restado de la caja correctamente"});
                } else { alert("⚠️ Error:\n" + res.detail); }
            } catch (error) { alert("Error de red al guardar el gasto."); } 
            finally { if (boton) { boton.disabled = false; boton.innerText = "Restar de la Caja General"; } }
        });
    }
});