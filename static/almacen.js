// =========================================
// MÓDULO DE INVENTARIO Y ALMACÉN
// =========================================
async function cargarInsumos() {
    try {
        let res = await fetch('/almacen/insumos');
        if (!res.ok) return;
        let insumos = await res.json();
        let htmlTabla = '';
        let htmlSelect = '<option value="" disabled selected>Seleccione un insumo...</option>';
        
        if (insumos.length === 0) {
            htmlTabla = '<tr><td colspan="4" class="px-4 py-6 text-center text-gray-400 italic font-bold">No hay insumos.</td></tr>';
        } else {
            insumos.forEach(i => {
                htmlSelect += `<option value="${i.id}">${i.nombre} (${i.unidad_medida})</option>`;
                let colorStock = i.stock_actual <= 0 ? 'text-red-600' : 'text-gray-900';
                let detalleBultos = "";
                if (i.categoria === "Alimento" && i.unidad_medida === "Kg" && i.stock_actual > 0) {
                    let bultosEnteros = Math.floor(i.stock_actual / 40);
                    let kilosSueltos = i.stock_actual % 40;
                    if (bultosEnteros > 0) {
                        detalleBultos = `<br><span class="text-[11px] text-purple-600 font-bold"> ${bultosEnteros} ${bultosEnteros === 1 ? 'bulto' : 'bultos'}`;
                        if (kilosSueltos > 0) detalleBultos += ` y ${kilosSueltos} Kg sueltos`;
                        detalleBultos += `</span>`;
                    } else detalleBultos = `<br><span class="text-[10px] text-gray-500 italic">Menos de 1 bulto completo</span>`;
                }
                htmlTabla += `<tr class="hover:bg-gray-50 border-b border-gray-100"><td class="px-4 py-3 font-bold text-gray-800">${i.nombre}</td><td class="px-4 py-3 text-xs"><span class="bg-gray-200 text-gray-600 px-2 py-1 rounded font-bold">${i.categoria}</span></td><td class="px-4 py-3 text-right font-mono"><span class="font-black text-lg ${colorStock}">${i.stock_actual.toLocaleString('en-US')}</span> <span class="text-xs font-bold text-gray-500">${i.unidad_medida}</span>${detalleBultos}</td><td class="px-4 py-3 text-center"><button onclick="eliminarInsumo(${i.id})" class="bg-red-100 text-red-700 px-3 py-1 rounded font-bold text-xs shadow-sm">Eliminar</button></td></tr>`;
            });
        }
        if(document.getElementById('tabla-insumos-body')) document.getElementById('tabla-insumos-body').innerHTML = htmlTabla;        
        if(document.getElementById('compra_insumo_id')) document.getElementById('compra_insumo_id').innerHTML = htmlSelect;
        if(document.getElementById('ajuste_insumo_id')) document.getElementById('ajuste_insumo_id').innerHTML = htmlSelect;
    } catch(e) { console.error(e); }
}

async function eliminarInsumo(id) {
    if(!confirm("¿Seguro que quieres borrar este insumo?")) return;
    try { await fetch(`/almacen/insumos/eliminar/${id}`, { method: 'POST' }); cargarInsumos(); } catch(e) { alert("Error al eliminar."); }
}

async function cargarProductos() {
    try {
        let res = await fetch('/productos');
        if (!res.ok) return;
        let productos = await res.json();
        let html = '';
        
        let thead = document.querySelector('#tabla-productos');
        if(thead && thead.previousElementSibling) {
            thead.previousElementSibling.innerHTML = `<tr><th class="px-4 py-3 font-semibold text-gray-700">Código</th><th class="px-4 py-3 font-semibold text-gray-700">Producto</th><th class="px-4 py-3 font-semibold text-gray-700 text-center">Precios</th><th class="px-4 py-3 font-semibold text-gray-700 text-right">Stock Disponible</th><th class="px-4 py-3 font-semibold text-gray-700 text-center">Acciones</th></tr>`;
        }

        if (productos.length === 0) {
            html = `<tr><td colspan="5" class="px-4 py-8 text-center text-gray-400 italic">Catálogo vacío.</td></tr>`;
        } else {
            productos.forEach((p, i) => {
                let bg = i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white';
                let stockEntero = Math.floor(p.stock_cartones);
                let huevosSueltos = Math.round((p.stock_cartones - stockEntero) * 30);
                let cajasEnteras = Math.floor(stockEntero / 12);
                let cartonesSueltosCaja = stockEntero % 12;
                
                let textoStock = `<span class="font-mono font-black text-xl ${stockEntero <= 0 && huevosSueltos <= 0 ? 'text-red-600' : 'text-gray-800'}">${stockEntero}</span> <span class="text-xs font-bold text-gray-500">CTN</span>`;
                if (huevosSueltos > 0) textoStock += ` <span class="font-mono font-black text-lg text-orange-600 ml-1">+${huevosSueltos}</span> <span class="text-[10px] font-bold text-gray-400 uppercase">sueltos</span>`;
                
                let detalleCajas = `<br><span class="text-[10px] text-gray-500 font-normal">Equivale a: <b>${cajasEnteras} Cajas</b>`;
                if (cartonesSueltosCaja > 0) detalleCajas += ` y ${cartonesSueltosCaja} cartones`;
                detalleCajas += `</span>`;

                html += `<tr class="${bg} hover:bg-red-50/20"><td class="px-4 py-3 font-mono font-black text-gray-900 text-lg">${p.codigo}</td><td class="px-4 py-3"><span class="font-bold text-gray-800">${p.nombre}</span></td><td class="px-4 py-3 text-center"><div class="text-xs"><span class="text-gray-500">Cartón:</span> <span class="font-bold text-emerald-600">${formMoneda(p.precio_carton)}</span></div><div class="text-xs"><span class="text-gray-500">Caja:</span> <span class="font-bold text-blue-600">${formMoneda(p.precio_caja)}</span></div></td><td class="px-4 py-3 text-right">${textoStock}${detalleCajas}</td><td class="px-4 py-3 text-center space-x-1"><button onclick='cargarProductoFormulario(${JSON.stringify(p)})' class="bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold text-sm">Editar</button><button onclick="eliminarProducto(${p.id})" class="bg-red-100 text-red-700 px-3 py-1.5 rounded font-bold text-sm">Borrar</button></td></tr>`;
            });
        }
        if(document.getElementById('tabla-productos')) document.getElementById('tabla-productos').innerHTML = html;
    } catch(e) { console.error(e); }
}

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
    if(!confirm("¿Seguro que deseas eliminar este producto?")) return;
    try { let r = await fetch(`/productos/eliminar/${id}`, { method: 'POST' }); mostrarRespuesta(await r.json()); cargarProductos(); } catch(e) {}
}

async function cargarFormularioEmpaque() {
    try {
        let res = await fetch('/productos');
        if (!res.ok) return;
        let productos = await res.json();
        let html = '';
        if (productos.length === 0) html = '<p class="text-sm text-red-500 font-bold">⚠️ No hay productos en el catálogo.</p>';
        else {
            productos.forEach(p => {
                let stockEntero = Math.floor(p.stock_cartones);
                let huevosStock = Math.round((p.stock_cartones - stockEntero) * 30);
                let txtStock = stockEntero + " CTN";
                if(huevosStock > 0) txtStock += " y " + huevosStock + " uds";
                html += `<div class="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded border border-gray-200 gap-2"><div><span class="font-bold text-gray-800">${p.nombre}</span><span class="text-[10px] text-gray-500 ml-2 block md:inline">Stock actual: ${txtStock}</span></div><div class="flex items-center gap-2 self-end md:self-auto"><input type="number" min="0" data-id="${p.id}" placeholder="0" class="input-empaque-cartones w-16 p-2 border rounded text-center font-bold text-emerald-700"><span class="text-xs font-bold">CTN</span> <span class="text-gray-300 font-bold">+</span> <input type="number" min="0" max="29" data-id="${p.id}" placeholder="0" class="input-empaque-sueltos w-16 p-2 border rounded text-center font-bold text-orange-600"><span class="text-xs font-bold text-gray-500">Sueltos</span></div></div>`;
            });
        }
        if(document.getElementById('contenedor-productos-empaque')) document.getElementById('contenedor-productos-empaque').innerHTML = html;
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    cargarInsumos();
    cargarProductos();
    cargarFormularioEmpaque();

    let fProd = document.getElementById('formProducto');
    if(fProd) fProd.addEventListener('submit', async (e) => {
        e.preventDefault();
        let id = document.getElementById('prod_id').value;
        let stockIngresado = parseFloat(document.getElementById('prod_stock').value) || 0;
        let stockActual = parseFloat(document.getElementById('prod_stock_actual').value) || 0;
        
        let datos = {
            codigo: document.getElementById('prod_codigo').value.toUpperCase(), nombre: document.getElementById('prod_nombre').value,
            descripcion: document.getElementById('prod_descripcion').value, precio_carton: parseFloat(document.getElementById('prod_precio_carton').value),
            precio_caja: parseFloat(document.getElementById('prod_precio_caja').value), stock_cartones: id ? (stockActual + stockIngresado) : stockIngresado 
        };
        let url = id ? '/productos/editar' : '/productos/crear';
        if (id) datos.producto_id = parseInt(id);

        try { let r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json()); limpiarFormProducto(); cargarProductos();
        } catch(err) { mostrarRespuesta({mensaje: "Error de conexión."}); }
    });

    let fEmp = document.getElementById('formEmpaque');
    if(fEmp) fEmp.addEventListener('submit', async (e) => {
        e.preventDefault();
        let items = [];
        document.querySelectorAll('.input-empaque-cartones').forEach(inputCarton => {
            let id = inputCarton.getAttribute('data-id');
            let inputSuelto = document.querySelector(`.input-empaque-sueltos[data-id="${id}"]`);
            let cartones = parseInt(inputCarton.value) || 0;
            let sueltos = parseInt(inputSuelto.value) || 0;
            if (cartones > 0 || sueltos > 0) items.push({ producto_id: parseInt(id), cantidad_cartones: cartones + (sueltos / 30.0) });
        });
        if(items.length === 0) { alert("Debes empacar al menos 1 cartón o 1 huevo suelto."); return; }
        let datos = { fecha: document.getElementById('fecha_empaque').value, huevos_descarte: parseInt(document.getElementById('huevos_descarte').value) || 0, items: items };
        try { let r = await fetch('/empaque/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json()); cargarFormularioEmpaque(); cargarProductos();
        } catch(err) {}
    });

    let fIns = document.getElementById('formInsumo');
    if(fIns) fIns.onsubmit = async (e) => {
        e.preventDefault();
        let datos = { nombre: document.getElementById('insumo_nombre').value, categoria: document.getElementById('insumo_cat').value, unidad_medida: document.getElementById('insumo_unidad').value, stock_actual: 0 };
        await fetch('/almacen/insumos/crear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        cargarInsumos(); fIns.reset();
    };

    let fComp = document.getElementById('formCompraInsumo');
    if(fComp) fComp.onsubmit = async (e) => {
        e.preventDefault();
        let costoUsd = parseFloat(document.getElementById('compra_costo').value);
        let pagaEnBolivares = costoUsd > 0 ? confirm("¿Vas a pagar esta compra en Bolívares (Pago Móvil/Transferencia)?") : false;
        let datos = {
            insumo_id: parseInt(document.getElementById('compra_insumo_id').value), cantidad_comprada: parseFloat(document.getElementById('compra_cantidad').value),
            es_saco: document.getElementById('compra_es_saco').checked, costo_total: costoUsd,
            moneda: pagaEnBolivares ? "VES" : "USD", tasa_cambio: pagaEnBolivares ? TASA_BCV_ACTUAL : 1.0, monto_ves: pagaEnBolivares ? (costoUsd * TASA_BCV_ACTUAL) : 0.0
        };
        await fetch('/almacen/comprar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        cargarInsumos(); if(typeof actualizarBalance === 'function') actualizarBalance(); fComp.reset();
    };

    let fAj = document.getElementById('formAjusteInsumo');
    if(fAj) fAj.onsubmit = async (e) => {
        e.preventDefault();
        let datos = { insumo_id: parseInt(document.getElementById('ajuste_insumo_id').value), cantidad_reducir: parseFloat(document.getElementById('ajuste_cantidad').value), motivo: document.getElementById('ajuste_motivo').value };
        await fetch('/almacen/ajustar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        cargarInsumos(); fAj.reset();
    };
});