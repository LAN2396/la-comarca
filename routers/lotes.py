from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
import datetime
import models, schemas
from database import obtener_db

router = APIRouter(tags=["Lotes y Producción"])

@router.post("/lotes/crear")
def registrar_lote(lote_nuevo: schemas.ModeloLote, db: Session = Depends(obtener_db)):
    dias_calculados = lote_nuevo.edad_valor * 7 if lote_nuevo.edad_unidad == "semanas" else lote_nuevo.edad_valor

    db_lote = models.LoteDB(
        nombre=lote_nuevo.nombre, galpon=lote_nuevo.galpon,
        cantidad_inicial=lote_nuevo.cantidad_inicial, cantidad_actual=lote_nuevo.cantidad_inicial,
        raza=lote_nuevo.raza, fecha_ingreso=lote_nuevo.fecha_ingreso, fase="Levante",
        edad_ingreso_dias=dias_calculados
    )
    db.add(db_lote)
    db.commit()
    db.refresh(db_lote)

    if lote_nuevo.costo_adquisicion > 0:
        db_gasto = models.GastoDB(
            lote_id=db_lote.id, 
            concepto=f"Compra de aves ({lote_nuevo.cantidad_inicial})", 
            total_gasto=lote_nuevo.costo_adquisicion, 
            fecha=lote_nuevo.fecha_ingreso,
            categoria="Inversión"
        )
        db.add(db_gasto)
        db.commit()

    return {"mensaje": "¡Lote de La Comarca guardado con éxito!", "lote_id": db_lote.id}

@router.get("/lotes/{lote_id}/editar-info")
def info_editar_lote(lote_id: int, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    edad_unidad = "semanas" if lote.edad_ingreso_dias % 7 == 0 and lote.edad_ingreso_dias > 0 else "dias"
    edad_valor = lote.edad_ingreso_dias // 7 if edad_unidad == "semanas" else lote.edad_ingreso_dias
    
    return {
        "nombre": lote.nombre, "galpon": lote.galpon, "raza": lote.raza,
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_valor": edad_valor, "edad_unidad": edad_unidad
    }

@router.post("/lotes/editar")
def editar_lote(lote_editado: schemas.ModeloLoteUpdate, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_editado.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    dias_calculados = lote_editado.edad_valor * 7 if lote_editado.edad_unidad == "semanas" else lote_editado.edad_valor
    lote.nombre = lote_editado.nombre
    lote.galpon = lote_editado.galpon
    lote.raza = lote_editado.raza
    lote.fecha_ingreso = lote_editado.fecha_ingreso
    lote.edad_ingreso_dias = dias_calculados
    db.commit()
    return {"mensaje": f"¡Lote ID {lote.id} actualizado!"}

@router.get("/lotes/activos")
def obtener_lotes_activos(db: Session = Depends(obtener_db)):
    lotes = db.query(models.LoteDB).filter(models.LoteDB.cantidad_actual > 0).all()
    return [{"id": l.id, "etiqueta": f"{l.nombre} ({l.galpon})"} for l in lotes]

@router.get("/lotes/todos")
def obtener_todos_los_lotes(db: Session = Depends(obtener_db)):
    lotes = db.query(models.LoteDB).order_by(models.LoteDB.id.desc()).all()
    lista = []
    for lote in lotes:
        estado = "Activo" if lote.cantidad_actual > 0 else "Cerrado"
        lista.append({"id": lote.id, "etiqueta": f"{lote.nombre} ({lote.galpon}) - {estado}"})
    return lista

@router.get("/lotes/{lote_id}/resumen")
def resumen_lote(lote_id: int, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    total_mortalidad = sum(p.mortalidad for p in lote.producciones) if lote.producciones else 0
    porcentaje_mortalidad = (total_mortalidad / lote.cantidad_inicial) * 100 if lote.cantidad_inicial > 0 else 0
    dias_en_granja = (date.today() - lote.fecha_ingreso).days
    semanas = (dias_en_granja + lote.edad_ingreso_dias) // 7
    
    gastos = db.query(models.GastoDB).filter(models.GastoDB.lote_id == lote.id).all()
    
    costo_aves = 0.0
    costo_alimento = 0.0
    costo_medicina = 0.0
    costo_salarios = 0.0
    costo_higiene = 0.0
    otros_levante = 0.0

    # Lógica de Categorización Inteligente (Soporta registros nuevos y viejos)
    for g in gastos:
        if g.categoria == "Inversión": 
            c_lower = g.concepto.lower()
            if "compra de aves" in c_lower:
                costo_aves += g.total_gasto
            elif "[alimento]" in c_lower or "aba" in c_lower or "alimento" in c_lower:
                costo_alimento += g.total_gasto
            elif "[medicina y vitaminas]" in c_lower or "medicina" in c_lower or "vacuna" in c_lower:
                costo_medicina += g.total_gasto
            elif "[salarios]" in c_lower:
                costo_salarios += g.total_gasto
            elif "[higiene]" in c_lower:
                costo_higiene += g.total_gasto
            else:
                otros_levante += g.total_gasto

    monto_inversion = costo_aves + costo_alimento + costo_medicina + costo_salarios + costo_higiene + otros_levante

    return {
        "codigo": f"L{lote.id:04d}", "galpon": lote.galpon, "raza": lote.raza,
        "fecha_nacimiento": (lote.fecha_ingreso - datetime.timedelta(days=lote.edad_ingreso_dias)).strftime("%Y-%m-%d"),
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_semanas": semanas, "porcentaje_mortalidad": round(porcentaje_mortalidad, 2),
        "aves_hoy": lote.cantidad_actual, "semanas_faltantes": max(0, 100 - semanas),
        "inversion_levante": monto_inversion,
        "desglose": {
            "aves": costo_aves, "alimento": costo_alimento, "medicina": costo_medicina,
            "salarios": costo_salarios, "higiene": costo_higiene, "otros": otros_levante
        }
    }

@router.post("/produccion/registrar")
def registrar_produccion(prod_nueva: schemas.ModeloProduccion, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == prod_nueva.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    porcentaje = (prod_nueva.cantidad_huevos / lote.cantidad_actual) * 100 if lote.cantidad_actual > 0 else 0
    lote.cantidad_actual -= prod_nueva.mortalidad
    db_prod = models.ProduccionDB(lote_id=prod_nueva.lote_id, cantidad_huevos=prod_nueva.cantidad_huevos, mortalidad=prod_nueva.mortalidad, fecha=prod_nueva.fecha, porcentaje_postura=f"{round(porcentaje,2)}%")
    db.add(db_prod)
    db.commit()
    return {"mensaje": "¡Producción guardada!"}

@router.post("/alimentacion/registrar-consumo")
def registrar_consumo(consumo: schemas.ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == consumo.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    
    calculo_gramos = (consumo.kilos_consumidos * 1000) / lote.cantidad_actual if lote.cantidad_actual > 0 else 0
    
    db_consumo = models.ConsumoAlimentoDB(lote_id=consumo.lote_id, kilos_consumidos=consumo.kilos_consumidos, gramos_por_ave=round(calculo_gramos,2), fecha=consumo.fecha)
    db.add(db_consumo)
    
    # === INICIO DE LÓGICA DE DESCUENTO EN CASCADA ===
    kilos_a_descontar = float(consumo.kilos_consumidos)
    
    # 1. Traemos TODOS los insumos de tipo 'Alimento' usando .all() en lugar de .first()
    insumos_alimento = db.query(models.InsumoDB).filter(
        models.InsumoDB.categoria == "Alimento", 
        models.InsumoDB.stock_actual > 0
    ).order_by(models.InsumoDB.id).all()
    
    # 2. Revisamos saco por saco hasta vaciar la cantidad consumida
    for insumo in insumos_alimento:
        if kilos_a_descontar <= 0:
            break # Si ya descontamos todo, detenemos el ciclo
            
        if insumo.stock_actual >= kilos_a_descontar:
            insumo.stock_actual -= kilos_a_descontar
            kilos_a_descontar = 0
        else:
            kilos_a_descontar -= insumo.stock_actual
            insumo.stock_actual = 0
    # === FIN DE LÓGICA DE DESCUENTO EN CASCADA ===

    db.commit()
    return {"mensaje": "¡Consumo descontado correctamente en cascada!"}

# --- CORRECTORES AUTO-SANADORES ---
@router.get("/produccion/buscar/{lote_id}/{fecha}")
def buscar_produccion(lote_id: int, fecha: str, db: Session = Depends(obtener_db)):
    prod = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == lote_id, models.ProduccionDB.fecha == fecha).order_by(models.ProduccionDB.id.desc()).first()
    if not prod: return {"cantidad_huevos": 0, "mortalidad": 0, "nota": "sin_registro"}
    return {"cantidad_huevos": prod.cantidad_huevos, "mortalidad": prod.mortalidad}

@router.get("/alimento/buscar/{lote_id}/{fecha}")
def buscar_alimento(lote_id: int, fecha: str, db: Session = Depends(obtener_db)):
    alim = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == lote_id, models.ConsumoAlimentoDB.fecha == fecha).order_by(models.ConsumoAlimentoDB.id.desc()).first()
    if not alim: return {"kilos_consumidos": 0.0, "nota": "sin_registro"}
    return {"kilos_consumidos": alim.kilos_consumidos}

@router.post("/produccion/corregir")
def corregir_produccion(datos: schemas.ModeloProduccion, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == datos.lote_id).first()
    registros = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == datos.lote_id, models.ProduccionDB.fecha == datos.fecha).all()
    porcentaje = (datos.cantidad_huevos / lote.cantidad_actual) * 100 if lote.cantidad_actual > 0 else 0
    if registros:
        prod = registros[-1]
        for fantasma in registros[:-1]: db.delete(fantasma)
        lote.cantidad_actual -= (datos.mortalidad - prod.mortalidad)
        prod.mortalidad, prod.cantidad_huevos, prod.porcentaje_postura = datos.mortalidad, datos.cantidad_huevos, f"{round(porcentaje,2)}%"
    else:
        db.add(models.ProduccionDB(lote_id=datos.lote_id, fecha=datos.fecha, mortalidad=datos.mortalidad, cantidad_huevos=datos.cantidad_huevos, porcentaje_postura=f"{round(porcentaje,2)}%"))
    db.commit()
    return {"mensaje": "¡Producción corregida!"}

@router.post("/alimento/corregir")
def corregir_alimento(datos: schemas.ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == datos.lote_id).first()
    registros = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == datos.lote_id, models.ConsumoAlimentoDB.fecha == datos.fecha).all()
    diferencia = datos.kilos_consumidos - (registros[-1].kilos_consumidos if registros else 0.0)
    if diferencia != 0:
        insumo = db.query(models.InsumoDB).filter(models.InsumoDB.categoria == "Alimento").order_by(models.InsumoDB.stock_actual.desc()).first()
        if insumo: insumo.stock_actual = max(0, insumo.stock_actual - diferencia)
    gramos = round((datos.kilos_consumidos * 1000) / lote.cantidad_actual, 2) if lote.cantidad_actual > 0 else 0
    if registros:
        alim = registros[-1]
        for fantasma in registros[:-1]: db.delete(fantasma)
        alim.kilos_consumidos, alim.gramos_por_ave = datos.kilos_consumidos, gramos
    else:
        db.add(models.ConsumoAlimentoDB(lote_id=datos.lote_id, fecha=datos.fecha, kilos_consumidos=datos.kilos_consumidos, gramos_por_ave=gramos))
    db.commit()
    return {"mensaje": "¡Alimento corregido!"}

# --- GASTOS DE LEVANTE (NUEVO) ---
class GastoLevanteSchema(BaseModel):
    lote_id: int
    tipo_gasto: str
    concepto: str
    monto: float
    fecha: date

@router.post("/lotes/gasto-levante")
def registrar_gasto_levante(gasto: GastoLevanteSchema, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == gasto.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    # Inyectamos la etiqueta para que el desglose lo identifique matemáticamente
    concepto_etiquetado = f"[{gasto.tipo_gasto}] {gasto.concepto}"
    
    nuevo_gasto = models.GastoDB(
        lote_id=gasto.lote_id, concepto=concepto_etiquetado, total_gasto=gasto.monto,
        fecha=gasto.fecha, categoria="Inversión"
    )
    db.add(nuevo_gasto)
    db.commit()
    return {"mensaje": "¡Inversión registrada con éxito!"}