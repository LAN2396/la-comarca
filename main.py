from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request
from pydantic import BaseModel
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import text
import datetime
import models
from database import engine, obtener_db
import sqlite3 
import requests
from bs4 import BeautifulSoup
import urllib3

# Ocultamos las advertencias de seguridad porque la página del BCV a veces tiene certificados vencidos
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = FastAPI()
# --- INYECTOR DE PERMISOS ---
try:
    import sqlite3
    con = sqlite3.connect("granja.db")
    con.execute("ALTER TABLE usuarios ADD COLUMN permisos VARCHAR DEFAULT ''")
    con.execute("UPDATE usuarios SET permisos = 'TODOS' WHERE username = 'luis armando'")
    con.commit()
    con.close()
except:
    pass # Si ya existe, pasa de largo sin errores
models.Base.metadata.create_all(bind=engine)

import hashlib

# --- SISTEMA DE ENCRIPTACIÓN NATIVO (Antifallos) ---
def obtener_password_hash(password: str):
    # Encripta la contraseña usando SHA-256
    return hashlib.sha256(password.encode()).hexdigest()

def verificar_password(plain_password: str, hashed_password: str):
    # Compara la contraseña encriptada, pero perdona a los 3 usuarios viejos (texto plano)
    hash_calculado = hashlib.sha256(plain_password.encode()).hexdigest()
    return hashed_password == hash_calculado or hashed_password == plain_password

# --- INICIALIZADOR INTELIGENTE DE USUARIOS ---
def inicializar_usuarios_inteligente():
    db = next(obtener_db())
    try:
        if db.query(models.UsuarioDB).count() == 0:
            usuarios_base = [
                models.UsuarioDB(username="admin", password=obtener_password_hash("admin123"), rol="Administrador"),
                models.UsuarioDB(username="empleado", password=obtener_password_hash("granja123"), rol="Empleado"),
                models.UsuarioDB(username="inversor", password=obtener_password_hash("dinero123"), rol="Inversor")
            ]
            db.add_all(usuarios_base)
            db.commit()
            print("🔐 Usuarios inicializados correctamente.")
    except Exception as e:
        print("⚠️ Error inicializando usuarios:", e)
    finally:
        db.close()

inicializar_usuarios_inteligente()

# --- 2. LA RUTA EXACTA (Con el "datos: ModeloLogin") ---

# ✅ ESTAS SON LAS DOS LÍNEAS QUE SE HABÍAN BORRADO
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- MODELOS DE ENTRADA (PYDANTIC) ---

# --- MODELOS DE INSUMOS (ALMACÉN) ---
class ModeloInsumo(BaseModel):
    nombre: str
    categoria: str
    unidad_medida: str
    stock_actual: float = 0.0

class ModeloCompraInsumo(BaseModel):
    insumo_id: int
    cantidad_comprada: float
    es_saco: bool = False # Magia para identificar si compraste sacos de 40kg
    costo_total: float
    moneda: str = "USD"
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

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

class ModeloConsumoAlimento(BaseModel):
    lote_id: int
    kilos_consumidos: float
    fecha: date

class ModeloProducto(BaseModel):
    codigo: str
    nombre: str
    descripcion: str | None = None
    precio_carton: float
    precio_caja: float
    stock_cartones: float = 0.0

class ModeloProductoUpdate(BaseModel):
    producto_id: int
    codigo: str
    nombre: str
    descripcion: str | None = None
    precio_carton: float
    precio_caja: float
    stock_cartones: float

class ItemEmpaque(BaseModel):
    producto_id: int
    cantidad_cartones: float

class ModeloEmpaque(BaseModel):
    fecha: date
    huevos_descarte: int
    items: list[ItemEmpaque]

class ModeloAjusteInsumo(BaseModel):
    insumo_id: int
    cantidad_reducir: float
    motivo: str

    # --- MODELOS PYDANTIC PARA FACTURACIÓN ---
class ModeloCliente(BaseModel):
    documento: str
    nombre: str
    telefono: str | None = None
    direccion: str | None = None

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
    items: list[ItemFactura]
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

class ModeloClienteUpdate(BaseModel):
    cliente_id: int
    documento: str
    nombre: str
    telefono: str | None = None

class ModeloAbono(BaseModel):
    numero_factura: str
    monto: float
    metodo_pago: str
    tasa_cambio: float = 1.0
    monto_ves: float = 0.0

# --- MODELOS PARA USUARIOS ---
class ModeloLogin(BaseModel):
    username: str
    password: str

class ModeloNuevoUsuario(BaseModel):
    username: str
    password: str
    rol: str

class ModeloPermisos(BaseModel):
    permisos_str: str

# =========================================
# 🛡️ GUARDIANES DE SEGURIDAD (ANTI-HACKEOS)
# =========================================
def verificar_admin(x_user: str = Header(None), db: Session = Depends(obtener_db)):
    if not x_user:
        raise HTTPException(status_code=403, detail="Intento bloqueado: No tienes un pase de acceso.")
    
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.username == x_user).first()
    if not user or user.rol != "Administrador":
        raise HTTPException(status_code=403, detail="🛡️ ALERTA DE SEGURIDAD: Acción denegada. Solo el Administrador Maestro puede hacer esto.")
    return user

def verificar_finanzas(x_user: str = Header(None), db: Session = Depends(obtener_db)):
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.username == x_user).first()
    if not user or user.rol not in ["Administrador", "Inversor"]:
        raise HTTPException(status_code=403, detail="🛡️ ALERTA DE SEGURIDAD: Los empleados no tienen permitido ver el dinero de la granja.")
    return user

import time

# Diccionario en memoria para rastrear IPs o usuarios: { "usuario": {"intentos": 3, "bloqueado_hasta": 1699999999} }
registro_intentos = {}
MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15

@app.post("/login")
def iniciar_sesion(datos: ModeloLogin, db: Session = Depends(obtener_db), request: Request = None):
    usuario_req = datos.username.lower()
    tiempo_actual = time.time()
    
    # 1. VERIFICAR SI ESTÁ BLOQUEADO
    if usuario_req in registro_intentos:
        info = registro_intentos[usuario_req]
        if info["bloqueado_hasta"] > tiempo_actual:
            tiempo_restante = int((info["bloqueado_hasta"] - tiempo_actual) / 60)
            raise HTTPException(status_code=429, detail=f"Demasiados intentos fallidos. Sistema bloqueado. Intenta en {tiempo_restante} minutos.")
        elif info["bloqueado_hasta"] != 0 and info["bloqueado_hasta"] < tiempo_actual:
            # El castigo expiró, reseteamos
            registro_intentos[usuario_req] = {"intentos": 0, "bloqueado_hasta": 0}

    # 2. BUSCAR USUARIO
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.username == usuario_req).first()
    
    if not user:
        registrar_fallo(usuario_req, tiempo_actual)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.") # Mensaje genérico para no dar pistas
        
    # 3. VERIFICAR CONTRASEÑA
    try:
        pass_valida = verificar_password(datos.password, user.password)
    except ValueError:
        pass_valida = (user.password == datos.password)
        
    if not pass_valida:
        registrar_fallo(usuario_req, tiempo_actual)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
    
    # 4. SI ENTRA CON ÉXITO, LIMPIAR HISTORIAL DE ERRORES
    if usuario_req in registro_intentos:
        del registro_intentos[usuario_req]
        
    return {"mensaje": "Bienvenido", "username": user.username, "rol": user.rol, "permisos": getattr(user, 'permisos', '')}

def registrar_fallo(usuario: str, tiempo_actual: float):
    if usuario not in registro_intentos:
        registro_intentos[usuario] = {"intentos": 1, "bloqueado_hasta": 0}
    else:
        registro_intentos[usuario]["intentos"] += 1
        
    if registro_intentos[usuario]["intentos"] >= MAX_INTENTOS:
        registro_intentos[usuario]["bloqueado_hasta"] = tiempo_actual + (MINUTOS_BLOQUEO * 60)

# --- RUTA PARA CREAR USUARIOS DINÁMICAMENTE ---
@app.post("/usuarios/crear")
def crear_usuario(usuario: ModeloNuevoUsuario, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    existe = db.query(models.UsuarioDB).filter(models.UsuarioDB.username == usuario.username.lower()).first()
    if existe:
        raise HTTPException(status_code=400, detail="Este nombre de usuario ya está registrado.")
        
    nuevo_user = models.UsuarioDB(
        username=usuario.username.lower(),
        password=obtener_password_hash(usuario.password),
        rol=usuario.rol
    )
    db.add(nuevo_user)
    db.commit()
    return {"mensaje": f"¡Usuario {usuario.username} registrado exitosamente como {usuario.rol}!"}

@app.get("/usuarios")
def listar_usuarios(db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    usuarios = db.query(models.UsuarioDB).all()
    # No enviamos las contraseñas al frontend por seguridad
    return [{"id": u.id, "username": u.username, "rol": u.rol, "permisos": getattr(u, 'permisos', '')} for u in usuarios]

@app.post("/usuarios/permisos/{user_id}")
def actualizar_permisos(user_id: int, datos: ModeloPermisos, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.permisos = datos.permisos_str
    db.commit()
    return {"mensaje": f"Accesos exactos guardados para @{user.username}."}

@app.post("/usuarios/eliminar/{user_id}")
def eliminar_usuario(user_id: int, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.username == "luis armando":
        raise HTTPException(status_code=400, detail="Acción denegada: No puedes eliminar al superadministrador.")
    
    db.delete(user)
    db.commit()
    return {"mensaje": f"El usuario @{user.username} ha sido revocado."}

# --- RUTAS PRINCIPALES ---

# =========================================
# RUTAS DE CLIENTES Y FACTURACIÓN
# =========================================

@app.get("/clientes")
def listar_clientes(db: Session = Depends(obtener_db)):
    return db.query(models.ClienteDB).all()

@app.post("/clientes/crear")
def crear_cliente(cliente: ModeloCliente, db: Session = Depends(obtener_db)):
    existe = db.query(models.ClienteDB).filter(models.ClienteDB.documento == cliente.documento).first()
    if existe:
        raise HTTPException(status_code=400, detail="Este documento o RIF ya está registrado.")
    
    db_cliente = models.ClienteDB(**cliente.dict())
    db.add(db_cliente)
    db.commit()
    return {"mensaje": f"¡Cliente {cliente.nombre} registrado con éxito!"}

@app.post("/clientes/editar")
def editar_cliente(cliente_edit: ModeloClienteUpdate, db: Session = Depends(obtener_db)):
    db_cliente = db.query(models.ClienteDB).filter(models.ClienteDB.id == cliente_edit.cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    
    db_cliente.documento = cliente_edit.documento
    db_cliente.nombre = cliente_edit.nombre
    db_cliente.telefono = cliente_edit.telefono
    db.commit()
    return {"mensaje": "¡Datos del cliente actualizados correctamente!"}

@app.post("/facturacion/procesar")
def procesar_factura(factura: ModeloFactura, db: Session = Depends(obtener_db)):
    try:
        cliente = db.query(models.ClienteDB).filter(models.ClienteDB.id == factura.cliente_id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado.")

        ultima_fact = db.query(models.FacturaDB).order_by(models.FacturaDB.id.desc()).first()
        num_seq = (ultima_fact.id + 1) if ultima_fact else 1
        numero_factura = f"FAC-{num_seq:04d}"

        f_vencimiento = None
        if factura.condicion == "Crédito" and factura.dias_credito > 0:
            f_vencimiento = factura.fecha + datetime.timedelta(days=factura.dias_credito)

        for item in factura.items:
            producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
            if not producto or producto.stock_cartones < item.cantidad_cartones:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para {producto.nombre if producto else 'ID ' + str(item.producto_id)}.")

        # --- AQUI ESTA LA MAGIA DE LOS BOLÍVARES ---
        db_factura = models.FacturaDB(
            numero_factura=numero_factura,
            cliente_id=factura.cliente_id,
            fecha=factura.fecha,
            condicion=factura.condicion,
            fecha_vencimiento=f_vencimiento,
            descuento_tipo=factura.descuento_tipo,
            descuento_valor=factura.descuento_valor,
            total=0.0,
            moneda="VES" if factura.condicion in ["Transferencia", "Pago Móvil"] else "USD",
            tasa_cambio=factura.tasa_cambio,
            monto_ves=factura.monto_ves
        )
        db.add(db_factura)
        db.flush()

        total_bruto = 0.0
        for item in factura.items:
            producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
            subtotal = item.cantidad_cartones * item.precio_unitario
            total_bruto += subtotal
            producto.stock_cartones -= item.cantidad_cartones
            db_detalle = models.DetalleFacturaDB(
                factura_id=db_factura.id, producto_id=item.producto_id,
                cantidad_cartones=item.cantidad_cartones, precio_unitario=item.precio_unitario, subtotal=subtotal
            )
            db.add(db_detalle)

        descuento_monto = 0.0
        if factura.descuento_tipo == "%":
            descuento_monto = total_bruto * (factura.descuento_valor / 100.0)
        else:
            descuento_monto = factura.descuento_valor 

        total_neto = max(0.0, total_bruto - descuento_monto) 
        db_factura.total = total_neto

        if factura.condicion == "Crédito":
            db_factura.saldo_pendiente = total_neto
            monto_para_caja = 0.0 
        else:
            db_factura.saldo_pendiente = 0.0
            monto_para_caja = total_neto 

        if monto_para_caja > 0:
            texto_desc = f"{factura.descuento_valor}%" if factura.descuento_tipo == "%" else f"${factura.descuento_valor}"
            lote_seguro = db.query(models.LoteDB).first()
            lote_valido = lote_seguro.id if lote_seguro else None
            
            # Agregamos la info de la moneda al texto de la caja para que lo veas claro en Finanzas
            texto_moneda = f" (Bs {factura.monto_ves:.2f} a Tasa {factura.tasa_cambio})" if factura.monto_ves > 0 else ""

            ingreso_general = models.VentaDB(
                lote_id=lote_valido, 
                concepto=f"Venta {factura.condicion} {numero_factura} - {cliente.nombre} (-{texto_desc}){texto_moneda}",
                cantidad_cartones=sum(i.cantidad_cartones for i in factura.items),
                precio_unitario=0,
                total_ingreso=monto_para_caja,
                fecha=factura.fecha,
                moneda="VES" if factura.condicion in ["Transferencia", "Pago Móvil"] else "USD",
                tasa_cambio=factura.tasa_cambio,
                monto_ves=factura.monto_ves
            )
            db.add(ingreso_general)

        db.commit()

        return {"mensaje": f"¡Factura {numero_factura} procesada con éxito!", "numero_factura": numero_factura}
        
    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=400, detail=f"Falla interna: {str(e)}")
    
    # --- RUTA PARA EL HISTORIAL DE FACTURAS ---
@app.get("/facturacion/historial")
def historial_facturas(db: Session = Depends(obtener_db)):
    facturas = db.query(models.FacturaDB).order_by(models.FacturaDB.id.desc()).all()
    resultado = []
    
    for f in facturas:
        # Extraemos los productos de esta factura específica para el ticket
        detalles_lista = []
        for d in f.detalles:
            detalles_lista.append({
                "nombre": d.producto.nombre if d.producto else "Prod. Eliminado",
                "cantidad_cartones": d.cantidad_cartones,
                "subtotal": d.subtotal
            })

        resultado.append({
            "numero_factura": f.numero_factura,
            "cliente": f.cliente.nombre if f.cliente else "Cliente Desconocido",
            "fecha": f.fecha.strftime("%d/%m/%Y"),
            "condicion": f.condicion,
            "fecha_vencimiento": f.fecha_vencimiento.strftime("%d/%m/%Y") if f.fecha_vencimiento else None,
            "descuento_tipo": f.descuento_tipo,
            "descuento_valor": f.descuento_valor,
            "total": f.total,
            "saldo_pendiente": getattr(f, 'saldo_pendiente', 0.0),
            "moneda": getattr(f, 'moneda', 'USD'),
            "tasa_cambio": getattr(f, 'tasa_cambio', 1.0),
            "monto_ves": getattr(f, 'monto_ves', 0.0),
            "detalles": detalles_lista
        })
        
    return resultado

@app.post("/facturacion/abonar")
def abonar_factura(abono: ModeloAbono, db: Session = Depends(obtener_db)):
    factura = db.query(models.FacturaDB).filter(models.FacturaDB.numero_factura == abono.numero_factura).first()
    if not factura: raise HTTPException(status_code=404, detail="Factura no encontrada")
    if abono.monto <= 0 or abono.monto > factura.saldo_pendiente:
        raise HTTPException(status_code=400, detail="Monto inválido o excede la deuda actual.")
    
    factura.saldo_pendiente -= abono.monto
        
    # 🔥 NUEVO: La factura ahora recuerda el método y la tasa con la que fue pagada
    factura.tasa_cambio = abono.tasa_cambio
    factura.moneda = "VES" if abono.metodo_pago in ["Transferencia Bancaria", "Pago Móvil", "Transferencia"] else "USD"
        
    # Si paga por partes, sumamos los bolívares al total de la factura
    if factura.monto_ves is None:
        factura.monto_ves = 0.0
    factura.monto_ves += abono.monto_ves

    lote_seguro = db.query(models.LoteDB).first()
    lote_valido = lote_seguro.id if lote_seguro else None

    # Anexamos la información de la transferencia en Bs al concepto de la caja
    texto_moneda = f" (Bs {abono.monto_ves:.2f} a Tasa {abono.tasa_cambio})" if abono.monto_ves > 0 else ""

    ingreso = models.VentaDB(
        lote_id=lote_valido,
        concepto=f"Abono ({abono.metodo_pago}) - Fra. {factura.numero_factura} ({factura.cliente.nombre}){texto_moneda}",
        cantidad_cartones=0, precio_unitario=0,
        total_ingreso=abono.monto,
        fecha=date.today(),
        moneda="VES" if factura.condicion in ["Transferencia", "Pago Móvil"] else "USD",
        tasa_cambio=abono.tasa_cambio,
        monto_ves=abono.monto_ves
    )
    db.add(ingreso)
    db.commit()
    return {"mensaje": f"¡Abono de ${abono.monto:.2f} registrado con éxito a la cuenta de caja!"}

@app.get("/api/tasa-bcv")
def obtener_tasa_bcv():
    try:
        # 1. Nos conectamos al BCV (verify=False es clave para que no dé error de certificado)
        url = "https://www.bcv.org.ve/"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, verify=False, timeout=10, headers=headers)
        
        # 2. Leemos el código fuente de la página
        soup = BeautifulSoup(response.content, "html.parser")
        
        # 3. Buscamos específicamente el recuadro del Dólar
        dolar_div = soup.find("div", id="dolar")
        tasa_texto = dolar_div.find("strong").text.strip().replace(",", ".")
        tasa_float = float(tasa_texto)
        
        return {"exito": True, "tasa": tasa_float, "origen": "BCV Oficial"}
        
    except Exception as e:
        # Si la página del BCV está caída, avisamos al frontend
        return {"exito": False, "tasa": 0.0, "error": str(e)}

@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    # Le quitamos el "request=request" y el "name=" para usar la sintaxis clásica
    return templates.TemplateResponse(request=request, name="index.html", context={"request": request})

@app.post("/lotes/crear")
def registrar_lote(lote_nuevo: ModeloLote, db: Session = Depends(obtener_db)):
    dias_calculados = lote_nuevo.edad_valor * 7 if lote_nuevo.edad_unidad == "semanas" else lote_nuevo.edad_valor

    db_lote = models.LoteDB(
        nombre=lote_nuevo.nombre, galpon=lote_nuevo.galpon,
        cantidad_inicial=lote_nuevo.cantidad_inicial, cantidad_actual=lote_nuevo.cantidad_inicial,
        raza=lote_nuevo.raza, fecha_ingreso=lote_nuevo.fecha_ingreso, fase="Levante",
        edad_ingreso_dias=dias_calculados
    )
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)

    if lote_nuevo.costo_adquisicion > 0:
        db_gasto = models.GastoDB(
            lote_id=db_lote.id, 
            concepto=f"Compra de aves ({lote_nuevo.cantidad_inicial})", 
            total_gasto=lote_nuevo.costo_adquisicion, 
            fecha=lote_nuevo.fecha_ingreso,
            categoria="Inversión"
        )
        db.add(db_gasto)
        db.commit()

    return {"mensaje": "¡Lote de La Comarca guardado con éxito!", "lote_id": db_lote.id}

# --- RUTAS PARA EDITAR DATOS DEL LOTE (INFO BÁSICA) ---
@app.get("/lotes/{lote_id}/editar-info")
def info_editar_lote(lote_id: int, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    edad_unidad = "semanas" if lote.edad_ingreso_dias % 7 == 0 and lote.edad_ingreso_dias > 0 else "dias"
    edad_valor = lote.edad_ingreso_dias // 7 if edad_unidad == "semanas" else lote.edad_ingreso_dias
    
    return {
        "nombre": lote.nombre,
        "galpon": lote.galpon,
        "raza": lote.raza,
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_valor": edad_valor,
        "edad_unidad": edad_unidad
    }

@app.post("/lotes/editar")
def editar_lote(lote_editado: ModeloLoteUpdate, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_editado.lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    dias_calculados = lote_editado.edad_valor * 7 if lote_editado.edad_unidad == "semanas" else lote_editado.edad_valor
    
    lote.nombre = lote_editado.nombre
    lote.galpon = lote_editado.galpon
    lote.raza = lote_editado.raza
    lote.fecha_ingreso = lote_editado.fecha_ingreso
    lote.edad_ingreso_dias = dias_calculados
    
    db.commit()
    return {"mensaje": f"¡Lote ID {lote.id} actualizado y corregido correctamente!"}

# --- RUTAS NUEVAS PARA CORREGIR REGISTROS DIARIOS ---
@app.get("/produccion/buscar/{lote_id}/{fecha}")
def buscar_produccion_diaria(lote_id: int, fecha: date, db: Session = Depends(obtener_db)):
    prod = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == lote_id, models.ProduccionDB.fecha == fecha).first()
    if not prod:
        raise HTTPException(status_code=404, detail="No hay registro de producción en esa fecha.")
    return {"cantidad_huevos": prod.cantidad_huevos, "mortalidad": prod.mortalidad}

@app.post("/produccion/corregir")
def corregir_produccion(datos: ModeloProduccion, db: Session = Depends(obtener_db)):
    prod = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == datos.lote_id, models.ProduccionDB.fecha == datos.fecha).first()
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == datos.lote_id).first()
    if not prod or not lote:
        raise HTTPException(status_code=404, detail="Registro o lote no encontrado.")
    
    diferencia_muertes = datos.mortalidad - prod.mortalidad
    lote.cantidad_actual -= diferencia_muertes
    
    prod.mortalidad = datos.mortalidad
    prod.cantidad_huevos = datos.cantidad_huevos
    db.commit()
    return {"mensaje": "¡Registro de Producción/Bajas corregido con éxito!"}

@app.get("/alimento/buscar/{lote_id}/{fecha}")
def buscar_alimento_diario(lote_id: int, fecha: date, db: Session = Depends(obtener_db)):
    alim = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == lote_id, models.ConsumoAlimentoDB.fecha == fecha).first()
    if not alim:
        raise HTTPException(status_code=404, detail="No hay registro de alimento en esa fecha.")
    return {"kilos_consumidos": alim.kilos_consumidos}

@app.post("/alimento/corregir")
def corregir_alimento(datos: ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    alim = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == datos.lote_id, models.ConsumoAlimentoDB.fecha == datos.fecha).first()
    if not alim:
        raise HTTPException(status_code=404, detail="Registro de alimento no encontrado.")
    
    alim.kilos_consumidos = datos.kilos_consumidos
    db.commit()
    return {"mensaje": "¡Consumo de alimento corregido con éxito!"}

# --- RUTAS DE CONSULTA Y FINANZAS ---

@app.get("/lotes/activos")
def obtener_lotes_activos(db: Session = Depends(obtener_db)):
    # Buscamos solo los lotes que tengan aves vivas actualmente
    lotes = db.query(models.LoteDB).filter(models.LoteDB.cantidad_actual > 0).all()
    
    lista_activos = []
    for lote in lotes:
        # AQUÍ ESTÁ EL CAMBIO: Quitamos el prefijo automático L0000
        etiqueta = f"{lote.nombre} ({lote.galpon})"
        lista_activos.append({"id": lote.id, "etiqueta": etiqueta})
        
    return lista_activos

@app.get("/lotes/{lote_id}/resumen")
def resumen_lote(lote_id: int, db: Session = Depends(obtener_db)):
    if lote_id <= 0:
        raise HTTPException(status_code=400, detail="ID inválido")

    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    total_mortalidad = sum(p.mortalidad for p in lote.producciones) if lote.producciones else 0
    porcentaje_mortalidad = (total_mortalidad / lote.cantidad_inicial) * 100 if lote.cantidad_inicial > 0 else 0
    
    dias_en_granja = (date.today() - lote.fecha_ingreso).days
    edad_total_dias = dias_en_granja + lote.edad_ingreso_dias
    semanas = edad_total_dias // 7
    
    gastos = db.query(models.GastoDB).filter(models.GastoDB.lote_id == lote.id).all()
    
    costo_aves = 0.0
    costo_alimento = 0.0
    costo_medicina = 0.0
    otros_levante = 0.0
    gastos_operativos = 0.0 # Nuevo acumulador

    for g in gastos:
        if g.categoria == "Inversión": 
            concepto_texto = g.concepto.lower()
            if "ave" in concepto_texto or "polla" in concepto_texto:
                costo_aves += g.total_gasto
            elif "alimento" in concepto_texto or "aba" in concepto_texto:
                costo_alimento += g.total_gasto
            elif "medicina" in concepto_texto or "vacuna" in concepto_texto:
                costo_medicina += g.total_gasto
            else:
                otros_levante += g.total_gasto
        elif g.categoria == "Operativo":
            gastos_operativos += g.total_gasto
    
    monto_inversion = costo_aves + costo_alimento + costo_medicina + otros_levante
    
    # Nuevos cálculos financieros individuales
    ventas = db.query(models.VentaDB).filter(models.VentaDB.lote_id == lote.id).all()
    ingresos_lote = sum(v.total_ingreso for v in ventas) if ventas else 0.0
    
    balance_operativo = ingresos_lote - gastos_operativos
    balance_total_roi = ingresos_lote - (gastos_operativos + monto_inversion)

    semanas_faltantes = max(0, 100 - semanas)
    fecha_nac = lote.fecha_ingreso - datetime.timedelta(days=lote.edad_ingreso_dias)

    return {
        "codigo": f"L{lote.id:04d}",
        "galpon": lote.galpon,
        "raza": lote.raza,
        "aves_iniciales": lote.cantidad_inicial,
        "fecha_nacimiento": fecha_nac.strftime("%Y-%m-%d"),
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_semanas": semanas,
        "porcentaje_mortalidad": round(porcentaje_mortalidad, 2),
        "inversion_levante": monto_inversion,
        "aves_hoy": lote.cantidad_actual,
        "semanas_faltantes": semanas_faltantes,
        "desglose": {
            "aves": costo_aves,
            "alimento": costo_alimento,
            "medicina": costo_medicina
        },
        # Enviamos las finanzas exclusivas al frontend
        "finanzas": {
            "balance_operativo": balance_operativo,
            "inversion_total": monto_inversion,
            "balance_total_roi": balance_total_roi
        }
    }

@app.post("/produccion/registrar")
def registrar_produccion(prod_nueva: ModeloProduccion, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == prod_nueva.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    porcentaje = (prod_nueva.cantidad_huevos / lote.cantidad_actual) * 100 if lote.cantidad_actual > 0 else 0
    lote.cantidad_actual -= prod_nueva.mortalidad
    db_prod = models.ProduccionDB(lote_id=prod_nueva.lote_id, cantidad_huevos=prod_nueva.cantidad_huevos, mortalidad=prod_nueva.mortalidad, fecha=prod_nueva.fecha, porcentaje_postura=f"{round(porcentaje,2)}%")
    db.add(db_prod)
    db.commit()
    return {"mensaje": "¡Producción y Bajas guardadas!", "registro": db_prod}

@app.post("/finanzas/registrar-gasto")
def registrar_gasto(gasto_nuevo: ModeloGasto, db: Session = Depends(obtener_db)):
    lote_seguro = db.query(models.LoteDB).first()
    lote_valido = lote_seguro.id if lote_seguro else None
    
    texto_moneda = f" (Bs {gasto_nuevo.monto_ves:.2f} a Tasa {gasto_nuevo.tasa_cambio})" if gasto_nuevo.moneda == "VES" else ""
    
    db_gasto = models.GastoDB(
        lote_id=lote_valido, 
        concepto=gasto_nuevo.concepto + texto_moneda, 
        total_gasto=gasto_nuevo.total_gasto, 
        fecha=gasto_nuevo.fecha, 
        categoria=gasto_nuevo.categoria,
        moneda=gasto_nuevo.moneda,
        tasa_cambio=gasto_nuevo.tasa_cambio,
        monto_ves=gasto_nuevo.monto_ves
    )
    db.add(db_gasto)
    db.commit()
    return {"mensaje": "¡Gasto operativo/administrativo registrado en la caja!"}

@app.post("/finanzas/registrar-venta")
def registrar_venta(venta_nueva: ModeloVenta, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == venta_nueva.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    calculo_total = venta_nueva.cantidad_cartones * venta_nueva.precio_unitario
    db_venta = models.VentaDB(lote_id=venta_nueva.lote_id, concepto=venta_nueva.concepto, cantidad_cartones=venta_nueva.cantidad_cartones, precio_unitario=venta_nueva.precio_unitario, total_ingreso=calculo_total, fecha=venta_nueva.fecha)
    db.add(db_venta)
    db.commit()
    return {"mensaje": "¡Venta registrada!", "venta": db_venta}

@app.get("/finanzas/dashboard")
def obtener_dashboard_finanzas(tasa_actual: float = 1.0, db: Session = Depends(obtener_db), acceso = Depends(verificar_finanzas)):
    ventas = db.query(models.VentaDB).all()
    gastos = db.query(models.GastoDB).all()
    facturas = db.query(models.FacturaDB).all()
    
    por_cobrar = sum(f.saldo_pendiente for f in facturas if getattr(f, 'saldo_pendiente', 0) > 0)

    # 💰 BÓVEDAS SEPARADAS
    caja_usd = 0.0
    banco_ves = 0.0
    usd_teorico_en_banco = 0.0

    transacciones = []
    
    # Sumamos lo que entra
    for v in ventas:
        if getattr(v, 'moneda', 'USD') == 'USD':
            caja_usd += v.total_ingreso
        else:
            banco_ves += getattr(v, 'monto_ves', 0.0)
            usd_teorico_en_banco += v.total_ingreso
            
        transacciones.append({
            "fecha_raw": str(v.fecha), 
            "fecha": v.fecha.strftime("%d/%m/%Y"), 
            "tipo": "Ingreso", "concepto": v.concepto, 
            "monto": v.total_ingreso, "categoria": "Ventas/Abonos"
        })

    # Restamos lo que sale
    for g in gastos:
        if getattr(g, 'moneda', 'USD') == 'USD':
            caja_usd -= g.total_gasto
        else:
            banco_ves -= getattr(g, 'monto_ves', 0.0)
            usd_teorico_en_banco -= g.total_gasto
            
        transacciones.append({
            "fecha_raw": str(g.fecha), 
            "fecha": g.fecha.strftime("%d/%m/%Y"), 
            "tipo": "Egreso", "concepto": g.concepto, 
            "monto": g.total_gasto, "categoria": g.categoria
        })
    
    transacciones.sort(key=lambda x: x["fecha_raw"], reverse=True)
    
    # 📉 CÁLCULO DE DEVALUACIÓN INFLACIONARIA
    usd_real_en_banco = banco_ves / tasa_actual if tasa_actual > 0 else usd_teorico_en_banco
    perdida_cambiaria = usd_teorico_en_banco - usd_real_en_banco
    
    return {
        "por_cobrar": por_cobrar,
        "caja_usd": caja_usd,
        "banco_ves": banco_ves,
        "usd_real_banco": usd_real_en_banco,
        "perdida_cambiaria": perdida_cambiaria,
        "capital_total": caja_usd + usd_real_en_banco,
        "transacciones": transacciones
    }

@app.post("/alimentacion/registrar-consumo")
def registrar_consumo(consumo: ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == consumo.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    calculo_gramos = (consumo.kilos_consumidos * 1000) / lote.cantidad_actual if lote.cantidad_actual > 0 else 0
    db_consumo = models.ConsumoAlimentoDB(lote_id=consumo.lote_id, kilos_consumidos=consumo.kilos_consumidos, gramos_por_ave=round(calculo_gramos,2), fecha=consumo.fecha)
    db.add(db_consumo)
    db.commit()
    return {"mensaje": "¡Consumo registrado!", "gramos_por_ave": f"{round(calculo_gramos,2)}g"}

# --- RUTA NUEVA PARA EL HISTORIAL EXCEL ---
# --- RUTA NUEVA PARA EL HISTORIAL EXCEL ---
@app.get("/historial/{dias}")
def obtener_historial(dias: int, db: Session = Depends(obtener_db)):
    # Si dias es 0, buscamos el total histórico. Si no, calculamos el límite.
    if dias == 0:
        producciones = db.query(models.ProduccionDB).all()
        alimentos = db.query(models.ConsumoAlimentoDB).all()
    else:
        fecha_limite = date.today() - datetime.timedelta(days=dias)
        producciones = db.query(models.ProduccionDB).filter(models.ProduccionDB.fecha >= fecha_limite).all()
        alimentos = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.fecha >= fecha_limite).all()
    
    historial_dict = {}
    
    for p in producciones:
        key = f"{p.fecha}_{p.lote_id}"
        historial_dict[key] = {
            "fecha": p.fecha.strftime("%Y-%m-%d"),
            "lote_id": p.lote_id,
            "huevos": p.cantidad_huevos,
            "mortalidad": p.mortalidad,
            "alimento": 0.0
        }
        
    for a in alimentos:
        key = f"{a.fecha}_{a.lote_id}"
        if key in historial_dict:
            historial_dict[key]["alimento"] = a.kilos_consumidos
        else:
            historial_dict[key] = {
                "fecha": a.fecha.strftime("%Y-%m-%d"),
                "lote_id": a.lote_id,
                "huevos": 0,
                "mortalidad": 0,
                "alimento": a.kilos_consumidos
            }
            
    lista_historial = list(historial_dict.values())
    lista_historial.sort(key=lambda x: x["fecha"], reverse=True)
    
    return lista_historial

# --- RUTA NUEVA PARA EL DASHBOARD DE GRÁFICOS ---
@app.get("/api/graficos/{lote_id}")
def obtener_datos_graficos(lote_id: int, db: Session = Depends(obtener_db)):
    # Traemos producción y alimento ordenados por fecha
    producciones = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == lote_id).order_by(models.ProduccionDB.fecha).all()
    alimentos = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == lote_id).order_by(models.ConsumoAlimentoDB.fecha).all()

    data_por_fecha = {}
    
    # Procesamos los huevos y el porcentaje
    for p in producciones:
        # Convertimos "85.5%" a 85.5 para que la gráfica lo entienda
        try:
            pct = float(p.porcentaje_postura.replace('%', ''))
        except:
            pct = 0.0
        data_por_fecha[p.fecha] = {"fecha": p.fecha.strftime("%d/%m"), "postura": pct, "alimento": 0.0}

    # Procesamos el consumo de alimento (Gramos por Ave)
    for a in alimentos:
        if a.fecha in data_por_fecha:
            data_por_fecha[a.fecha]["alimento"] = a.gramos_por_ave
        else:
            data_por_fecha[a.fecha] = {"fecha": a.fecha.strftime("%d/%m"), "postura": 0.0, "alimento": a.gramos_por_ave}

    # Ordenamos cronológicamente y devolvemos la lista
    fechas_ordenadas = sorted(data_por_fecha.keys())
    return [data_por_fecha[f] for f in fechas_ordenadas]

# --- RUTAS DE PRODUCTOS DE VENTA (NUEVO) ---
@app.get("/productos")
def listar_productos(db: Session = Depends(obtener_db)):
    productos = db.query(models.ProductoDB).all()
    return [
        {
            "id": p.id,
            "codigo": p.codigo,
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "precio_carton": p.precio_carton,
            "precio_caja": p.precio_caja,
            "stock_cartones": p.stock_cartones
        } for p in productos
    ]

@app.post("/productos/crear")
def crear_producto(prod: ModeloProducto, db: Session = Depends(obtener_db)):
    existe = db.query(models.ProductoDB).filter(models.ProductoDB.codigo == prod.codigo).first()
    if existe:
        raise HTTPException(status_code=400, detail="El código de producto ya existe.")
    
    nuevo_prod = models.ProductoDB(
        codigo=prod.codigo,
        nombre=prod.nombre,
        descripcion=prod.descripcion,
        precio_carton=prod.precio_carton,
        precio_caja=prod.precio_caja,
        stock_cartones=prod.stock_cartones
    )
    db.add(nuevo_prod)
    db.commit()
    return {"mensaje": f"¡Producto {prod.nombre} registrado con éxito!"}

@app.post("/productos/editar")
def editar_producto(prod: ModeloProductoUpdate, db: Session = Depends(obtener_db)):
    producto_db = db.query(models.ProductoDB).filter(models.ProductoDB.id == prod.producto_id).first()
    if not producto_db:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    
    producto_db.codigo = prod.codigo
    producto_db.nombre = prod.nombre
    producto_db.descripcion = prod.descripcion
    producto_db.precio_carton = prod.precio_carton
    producto_db.precio_caja = prod.precio_caja
    
    # Aquí sumamos al stock existente
    producto_db.stock_cartones = prod.stock_cartones 
    
    db.commit()
    return {"mensaje": "¡Producto actualizado correctamente!"}

@app.post("/productos/eliminar/{prod_id}")
def eliminar_producto(prod_id: int, db: Session = Depends(obtener_db)):
    producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == prod_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    
    db.delete(producto)
    db.commit()
    return {"mensaje": "¡Producto eliminado del catálogo!"}

# --- RUTA PARA EL CENTRO DE CLASIFICACIÓN (SUMA AL INVENTARIO) ---
@app.post("/empaque/registrar")
def registrar_empaque(datos: ModeloEmpaque, db: Session = Depends(obtener_db)):
    # Sumamos los cartones empacados al inventario de cada producto
    for item in datos.items:
        producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
        if producto:
            producto.stock_cartones += item.cantidad_cartones
    
    # (En la Fase 2 agregaremos la tabla de Historial Kardex y los descartes aquí)
    
    db.commit()
    return {"mensaje": "¡Empaque registrado! El inventario sumó los cartones automáticamente."}

# --- RUTAS DE ALMACÉN (INSUMOS Y COMPRAS) ---
@app.get("/almacen/insumos")
def listar_insumos(db: Session = Depends(obtener_db)):
    return db.query(models.InsumoDB).all()

@app.post("/almacen/insumos/crear")
def crear_insumo(insumo: ModeloInsumo, db: Session = Depends(obtener_db)):
    nuevo_insumo = models.InsumoDB(
        nombre=insumo.nombre,
        categoria=insumo.categoria,
        unidad_medida=insumo.unidad_medida,
        stock_actual=insumo.stock_actual
    )
    db.add(nuevo_insumo)
    db.commit()
    return {"mensaje": f"¡Insumo '{insumo.nombre}' registrado en el almacén!"}

@app.post("/almacen/comprar")
def comprar_insumo(compra: ModeloCompraInsumo, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == compra.insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")
    
    cantidad_a_sumar = compra.cantidad_comprada
    if compra.es_saco and insumo.unidad_medida == "Kg":
        cantidad_a_sumar = compra.cantidad_comprada * 40

    insumo.stock_actual += cantidad_a_sumar
    
    if compra.costo_total > 0:
        lote_seguro = db.query(models.LoteDB).first()
        lote_valido = lote_seguro.id if lote_seguro else None
        
        texto_moneda = f" (Bs {compra.monto_ves:.2f} a Tasa {compra.tasa_cambio})" if compra.moneda == "VES" else ""
        
        gasto = models.GastoDB(
            lote_id=lote_valido,
            concepto=f"Compra Almacén: {insumo.nombre} ({cantidad_a_sumar} {insumo.unidad_medida}){texto_moneda}",
            total_gasto=compra.costo_total,
            fecha=date.today(),
            categoria="Insumos y Alimentos",
            moneda=compra.moneda,
            tasa_cambio=compra.tasa_cambio,
            monto_ves=compra.monto_ves
        )
        db.add(gasto)
    
    db.commit()
    return {"mensaje": f"¡Compra registrada! Se sumaron {cantidad_a_sumar} {insumo.unidad_medida} y se registró el egreso."}

@app.post("/almacen/ajustar")
def ajustar_insumo(ajuste: ModeloAjusteInsumo, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == ajuste.insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")
    
    # 🚫 VALIDACIÓN: Evita mermas mayores al stock actual
    if ajuste.cantidad_reducir > insumo.stock_actual:
        raise HTTPException(
            status_code=400, 
            detail=f"No puedes descontar más de lo existente. Stock actual: {insumo.stock_actual} {insumo.unidad_medida}"
        )
    
    insumo.stock_actual -= ajuste.cantidad_reducir
    db.commit()
    return {"mensaje": f"Se descontaron {ajuste.cantidad_reducir} de {insumo.nombre}."}

@app.post("/almacen/insumos/eliminar/{insumo_id}")
def eliminar_insumo(insumo_id: int, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == insumo_id).first()
    if insumo:
        db.delete(insumo)
        db.commit()
    return {"mensaje": "Eliminado"}

