from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class LoteDB(Base):
    __tablename__ = "lotes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    galpon = Column(String)
    cantidad_inicial = Column(Integer)
    cantidad_actual = Column(Integer)
    raza = Column(String)
    fecha_ingreso = Column(Date)
    fase = Column(String)
    edad_ingreso_dias = Column(Integer, default=0) # Almacenamos siempre en días para estandarizar
    
    producciones = relationship("ProduccionDB", back_populates="lote")
    ventas = relationship("VentaDB", back_populates="lote")
    gastos = relationship("GastoDB", back_populates="lote")
    consumos = relationship("ConsumoAlimentoDB", back_populates="lote")

class ProduccionDB(Base):
    __tablename__ = "produccion"
    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"))
    text = Column(String, nullable=True)
    cantidad_huevos = Column(Integer)
    mortalidad = Column(Integer)
    fecha = Column(Date)
    porcentaje_postura = Column(String)
    lote = relationship("LoteDB", back_populates="producciones")

class VentaDB(Base):
    __tablename__ = "ventas"
    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"))
    concepto = Column(String)
    text = Column(String, nullable=True)
    cantidad_cartones = Column(Float)
    precio_unitario = Column(Float)
    total_ingreso = Column(Float)
    fecha = Column(Date)
    lote = relationship("LoteDB", back_populates="ventas")
    moneda = Column(String, default="USD")
    tasa_cambio = Column(Float, default=1.0)
    monto_ves = Column(Float, default=0.0)

class GastoDB(Base):
    __tablename__ = "gastos"
    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"))
    concepto = Column(String)
    text = Column(String, nullable=True)
    total_gasto = Column(Float)
    fecha = Column(Date)
    categoria = Column(String, default="Operativo") # Operativo o Inversión
    lote = relationship("LoteDB", back_populates="gastos")
    moneda = Column(String, default="USD")
    tasa_cambio = Column(Float, default=1.0)
    monto_ves = Column(Float, default=0.0)

class ConsumoAlimentoDB(Base):
    __tablename__ = "consumo_alimento"
    id = Column(Integer, primary_key=True, index=True)
    lote_id = Column(Integer, ForeignKey("lotes.id"))
    kilos_consumidos = Column(Float)
    gramos_por_ave = Column(Float)
    fecha = Column(Date)
    lote = relationship("LoteDB", back_populates="consumos")

class ProductoDB(Base):
    __tablename__ = "productos"
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True) 
    nombre = Column(String, index=True)
    descripcion = Column(String, nullable=True)
    precio_carton = Column(Float) # NUEVO: Precio al detal
    precio_caja = Column(Float)   # NUEVO: Precio al mayor
    stock_cartones = Column(Float, default=0.0) # El inventario siempre es en cartones

class InsumoDB(Base):
    __tablename__ = "insumos"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    categoria = Column(String)      # Ej: "Alimento", "Empaque", "Medicina"
    unidad_medida = Column(String)  # Ej: "Kg", "Unidad", "Frasco"
    stock_actual = Column(Float, default=0.0) # El inventario real

# --- NUEVOS MODELOS PARA FACTURACIÓN Y CLIENTES ---

class ClienteDB(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    documento = Column(String, unique=True, index=True) 
    nombre = Column(String, index=True)
    telefono = Column(String, nullable=True)
    direccion = Column(String, nullable=True)
    
    facturas = relationship("FacturaDB", back_populates="cliente")

class FacturaDB(Base):
    __tablename__ = "facturas"
    id = Column(Integer, primary_key=True, index=True)
    numero_factura = Column(String, unique=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    fecha = Column(Date)
    condicion = Column(String, default="Efectivo") 
    fecha_vencimiento = Column(Date, nullable=True)  
    descuento_tipo = Column(String, default="%")
    descuento_valor = Column(Float, default=0.0) 
    total = Column(Float)
    saldo_pendiente = Column(Float, default=0.0)
    
    # 👇 ESTAS SON LAS 3 LÍNEAS NUEVAS 👇
    moneda = Column(String, default="USD")
    tasa_cambio = Column(Float, default=1.0)
    monto_ves = Column(Float, default=0.0)
    
    cliente = relationship("ClienteDB", back_populates="facturas")
    detalles = relationship("DetalleFacturaDB", back_populates="factura")

class DetalleFacturaDB(Base):
    __tablename__ = "detalles_factura"
    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"))
    producto_id = Column(Integer, ForeignKey("productos.id"))
    cantidad_cartones = Column(Float)
    precio_unitario = Column(Float)
    subtotal = Column(Float)
    
    factura = relationship("FacturaDB", back_populates="detalles")
    producto = relationship("ProductoDB")

class UsuarioDB(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    rol = Column(String)
    permisos = Column(String, default="") # 🆕 Aquí guardaremos qué casillas marcó el Admin