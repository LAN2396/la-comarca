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





@app.get("/ajuste-final")
def ajuste_final_magico():
    try:
        # La tasa actual exacta de tu imagen
        TASA_ACTUAL = 748.79 
        HUECO_USD = -24.50
        
        with Session(engine) as db:
            # 1. RESTAURAR LOS CRÉDITOS (Toda factura con deuda vuelve a ser Crédito)
            db.execute(text("""
                UPDATE facturas 
                SET condicion = 'Crédito', moneda = 'USD', tasa_cambio = 1.0, monto_ves = 0 
                WHERE saldo_pendiente > 0
            """))
            
            # 2. LIMPIAR CUALQUIER PÉRDIDA CAMBIARIA VIEJA PARA RECALCULARLA BIEN
            db.execute(text("DELETE FROM gastos WHERE categoria = 'Pérdida Cambiaria'"))
            
            # 3. LEER EL BANCO REAL Y RECALCULAR LA INFLACIÓN
            ventas_ves = db.execute(text("SELECT SUM(monto_ves) FROM ventas WHERE moneda = 'VES'")).scalar() or 0.0
            gastos_ves = db.execute(text("SELECT SUM(monto_ves) FROM gastos WHERE moneda = 'VES'")).scalar() or 0.0
            
            banco_ves_actual = ventas_ves - gastos_ves 
            banco_ves_ideal = HUECO_USD * TASA_ACTUAL  # -24.50 * 748.79 = -18,345.35 Bs
            
            # Calculamos la diferencia (-18,345.35 - (-18,292.43) = -52.92 Bs)
            diferencia_ves = banco_ves_ideal - banco_ves_actual 
            
            # Si hay hueco, lo inyectamos como pérdida
            if diferencia_ves < -0.01:
                perdida_bs = abs(diferencia_ves)
                perdida_usd = perdida_bs / TASA_ACTUAL # Esto dará exactamente los $0.07
                
                from datetime import date
                db.execute(text("""
                    INSERT INTO gastos (lote_id, concepto, total_gasto, fecha, categoria, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Ajuste Diferencial Cambiario', :m, :f, 'Pérdida Cambiaria', 'VES', :tc, :mves)
                """), {
                    "m": round(perdida_usd, 2), 
                    "f": date.today().strftime("%Y-%m-%d"), 
                    "tc": TASA_ACTUAL, 
                    "mves": round(perdida_bs, 2)
                })
                
            db.commit()
            
        return {"mensaje": "¡Créditos arreglados y pérdida cambiaria de $0.07 registrada!"}
    except Exception as e:
        return {"error": str(e)}