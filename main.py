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
        # ====== 1. PON TUS DATOS REALES AQUÍ ======
        TASA_ACTUAL = 746.63
        
        # Pon aquí los dólares EXACTOS que recibiste en billetes físicos
        BILLETES_RECIBIDOS = 30.00  
        # ==========================================
        
        with Session(engine) as db:
            # 1. Limpiar basuras de pruebas anteriores (Cero depósitos falsos)
            db.execute(text("DELETE FROM gastos WHERE categoria = 'Pérdida Cambiaria' OR concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%'"))
            db.execute(text("DELETE FROM ventas WHERE concepto ILIKE '%Ajuste%' OR concepto ILIKE '%Depósito%'"))
            
            # 2. Leer saldos de banco Viejos para poder calcular la inflación real
            ventas_ves = db.execute(text("SELECT SUM(monto_ves) FROM ventas WHERE moneda = 'VES'")).scalar() or 0.0
            gastos_ves = db.execute(text("SELECT SUM(monto_ves) FROM gastos WHERE moneda = 'VES'")).scalar() or 0.0
            banco_ves_historico = ventas_ves - gastos_ves
            
            # 3. Reescribir Facturas (POS) para arreglar los $141 falsos
            facturas = db.query(models.FacturaDB).filter(models.FacturaDB.saldo_pendiente == 0).order_by(models.FacturaDB.id).all()
            efectivo_fac = BILLETES_RECIBIDOS
            for f in facturas:
                if efectivo_fac > 0 and efectivo_fac >= f.total:
                    f.condicion = "Efectivo"
                    f.moneda = "USD"
                    f.monto_ves = 0
                    efectivo_fac -= f.total
                else:
                    f.condicion = "Transferencia"
                    f.moneda = "VES"
                    f.tasa_cambio = TASA_ACTUAL
                    f.monto_ves = f.total * TASA_ACTUAL
                    
            # 4. Reescribir Ventas (Ingresos Granja)
            ventas = db.query(models.VentaDB).order_by(models.VentaDB.id).all()
            efectivo_ven = BILLETES_RECIBIDOS
            for v in ventas:
                if efectivo_ven > 0 and efectivo_ven >= v.total_ingreso:
                    v.moneda = "USD"
                    v.monto_ves = 0
                    efectivo_ven -= v.total_ingreso
                else:
                    v.moneda = "VES"
                    v.tasa_cambio = TASA_ACTUAL
                    v.monto_ves = v.total_ingreso * TASA_ACTUAL

            # 5. Reescribir Gastos (Vaciamos la caja a $0 usando el efectivo para pagar gastos)
            gastos = db.query(models.GastoDB).order_by(models.GastoDB.id).all()
            efectivo_gas = BILLETES_RECIBIDOS
            for g in gastos:
                if efectivo_gas > 0 and efectivo_gas >= g.total_gasto:
                    g.moneda = "USD"
                    g.monto_ves = 0
                    efectivo_gas -= g.total_gasto
                else:
                    g.moneda = "VES"
                    g.tasa_cambio = TASA_ACTUAL
                    g.monto_ves = g.total_gasto * TASA_ACTUAL
                    
            db.commit()
            
            # 6. Calcular e inyectar Pérdida Cambiaria Real
            banco_ves_perfecto = db.execute(text("SELECT (COALESCE((SELECT SUM(monto_ves) FROM ventas WHERE moneda = 'VES'), 0) - COALESCE((SELECT SUM(monto_ves) FROM gastos WHERE moneda = 'VES'), 0))")).scalar() or 0.0
            
            diferencia_ves = banco_ves_perfecto - banco_ves_historico
            if diferencia_ves < -0.01:
                perdida_usd = abs(diferencia_ves) / TASA_ACTUAL
                from datetime import date
                db.execute(text("""
                    INSERT INTO gastos (lote_id, concepto, total_gasto, fecha, categoria, moneda, tasa_cambio, monto_ves)
                    VALUES (NULL, 'Pérdida por Diferencial Cambiario', :m, :f, 'Pérdida Cambiaria', 'VES', :tc, :mves)
                """), {"m": round(perdida_usd, 2), "f": date.today().strftime("%Y-%m-%d"), "tc": TASA_ACTUAL, "mves": abs(diferencia_ves)})
                db.commit()

        return {"mensaje": "¡Reparación Maestra Aplicada! Cero depósitos falsos, facturas corregidas y pérdida registrada."}
    except Exception as e:
        return {"error": str(e)}
