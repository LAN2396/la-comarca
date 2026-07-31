from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import math  # <-- Librería inyectada para forzar los números enteros
import models, schemas
from database import obtener_db

router = APIRouter(tags=["Productos y Empaque"])

@router.get("/productos")
def listar_productos(db: Session = Depends(obtener_db)):
    productos = db.query(models.ProductoDB).all()
    return [
        {
            "id": p.id,
            "codigo": p.codigo,
            "nombre": p.nombre,
            "descripcion": p.descripcion,
            "precio_carton": p.precio_carton,
            "precio_caja": p.precio_caja,
            "stock_cartones": p.stock_cartones
        } for p in productos
    ]

@router.post("/productos/crear")
def crear_producto(prod: schemas.ModeloProducto, db: Session = Depends(obtener_db)):
    existe = db.query(models.ProductoDB).filter(models.ProductoDB.codigo == prod.codigo).first()
    if existe:
        raise HTTPException(status_code=400, detail="El código de producto ya existe.")
    
    nuevo_prod = models.ProductoDB(
        codigo=prod.codigo,
        nombre=prod.nombre,
        descripcion=prod.descripcion,
        precio_carton=prod.precio_carton,
        precio_caja=prod.precio_caja,
        stock_cartones=prod.stock_cartones
    )
    db.add(nuevo_prod)
    db.commit()
    return {"mensaje": f"¡Producto {prod.nombre} registrado con éxito!"}

@router.post("/productos/editar")
def editar_producto(prod: schemas.ModeloProductoUpdate, db: Session = Depends(obtener_db)):
    producto_db = db.query(models.ProductoDB).filter(models.ProductoDB.id == prod.producto_id).first()
    if not producto_db:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    
    producto_db.codigo = prod.codigo
    producto_db.nombre = prod.nombre
    producto_db.descripcion = prod.descripcion
    producto_db.precio_carton = prod.precio_carton
    producto_db.precio_caja = prod.precio_caja
    producto_db.stock_cartones = prod.stock_cartones 
    
    db.commit()
    return {"mensaje": "¡Producto actualizado correctamente!"}

@router.post("/productos/eliminar/{prod_id}")
def eliminar_producto(prod_id: int, db: Session = Depends(obtener_db)):
    producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == prod_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    
    db.delete(producto)
    db.commit()
    return {"mensaje": "¡Producto eliminado del catálogo!"}

@router.post("/empaque/registrar")
def registrar_empaque(datos: schemas.ModeloEmpaque, db: Session = Depends(obtener_db)):
    total_separadores_fisicos = 0
    
    for item in datos.items:
        producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
        if producto:
            # 1. El producto (los huevos empacados) sí recibe el decimal exacto
            producto.stock_cartones += item.cantidad_cartones
            
            # 2. math.ceil() obliga a que los picos sueltos gasten 1 cartón físico entero
            total_separadores_fisicos += math.ceil(item.cantidad_cartones)
            
    insumo_empaque = db.query(models.InsumoDB).filter(models.InsumoDB.categoria == "Empaque", models.InsumoDB.stock_actual > 0).first()
    if insumo_empaque:
        # 3. Se descuentan únicamente los cartones físicos (números enteros)
        insumo_empaque.stock_actual -= total_separadores_fisicos
        if insumo_empaque.stock_actual < 0: 
            insumo_empaque.stock_actual = 0
    
    db.commit()
    return {"mensaje": "¡Empaque registrado! Se sumaron los huevos y se descontaron los separadores físicos."}