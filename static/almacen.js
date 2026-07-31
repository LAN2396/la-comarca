// =========================================
// MÓDULO DE INVENTARIO Y ALMACÉN
// =========================================

// --- 1. GENERADOR DE TARJETAS DE INSUMOS ---
async function cargarInsumos() {
    try {
        let res = await fetch('/almacen/insumos');
        if (!res.ok) return;
        let insumos = await res.json();
        
        let htmlTarjetas = '';
        let htmlSelect = '<option value="" disabled selected>Seleccione un insumo...</option>';
        
        let contenedor = document.getElementById('contenedor-insumos-grid');
        if(!contenedor) return;

        if (insumos.length === 0) {
            htmlTarjetas = '<div class="p-10 text-center text-gray-400 font-bold italic">No hay insumos. Crea el primero.</div>';
        } else {
            insumos.forEach(i => {
                htmlSelect += `<option value="${i.id}">${i.nombre} (${i.unidad_medida})</option>`;
                
                let colorStock = i.stock_actual <= 0 ? 'text-red-600' : 'text-gray-900';
                let detalleBultos = "";
                
                if (i.categoria === "Alimento" && i.unidad_medida === "Kg" && i.stock_actual > 0) {
                    let bultosEnteros = Math.floor(i.stock_actual / 40);
                    let kilosSueltos = parseFloat((i.stock_actual % 40).toFixed(1)); 
                    
                    if (bultosEnteros > 0) {
                        detalleBultos = `<span class="text-[11px] text-purple-700 font-bold"> ${bultosEnteros} ${bultosEnteros === 1 ? 'bulto' : 'bultos'}`;
                        if (kilosSueltos > 0) detalleBultos += ` y ${kilosSueltos} Kg sueltos`;
                        detalleBultos += `</span>`;
                    } else {
                        detalleBultos = `<span class="text-[10px] text-gray-500 italic">Suelto (Menos de 1 bulto)</span>`;
                    }
                }

                // Aseguramos que si no hay precio, muestre 0.00
                let precioUnitario = i.ultimo_precio ? formMoneda(i.ultimo_precio) : "$0.00";

                // Tarjeta 100% Corporativa
                htmlTarjetas += `
                <div class="border-b-8 border-gray-200 last:border-b-0 bg-white hover:bg-red-50/10 transition-colors">
                    
                    <!-- Encabezados para PC (5 Columnas) -->
                    <div class="hidden lg:grid lg:grid-cols-5 bg-comarca-dorado text-black uppercase font-bold text-[10px] divide-x divide-yellow-600 border-b border-yellow-600">
                        <div class="px-4 py-2">Insumo y Categoría</div>
                        <div class="px-4 py-2 text-center">Medida</div>
                        <div class="px-4 py-2 text-right">Stock Actual</div>
                        <div class="px-4 py-2 text-center">Último Precio</div>
                        <div class="px-4 py-2 text-center">Acciones</div>
                    </div>
                    
                    <!-- Cuerpo de la Tarjeta -->
                    <div class="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                        <div class="px-4 py-4 flex flex-col justify-center">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 lg:hidden">Insumo</span>
                            <span class="font-black text-comarca-rojo text-lg leading-tight mb-1">${i.nombre}</span>
                            <div><span class="bg-gray-200 text-gray-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide">${i.categoria}</span></div>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-center lg:items-center text-sm">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 lg:hidden">Medida</span>
                            <span class="font-bold text-gray-600">${i.unidad_medida}</span>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-center lg:items-end text-left lg:text-right">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 lg:hidden">Stock Disponible</span>
                            <div>
                                <span class="font-mono font-black text-2xl ${colorStock}">${i.stock_actual.toLocaleString('en-US')}</span> 
                                <span class="text-xs font-bold text-gray-500">${i.unidad_medida}</span>
                            </div>
                            <div class="mt-1">${detalleBultos}</div>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-center lg:items-center text-left lg:text-center">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 lg:hidden">Último Precio Pagado</span>
                            <span class="font-mono font-black text-xl text-emerald-700">${precioUnitario}</span>
                            <span class="text-[10px] font-bold text-gray-400 mt-1">Por ${i.unidad_medida}</span>
                        </div>
                        <div class="px-4 py-4 flex flex-row lg:flex-col justify-center items-center gap-2">
                            <button onclick='cargarInsumoFormulario(${JSON.stringify(i)})' class="w-full lg:w-auto bg-yellow-100 text-yellow-800 hover:bg-yellow-200 px-4 py-2 rounded font-bold text-xs transition">✏️ Editar</button>
                            <button onclick="eliminarInsumo(${i.id})" class="w-full lg:w-auto bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded font-bold text-xs transition">🗑️ Borrar</button>
                        </div>
                    </div>
                </div>`;
            });
        }
        contenedor.innerHTML = htmlTarjetas;        
        
        if(document.getElementById('compra_insumo_id')) document.getElementById('compra_insumo_id').innerHTML = htmlSelect;
        if(document.getElementById('ajuste_insumo_id')) document.getElementById('ajuste_insumo_id').innerHTML = htmlSelect;
    } catch(e) { console.error(e); }
}

function cargarInsumoFormulario(i) {
    document.getElementById('insumo_id').value = i.id;
    document.getElementById('insumo_nombre').value = i.nombre;
    document.getElementById('insumo_cat').value = i.categoria;
    document.getElementById('insumo_unidad').value = i.unidad_medida;
    document.getElementById('insumo_stock').value = i.stock_actual;
    document.getElementById('insumo_precio').value = i.ultimo_precio || 0;
    
    document.getElementById('titulo-form-insumo').innerText = "✏️ Editar Insumo";
    document.getElementById('btn-guardar-insumo').innerText = "Guardar Cambios";
    
    document.getElementById('div-insumo-stock').classList.remove('hidden'); 
    document.getElementById('div-insumo-precio').classList.remove('hidden'); 
    
    if(typeof toggleFormularioAlmacen === 'function') toggleFormularioAlmacen('editar');
}

function limpiarFormInsumo() {
    document.getElementById('formInsumo').reset();
    document.getElementById('insumo_id').value = "";
    document.getElementById('titulo-form-insumo').innerText = "📦 Registrar Nuevo Insumo";
    document.getElementById('btn-guardar-insumo').innerText = "Crear Insumo en Base de Datos";
    
    document.getElementById('div-insumo-stock').classList.add('hidden'); 
    document.getElementById('div-insumo-precio').classList.add('hidden'); 
}

async function eliminarInsumo(id) {
    if(!confirm("¿Seguro que quieres borrar este insumo del almacén?")) return;
    try { await fetch(`/almacen/insumos/eliminar/${id}`, { method: 'POST' }); cargarInsumos(); } catch(e) { alert("Error al eliminar."); }
}

// --- 2. GENERADOR DE PRODUCTOS (SE MANTIENE INTACTO) ---
async function cargarProductos() {
    try {
        let res = await fetch('/productos');
        if (!res.ok) return;
        let productos = await res.json();
        let html = '';
        
        let contenedor = document.getElementById('contenedor-productos-grid');
        if(!contenedor) return;

        if (productos.length === 0) {
            html = `<div class="p-10 text-center text-gray-400 font-bold italic">Catálogo vacío. Registra tu primer producto.</div>`;
        } else {
            productos.forEach((p, i) => {
                let stockEntero = Math.floor(p.stock_cartones);
                let huevosSueltos = Math.round((p.stock_cartones - stockEntero) * 30);
                let cajasEnteras = Math.floor(stockEntero / 12);
                let cartonesSueltosCaja = stockEntero % 12;
                
                let textoStock = `<span class="font-mono font-black text-2xl ${stockEntero <= 0 && huevosSueltos <= 0 ? 'text-red-600' : 'text-gray-900'}">${stockEntero}</span> <span class="text-xs font-bold text-gray-500">CTN</span>`;
                if (huevosSueltos > 0) textoStock += ` <span class="font-mono font-black text-xl text-orange-600 ml-1">+${huevosSueltos}</span> <span class="text-[10px] font-bold text-gray-400 uppercase">sueltos</span>`;
                
                let detalleCajas = `<span class="text-[11px] text-gray-500 font-medium">Equivale a: <b class="text-gray-700">${cajasEnteras} Cajas</b>`;
                if (cartonesSueltosCaja > 0) detalleCajas += ` y ${cartonesSueltosCaja} cartones`;
                detalleCajas += `</span>`;

                html += `
                <div class="border-b-8 border-gray-200 last:border-b-0 bg-white hover:bg-red-50/20 transition-colors">
                    <div class="hidden md:grid md:grid-cols-4 bg-comarca-dorado text-black uppercase font-bold text-[10px] divide-x divide-yellow-600 border-b border-yellow-600">
                        <div class="px-4 py-2">Producto</div>
                        <div class="px-4 py-2 text-center">Precios de Venta</div>
                        <div class="px-4 py-2 text-right">Stock Disponible</div>
                        <div class="px-4 py-2 text-center">Acciones</div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                        <div class="px-4 py-4 flex flex-col justify-center">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Producto</span>
                            <span class="font-mono font-black text-comarca-rojo text-lg leading-none mb-1">${p.codigo}</span>
                            <span class="font-bold text-gray-800 text-sm">${p.nombre}</span>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-center md:items-center text-sm">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-2 md:hidden">Precios</span>
                            <div class="flex justify-between md:justify-center w-full md:w-auto gap-4">
                                <div class="text-left md:text-center"><span class="text-[11px] font-black text-gray-400 uppercase block">Cartón</span><span class="font-bold text-comarca-rojo">${formMoneda(p.precio_carton)}</span></div>
                                <div class="text-right md:text-center"><span class="text-[11px] font-black text-gray-400 uppercase block">Caja</span><span class="font-bold text-yellow-600">${formMoneda(p.precio_caja)}</span></div>
                            </div>
                        </div>
                        <div class="px-4 py-4 flex flex-col justify-center md:items-end text-left md:text-right">
                            <span class="text-[10px] font-black text-yellow-600 uppercase mb-1 md:hidden">Stock Disponible</span>
                            <div>${textoStock}</div>
                            <div class="mt-1">${detalleCajas}</div>
                        </div>
                        <div class="px-4 py-4 flex flex-row md:flex-col justify-center items-center gap-2">
                            <button onclick='cargarProductoFormulario(${JSON.stringify(p)})' class="w-full md:w-auto bg-yellow-100 text-yellow-700 hover:bg-yellow-200 px-4 py-2 rounded font-bold text-xs transition">✏️ Editar</button>
                            <button onclick="eliminarProducto(${p.id})" class="w-full md:w-auto bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded font-bold text-xs transition">🗑️ Borrar</button>
                        </div>
                    </div>
                </div>`;
            });
        }
        contenedor.innerHTML = html;
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
    document.getElementById('lbl_prod_stock').classList.replace('text-gray-500', 'text-comarca-rojo');
    document.getElementById('prod_stock_actual').value = p.stock_cartones; 
    document.getElementById('prod_stock').value = 0; 
    
    if(typeof toggleFormularioProducto === 'function') toggleFormularioProducto('abrir');
}

function limpiarFormProducto() {
    document.getElementById('titulo-form-producto').innerText = "📦 Registrar Nuevo Producto";
    document.getElementById('btn-guardar-producto').innerText = "Guardar Producto";
    document.getElementById('btn-cancelar-producto').classList.add('hidden');
    document.getElementById('formProducto').reset();
    document.getElementById('prod_id').value = '';
    document.getElementById('lbl_prod_stock').innerText = "CARTONES DISPONIBLES (STOCK INICIAL)";
    document.getElementById('lbl_prod_stock').classList.replace('text-comarca-rojo', 'text-gray-500');
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
        if (productos.length === 0) {
            html = '<p class="text-sm text-red-500 font-bold col-span-full">⚠️ No hay productos en el catálogo.</p>';
        } else {
            productos.forEach(p => {
                let stockEntero = Math.floor(p.stock_cartones);
                let huevosStock = Math.round((p.stock_cartones - stockEntero) * 30);
                let txtStock = stockEntero + " CTN";
                if(huevosStock > 0) txtStock += " y " + huevosStock + " uds";
                
                // Nueva tarjeta tipo App Móvil
                html += `
                <div class="flex flex-col justify-between bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm hover:border-yellow-400 transition-colors gap-3">
                    <div class="border-b border-gray-100 pb-2 text-center md:text-left">
                        <span class="font-black text-gray-800 text-base">${p.nombre}</span>
                        <span class="text-[11px] text-comarca-rojo font-bold block mt-1 uppercase tracking-wide">Stock actual: ${txtStock}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
                        <div class="flex flex-col items-center w-1/2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Cartones</label>
                            <input type="number" min="0" data-id="${p.id}" placeholder="0" class="input-empaque-cartones w-full p-2 border-2 border-gray-300 bg-white rounded-lg text-center font-black text-xl text-emerald-700 focus:border-yellow-500 focus:ring-0 outline-none transition-colors">
                        </div>
                        <span class="text-gray-300 font-black text-2xl mt-4">+</span>
                        <div class="flex flex-col items-center w-1/2">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1">Sueltos</label>
                            <input type="number" min="0" max="29" data-id="${p.id}" placeholder="0" class="input-empaque-sueltos w-full p-2 border-2 border-gray-300 bg-white rounded-lg text-center font-black text-xl text-orange-600 focus:border-orange-500 focus:ring-0 outline-none transition-colors">
                        </div>
                    </div>
                </div>`;
            });
        }
        if(document.getElementById('contenedor-productos-empaque')) document.getElementById('contenedor-productos-empaque').innerHTML = html;
    } catch(e) {}
}

// --- 3. EVENTOS ---
document.addEventListener('DOMContentLoaded', () => {
    cargarInsumos();
    cargarProductos();
    cargarFormularioEmpaque();

    // Evento Formulario Insumos
    let fIns = document.getElementById('formInsumo');
    if(fIns) fIns.onsubmit = async (e) => {
        e.preventDefault();
        let id = document.getElementById('insumo_id').value;
        let datos = { 
            nombre: document.getElementById('insumo_nombre').value, 
            categoria: document.getElementById('insumo_cat').value, 
            unidad_medida: document.getElementById('insumo_unidad').value, 
            stock_actual: id ? parseFloat(document.getElementById('insumo_stock').value) : 0,
            ultimo_precio: id ? parseFloat(document.getElementById('insumo_precio').value) : 0
        };
        
        if (id) {
            datos.id = parseInt(id);
            await fetch('/almacen/insumos/editar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        } else {
            await fetch('/almacen/insumos/crear', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        }
        
        cargarInsumos(); 
        if(typeof toggleFormularioAlmacen === 'function') toggleFormularioAlmacen('cerrar');
        limpiarFormInsumo();
    };

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

        try { 
            let r = await fetch(url, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json()); 
            limpiarFormProducto(); 
            
            // 👇 ESTAS SON LAS DOS FUNCIONES QUE ACTUALIZAN TODO 👇
            cargarProductos();
            cargarFormularioEmpaque(); // ¡EL ARREGLO! Ahora el empaque se entera del nuevo producto
            
            if(typeof toggleFormularioProducto === 'function') toggleFormularioProducto('cerrar');
        } catch(err) {
            mostrarRespuesta({mensaje: "Error de conexión."});
        }
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
        if(items.length === 0) return;
        let datos = { fecha: document.getElementById('fecha_empaque').value, huevos_descarte: parseInt(document.getElementById('huevos_descarte').value) || 0, items: items };
        try { let r = await fetch('/empaque/registrar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
            mostrarRespuesta(await r.json()); cargarFormularioEmpaque(); cargarProductos();
        } catch(err) {}
    });

    // Registrar Compra (Calcula el precio unitario automáticamente)
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
        cargarInsumos(); if(typeof toggleFormularioAlmacen === 'function') toggleFormularioAlmacen('cerrar'); if(typeof actualizarBalance === 'function') actualizarBalance(); fComp.reset();
    };

    let fAj = document.getElementById('formAjusteInsumo');
    if(fAj) fAj.onsubmit = async (e) => {
        e.preventDefault();
        let datos = { insumo_id: parseInt(document.getElementById('ajuste_insumo_id').value), cantidad_reducir: parseFloat(document.getElementById('ajuste_cantidad').value), motivo: document.getElementById('ajuste_motivo').value };
        await fetch('/almacen/ajustar', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(datos) });
        cargarInsumos(); if(typeof toggleFormularioAlmacen === 'function') toggleFormularioAlmacen('cerrar'); fAj.reset();
    };
});