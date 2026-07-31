from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import text


import models
from database import engine

# 1. IMPORTAMOS NUESTROS MÓDULOS (Enrutadores)
from routers import finanzas
from routers import auth
from routers import almacen
from routers import productos
from routers import lotes
from routers import facturacion

app = FastAPI(title="Sistema Avícola La Comarca")

# --- INYECTOR DE PERMISOS DE SEGURIDAD MIGRACIÓN ---
try:
    import sqlite3
    con = sqlite3.connect("granja.db")
    con.execute("ALTER TABLE usuarios ADD COLUMN permisos VARCHAR DEFAULT ''")
    con.execute("UPDATE usuarios SET permisos = 'TODOS' WHERE username = 'luis armando'")
    con.commit()
    con.close()
except:
    pass 

# Construir Base de Datos
models.Base.metadata.create_all(bind=engine)

# Llamamos a la función inteligente que ahora vive en auth.py
auth.inicializar_usuarios_inteligente()

# --- CONECTAMOS TODOS LOS ROUTERS AL SISTEMA ---
app.include_router(auth.router)
app.include_router(almacen.router)
app.include_router(productos.router)
app.include_router(lotes.router)
app.include_router(facturacion.router)
app.include_router(finanzas.router)

# Configuración Visual Frontend
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

def render_seguro(request: Request, name: str, context: dict = None):
    if context is None:
        context = {}
    context["request"] = request
    try:
        return templates.TemplateResponse(request=request, name=name, context=context)
    except TypeError:
        return templates.TemplateResponse(name, context)

# --- RUTA PRINCIPAL (CARGA DE PÁGINA) ---
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return render_seguro(request, "index.html")





@app.get("/forzar-cuadre")
def forzar_cuadre_caja():
    # 👇 TUS NÚMEROS REALES Y EXACTOS 👇
    TASA_ACTUAL = 746.63
    OBJETIVO_BANCO_USD = -24.50
    OBJETIVO_BANCO_BS = OBJETIVO_BANCO_USD * TASA_ACTUAL
    
    # Abrimos la conexión manualmente
    with Session(engine) as db:
        # 1. Leer saldos actuales
        res = db.execute(text("SELECT tipo, moneda, monto, monto_ves FROM transacciones")).fetchall()
        caja_sistema = 0.0
        banco_sistema_bs = 0.0
        
        for fila in res:
            tipo, moneda = fila[0], fila[1]
            monto, monto_ves = float(fila[2] or 0), float(fila[3] or 0)
            
            if moneda == "VES":
                if tipo == "Ingreso": banco_sistema_bs += monto_ves
                else: banco_sistema_bs -= monto_ves
            else:
                if tipo == "Ingreso": caja_sistema += monto
                else: caja_sistema -= monto
                
        from datetime import date
        hoy = date.today().strftime("%Y-%m-%d")
        
        # 2. Vaciar el Efectivo (Simulando un depósito al banco)
        if caja_sistema > 0.01:
            # Sacamos del efectivo
            db.execute(text("""
                INSERT INTO transacciones (fecha, tipo, concepto, monto, categoria, moneda, tasa_cambio, monto_ves)
                VALUES (:f, 'Egreso', 'Depósito en Banco (Cierre de Efectivo)', :m, 'Transferencia', 'USD', 1.0, 0.0)
            """), {"f": hoy, "m": round(caja_sistema, 2)})
            
            # Lo metemos al banco
            ingreso_banco_bs = caja_sistema * TASA_ACTUAL
            db.execute(text("""
                INSERT INTO transacciones (fecha, tipo, concepto, monto, categoria, moneda, tasa_cambio, monto_ves)
                VALUES (:f, 'Ingreso', 'Recepción de Efectivo en Banco', :m, 'Transferencia', 'VES', :tc, :mves)
            """), {"f": hoy, "m": round(caja_sistema, 2), "tc": TASA_ACTUAL, "mves": round(ingreso_banco_bs, 2)})
            
            banco_sistema_bs += ingreso_banco_bs
            
        # 3. Calcular y registrar la Pérdida Cambiaria exacta
        diferencia_bs = OBJETIVO_BANCO_BS - banco_sistema_bs
        
        # Si la diferencia es negativa, significa que la devaluación nos comió dinero
        if diferencia_bs < -0.01:
            perdida_bs = abs(diferencia_bs)
            perdida_usd = perdida_bs / TASA_ACTUAL
            db.execute(text("""
                INSERT INTO transacciones (fecha, tipo, concepto, monto, categoria, moneda, tasa_cambio, monto_ves)
                VALUES (:f, 'Egreso', 'Pérdida por Diferencial Cambiario', :m, 'Pérdida Cambiaria', 'VES', :tc, :mves)
            """), {"f": hoy, "m": round(perdida_usd, 2), "tc": TASA_ACTUAL, "mves": round(perdida_bs, 2)})
            
        # Por si acaso la tasa jugó a favor (Ganancia Cambiaria)
        elif diferencia_bs > 0.01:
            ganancia_bs = diferencia_bs
            ganancia_usd = ganancia_bs / TASA_ACTUAL
            db.execute(text("""
                INSERT INTO transacciones (fecha, tipo, concepto, monto, categoria, moneda, tasa_cambio, monto_ves)
                VALUES (:f, 'Ingreso', 'Ganancia por Diferencial Cambiario', :m, 'Ganancia Cambiaria', 'VES', :tc, :mves)
            """), {"f": hoy, "m": round(ganancia_usd, 2), "tc": TASA_ACTUAL, "mves": round(ganancia_bs, 2)})
            
        db.commit()
        
    # Calculamos la pérdida para mostrarla en el mensaje final
    perdida_final = round(abs(diferencia_bs) / TASA_ACTUAL, 2)
        
    return {
        "mensaje": "¡Caja cuadrada y devaluación registrada como todo un profesional!",
        "Efectivo_Final": "$0.00",
        "Banco_Final": f"Bs {round(OBJETIVO_BANCO_BS, 2)}",
        "Perdida_Cambiaria_Registrada": f"${perdida_final}"
    }