from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import models, schemas
from database import obtener_db

router = APIRouter(prefix="/almacen", tags=["Almacén e Insumos"])

@router.get("/insumos")
def listar_insumos(db: Session = Depends(obtener_db)):
    return db.query(models.InsumoDB).all()

@router.post("/insumos/crear")
def crear_insumo(insumo: schemas.ModeloInsumo, db: Session = Depends(obtener_db)):
    nuevo_insumo = models.InsumoDB(
        nombre=insumo.nombre,
        categoria=insumo.categoria,
        unidad_medida=insumo.unidad_medida,
        stock_actual=insumo.stock_actual
    )
    db.add(nuevo_insumo)
    db.commit()
    return {"mensaje": f"¡Insumo '{insumo.nombre}' registrado en el almacén!"}

@router.post("/comprar")
def comprar_insumo(compra: schemas.ModeloCompraInsumo, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == compra.insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")
    
    cantidad_a_sumar = compra.cantidad_comprada
    if compra.es_saco and insumo.unidad_medida == "Kg":
        cantidad_a_sumar = compra.cantidad_comprada * 40

    insumo.stock_actual += cantidad_a_sumar
    
    if compra.costo_total > 0:
        lote_seguro = db.query(models.LoteDB).first()
        lote_valido = lote_seguro.id if lote_seguro else None
        texto_moneda = f" (Bs {compra.monto_ves:.2f} a Tasa {compra.tasa_cambio})" if compra.moneda == "VES" else ""
        
        gasto = models.GastoDB(
            lote_id=lote_valido,
            concepto=f"Compra Almacén: {insumo.nombre} ({cantidad_a_sumar} {insumo.unidad_medida}){texto_moneda}",
            total_gasto=compra.costo_total,
            fecha=date.today(),
            categoria="Insumos y Alimentos",
            moneda=compra.moneda,
            tasa_cambio=compra.tasa_cambio,
            monto_ves=compra.monto_ves
        )
        db.add(gasto)
    
    db.commit()
    return {"mensaje": f"¡Compra registrada! Se sumaron {cantidad_a_sumar} {insumo.unidad_medida} y se registró el egreso."}

@router.post("/ajustar")
def ajustar_insumo(ajuste: schemas.ModeloAjusteInsumo, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == ajuste.insumo_id).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo no encontrado.")
    
    if ajuste.cantidad_reducir > insumo.stock_actual:
        raise HTTPException(status_code=400, detail=f"No puedes descontar más de lo existente. Stock actual: {insumo.stock_actual} {insumo.unidad_medida}")
    
    insumo.stock_actual -= ajuste.cantidad_reducir
    db.commit()
    return {"mensaje": f"Se descontaron {ajuste.cantidad_reducir} de {insumo.nombre}."}

@router.post("/insumos/eliminar/{insumo_id}")
def eliminar_insumo(insumo_id: int, db: Session = Depends(obtener_db)):
    insumo = db.query(models.InsumoDB).filter(models.InsumoDB.id == insumo_id).first()
    if insumo:
        db.delete(insumo)
        db.commit()
    return {"mensaje": "Eliminado"}