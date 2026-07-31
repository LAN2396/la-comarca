from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request

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



from sqlalchemy import text

@app.get("/reparar-sistema")
def reparar_sistema_base_datos(db: Session = Depends(get_db)):
    mensajes = []
    
    # 1. Agregar la columna al almacén SIN borrar los insumos existentes
    try:
        db.execute(text("ALTER TABLE insumos ADD COLUMN ultimo_precio FLOAT DEFAULT 0.0;"))
        db.commit()
        mensajes.append("✅ Columna 'ultimo_precio' añadida correctamente.")
    except Exception as e:
        db.rollback()
        mensajes.append("⚠️ La columna 'ultimo_precio' ya estaba lista.")

    # 2. Corregir el dinero mal ubicado (Mover Pago Móvil a Bancos)
    try:
        # Busca cualquier transacción que diga "pago móvil" o "transferencia" 
        # y le cambia la moneda a 'VES' para que el sistema lo cuente como Banco y no como Efectivo.
        db.execute(text("""
            UPDATE transacciones 
            SET moneda = 'VES' 
            WHERE tipo = 'Ingreso' 
            AND (concepto ILIKE '%pago m_vil%' OR concepto ILIKE '%transferencia%');
        """))
        db.commit()
        mensajes.append("✅ Dinero reubicado: Los pagos móviles antiguos fueron pasados a la cuenta de Bancos.")
    except Exception as e:
        db.rollback()
        mensajes.append(f"❌ Error al reubicar el dinero: {str(e)}")
        
    return {"estado": "Mantenimiento Completado", "resultados": mensajes}