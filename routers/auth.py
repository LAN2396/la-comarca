from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from starlette.requests import Request
import time
import hashlib
import models
import schemas
from database import obtener_db

# 1. Instanciamos el Enrutador
router = APIRouter(tags=["Autenticación y Seguridad"])

# =========================================
# 🛡️ GUARDIANES DE SEGURIDAD (ANTI-HACKEOS)
# =========================================
def obtener_password_hash(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def verificar_password(plain_password: str, hashed_password: str):
    hash_calculado = hashlib.sha256(plain_password.encode()).hexdigest()
    return hashed_password == hash_calculado or hashed_password == plain_password

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

# =========================================
# PROTECCIÓN FUERZA BRUTA
# =========================================
registro_intentos = {}
MAX_INTENTOS = 5
MINUTOS_BLOQUEO = 15

def registrar_fallo(usuario: str, tiempo_actual: float):
    if usuario not in registro_intentos:
        registro_intentos[usuario] = {"intentos": 1, "bloqueado_hasta": 0}
    else:
        registro_intentos[usuario]["intentos"] += 1
    if registro_intentos[usuario]["intentos"] >= MAX_INTENTOS:
        registro_intentos[usuario]["bloqueado_hasta"] = tiempo_actual + (MINUTOS_BLOQUEO * 60)

# =========================================
# RUTAS DE ACCESO Y USUARIOS
# =========================================
@router.post("/login")
def iniciar_sesion(datos: schemas.ModeloLogin, db: Session = Depends(obtener_db), request: Request = None):
    usuario_req = datos.username.lower()
    tiempo_actual = time.time()
    
    if usuario_req in registro_intentos:
        info = registro_intentos[usuario_req]
        if info["bloqueado_hasta"] > tiempo_actual:
            tiempo_restante = int((info["bloqueado_hasta"] - tiempo_actual) / 60)
            raise HTTPException(status_code=429, detail=f"Sistema bloqueado. Intenta en {tiempo_restante} minutos.")
        elif info["bloqueado_hasta"] != 0 and info["bloqueado_hasta"] < tiempo_actual:
            registro_intentos[usuario_req] = {"intentos": 0, "bloqueado_hasta": 0}

    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.username == usuario_req).first()
    
    if not user:
        registrar_fallo(usuario_req, tiempo_actual)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
        
    try:
        pass_valida = verificar_password(datos.password, user.password)
    except ValueError:
        pass_valida = (user.password == datos.password)
        
    if not pass_valida:
        registrar_fallo(usuario_req, tiempo_actual)
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
    
    if usuario_req in registro_intentos:
        del registro_intentos[usuario_req]
        
    return {"mensaje": "Bienvenido", "username": user.username, "rol": user.rol, "permisos": getattr(user, 'permisos', '')}

@router.post("/usuarios/crear")
def crear_usuario(usuario: schemas.ModeloNuevoUsuario, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
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

@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    usuarios = db.query(models.UsuarioDB).all()
    return [{"id": u.id, "username": u.username, "rol": u.rol, "permisos": getattr(u, 'permisos', '')} for u in usuarios]

@router.post("/usuarios/permisos/{user_id}")
def actualizar_permisos(user_id: int, datos: schemas.ModeloPermisos, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.permisos = datos.permisos_str
    db.commit()
    return {"mensaje": f"Accesos exactos guardados para @{user.username}."}

@router.post("/usuarios/eliminar/{user_id}")
def eliminar_usuario(user_id: int, db: Session = Depends(obtener_db), admin = Depends(verificar_admin)):
    user = db.query(models.UsuarioDB).filter(models.UsuarioDB.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.username == "luis armando":
        raise HTTPException(status_code=400, detail="Acción denegada: No puedes eliminar al superadministrador.")
    
    db.delete(user)
    db.commit()
    return {"mensaje": f"El usuario @{user.username} ha sido revocado."}