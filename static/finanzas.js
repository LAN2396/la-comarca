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

    let ingresos = 0, gastos = 0, entradas_efectivo = 0, entradas_banco = 0;
    let categorias_gastos = {};
    let htmlTabla = '';

    if (transFiltradas.length === 0) {
        htmlTabla = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic font-medium">No hay movimientos.</td></tr>`;
    } else {
        transFiltradas.forEach((t, i) => {
            if (t.tipo === "Ingreso") {
                ingresos += t.monto;
                let txt = t.concepto.toLowerCase();
                if (txt.includes("efectivo") || txt.includes("zelle")) entradas_efectivo += t.monto;
                else if (txt.includes("transferencia") || txt.includes("pago móvil")) entradas_banco += t.monto;
            } else {
                gastos += t.monto;
                categorias_gastos[t.categoria] = (categorias_gastos[t.categoria] || 0) + t.monto;
            }

            let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
            let esIngreso = t.tipo === "Ingreso";
            let colorPildora = esIngreso ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200';
            let colorMonto = esIngreso ? 'text-emerald-600' : 'text-red-600';
            let signo = esIngreso ? '+' : '-';
            let detalle = t.categoria ? `<br><span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${t.categoria}</span>` : '';

            htmlTabla += `<tr class="${bg} hover:bg-gray-100 border-b border-gray-100">
                <td class="px-4 py-3 text-xs font-mono font-bold text-gray-600">${t.fecha}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded border font-black text-[10px] uppercase tracking-wider ${colorPildora}">${t.tipo}</span></td>
                <td class="px-4 py-3 font-bold text-gray-800">${t.concepto}${detalle}</td>
                <td class="px-4 py-3 text-right font-mono font-black ${colorMonto} text-base">${signo} ${formMoneda(t.monto)}</td>
            </tr>`;
        });
    }

    let balance = ingresos - gastos;
    let porcentajeGanancia = ingresos > 0 ? (balance / ingresos) * 100 : 0;
    if (document.getElementById('dash_ingresos')) document.getElementById('dash_ingresos').innerText = formMoneda(ingresos);
    if (document.getElementById('dash_egresos')) document.getElementById('dash_egresos').innerText = formMoneda(gastos);
    
    let lblGanancia = document.getElementById('lbl_porcentaje_ganancia');
    if (lblGanancia) {
        lblGanancia.innerText = porcentajeGanancia.toFixed(2) + "%";
        lblGanancia.className = `text-2xl font-black font-mono ${porcentajeGanancia >= 0 ? 'text-purple-700' : 'text-red-600'}`;
    }

    if (document.getElementById('dash_efectivo')) document.getElementById('dash_efectivo').innerText = formMoneda(entradas_efectivo);
    if (document.getElementById('dash_banco')) document.getElementById('dash_banco').innerText = formMoneda(entradas_banco);
    if (document.getElementById('dash_porcobrar')) document.getElementById('dash_porcobrar').innerText = formMoneda(deudaGlobalFinanzas);

    document.getElementById('tabla-finanzas-body').innerHTML = htmlTabla;

    let ctx = document.getElementById('chartFinanzas');
    if(ctx) {
        if (chartDistribucionGastos) chartDistribucionGastos.destroy();
        let labels = Object.keys(categorias_gastos);
        let valores = Object.values(categorias_gastos);
        if(valores.length === 0) { labels = ["Sin Gastos"]; valores = [1]; }

        chartDistribucionGastos = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: valores, backgroundColor: ['#f97316', '#8b0000', '#3b82f6', '#10b981', '#8b5cf6', '#eab308'], borderWidth: 2, borderColor: '#ffffff' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' } } }, tooltip: { callbacks: { label: function(c) { return " " + formMoneda(c.raw); } } } }, cutout: '65%' }
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