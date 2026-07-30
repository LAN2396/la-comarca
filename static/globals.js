// =========================================
// VARIABLES GLOBALES Y HERRAMIENTAS
// =========================================
let usuarioActual = null;
let rolActual = null;
let ultimoLoteTrabajado = null;
let TASA_BCV_ACTUAL = 0.0;

// Fechas Inteligentes
const fechaLocal = new Date();
const anio = fechaLocal.getFullYear();
const mes = String(fechaLocal.getMonth() + 1).padStart(2, '0');
const dia = String(fechaLocal.getDate()).padStart(2, '0');
const hoy = `${anio}-${mes}-${dia}`;

function esFechaFutura(fechaStr) {
    return fechaStr > hoy; 
}

async function extraerTasaBCV() {
    const display = document.getElementById('tasa-bcv-display');
    if(!display) return;
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

function formMoneda(valor) {
    return "$" + parseFloat(valor).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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
    
    const inputsFecha = ['fecha_prod', 'fecha_alim', 'lote_fecha', 'corr_prod_fecha', 'corr_alim_fecha', 'fecha_empaque'];
    inputsFecha.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = hoy;
    });

    let buscador = document.getElementById('buscador_lote');
    if(buscador && buscador.value > 0 && typeof consultarResumenLote === 'function') {
        consultarResumenLote(buscador.value);
    }
    if(typeof cargarHistorial === 'function') cargarHistorial(30); 
}