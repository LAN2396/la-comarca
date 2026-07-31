from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import datetime
import requests
from bs4 import BeautifulSoup
import urllib3
import models, schemas
from database import obtener_db

# Importamos la protección de accesos que creamos en auth.py
from routers.auth import verificar_finanzas

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

router = APIRouter(tags=["Finanzas y Analítica"])

@router.post("/finanzas/registrar-gasto")
def registrar_gasto(gasto_nuevo: schemas.ModeloGasto, db: Session = Depends(obtener_db)):
    lote_seguro = db.query(models.LoteDB).first()
    lote_valido = lote_seguro.id if lote_seguro else None
    texto_moneda = f" (Bs {gasto_nuevo.monto_ves:.2f} a Tasa {gasto_nuevo.tasa_cambio})" if gasto_nuevo.moneda == "VES" else ""
    
    db_gasto = models.GastoDB(
        lote_id=lote_valido, 
        concepto=gasto_nuevo.concepto + texto_moneda, 
        total_gasto=gasto_nuevo.total_gasto, 
        fecha=gasto_nuevo.fecha, 
        categoria=gasto_nuevo.categoria,
        moneda=gasto_nuevo.moneda,
        tasa_cambio=gasto_nuevo.tasa_cambio,
        monto_ves=gasto_nuevo.monto_ves
    )
    db.add(db_gasto)
    db.commit()
    return {"mensaje": "¡Gasto operativo/administrativo registrado en la caja!"}

@router.post("/finanzas/registrar-venta")
def registrar_venta(venta_nueva: schemas.ModeloVenta, db: Session = Depends(obtener_db)):
    lote = db.query(models.LoteDB).filter(models.LoteDB.id == venta_nueva.lote_id).first()
    if not lote: raise HTTPException(status_code=404, detail="Lote no existe.")
    calculo_total = venta_nueva.cantidad_cartones * venta_nueva.precio_unitario
    db_venta = models.VentaDB(lote_id=venta_nueva.lote_id, concepto=venta_nueva.concepto, cantidad_cartones=venta_nueva.cantidad_cartones, precio_unitario=venta_nueva.precio_unitario, total_ingreso=calculo_total, fecha=venta_nueva.fecha)
    db.add(db_venta)
    db.commit()
    return {"mensaje": "¡Venta registrada!", "venta": db_venta}

@router.get("/finanzas/dashboard")
def obtener_dashboard_finanzas(tasa_actual: float = 1.0, db: Session = Depends(obtener_db), acceso = Depends(verificar_finanzas)):
    ventas = db.query(models.VentaDB).all()
    gastos = db.query(models.GastoDB).all()
    facturas = db.query(models.FacturaDB).all()
    
    por_cobrar = sum(f.saldo_pendiente for f in facturas if getattr(f, 'saldo_pendiente', 0) > 0)

    caja_usd, banco_ves, usd_teorico_en_banco = 0.0, 0.0, 0.0
    transacciones = []
    
    for v in ventas:
        if getattr(v, 'moneda', 'USD') == 'USD': caja_usd += v.total_ingreso
        else:
            banco_ves += getattr(v, 'monto_ves', 0.0)
            usd_teorico_en_banco += v.total_ingreso
        transacciones.append({"fecha_raw": str(v.fecha), "fecha": v.fecha.strftime("%d/%m/%Y"), "tipo": "Ingreso", "concepto": v.concepto, "monto": v.total_ingreso, "categoria": "Ventas/Abonos"})

    for g in gastos:
        if getattr(g, 'moneda', 'USD') == 'USD': caja_usd -= g.total_gasto
        else:
            banco_ves -= getattr(g, 'monto_ves', 0.0)
            usd_teorico_en_banco -= g.total_gasto
        transacciones.append({"fecha_raw": str(g.fecha), "fecha": g.fecha.strftime("%d/%m/%Y"), "tipo": "Egreso", "concepto": g.concepto, "monto": g.total_gasto, "categoria": g.categoria})
    
    transacciones.sort(key=lambda x: x["fecha_raw"], reverse=True)
    usd_real_en_banco = banco_ves / tasa_actual if tasa_actual > 0 else usd_teorico_en_banco
    perdida_cambiaria = usd_teorico_en_banco - usd_real_en_banco
    
    return {"por_cobrar": por_cobrar, "caja_usd": caja_usd, "banco_ves": banco_ves, "usd_real_banco": usd_real_en_banco, "perdida_cambiaria": perdida_cambiaria, "capital_total": caja_usd + usd_real_en_banco, "transacciones": transacciones}

@router.get("/historial/{dias}")
def obtener_historial(dias: int, db: Session = Depends(obtener_db)):
    if dias == 0:
        producciones = db.query(models.ProduccionDB).all()
        alimentos = db.query(models.ConsumoAlimentoDB).all()
    else:
        fecha_limite = date.today() - datetime.timedelta(days=dias)
        producciones = db.query(models.ProduccionDB).filter(models.ProduccionDB.fecha >= fecha_limite).all()
        alimentos = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.fecha >= fecha_limite).all()
    
    lotes_db = db.query(models.LoteDB).all()
    lotes_cache = {l.id: f"{l.nombre} ({l.galpon})" for l in lotes_db}
    
    historial_dict = {}
    for p in producciones:
        key = f"{p.fecha}_{p.lote_id}"
        historial_dict[key] = {
            "fecha": p.fecha.strftime("%Y-%m-%d"), 
            "lote_nombre": lotes_cache.get(p.lote_id, f"Lote {p.lote_id}"), 
            "huevos": p.cantidad_huevos, 
            "mortalidad": p.mortalidad, 
            "alimento": 0.0,
            "postura": p.porcentaje_postura  # 👈 Nueva métrica agregada
        }
        
    for a in alimentos:
        key = f"{a.fecha}_{a.lote_id}"
        if key in historial_dict: 
            historial_dict[key]["alimento"] = a.kilos_consumidos
        else:
            historial_dict[key] = {
                "fecha": a.fecha.strftime("%Y-%m-%d"), 
                "lote_nombre": lotes_cache.get(a.lote_id, f"Lote {a.lote_id}"), 
                "huevos": 0, 
                "mortalidad": 0, 
                "alimento": a.kilos_consumidos,
                "postura": "0%"
            }
            
    lista_historial = list(historial_dict.values())
    
    # 👈 NUEVO: Calcular Conversión Alimenticia (gramos de alimento por huevo)
    for item in lista_historial:
        if item["huevos"] > 0 and item["alimento"] > 0:
            conversion = (item["alimento"] * 1000) / item["huevos"]
            item["conversion"] = round(conversion, 1)
        else:
            item["conversion"] = 0.0

    lista_historial.sort(key=lambda x: x["fecha"], reverse=True)
    return lista_historial

@router.get("/api/graficos/{lote_id}")
def obtener_datos_graficos(lote_id: int, db: Session = Depends(obtener_db)):
    producciones = db.query(models.ProduccionDB).filter(models.ProduccionDB.lote_id == lote_id).order_by(models.ProduccionDB.fecha).all()
    alimentos = db.query(models.ConsumoAlimentoDB).filter(models.ConsumoAlimentoDB.lote_id == lote_id).order_by(models.ConsumoAlimentoDB.fecha).all()

    data_por_fecha = {}
    for p in producciones:
        try: pct = float(p.porcentaje_postura.replace('%', ''))
        except: pct = 0.0
        data_por_fecha[p.fecha] = {"fecha": p.fecha.strftime("%d/%m"), "postura": pct, "alimento": 0.0}

    for a in alimentos:
        if a.fecha in data_por_fecha: data_por_fecha[a.fecha]["alimento"] = a.gramos_por_ave
        else: data_por_fecha[a.fecha] = {"fecha": a.fecha.strftime("%d/%m"), "postura": 0.0, "alimento": a.gramos_por_ave}

    return [data_por_fecha[f] for f in sorted(data_por_fecha.keys())]

@router.get("/api/tasa-bcv")
def obtener_tasa_bcv():
    try:
        url = "https://www.bcv.org.ve/"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        response = requests.get(url, verify=False, timeout=10, headers=headers)
        soup = BeautifulSoup(response.content, "html.parser")
        dolar_div = soup.find("div", id="dolar")
        tasa_texto = dolar_div.find("strong").text.strip().replace(",", ".")
        return {"exito": True, "tasa": float(tasa_texto), "origen": "BCV Oficial"}
    except Exception as e:
        return {"exito": False, "tasa": 0.0, "error": str(e)}