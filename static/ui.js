// =========================================
// INTERFAZ DE USUARIO Y NAVEGACIÓN
// =========================================

// Bloque que coloca la fecha de hoy por defecto en los formularios
document.addEventListener("DOMContentLoaded", () => {
    const inputsFecha = ['fecha_prod', 'fecha_alim', 'lote_fecha', 'corr_prod_fecha', 'corr_alim_fecha', 'fecha_empaque'];
    inputsFecha.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.max = hoy;
            el.value = hoy;
        }
    });
});

// Función central para cambiar de pantalla
function cambiarPestana(panelId) {
    document.querySelectorAll('.panel-seccion').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.pestana-btn').forEach(el => {
        el.classList.remove('bg-red-900', 'text-white', 'shadow-inner');
        el.classList.add('text-red-100', 'hover:bg-red-900/50');
    });
    
    let panel = document.getElementById(panelId);
    if (panel) panel.classList.remove('hidden');
    
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
    
    let tituloSeccion = document.getElementById('titulo-seccion');
    if (tituloSeccion) tituloSeccion.innerText = titulos[panelId] || 'Panel de Control';

    // Disparadores que actualizan la información al entrar a la pestaña
    if (panelId === 'panel-productos' && typeof cargarProductos === 'function') cargarProductos();
    if (panelId === 'panel-historial-facturas' && typeof cargarHistorialFacturas === 'function') cargarHistorialFacturas();
    if (panelId === 'panel-facturacion') {
        if(typeof cargarClientesPOS === 'function') cargarClientesPOS();
        if(typeof cargarProductosPOS === 'function') cargarProductosPOS();
        let posFecha = document.getElementById('pos-fecha');
        if (posFecha) posFecha.innerText = hoy;
    }
    if (panelId === 'panel-clientes' && typeof cargarDirectorioClientes === 'function') cargarDirectorioClientes();
    if (panelId === 'panel-finanzas' && typeof cargarDashboardFinanzas === 'function') cargarDashboardFinanzas();
    if (panelId === 'panel-usuarios' && typeof cargarUsuarios === 'function') cargarUsuarios();
    
    if (panelId === 'panel-graficos' && typeof dibujarGraficos === 'function') {
        let selectGraf = document.getElementById('select_grafico_lote');
        if(selectGraf) {
            if (ultimoLoteTrabajado) {
                selectGraf.value = ultimoLoteTrabajado; 
            } else if (selectGraf.options.length > 1) {
                selectGraf.selectedIndex = 1; 
            }
            dibujarGraficos(selectGraf.value);
        }
    }
    
    // Cierra el menú en móviles automáticamente
    if (window.innerWidth < 768) {
        let sidebar = document.getElementById('sidebarMenu');
        if(sidebar) sidebar.classList.add('-translate-x-full');
    }
}

// Botón "hamburguesa" de teléfonos móviles
function toggleMenu() {
    let sidebar = document.getElementById('sidebarMenu');
    if(sidebar) sidebar.classList.toggle('-translate-x-full');
}