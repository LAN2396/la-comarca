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
        OBJETIVO_BANCO_USD = -24.50
        OBJETIVO_BANCO_BS = OBJETIVO_BANCO_USD * TASA_ACTUAL
        
        with Session(engine) as db:
            # 1. Leemos los ingresos reales de la tabla 'ventas'
            ventas = db.execute(text("SELECT moneda, total_ingreso, monto_ves FROM ventas")).fetchall()
            # 2. Leemos los gastos reales de la tabla 'gastos'
            gastos = db.execute(text("SELECT moneda, total_gasto, monto_ves FROM gastos")).fetchall()
            
            caja_sistema = 0.0
            banco_sistema_bs = 0.0
            
            # Sumamos las ventas (Ingresos en Efectivo USD o Banco VES)
            for v in ventas:
                moneda, monto, monto_ves = v[0], float(v[1] or 0), float(v[2] or 0)
                if moneda == "VES":
                    banco_sistema_bs += monto_ves
                else:
                    caja_sistema += monto
                    
            # Restamos los gastos (Egresos de Efectivo USD o Banco VES)
            for g in gastos:
                moneda, monto, monto_ves = g[0], float(g[1] or 0), float(g[2] or 0)
                if moneda == "VES":
                    banco_sistema_bs -= monto_ves
                else:
                    caja_sistema -= monto
                    
            from datetime import date
            hoy = date.today().strftime("%Y-%m-%d")
            
            # 3. Si hay efectivo acumulado, simulamos el depósito al banco para dejarlo en 0.00
            if caja_sistema > 0.01:
                # Registramos el egreso de efectivo
                db.execute(text("""
                    INSERT INTO gastos (lote_id, concepto, total_gasto, fecha, categoria, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Depósito en Banco (Cierre de Efectivo)', :m, :f, 'Operativo', 'USD', 1.0, 0.0)
                """), {"m": round(caja_sistema, 2), "f": hoy})
                
                # Registramos el ingreso al banco en Bs
                ingreso_banco_bs = caja_sistema * TASA_ACTUAL
                db.execute(text("""
                    INSERT INTO ventas (lote_id, concepto, cantidad_cartones, precio_unitario, total_ingreso, fecha, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Recepción de Efectivo en Banco', 0, 0, :m, :f, 'VES', :tc, :mves)
                """), {"m": round(caja_sistema, 2), "f": hoy, "tc": TASA_ACTUAL, "mves": round(ingreso_banco_bs, 2)})
                
                banco_sistema_bs += ingreso_banco_bs
                
            # 4. Calculamos la diferencia exacta para registrar la Pérdida por Diferencial Cambiario
            diferencia_bs = OBJETIVO_BANCO_BS - banco_sistema_bs
            
            if diferencia_bs < -0.01:
                perdida_bs = abs(diferencia_bs)
                perdida_usd = perdida_bs / TASA_ACTUAL
                # Inyectamos la pérdida cambiaria formalmente como un gasto operativo
                db.execute(text("""
                    INSERT INTO gastos (lote_id, concepto, total_gasto, fecha, categoria, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Pérdida por Diferencial Cambiario y Devaluación', :m, :f, 'Operativo', 'VES', :tc, :mves)
                """), {"m": round(perdida_usd, 2), "f": hoy, "tc": TASA_ACTUAL, "mves": round(perdida_bs, 2)})
                
            db.commit()
            
        return {
            "mensaje": "¡Caja cuadrada a 0 en efectivo, deuda exacta en banco y devaluación registrada!",
            "Efectivo_Final": "$0.00",
            "Banco_Final": f"Bs {round(OBJETIVO_BANCO_BS, 2)}"
        }
        
    except Exception as e:
        return {
            "estado": "Error Encontrado",
            "motivo_del_fallo": str(e)
        }
