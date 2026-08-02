// =========================================
// MÓDULO PUNTO DE VENTA Y FACTURACIÓN (POS)
// =========================================
let carritoPOS = [];
let productosCachePOS = [];
let cacheFacturas = []; 

async function cargarDirectorioClientes() {
    try {
        let r = await fetch('/clientes');
        let clientes = await r.json();
        let html = '';

        if (clientes.length === 0) {
            html = `<div class="p-8 text-center text-gray-400 italic font-medium">No hay clientes registrados en el sistema.</div>`;
        } else {
            // Encabezados ocultos en móvil, visibles en PC
            html += `
            <div class="hidden lg:grid lg:grid-cols-4 bg-gray-200 text-gray-600 font-black text-[10px] uppercase tracking-wider p-3 border-b border-gray-300">
                <div>Documento</div>
                <div class="col-span-2">Nombre / Razón Social</div>
                <div class="text-center">Acciones</div>
            </div>`;

            clientes.forEach((c, i) => {
                let bg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                html += `
                <div class="${bg} p-4 hover:bg-red-50/20 transition-colors flex flex-col lg:grid lg:grid-cols-4 lg:items-center gap-3 border-b border-gray-200">
                    <div class="flex justify-between items-center lg:block">
                        <span class="text-[10px] font-black text-gray-400 uppercase lg:hidden">Documento</span>
                        <span class="font-mono font-black text-gray-800">${c.documento}</span>
                    </div>
                    <div class="flex flex-col lg:col-span-2">
                        <span class="text-[10px] font-black text-gray-400 uppercase lg:hidden mb-0.5">Nombre / Razón Social</span>
                        <span class="font-black text-gray-900 text-base">${c.nombre}</span>
                        <span class="text-gray-500 font-bold text-xs mt-1">📞 ${c.telefono || 'Sin teléfono'}</span>
                    </div>
                    <div class="flex justify-end lg:justify-center mt-2 lg:mt-0 border-t border-gray-100 lg:border-0 pt-3 lg:pt-0">
                        <button onclick='cargarFormularioCliente(${JSON.stringify(c)})' class="w-full lg:w-auto bg-comarca-dorado text-black px-4 py-2 rounded font-black hover:bg-yellow-500 transition shadow-sm text-xs">✏️ Editar</button>
                    </div>
                </div>`;
            });
        }
        let divDir = document.getElementById('tabla-directorio-clientes');
        if (divDir) divDir.innerHTML = html;
    } catch(e) { console.error("Error al cargar clientes", e); }
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
        let sel = document.getElementById('fact_cliente_id');
        if(sel) sel.innerHTML = html;
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
        let html = '<option value="" disabled selected>Seleccione un tipo...</option>';
        productosCachePOS.forEach(p => { html += `<option value="${p.id}">${p.nombre} (${p.codigo})</option>`; });
        let pId = document.getElementById('fact_producto_id');
        if(pId) pId.innerHTML = html;
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
    
    if(carritoPOS.length === 0) {
        html = `<div class="p-6 text-center text-gray-400 font-bold italic text-sm">El carrito está vacío.</div>`;
    } else {
        carritoPOS.forEach((item, index) => {
            totalBruto += item.subtotal;
            let txtCant = item.tipo_venta === "Caja" ? `${item.cantidad_cartones / 12} CJ` : `${item.cantidad_cartones} CTN`;
            let txtPrecioMostrar = item.tipo_venta === "Caja" ? `${formMoneda(item.precio_unitario * 12)} /CJ` : `${formMoneda(item.precio_unitario)} /CTN`;
            
            html += `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-white hover:bg-red-50/20 transition gap-2 border-b border-gray-100 last:border-b-0">
                <div class="flex-1">
                    <h3 class="font-black text-gray-800 text-xs md:text-sm">${item.nombre}</h3>
                    <div class="text-[10px] font-bold text-gray-500 mt-1">
                        <span class="text-comarca-rojo bg-red-50 px-1.5 py-0.5 rounded border border-red-100 shadow-sm">${txtCant}</span> 
                        <span class="ml-1">x ${txtPrecioMostrar}</span>
                    </div>
                </div>
                <div class="flex items-center justify-between w-full sm:w-auto gap-3 border-t border-gray-100 pt-2 sm:border-0 sm:pt-0">
                    <span class="font-mono font-black text-base text-gray-800">${formMoneda(item.subtotal)}</span>
                    <button type="button" onclick="quitarDelCarritoPOS(${index})" class="bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1.5 rounded-lg transition font-bold text-[10px] shadow-sm">
                        🗑️ Quitar
                    </button>
                </div>
            </div>`;
        });
    }
    
    let elTipo = document.getElementById('fact_desc_tipo');
    let elDesc = document.getElementById('fact_descuento');
    
    let descTipo = elTipo ? elTipo.value : '%';
    let descValor = elDesc ? parseFloat(elDesc.value) || 0 : 0;
    
    let descMonto = descTipo === "%" ? totalBruto * (descValor / 100.0) : descValor;
    let totalNeto = Math.max(0, totalBruto - descMonto); 

    let tBody = document.getElementById('tabla-carrito-body');
    if(tBody) tBody.innerHTML = html;
    
    let lblSub = document.getElementById('fact_subtotal_lbl');
    if(lblSub) lblSub.innerText = formMoneda(totalBruto);
    
    let lblDesc = document.getElementById('fact_descuento_lbl');
    if(lblDesc) lblDesc.innerText = "-" + formMoneda(descMonto);
    
    let lblTot = document.getElementById('fact_total_lbl');
    if(lblTot) lblTot.innerText = formMoneda(totalNeto);
    
    actualizarTotalBCV();
}

function actualizarTotalBCV() {
    let elCond = document.getElementById('fact_condicion');
    let lblBs = document.getElementById('fact_total_bs_lbl');
    let lblTot = document.getElementById('fact_total_lbl');
    
    if(!lblBs || !elCond || !lblTot) return;
    
    let metodo = elCond.value;
    let totalUsd = parseFloat(lblTot.innerText.replace('$', '').trim()) || 0;
    if (metodo === 'Transferencia' || metodo === 'Pago Móvil') {
        lblBs.innerText = `Bs ${(totalUsd * TASA_BCV_ACTUAL).toFixed(2)} (Tasa: ${TASA_BCV_ACTUAL})`;
        lblBs.classList.remove('hidden');
    } else lblBs.classList.add('hidden');
}

function alternarDiasCreditoPOS() {
    let elCond = document.getElementById('fact_condicion');
    let cont = document.getElementById('contenedor_dias_credito');
    let factDias = document.getElementById('fact_dias_credito');
    
    if(!cont || !elCond) return;
    
    if (elCond.value === "Crédito") {
        cont.classList.remove('hidden');
    } else { 
        cont.classList.add('hidden'); 
        if(factDias) factDias.value = 0; 
    }
}

async function procesarFacturaFinalPOS() {
    let elClienteId = document.getElementById('fact_cliente_id');
    if(!elClienteId || !elClienteId.value) { alert("Seleccione cliente."); return; }
    if(carritoPOS.length === 0) { alert("Carrito vacío."); return; }

    let clienteId = parseInt(elClienteId.value);
    let elCondicion = document.getElementById('fact_condicion');
    let condicionPago = elCondicion ? elCondicion.value : "Efectivo";
    
    let lblTot = document.getElementById('fact_total_lbl');
    let totalUsd = lblTot ? parseFloat(lblTot.innerText.replace('$', '').trim()) || 0 : 0;
    
    let usaBolivares = (condicionPago === 'Transferencia' || condicionPago === 'Pago Móvil');
    let tasaParaBD = usaBolivares ? TASA_BCV_ACTUAL : 1.0;
    let vesParaBD = usaBolivares ? (totalUsd * TASA_BCV_ACTUAL) : 0.0;

    let elDias = document.getElementById('fact_dias_credito');
    let elDescTipo = document.getElementById('fact_desc_tipo');
    let elDescValor = document.getElementById('fact_descuento');

    let datos = {
        cliente_id: clienteId, fecha: hoy, condicion: condicionPago,
        dias_credito: elDias ? parseInt(elDias.value) || 0 : 0,
        descuento_tipo: elDescTipo ? elDescTipo.value : '%',
        descuento_valor: elDescValor ? parseFloat(elDescValor.value) || 0 : 0,
        total: totalUsd, tasa_cambio: tasaParaBD, monto_ves: vesParaBD,
        items: carritoPOS.map(x => ({ producto_id: x.producto_id, cantidad_cartones: x.cantidad_cartones, precio_unitario: x.precio_unitario }))
    };

    try {
        let r = await fetch('/facturacion/procesar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        let res = await r.json();
        if(r.ok) {
            mostrarRespuesta(res);
            carritoPOS = []; actualizarTablaCarritoPOS();
            if(elClienteId) elClienteId.value = ""; 
            if(elCondicion) elCondicion.value = "Efectivo"; 
            if(elDescTipo) elDescTipo.value = "%"; 
            if(elDescValor) elDescValor.value = 0; 
            alternarDiasCreditoPOS(); actualizarTotalBCV();
            if(typeof actualizarBalance === 'function') actualizarBalance();
            if(typeof cargarHistorialFacturas === 'function') cargarHistorialFacturas();
        } else alert("⚠️ Error: " + res.detail);
    } catch(e) {}
}

async function cargarHistorialFacturas() {
    try {
        let r = await fetch('/facturacion/historial?_t=' + new Date().getTime());
        let datos = await r.json();
        cacheFacturas = Array.isArray(datos) ? datos : [];
        filtrarFacturas(); 
    } catch(e) {
        console.error("Error historial:", e);
        cacheFacturas = [];
        filtrarFacturas();
    }
}

function cambiarFiltroFechaPOS() {
    let elFiltro = document.getElementById('filtro_fact_fecha');
    let divRango = document.getElementById('rango_fechas_pos');
    if(!elFiltro || !divRango) return;
    
    if (elFiltro.value === 'Personalizado') divRango.classList.remove('hidden'); 
    else divRango.classList.add('hidden');
    filtrarFacturas();
}

function parsearFechaPOS(fStr) { 
    if(!fStr) return new Date();
    let p = fStr.split('/'); 
    if(p.length !== 3) return new Date();
    return new Date(p[2], p[1] - 1, p[0]); 
}

function filtrarFacturas() {
    try {
        let elCliente = document.getElementById('filtro_fact_cliente');
        let txtBusq = elCliente ? elCliente.value.toLowerCase() : '';
        
        let elCondicion = document.getElementById('filtro_fact_condicion');
        let condBusq = elCondicion ? elCondicion.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : 'todas';
        
        let elFecha = document.getElementById('filtro_fact_fecha');
        let tipoFecha = elFecha ? elFecha.value : 'Todas';
        
        let elDesde = document.getElementById('filtro_fecha_desde');
        let strDesde = elDesde ? elDesde.value : '';
        
        let elHasta = document.getElementById('filtro_fecha_hasta');
        let strHasta = elHasta ? elHasta.value : '';
        
        let hoyObj = new Date(); hoyObj.setHours(0,0,0,0);

        let filtradas = cacheFacturas.filter(f => {
            let cTxt = true;
            if(f.cliente && f.numero_factura) {
                cTxt = f.cliente.toLowerCase().includes(txtBusq) || f.numero_factura.toLowerCase().includes(txtBusq);
            }
            
            let cFact = f.condicion ? f.condicion.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
            let cCond = condBusq === "todas" || cFact === condBusq || cFact.includes(condBusq);
            
            let cFecha = true;
            if (tipoFecha !== "Todas" && f.fecha) {
                let fObj = parsearFechaPOS(f.fecha);
                if (tipoFecha === "Hoy") cFecha = fObj.getTime() === hoyObj.getTime();
                else if (tipoFecha === "Semana") { let sAtras = new Date(hoyObj); sAtras.setDate(sAtras.getDate() - 7); cFecha = fObj >= sAtras && fObj <= hoyObj; }
                else if (tipoFecha === "Mes") cFecha = fObj.getMonth() === hoyObj.getMonth() && fObj.getFullYear() === hoyObj.getFullYear();
                else if (tipoFecha === "Personalizado" && strDesde && strHasta) {
                    let dArr = strDesde.split('-');
                    let hArr = strHasta.split('-');
                    if(dArr.length === 3 && hArr.length === 3) {
                        let d = new Date(dArr[0], dArr[1] - 1, dArr[2]);
                        let h = new Date(hArr[0], hArr[1] - 1, hArr[2]);
                        cFecha = fObj >= d && fObj <= h;
                    }
                }
            }
            return cTxt && cCond && cFecha;
        });
        renderizarTablaFacturas(filtradas);
    } catch(err) {
        console.error("Error filtrando:", err);
        renderizarTablaFacturas(cacheFacturas);
    }
}

function renderizarTablaFacturas(facturas) {
    let html = ''; 
    let tf = 0, tc_efectivo = 0, tc_bancos = 0, tc_bancos_bs = 0, tcr = 0;
    
    if (!Array.isArray(facturas) || facturas.length === 0) {
        html = `<div class="p-8 text-center text-gray-400 italic text-sm font-medium">No se encontraron facturas.</div>`;
    } else {
        facturas.forEach((f) => {
            let saldo = f.saldo_pendiente || 0; 
            tf += f.total; tcr += saldo; 
            
            let cobrado = f.total - saldo;
            let esBanco = (f.condicion === 'Transferencia' || f.condicion === 'Pago Móvil');
            
            if (esBanco) {
                tc_bancos += cobrado;
                // 🔥 SE SUMA ESTRICTAMENTE LO QUE ESTÁ EN LA BASE DE DATOS
                tc_bancos_bs += f.monto_ves || 0; 
            } else {
                tc_efectivo += cobrado; 
            }

            let colC = saldo > 0 ? 'text-comarca-rojo bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-100 border-emerald-200';
            let txtEst = saldo > 0 ? 'Deuda' : 'Pagado'; 
            
            html += `
            <div class="flex flex-col md:flex-row justify-between md:items-center p-3 sm:p-4 bg-white hover:bg-red-50/10 transition-colors gap-3 border-b border-gray-200 last:border-b-0">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono font-black text-gray-800 text-[11px] bg-gray-100 px-2 py-0.5 rounded border border-gray-200 shadow-sm">${f.numero_factura}</span>
                        <span class="px-2 py-0.5 rounded border font-black text-[9px] uppercase tracking-wider ${colC}">${txtEst}</span>
                    </div>
                    <h3 class="font-black text-comarca-rojo text-base leading-tight">${f.cliente}</h3>
                    <p class="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">
                        Método: <span class="text-gray-800">${f.condicion}</span> <span class="mx-1 hidden sm:inline">•</span><span class="block sm:inline mt-0.5 sm:mt-0">Fecha: <span class="text-gray-800">${f.fecha}</span></span>
                    </p>
                </div>
                
                <div class="flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end w-full md:w-28 bg-gray-50 md:bg-transparent p-2 md:p-0 rounded border border-gray-200 md:border-0 shadow-inner md:shadow-none">
                    <div class="text-left md:text-right w-1/2 md:w-full">
                        <span class="block text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Facturado</span>
                        <span class="font-mono font-black text-base text-gray-800 leading-none">${formMoneda(f.total)}</span>
                    </div>
                    ${saldo > 0 ? `
                    <div class="text-right w-1/2 md:w-full md:mt-2 pl-3 border-l border-gray-200 md:border-0 md:pl-0">
                        <span class="block text-[9px] font-black text-comarca-rojo uppercase tracking-widest leading-none mb-1">Por Cobrar</span>
                        <span class="font-mono font-black text-base text-comarca-rojo leading-none">${formMoneda(saldo)}</span>
                    </div>` : `<div class="hidden md:block md:mt-2 h-[26px] w-full"></div>`}
                </div>
                
                <div class="flex flex-row md:flex-col justify-end items-center md:items-end w-full md:w-24 gap-2 mt-2 md:mt-0 pt-2 md:pt-0 border-t border-gray-100 md:border-0">
                    ${saldo > 0 ? `<button onclick="abrirModalCobro('${f.numero_factura}', ${saldo}, '${f.cliente}')" class="w-full bg-emerald-600 text-white py-1.5 rounded text-[10px] font-black shadow-sm hover:bg-emerald-700 uppercase tracking-widest transition-transform active:scale-95">Cobrar</button>` : `<div class="hidden md:block h-[28px] w-full"></div>`}
                    <button onclick="reimprimirFactura('${f.numero_factura}')" class="w-full bg-gray-800 text-white py-1.5 rounded text-[10px] font-black shadow-sm hover:bg-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-transform active:scale-95">
                        <span>🖨️</span> Ticket
                    </button>
                </div>
            </div>`;
        });
    }
    
    let tTabla = document.getElementById('tabla-historial-facturas');
    if(tTabla) tTabla.innerHTML = html;
    
    let lblTot = document.getElementById('lbl_fact_total');
    if(lblTot) lblTot.innerText = formMoneda(tf);
    
    let lblEfe = document.getElementById('lbl_fact_efectivo');
    if(lblEfe) lblEfe.innerText = formMoneda(tc_efectivo);
    
    // 🔥 ELIMINAMOS EL SÍMBOLO '~' PARA MOSTRAR QUE ES UN DATO REAL
    let lblBan = document.getElementById('lbl_fact_bancos');
    if (lblBan) {
        lblBan.innerHTML = `${formMoneda(tc_bancos)} <span class="text-sm font-bold text-gray-500 ml-1">Bs ${tc_bancos_bs.toLocaleString('es-VE', {minimumFractionDigits: 2})}</span>`;
    }
    
    let lblCre = document.getElementById('lbl_fact_credito');
    if(lblCre) lblCre.innerText = formMoneda(tcr);
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

    let html = `<html><head><title>Ticket ${numFac}</title><style>@page { margin: 0; } body{font-family:monospace;font-size:12px;width:80mm;margin:10px auto;padding:10px}h2{text-align:center;font-size:16px;margin:5px 0}p{margin:3px 0}.center{text-align:center}.divider{border-bottom:1px dashed #000;margin:10px 0}table{width:100%;border-collapse:collapse}th{border-bottom:1px dashed #000;text-align:left}.total{font-size:15px;font-weight:900;text-align:right;margin-top:10px}</style></head><body><div class="center font-bold">*** NO FISCAL ***</div><h2>Granja La Comarca</h2><p class="center">El Vigía, Edo. Mérida</p><div class="divider"></div><p><strong>Fact:</strong> ${numFac}</p><p><strong>Fec:</strong> ${f}</p><p><strong>Cli:</strong> ${cli}</p><p><strong>Cond:</strong> ${tCond}</p>${tVenc}<div class="divider"></div><table><thead><tr><th>Prod</th><th style="text-align:center">Cant</th><th style="text-align:right">SubT</th></tr></thead><tbody>${hItems}</tbody></table><div class="divider"></div>${tDesc}${tTot}<div class="divider"></div><p class="center" style="margin-top:15px;">*** GRACIAS POR SU COMPRA ***</p><script>window.onload=function(){setTimeout(()=>{window.print();},500);}</script></body></html>`;
    v.document.write(html); v.document.close();
}

function abrirModalCobro(fac, deu, cli) {
    let elCli = document.getElementById('cobro_cliente');
    let elFac = document.getElementById('cobro_factura');
    let elDeu = document.getElementById('cobro_deuda');
    let elMonto = document.getElementById('cobro_monto');
    let elModal = document.getElementById('modalCobro');
    
    if(elCli) elCli.innerText = cli; 
    if(elFac) elFac.innerText = fac;
    if(elDeu) elDeu.innerText = deu.toFixed(2); 
    if(elMonto) { elMonto.value = ''; elMonto.max = deu; }
    if(elModal) elModal.classList.remove('hidden');
}

function cerrarModalCobro() { 
    let elModal = document.getElementById('modalCobro');
    if(elModal) elModal.classList.add('hidden'); 
}

async function procesarCobro(e) {
    e.preventDefault();
    let btn = e.target.querySelector('button[type="submit"]'); if(btn){btn.disabled=true; btn.innerText="Procesando...";}
    
    let elMonto = document.getElementById('cobro_monto');
    let elMet = document.getElementById('cobro_metodo');
    let elFac = document.getElementById('cobro_factura');
    let elCli = document.getElementById('cobro_cliente');

    let monto = elMonto ? parseFloat(elMonto.value) : 0; 
    let met = elMet ? elMet.value : 'Efectivo';
    let fac = elFac ? elFac.innerText : ''; 
    let cli = elCli ? elCli.innerText : '';

    let usaBs = (met === 'Transferencia Bancaria' || met === 'Pago Móvil');
    let tasa = usaBs ? TASA_BCV_ACTUAL : 1.0; let vBs = usaBs ? (monto * TASA_BCV_ACTUAL) : 0.0;
    
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
    let html = `<html><head><title>Abono ${numFac}</title><style>@page { margin: 0; } body{font-family:monospace;font-size:12px;width:80mm;margin:10px auto;padding:10px}h2{text-align:center;font-size:16px;margin:5px 0}p{margin:3px 0}.center{text-align:center}.divider{border-bottom:1px dashed #000;margin:10px 0}table{width:100%;border-collapse:collapse}th{border-bottom:1px dashed #000;text-align:left}.total{font-size:15px;font-weight:900;text-align:right;margin-top:10px}</style></head><body><div class="center font-bold">*** NO FISCAL ***</div><h2>Granja La Comarca</h2><p class="center">El Vigía</p><div class="divider"></div><p><strong>Fact:</strong> ${numFac}</p><p><strong>Cli:</strong> ${cli}</p><p><strong>Cond:</strong> Abono a Deuda</p><div class="divider"></div><table><thead><tr><th>Concepto</th><th style="text-align:center">Método</th><th style="text-align:right">SubT</th></tr></thead><tbody><tr><td>Pago parcial</td><td style="text-align:center;">${met}</td><td style="text-align:right;">${formMoneda(mUsd)}</td></tr></tbody></table><div class="divider"></div>${tTot}<div class="divider"></div><p class="center" style="margin-top:15px;">*** APROBADO ***</p><script>window.onload=function(){setTimeout(()=>{window.print();},500);}</script></body></html>`;
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