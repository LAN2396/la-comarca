import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. El sistema verifica si hay una "URL de la Nube" configurada
URL_BASE_DATOS = os.getenv("DATABASE_URL")

if URL_BASE_DATOS:
    # --- MODO PRODUCCIÓN (NUBE) ---
    # Render y Neon usan PostgreSQL, a veces hay que corregir el prefijo
    if URL_BASE_DATOS.startswith("postgres://"):
        URL_BASE_DATOS = URL_BASE_DATOS.replace("postgres://", "postgresql://", 1)
    engine = create_engine(URL_BASE_DATOS)
else:
    # --- MODO LOCAL (TU COMPUTADORA) ---
    URL_BASE_DATOS = "sqlite:///./granja.db"
    engine = create_engine(URL_BASE_DATOS, connect_args={"check_same_thread": False})

# 2. Creamos la sesión
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Base para los modelos
Base = declarative_base()

# Función para usar en main.py
def obtener_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()