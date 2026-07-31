from pydantic import BaseModel
from datetime import date
from typing import List, Optional

# =========================================
# MODELOS DE ALMACÉN E INSUMOS
# =========================================
class InsumoSchema(BaseModel):
    nombre: str
    categoria: str
    unidad_medida: str
    stock_actual: float
    ultimo_precio: float = 0.0  # 🔥 Nuevo campo agregado

# 🔥 Nuevo esquema para poder editar
class InsumoEditSchema(BaseModel):
    id: int
    nombre: str
    categoria: str
    unidad_medida: str
    stock_actual: float
    ultimo_precio: float

class ModeloCompraInsumo(BaseModel):
    insumo_id: int
    cantidad_comprada: float
    es_saco: bool = False
    costo_total: float
    moneda: str = "USD"
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

class ModeloAjusteInsumo(BaseModel):
    insumo_id: int
    cantidad_reducir: float
    motivo: str

# =========================================
# MODELOS DE LOTES Y GRANJA
# =========================================
class ModeloLote(BaseModel):
    nombre: str
    galpon: str
    cantidad_inicial: int
    raza: str
    fecha_ingreso: date
    edad_valor: int
    edad_unidad: str
    costo_adquisicion: float

class ModeloLoteUpdate(BaseModel):
    lote_id: int
    nombre: str
    galpon: str
    raza: str
    fecha_ingreso: date
    edad_valor: int
    edad_unidad: str

class ModeloProduccion(BaseModel):
    lote_id: int
    cantidad_huevos: int
    mortalidad: int = 0
    fecha: date

class ModeloConsumoAlimento(BaseModel):
    lote_id: int
    kilos_consumidos: float
    fecha: date

# =========================================
# MODELOS DE PRODUCTOS Y EMPAQUE
# =========================================
class ModeloProducto(BaseModel):
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    precio_carton: float
    precio_caja: float
    stock_cartones: float = 0.0

class ModeloProductoUpdate(BaseModel):
    producto_id: int
    codigo: str
    nombre: str
    descripcion: Optional[str] = None
    precio_carton: float
    precio_caja: float
    stock_cartones: float

class ItemEmpaque(BaseModel):
    producto_id: int
    cantidad_cartones: float

class ModeloEmpaque(BaseModel):
    fecha: date
    huevos_descarte: int
    items: List[ItemEmpaque]

# =========================================
# MODELOS DE FINANZAS GENERALES
# =========================================
class ModeloVenta(BaseModel):
    lote_id: int
    concepto: str
    cantidad_cartones: float
    precio_unitario: float
    fecha: date

class ModeloGasto(BaseModel):
    lote_id: int
    concepto: str
    total_gasto: float
    fecha: date
    categoria: str 
    moneda: str = "USD"
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

# =========================================
# MODELOS DE CLIENTES Y FACTURACIÓN (POS)
# =========================================
class ModeloCliente(BaseModel):
    documento: str
    nombre: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None

class ModeloClienteUpdate(BaseModel):
    cliente_id: int
    documento: str
    nombre: str
    telefono: Optional[str] = None

class ItemFactura(BaseModel):
    producto_id: int
    cantidad_cartones: float
    precio_unitario: float

class ModeloFactura(BaseModel):
    cliente_id: int
    fecha: date
    condicion: str
    dias_credito: int = 0
    descuento_tipo: str = "%"
    descuento_valor: float = 0.0
    items: List[ItemFactura]
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

class ModeloAbono(BaseModel):
    numero_factura: str
    monto: float
    metodo_pago: str
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

# =========================================
# MODELOS DE SEGURIDAD Y USUARIOS
# =========================================
class ModeloLogin(BaseModel):
    username: str
    password: str

class ModeloNuevoUsuario(BaseModel):
    username: str
    password: str
    rol: str

class ModeloPermisos(BaseModel):
    permisos_str: str