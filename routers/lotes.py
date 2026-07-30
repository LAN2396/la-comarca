from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    edad_unidad = "semanas" if lote.edad_ingreso_dias % 7 == 0 and lote.edad_ingreso_dias > 0 else "dias"
    edad_valor = lote.edad_ingreso_dias // 7 if edad_unidad == "semanas" else lote.edad_ingreso_dias
    
    return {
        "nombre": lote.nombre,
        "galpon": lote.galpon,
        "raza": lote.raza,
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_valor": edad_valor,
        "edad_unidad": edad_unidad
    }

@router.post("/lotes/editar")
def editar_lote(lote_editado: schemas.ModeloLoteUpdate, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_editado.lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    dias_calculados = lote_editado.edad_valor * 7 if lote_editado.edad_unidad == "semanas" else lote_editado.edad_valor
    
    lote.nombre = lote_editado.nombre
    lote.galpon = lote_editado.galpon
    lote.raza = lote_editado.raza
    lote.fecha_ingreso = lote_editado.fecha_ingreso
    lote.edad_ingreso_dias = dias_calculados
    
    db.commit()
    return {"mensaje": f"¡Lote ID {lote.id} actualizado y corregido correctamente!"}

@router.get("/produccion/buscar/{lote_id}/{fecha}")
def buscar_produccion_diaria(lote_id: int, fecha: date, db: Session = Depends(obtener_db)):
    prod = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == lote_id, models.ProduccionDB.fecha == fecha).first()
    if not prod:
        raise HTTPException(status_code=404, detail="No hay registro de producción en esa fecha.")
    return {"cantidad_huevos": prod.cantidad_huevos, "mortalidad": prod.mortalidad}

@router.post("/produccion/corregir")
def corregir_produccion(datos: schemas.ModeloProduccion, db: Session = Depends(obtener_db)):
    prod = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == datos.lote_id, models.ProduccionDB.fecha == datos.fecha).first()
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == datos.lote_id).first()
    if not prod or not lote:
        raise HTTPException(status_code=404, detail="Registro o lote no encontrado.")
    
    diferencia_muertes = datos.mortalidad - prod.mortalidad
    lote.cantidad_actual -= diferencia_muertes
    
    prod.mortalidad = datos.mortalidad
    prod.cantidad_huevos = datos.cantidad_huevos
    
    # 🔥 CORRECCIÓN BUG 4: Recalcular porcentaje para que el gráfico refleje el cambio
    porcentaje = (datos.cantidad_huevos / lote.cantidad_actual) * 100 if lote.cantidad_actual > 0 else 0
    prod.porcentaje_postura = f"{round(porcentaje,2)}%"
    
    db.commit()
    return {"mensaje": "¡Registro de Producción/Bajas corregido con éxito!"}

@router.get("/alimento/buscar/{lote_id}/{fecha}")
def buscar_alimento_diario(lote_id: int, fecha: date, db: Session = Depends(obtener_db)):
    alim = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == lote_id, models.ConsumoAlimentoDB.fecha == fecha).first()
    if not alim:
        raise HTTPException(status_code=404, detail="No hay registro de alimento en esa fecha.")
    return {"kilos_consumidos": alim.kilos_consumidos}

@router.post("/alimento/corregir")
def corregir_alimento(datos: schemas.ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    alim = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == datos.lote_id, models.ConsumoAlimentoDB.fecha == datos.fecha).first()
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == datos.lote_id).first()
    if not alim or not lote:
        raise HTTPException(status_code=404, detail="Registro de alimento o lote no encontrado.")
    
    alim.kilos_consumidos = datos.kilos_consumidos
    
    # 🔥 CORRECCIÓN BUG 4: Recalcular gramos por ave para actualizar el gráfico de barras
    calculo_gramos = (datos.kilos_consumidos * 1000) / lote.cantidad_actual if lote.cantidad_actual > 0 else 0
    alim.gramos_por_ave = round(calculo_gramos, 2)
    
    db.commit()
    return {"mensaje": "¡Consumo de alimento corregido con éxito!"}

@router.get("/lotes/activos")
def obtener_lotes_activos(db: Session = Depends(obtener_db)):
    lotes = db.query(models.LoteDB).filter(models.LoteDB.cantidad_actual > 0).all()
    lista_activos = []
    for lote in lotes:
        etiqueta = f"{lote.nombre} ({lote.galpon})"
        lista_activos.append({"id": lote.id, "etiqueta": etiqueta})
    return lista_activos

@router.get("/lotes/{lote_id}/resumen")
def resumen_lote(lote_id: int, db: Session = Depends(obtener_db)):
    if lote_id <= 0:
        raise HTTPException(status_code=400, detail="ID inválido")

    lote = db.query(models.LoteDB).filter(models.LoteDB.id == lote_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote no encontrado")
    
    total_mortalidad = sum(p.mortalidad for p in lote.producciones) if lote.producciones else 0
    porcentaje_mortalidad = (total_mortalidad / lote.cantidad_inicial) * 100 if lote.cantidad_inicial > 0 else 0
    
    dias_en_granja = (date.today() - lote.fecha_ingreso).days
    edad_total_dias = dias_en_granja + lote.edad_ingreso_dias
    semanas = edad_total_dias // 7
    
    gastos = db.query(models.GastoDB).filter(models.GastoDB.lote_id == lote.id).all()
    
    costo_aves = 0.0
    costo_alimento = 0.0
    costo_medicina = 0.0
    otros_levante = 0.0
    gastos_operativos = 0.0 

    for g in gastos:
        if g.categoria == "Inversión": 
            concepto_texto = g.concepto.lower()
            if "ave" in concepto_texto or "polla" in concepto_texto:
                costo_aves += g.total_gasto
            elif "alimento" in concepto_texto or "aba" in concepto_texto:
                costo_alimento += g.total_gasto
            elif "medicina" in concepto_texto or "vacuna" in concepto_texto:
                costo_medicina += g.total_gasto
            else:
                otros_levante += g.total_gasto
        elif g.categoria == "Operativo":
            gastos_operativos += g.total_gasto
    
    monto_inversion = costo_aves + costo_alimento + costo_medicina + otros_levante
    ventas = db.query(models.VentaDB).filter(models.VentaDB.lote_id == lote.id).all()
    ingresos_lote = sum(v.total_ingreso for v in ventas) if ventas else 0.0
    
    balance_operativo = ingresos_lote - gastos_operativos
    balance_total_roi = ingresos_lote - (gastos_operativos + monto_inversion)

    semanas_faltantes = max(0, 100 - semanas)
    fecha_nac = lote.fecha_ingreso - datetime.timedelta(days=lote.edad_ingreso_dias)

    return {
        "codigo": f"L{lote.id:04d}",
        "galpon": lote.galpon,
        "raza": lote.raza,
        "aves_iniciales": lote.cantidad_inicial,
        "fecha_nacimiento": fecha_nac.strftime("%Y-%m-%d"),
        "fecha_ingreso": lote.fecha_ingreso.strftime("%Y-%m-%d"),
        "edad_semanas": semanas,
        "porcentaje_mortalidad": round(porcentaje_mortalidad, 2),
        "inversion_levante": monto_inversion,
        "aves_hoy": lote.cantidad_actual,
        "semanas_faltantes": semanas_faltantes,
        "desglose": {
            "aves": costo_aves,
            "alimento": costo_alimento,
            "medicina": costo_medicina
        },
        "finanzas": {
            "balance_operativo": balance_operativo,
            "inversion_total": monto_inversion,
            "balance_total_roi": balance_total_roi
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
    return {"mensaje": "¡Producción y Bajas guardadas!", "registro": db_prod}

@router.post("/alimentacion/registrar-consumo")
def registrar_consumo(consumo: schemas.ModeloConsumoAlimento, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == consumo.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    
    calculo_gramos = (consumo.kilos_consumidos * 1000) / lote.cantidad_actual if lote.cantidad_actual > 0 else 0
    
    db_consumo = models.ConsumoAlimentoDB(
        lote_id=consumo.lote_id, 
        kilos_consumidos=consumo.kilos_consumidos, 
        gramos_por_ave=round(calculo_gramos,2), 
        fecha=consumo.fecha
    )
    db.add(db_consumo)
    
    # 🔥 CORRECCIÓN BUG 2 (Alimento): Busca cualquier alimento con stock > 0
    insumo_alimento = db.query(models.InsumoDB).filter(models.InsumoDB.categoria == "Alimento", models.InsumoDB.stock_actual > 0).first()
    if insumo_alimento:
        insumo_alimento.stock_actual -= consumo.kilos_consumidos
        if insumo_alimento.stock_actual < 0: insumo_alimento.stock_actual = 0
            
    db.commit()
    return {"mensaje": "¡Consumo registrado y descontado del almacén!", "gramos_por_ave": f"{round(calculo_gramos,2)}g"}