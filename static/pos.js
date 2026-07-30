// =========================================
// MÓDULO PUNTO DE VENTA Y FACTURACIÓN (POS)
// =========================================
let carritoPOS = [];
let productosCachePOS = [];
let cacheFacturas = []; 

async function cargarDirectorioClientes() {
    try {
        let r = await fetch('/clientes'); let clientes = await r.json(); let html = '';
        if (clientes.length === 0) html = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-400 italic font-medium">No hay clientes registrados.</td></tr>`;
        else {
            clientes.forEach((c, i) => {
                let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                html += `<tr class="${bg}"><td class="px-4 py-3 font-mono font-bold">${c.documento}</td><td class="px-4 py-3 font-bold">${c.nombre}</td><td class="px-4 py-3">${c.telefono || 'N/A'}</td><td class="px-4 py-3 text-center"><button onclick='cargarFormularioCliente(${JSON.stringify(c)})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold text-xs">Editar</button></td></tr>`;
            });
        }
        if(document.getElementById('tabla-directorio-clientes')) document.getElementById('tabla-directorio-clientes').innerHTML = html;
    } catch(e) {}
}

function cargarFormularioCliente(c) {
    document.getElementById('titulo-form-cliente').innerText = "🛠️ Editar Cliente";
    document.getElementById('btn-guardar-cliente').innerText = "Actualizar";
    document.getElementById('btn-cancelar-cliente').classList.remove('hidden');
    document.getElementById('dir_cliente_id').value = c.id; document.getElementById('dir_cliente_doc').value = c.documento;
    document.getElementById('dir_cliente_nombre').value = c.nombre; document.getElementById('dir_cliente_tlf').value = c.telefono || '';
}

function limpiarFormCliente() {
    document.getElementById('titulo-form-cliente').innerText = "➕ Registrar Cliente";
    document.getElementById('btn-guardar-cliente').innerText = "Guardar";
    document.getElementById('btn-cancelar-cliente').classList.add('hidden');
    document.getElementById('formDirCliente').reset(); document.getElementById('dir_cliente_id').value = '';
}

async function cargarClientesPOS() {
    try {
        let r = await fetch('/clientes'); let clientes = await r.json();
        let html = '<option value="" disabled selected>Seleccione un cliente...</option>';
        clientes.forEach(c => { html += `<option value="${c.id}">${c.nombre} (${c.documento})</option>`; });
        if(document.getElementById('fact_cliente_id')) document.getElementById('fact_cliente_id').innerHTML = html;
    } catch(e) {}
}

async function registrarClienteRapidoPOS() {
    let docInput = document.getElementById('c_doc').value.trim(); let nomInput = document.getElementById('c_nombre').value.trim(); let tlfInput = document.getElementById('c_tlf').value.trim();
    if(!nomInput) { alert("El Nombre completo es un campo obligatorio."); return; }
    let datos = { documento: docInput ? docInput.toUpperCase() : "CF-" + Math.floor(Math.random() * 10000000), nombre: nomInput, telefono: tlfInput || null, direccion: null };
    try {
        let r = await fetch('/clientes/crear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        let res = await r.json();
        if (r.ok) {
            mostrarRespuesta(res); document.getElementById('form-rapido-cliente').classList.add('hidden'); document.getElementById('c_doc').value = ''; document.getElementById('c_nombre').value = ''; document.getElementById('c_tlf').value = '';
            await cargarClientesPOS();
            let selector = document.getElementById('fact_cliente_id');
            for (let i = 0; i < selector.options.length; i++) if (selector.options[i].text.includes(datos.documento)) { selector.selectedIndex = i; break; }
        } else alert("Error: " + res.detail);
    } catch(e) {}
}

async function cargarProductosPOS() {
    try {
        let r = await fetch('/productos'); productosCachePOS = await r.json();
        let html = '<option value="" disabled selected>Seleccione un tipo de huevo...</option>';
        productosCachePOS.forEach(p => { html += `<option value="${p.id}">${p.nombre} (${p.codigo})</option>`; });
        if(document.getElementById('fact_producto_id')) document.getElementById('fact_producto_id').innerHTML = html;
    } catch(e) {}
}

function actualizarPrecioSugeridoPOS() {}

function agregarAlCarritoPOS() {
    let prodId = parseInt(document.getElementById('fact_producto_id').value);
    let cartones = parseInt(document.getElementById('fact_cant_cartones').value) || 0;
    let cajas = parseInt(document.getElementById('fact_cant_cajas').value) || 0;

    if(!prodId) { alert("Elija un producto."); return; }
    if(cartones === 0 && cajas === 0) { alert("Establezca cantidad."); return; }

    let prod = productosCachePOS.find(x => x.id === prodId);

    if (cajas > 0) {
        let totalCartonesCaja = cajas * 12; let precioCajaPorCarton = prod.precio_caja / 12; 
        let existeCaja = carritoPOS.find(x => x.producto_id === prodId && x.tipo_venta === "Caja");
        if(existeCaja) { existeCaja.cantidad_cartones += totalCartonesCaja; existeCaja.subtotal = existeCaja.cantidad_cartones * existeCaja.precio_unitario; }
        else carritoPOS.push({ producto_id: prodId, nombre: `${prod.nombre} (Cajas)`, cantidad_cartones: totalCartonesCaja, precio_unitario: precioCajaPorCarton, tipo_venta: "Caja", subtotal: totalCartonesCaja * precioCajaPorCarton });
    }

    if (cartones > 0) {
        let existeCarton = carritoPOS.find(x => x.producto_id === prodId && x.tipo_venta === "Cartón");
        if(existeCarton) { existeCarton.cantidad_cartones += cartones; existeCarton.subtotal = existeCarton.cantidad_cartones * existeCarton.precio_unitario; } 
        else carritoPOS.push({ producto_id: prodId, nombre: `${prod.nombre} (Cartones)`, cantidad_cartones: cartones, precio_unitario: prod.precio_carton, tipo_venta: "Cartón", subtotal: cartones * prod.precio_carton });
    }
    document.getElementById('fact_cant_cartones').value = 0; document.getElementById('fact_cant_cajas').value = 0;
    actualizarTablaCarritoPOS();
}

function quitarDelCarritoPOS(index) { carritoPOS.splice(index, 1); actualizarTablaCarritoPOS(); }

function actualizarTablaCarritoPOS() {
    let html = ''; let totalBruto = 0;
    if(carritoPOS.length === 0) html = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic">Vacío</td></tr>`;
    else {
        carritoPOS.forEach((item, index) => {
            totalBruto += item.subtotal;
            let txtCant = item.tipo_venta === "Caja" ? `${item.cantidad_cartones / 12} CJ` : `${item.cantidad_cartones} CTN`;
            let txtPrecioMostrar = item.tipo_venta === "Caja" ? `${formMoneda(item.precio_unitario * 12)} /CJ` : `${formMoneda(item.precio_unitario)} /CTN`;
            html += `<tr class="border-b"><td class="px-4 py-3 font-bold">${item.nombre}</td><td class="px-4 py-3 text-right font-mono">${txtCant}</td><td class="px-4 py-3 text-right font-mono text-emerald-600">${txtPrecioMostrar}</td><td class="px-4 py-3 text-right font-mono font-black">${formMoneda(item.subtotal)}</td><td class="px-4 py-3 text-center"><button onclick="quitarDelCarritoPOS(${index})" class="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs">Quitar</button></td></tr>`;
        });
    }
    let descTipo = document.getElementById('fact_desc_tipo').value;
    let descValor = parseFloat(document.getElementById('fact_descuento').value) || 0;
    let descMonto = descTipo === "%" ? totalBruto * (descValor / 100.0) : descValor;
    let totalNeto = Math.max(0, totalBruto - descMonto); 

    if(document.getElementById('tabla-carrito-body')) document.getElementById('tabla-carrito-body').innerHTML = html;
    if(document.getElementById('fact_total_lbl')) document.getElementById('fact_total_lbl').innerText = formMoneda(totalNeto);
    actualizarTotalBCV();
}

function actualizarTotalBCV() {
    let metodo = document.getElementById('fact_condicion').value;
    let lblBs = document.getElementById('fact_total_bs_lbl');
    if(!lblBs) return;
    let totalUsd = parseFloat(document.getElementById('fact_total_lbl').innerText.replace('$', '').trim()) || 0;
    if (metodo === 'Transferencia' || metodo === 'Pago Móvil') {
        lblBs.innerText = `Bs ${(totalUsd * TASA_BCV_ACTUAL).toFixed(2)} (Tasa: ${TASA_BCV_ACTUAL})`;
        lblBs.classList.remove('hidden');
    } else lblBs.classList.add('hidden');
}

function alternarDiasCreditoPOS() {
    let cond = document.getElementById('fact_condicion').value;
    let cont = document.getElementById('contenedor_dias_credito');
    if(!cont) return;
    if (cond === "Crédito") cont.classList.remove('hidden');
    else { cont.classList.add('hidden'); document.getElementById('fact_dias_credito').value = 0; }
}

async function procesarFacturaFinalPOS() {
    let clienteId = parseInt(document.getElementById('fact_cliente_id').value);
    if(!clienteId) { alert("Seleccione cliente."); return; }
    if(carritoPOS.length === 0) { alert("Carrito vacío."); return; }

    let condicionPago = document.getElementById('fact_condicion').value;
    let totalUsd = parseFloat(document.getElementById('fact_total_lbl').innerText.replace('$', '').trim()) || 0;
    let usaBolivares = (condicionPago === 'Transferencia' || condicionPago === 'Pago Móvil');
    let tasaParaBD = usaBolivares ? TASA_BCV_ACTUAL : 1.0;
    let vesParaBD = usaBolivares ? (totalUsd * TASA_BCV_ACTUAL) : 0.0;

    let datos = {
        cliente_id: clienteId, fecha: hoy, condicion: condicionPago,
        dias_credito: parseInt(document.getElementById('fact_dias_credito').value) || 0,
        descuento_tipo: document.getElementById('fact_desc_tipo').value,
        descuento_valor: parseFloat(document.getElementById('fact_descuento').value) || 0,
        total: totalUsd, tasa_cambio: tasaParaBD, monto_ves: vesParaBD,
        items: carritoPOS.map(x => ({ producto_id: x.producto_id, cantidad_cartones: x.cantidad_cartones, precio_unitario: x.precio_unitario }))
    };

    try {
        let r = await fetch('/facturacion/procesar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        let res = await r.json();
        if(r.ok) {
            let clName = document.getElementById('fact_cliente_id').options[document.getElementById('fact_cliente_id').selectedIndex].text;
            imprimirTicketPOS(res.numero_factura, clName, condicionPago, totalUsd, carritoPOS, datos.descuento_tipo, datos.descuento_valor, null, tasaParaBD, vesParaBD, usaBolivares?"VES":"USD", datos.condicion==="Crédito"?totalUsd:0);
            mostrarRespuesta(res);
            carritoPOS = []; actualizarTablaCarritoPOS();
            document.getElementById('fact_cliente_id').value = ""; document.getElementById('fact_condicion').value = "Efectivo"; document.getElementById('fact_desc_tipo').value = "%"; document.getElementById('fact_descuento').value = 0; alternarDiasCreditoPOS(); actualizarTotalBCV();
            if(typeof actualizarBalance === 'function') actualizarBalance();
            if(typeof cargarHistorialFacturas === 'function') cargarHistorialFacturas();
        } else alert("⚠️ Error: " + res.detail);
    } catch(e) {}
}

async function cargarHistorialFacturas() {
    try {
        let r = await fetch('/facturacion/historial?_t=' + new Date().getTime());
        cacheFacturas = await r.json();
        filtrarFacturas(); 
    } catch(e) {}
}

function cambiarFiltroFechaPOS() {
    let tipo = document.getElementById('filtro_fact_fecha').value;
    let divRango = document.getElementById('rango_fechas_pos');
    if (tipo === 'Personalizado') divRango.classList.remove('hidden'); else divRango.classList.add('hidden');
    filtrarFacturas();
}

function parsearFechaPOS(fStr) { let p = fStr.split('/'); return new Date(p[2], p[1] - 1, p[0]); }

function filtrarFacturas() {
    let txtBusq = document.getElementById('filtro_fact_cliente').value.toLowerCase();
    let condBusq = document.getElementById('filtro_fact_condicion').value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let tipoFecha = document.getElementById('filtro_fact_fecha').value;
    let strDesde = document.getElementById('filtro_fecha_desde').value; let strHasta = document.getElementById('filtro_fecha_hasta').value;
    let hoyObj = new Date(); hoyObj.setHours(0,0,0,0);

    let filtradas = cacheFacturas.filter(f => {
        let cTxt = f.cliente.toLowerCase().includes(txtBusq) || f.numero_factura.toLowerCase().includes(txtBusq);
        let cFact = f.condicion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        let cCond = condBusq === "todas" || cFact === condBusq || cFact.includes(condBusq);
        
        let cFecha = true;
        if (tipoFecha !== "Todas") {
            let fObj = parsearFechaPOS(f.fecha);
            if (tipoFecha === "Hoy") cFecha = fObj.getTime() === hoyObj.getTime();
            else if (tipoFecha === "Semana") { let sAtras = new Date(hoyObj); sAtras.setDate(sAtras.getDate() - 7); cFecha = fObj >= sAtras && fObj <= hoyObj; }
            else if (tipoFecha === "Mes") cFecha = fObj.getMonth() === hoyObj.getMonth() && fObj.getFullYear() === hoyObj.getFullYear();
            else if (tipoFecha === "Personalizado" && strDesde && strHasta) {
                let d = new Date(strDesde.split('-')[0], strDesde.split('-')[1] - 1, strDesde.split('-')[2]);
                let h = new Date(strHasta.split('-')[0], strHasta.split('-')[1] - 1, strHasta.split('-')[2]);
                cFecha = fObj >= d && fObj <= h;
            }
        }
        return cTxt && cCond && cFecha;
    });
    renderizarTablaFacturas(filtradas);
}

function renderizarTablaFacturas(facturas) {
    let html = ''; let tf = 0, tc = 0, tcr = 0;
    if (facturas.length === 0) html = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400 italic font-medium">No se encontraron facturas.</td></tr>`;
    else {
        facturas.forEach((f, i) => {
            let saldo = f.saldo_pendiente || 0; tf += f.total; tcr += saldo; tc += (f.total - saldo);
            let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
            let colC = saldo > 0 ? 'text-red-700 bg-red-100' : 'text-emerald-700 bg-emerald-100';
            let txtEst = saldo > 0 ? 'Deuda' : 'Pagado'; 
            let btnCobrar = saldo > 0 ? `<button onclick="abrirModalCobro('${f.numero_factura}', ${saldo}, '${f.cliente}')" class="bg-emerald-600 text-white px-2 py-1 rounded text-xs font-bold">Cobrar</button>` : `<span class="px-2 py-1 text-xs text-gray-400 font-bold">Sin deuda</span>`;
            html += `<tr class="${bg} border-b"><td class="px-3 py-3 font-mono font-black">${f.numero_factura}</td><td class="px-3 py-3 font-bold">${f.cliente}</td><td class="px-3 py-3 text-center"><span class="px-2 py-1 rounded font-bold text-[11px] ${colC}">${txtEst}</span></td><td class="px-3 py-3 text-center text-xs font-bold">${f.condicion}</td><td class="px-3 py-3 text-right font-mono">${formMoneda(f.total)}</td><td class="px-3 py-3 text-right font-mono font-black ${saldo > 0 ? 'text-red-600' : 'text-emerald-600'}">${formMoneda(saldo)}</td><td class="px-3 py-3 text-center flex justify-center items-center gap-1">${btnCobrar}<button onclick="reimprimirFactura('${f.numero_factura}')" class="bg-gray-800 text-white px-2 py-1 rounded text-xs font-bold">Ticket</button></td></tr>`;
        });
    }
    if(document.getElementById('tabla-historial-facturas')) document.getElementById('tabla-historial-facturas').innerHTML = html;
    if(document.getElementById('lbl_fact_total')) document.getElementById('lbl_fact_total').innerText = formMoneda(tf);
    if(document.getElementById('lbl_fact_cobrado')) document.getElementById('lbl_fact_cobrado').innerText = formMoneda(tc);
    if(document.getElementById('lbl_fact_credito')) document.getElementById('lbl_fact_credito').innerText = formMoneda(tcr);
}

function reimprimirFactura(numFac) {
    let f = cacheFacturas.find(x => x.numero_factura === numFac);
    if(!f) return;
    imprimirTicketPOS(f.numero_factura, f.cliente, f.condicion, f.total, f.detalles, f.descuento_tipo, f.descuento_valor, f.fecha_vencimiento, f.tasa_cambio, f.monto_ves, f.moneda, f.saldo_pendiente);
}

function imprimirTicketPOS(numFac, cli, cond, totUsd, items, dTip, dVal, fVenc, tasa, mBs, mon, saldo) {
    let v = window.open('', '_blank', 'width=350,height=600');
    let f = new Date().toLocaleString('es-VE');
    let hItems = '';
    (items||[]).forEach(i => { hItems += `<tr><td style="padding: 4px 0;">${i.nombre}</td><td style="text-align:center;">${i.cantidad_cartones}</td><td style="text-align:right;">${formMoneda(i.subtotal||0)}</td></tr>`; });
    let tDesc = dVal > 0 ? `<p style="text-align:right;"><strong>Desc:</strong> -${dTip==='%'?dVal+'%':'$'+dVal}</p>` : '';
    let tCond = cond === 'Crédito' && saldo <= 0 ? 'Crédito (PAGADO)' : cond;
    let tVenc = cond === 'Crédito' && fVenc && saldo > 0 ? `<p><strong>Vence:</strong> ${fVenc}</p>` : '';
    
    let tTot = mon === 'VES' ? `<div class="total" style="font-size: 15px;">TOTAL: Bs ${(mBs||totUsd*tasa).toFixed(2)}</div><div class="center" style="font-size: 11px;">(Eqv. ${formMoneda(totUsd)} - Tasa: ${tasa.toFixed(2)})</div>` : `<div class="total">TOTAL: ${formMoneda(totUsd)}</div>`;

    let html = `<html><head><title>Ticket ${numFac}</title><style>body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:10px}h2{text-align:center;font-size:16px;margin:5px 0}p{margin:3px 0}.center{text-align:center}.divider{border-bottom:1px dashed #000;margin:10px 0}table{width:100%;border-collapse:collapse}th{border-bottom:1px dashed #000;text-align:left}.total{font-size:15px;font-weight:900;text-align:right;margin-top:10px}</style></head><body><div class="center font-bold">*** NO FISCAL ***</div><h2>Granja La Comarca</h2><p class="center">El Vigía, Edo. Mérida</p><div class="divider"></div><p><strong>Fact:</strong> ${numFac}</p><p><strong>Fec:</strong> ${f}</p><p><strong>Cli:</strong> ${cli}</p><p><strong>Cond:</strong> ${tCond}</p>${tVenc}<div class="divider"></div><table><thead><tr><th>Prod</th><th style="text-align:center">Cant</th><th style="text-align:right">SubT</th></tr></thead><tbody>${hItems}</tbody></table><div class="divider"></div>${tDesc}${tTot}<div class="divider"></div><p class="center" style="margin-top:15px;">*** GRACIAS ***</p><script>window.onload=function(){setTimeout(()=>{window.print();},500);}</script></body></html>`;
    v.document.write(html); v.document.close();
}

function abrirModalCobro(fac, deu, cli) {
    document.getElementById('cobro_cliente').innerText = cli; document.getElementById('cobro_factura').innerText = fac;
    document.getElementById('cobro_deuda').innerText = deu.toFixed(2); document.getElementById('cobro_monto').value = '';
    document.getElementById('cobro_monto').max = deu; document.getElementById('modalCobro').classList.remove('hidden');
}

function cerrarModalCobro() { document.getElementById('modalCobro').classList.add('hidden'); }

async function procesarCobro(e) {
    e.preventDefault();
    let btn = e.target.querySelector('button[type="submit"]'); if(btn){btn.disabled=true; btn.innerText="Procesando...";}
    let monto = parseFloat(document.getElementById('cobro_monto').value); let met = document.getElementById('cobro_metodo').value;
    let usaBs = (met === 'Transferencia Bancaria' || met === 'Pago Móvil');
    let tasa = usaBs ? TASA_BCV_ACTUAL : 1.0; let vBs = usaBs ? (monto * TASA_BCV_ACTUAL) : 0.0;
    let fac = document.getElementById('cobro_factura').innerText; let cli = document.getElementById('cobro_cliente').innerText;
    let datos = { numero_factura: fac, monto: monto, metodo_pago: met, tasa_cambio: tasa, monto_ves: vBs };
    try {
        let r = await fetch('/facturacion/abonar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        if(r.ok) {
            mostrarRespuesta(await r.json()); cerrarModalCobro(); cargarHistorialFacturas(); if(typeof actualizarBalance === 'function') actualizarBalance();
            setTimeout(()=>{ if(confirm("¿Imprimir comprobante?")) imprimirTicketCobro(fac, cli, monto, met, tasa, vBs); }, 400);
        } else alert("⚠️ Error: " + (await r.json()).detail);
    } catch(e) {} finally { if(btn){btn.disabled=false; btn.innerText="Procesar Ingreso";} }
}

function imprimirTicketCobro(numFac, cli, mUsd, met, tasa, mBs) {
    let v = window.open('', '_blank', 'width=350,height=600');
    let tTot = met==='Efectivo'||met==='Zelle' ? `<div class="total">TOTAL: ${formMoneda(mUsd)}</div>` : `<div class="total" style="font-size:15px;">TOTAL: Bs ${mBs.toFixed(2)}</div><div class="center" style="font-size:11px;">(Eqv. ${formMoneda(mUsd)} - Tasa: ${tasa.toFixed(2)})</div>`;
    let html = `<html><head><title>Abono ${numFac}</title><style>body{font-family:monospace;font-size:12px;width:80mm;margin:0 auto;padding:10px}h2{text-align:center;font-size:16px;margin:5px 0}p{margin:3px 0}.center{text-align:center}.divider{border-bottom:1px dashed #000;margin:10px 0}table{width:100%;border-collapse:collapse}th{border-bottom:1px dashed #000;text-align:left}.total{font-size:15px;font-weight:900;text-align:right;margin-top:10px}</style></head><body><div class="center font-bold">*** NO FISCAL ***</div><h2>Granja La Comarca</h2><p class="center">El Vigía</p><div class="divider"></div><p><strong>Fact:</strong> ${numFac}</p><p><strong>Cli:</strong> ${cli}</p><p><strong>Cond:</strong> Abono a Deuda</p><div class="divider"></div><table><thead><tr><th>Concepto</th><th style="text-align:center">Método</th><th style="text-align:right">SubT</th></tr></thead><tbody><tr><td>Pago parcial</td><td style="text-align:center;">${met}</td><td style="text-align:right;">${formMoneda(mUsd)}</td></tr></tbody></table><div class="divider"></div>${tTot}<div class="divider"></div><p class="center" style="margin-top:15px;">*** APROBADO ***</p><script>window.onload=function(){setTimeout(()=>{window.print();},500);}</script></body></html>`;
    v.document.write(html); v.document.close();
}

document.addEventListener('DOMContentLoaded', () => {
    let fDir = document.getElementById('formDirCliente');
    if(fDir) fDir.addEventListener('submit', async (e) => {
        e.preventDefault();
        let id = document.getElementById('dir_cliente_id').value;
        let datos = { documento: document.getElementById('dir_cliente_doc').value.toUpperCase(), nombre: document.getElementById('dir_cliente_nombre').value, telefono: document.getElementById('dir_cliente_tlf').value };
        let url = id ? '/clientes/editar' : '/clientes/crear';
        if(id) datos.cliente_id = parseInt(id); else if (!datos.documento) datos.documento = "CF-" + Math.floor(Math.random() * 10000000);
        try { let r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) }); mostrarRespuesta(await r.json()); limpiarFormCliente(); cargarDirectorioClientes(); } catch(err) {}
    });
});