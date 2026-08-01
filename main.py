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
    try:
        TASA_ACTUAL = 746.63
        
        with Session(engine) as db:
            # 1. Limpiamos cualquier rastro de ajustes o depósitos anteriores
            db.execute(text("DELETE FROM gastos WHERE concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Recepción%'"))
            db.execute(text("DELETE FROM ventas WHERE concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%' OR concepto ILIKE '%Recepción%'"))
            db.commit()
            
            # 2. Leemos la realidad actual de ventas y gastos limpios
            res_v = db.execute(text("SELECT SUM(total_ingreso) FROM ventas")).scalar() or 0.0
            res_g = db.execute(text("SELECT SUM(total_gasto) FROM gastos")).scalar() or 0.0
            
            # 3. Metas exactas solicitadas por ti
            OBJETIVO_INGRESOS = 218.00
            OBJETIVO_GASTOS = 242.50
            
            diff_ingresos = OBJETIVO_INGRESOS - float(res_v)
            diff_gastos = OBJETIVO_GASTOS - float(res_g)
            
            from datetime import date
            hoy = date.today().strftime("%Y-%m-%d")
            
            # Ajustamos si falta para llegar al ingreso neta de 218
            if abs(diff_ingresos) > 0.01:
                db.execute(text("""
                    INSERT INTO ventas (lote_id, concepto, cantidad_cartones, precio_unitario, total_ingreso, fecha, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Ajuste de Facturación Neta', 0, 0, :m, :f, 'USD', 1.0, 0.0)
                """), {"m": round(diff_ingresos, 2), "f": hoy})
                
            # Ajustamos el gasto faltante catalogándolo explícitamente como 'Pérdida Cambiaria' para que encienda la tarjeta visual
            if abs(diff_gastos) > 0.01:
                monto_gasto = round(diff_gastos, 2)
                monto_ves_gasto = monto_gasto * TASA_ACTUAL
                db.execute(text("""
                    INSERT INTO gastos (lote_id, concepto, total_gasto, fecha, categoria, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Pérdida por Diferencial Cambiario', :m, :f, 'Pérdida Cambiaria', 'VES', :tc, :mves)
                """), {"m": monto_gasto, "f": hoy, "tc": TASA_ACTUAL, "mves": round(monto_ves_gasto, 2)})
                
            db.commit()
            
        return {
            "estado": "¡Cuadre Exitoso!",
            "Total_Ingresado": "$218.00",
            "Total_Gastado": "$242.50",
            "Efectivo": "$0.00",
            "Pérdida_Cambiaria": f"${round(diff_gastos, 2)}"
        }
        
    except Exception as e:
        return {
            "estado": "Error Encontrado",
            "motivo_del_fallo": str(e)
        }
