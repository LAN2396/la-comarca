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





@app.get("/migrar-a-bancos")
def migrar_todo_a_bancos():
    try:
        # Usamos la tasa actual para estandarizar todo el historial
        TASA_ACTUAL = 746.63 
        
        with Session(engine) as db:
            # 1. Limpiamos cualquier intento previo de pérdida cambiaria o ajustes
            db.execute(text("DELETE FROM gastos WHERE categoria = 'Pérdida Cambiaria' OR concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Diferencial%' OR concepto ILIKE '%Recepción%'"))
            db.execute(text("DELETE FROM ventas WHERE concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Recepción%'"))
            
            # 2. Pasamos TODAS las facturas a Transferencia (Banco)
            db.execute(text("""
                UPDATE facturas 
                SET condicion = 'Transferencia', 
                    moneda = 'VES', 
                    tasa_cambio = :tasa, 
                    monto_ves = total * :tasa
            """), {"tasa": TASA_ACTUAL})
            
            # 3. Pasamos TODOS los ingresos (Ventas) a Banco
            db.execute(text("""
                UPDATE ventas 
                SET moneda = 'VES', 
                    tasa_cambio = :tasa, 
                    monto_ves = total_ingreso * :tasa
            """), {"tasa": TASA_ACTUAL})
            
            # 4. Pasamos TODOS los gastos a Banco
            db.execute(text("""
                UPDATE gastos 
                SET moneda = 'VES', 
                    tasa_cambio = :tasa, 
                    monto_ves = total_gasto * :tasa
            """), {"tasa": TASA_ACTUAL})
            
            db.commit()
            
        return {
            "estado": "¡Migración Exitosa!", 
            "mensaje": "Todas las facturas y gastos se movieron a Banco. Efectivo en cero.",
            "Efectivo": "$0.00",
            "Banco_Proyectado": "-$24.50"
        }
    except Exception as e:
        return {"error": str(e)}
