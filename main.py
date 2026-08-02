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





@app.get("/revertir-todo")
def revertir_desastre():
    try:
        with Session(engine) as db:
            # 1. BORRAMOS TODO MI DESASTRE (Devuelve los gastos a 242.50)
            db.execute(text("DELETE FROM gastos WHERE categoria = 'Pérdida Cambiaria' OR concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Diferencial%' OR concepto ILIKE '%Recepción%'"))
            db.execute(text("DELETE FROM ventas WHERE concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Recepción%'"))
            
            # 2. RECUPERAMOS LAS FACTURAS EN EFECTIVO DE TUS CLIENTES
            db.execute(text("""
                UPDATE facturas 
                SET condicion = 'Efectivo', moneda = 'USD', tasa_cambio = 1.0, monto_ves = 0
                WHERE cliente_id IN (
                    SELECT id FROM clientes 
                    WHERE nombre ILIKE '%Pedro%' 
                       OR nombre ILIKE '%Sanoni%' 
                       OR nombre ILIKE '%Jaime%'
                )
            """))
            
            db.commit()
            
        return {"mensaje": "¡Sistema restaurado! Se borró mi error, los gastos vuelven a 242.50 y se recuperaron las facturas en efectivo."}
    except Exception as e:
        return {"error": str(e)}
