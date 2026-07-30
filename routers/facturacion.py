from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
import datetime
import models, schemas
from database import obtener_db

router = APIRouter(tags=["Clientes y Facturación"])

@router.get("/clientes")
def listar_clientes(db: Session = Depends(obtener_db)):
    return db.query(models.ClienteDB).all()

@router.post("/clientes/crear")
def crear_cliente(cliente: schemas.ModeloCliente, db: Session = Depends(obtener_db)):
    existe = db.query(models.ClienteDB).filter(models.ClienteDB.documento == cliente.documento).first()
    if existe:
        raise HTTPException(status_code=400, detail="Este documento o RIF ya está registrado.")
    
    db_cliente = models.ClienteDB(**cliente.dict())
    db.add(db_cliente)
    db.commit()
    return {"mensaje": f"¡Cliente {cliente.nombre} registrado con éxito!"}

@router.post("/clientes/editar")
def editar_cliente(cliente_edit: schemas.ModeloClienteUpdate, db: Session = Depends(obtener_db)):
    db_cliente = db.query(models.ClienteDB).filter(models.ClienteDB.id == cliente_edit.cliente_id).first()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado.")
    
    db_cliente.documento = cliente_edit.documento
    db_cliente.nombre = cliente_edit.nombre
    db_cliente.telefono = cliente_edit.telefono
    db.commit()
    return {"mensaje": "¡Datos del cliente actualizados correctamente!"}

@router.post("/facturacion/procesar")
def procesar_factura(factura: schemas.ModeloFactura, db: Session = Depends(obtener_db)):
    try:
        cliente = db.query(models.ClienteDB).filter(models.ClienteDB.id == factura.cliente_id).first()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente no encontrado.")

        ultima_fact = db.query(models.FacturaDB).order_by(models.FacturaDB.id.desc()).first()
        num_seq = (ultima_fact.id + 1) if ultima_fact else 1
        numero_factura = f"FAC-{num_seq:04d}"

        f_vencimiento = None
        if factura.condicion == "Crédito" and factura.dias_credito > 0:
            f_vencimiento = factura.fecha + datetime.timedelta(days=factura.dias_credito)

        for item in factura.items:
            producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
            if not producto or producto.stock_cartones < item.cantidad_cartones:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para ID {item.producto_id}.")

        db_factura = models.FacturaDB(
            numero_factura=numero_factura,
            cliente_id=factura.cliente_id,
            fecha=factura.fecha,
            condicion=factura.condicion,
            fecha_vencimiento=f_vencimiento,
            descuento_tipo=factura.descuento_tipo,
            descuento_valor=factura.descuento_valor,
            total=0.0,
            moneda="VES" if factura.condicion in ["Transferencia", "Pago Móvil"] else "USD",
            tasa_cambio=factura.tasa_cambio,
            monto_ves=factura.monto_ves
        )
        db.add(db_factura)
        db.flush()

        total_bruto = 0.0
        for item in factura.items:
            producto = db.query(models.ProductoDB).filter(models.ProductoDB.id == item.producto_id).first()
            subtotal = item.cantidad_cartones * item.precio_unitario
            total_bruto += subtotal
            producto.stock_cartones -= item.cantidad_cartones
            db_detalle = models.DetalleFacturaDB(
                factura_id=db_factura.id, producto_id=item.producto_id,
                cantidad_cartones=item.cantidad_cartones, precio_unitario=item.precio_unitario, subtotal=subtotal
            )
            db.add(db_detalle)

        descuento_monto = total_bruto * (factura.descuento_valor / 100.0) if factura.descuento_tipo == "%" else factura.descuento_valor 
        total_neto = max(0.0, total_bruto - descuento_monto) 
        db_factura.total = total_neto

        if factura.condicion == "Crédito":
            db_factura.saldo_pendiente = total_neto
            monto_para_caja = 0.0 
        else:
            db_factura.saldo_pendiente = 0.0
            monto_para_caja = total_neto 

        if monto_para_caja > 0:
            texto_desc = f"{factura.descuento_valor}%" if factura.descuento_tipo == "%" else f"${factura.descuento_valor}"
            lote_seguro = db.query(models.LoteDB).first()
            lote_valido = lote_seguro.id if lote_seguro else None
            texto_moneda = f" (Bs {factura.monto_ves:.2f} a Tasa {factura.tasa_cambio})" if factura.monto_ves > 0 else ""

            ingreso_general = models.VentaDB(
                lote_id=lote_valido, 
                concepto=f"Venta {factura.condicion} {numero_factura} - {cliente.nombre} (-{texto_desc}){texto_moneda}",
                cantidad_cartones=sum(i.cantidad_cartones for i in factura.items),
                precio_unitario=0,
                total_ingreso=monto_para_caja,
                fecha=factura.fecha,
                moneda="VES" if factura.condicion in ["Transferencia", "Pago Móvil"] else "USD",
                tasa_cambio=factura.tasa_cambio,
                monto_ves=factura.monto_ves
            )
            db.add(ingreso_general)

        db.commit()
        return {"mensaje": f"¡Factura {numero_factura} procesada con éxito!", "numero_factura": numero_factura}
        
    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=400, detail=f"Falla interna: {str(e)}")

@router.get("/facturacion/historial")
def historial_facturas(db: Session = Depends(obtener_db)):
    facturas = db.query(models.FacturaDB).order_by(models.FacturaDB.id.desc()).all()
    resultado = []
    for f in facturas:
        detalles_lista = [{"nombre": d.producto.nombre if d.producto else "Prod. Eliminado", "cantidad_cartones": d.cantidad_cartones, "subtotal": d.subtotal} for d in f.detalles]
        resultado.append({
            "numero_factura": f.numero_factura,
            "cliente": f.cliente.nombre if f.cliente else "Cliente Desconocido",
            "fecha": f.fecha.strftime("%d/%m/%Y"),
            "condicion": f.condicion,
            "fecha_vencimiento": f.fecha_vencimiento.strftime("%d/%m/%Y") if f.fecha_vencimiento else None,
            "descuento_tipo": f.descuento_tipo,
            "descuento_valor": f.descuento_valor,
            "total": f.total,
            "saldo_pendiente": getattr(f, 'saldo_pendiente', 0.0),
            "moneda": getattr(f, 'moneda', 'USD'),
            "tasa_cambio": getattr(f, 'tasa_cambio', 1.0),
            "monto_ves": getattr(f, 'monto_ves', 0.0),
            "detalles": detalles_lista
        })
    return resultado

@router.post("/facturacion/abonar")
def abonar_factura(abono: schemas.ModeloAbono, db: Session = Depends(obtener_db)):
    factura = db.query(models.FacturaDB).filter(models.FacturaDB.numero_factura == abono.numero_factura).first()
    if not factura: raise HTTPException(status_code=404, detail="Factura no encontrada")
    if abono.monto <= 0 or abono.monto > factura.saldo_pendiente:
        raise HTTPException(status_code=400, detail="Monto inválido o excede la deuda actual.")
    
    factura.saldo_pendiente -= abono.monto
    
    # 🔥 CORRECCIÓN BUG 1: Validar la moneda según el método de pago del ABONO, no la factura
    es_ves = abono.metodo_pago in ["Transferencia Bancaria", "Pago Móvil", "Transferencia"]
    factura.tasa_cambio = abono.tasa_cambio
    factura.moneda = "VES" if es_ves else "USD"
        
    if factura.monto_ves is None: factura.monto_ves = 0.0
    factura.monto_ves += abono.monto_ves

    lote_seguro = db.query(models.LoteDB).first()
    lote_valido = lote_seguro.id if lote_seguro else None
    texto_moneda = f" (Bs {abono.monto_ves:.2f} a Tasa {abono.tasa_cambio})" if abono.monto_ves > 0 else ""

    ingreso = models.VentaDB(
        lote_id=lote_valido,
        concepto=f"Abono ({abono.metodo_pago}) - Fra. {factura.numero_factura} ({factura.cliente.nombre}){texto_moneda}",
        cantidad_cartones=0, precio_unitario=0, total_ingreso=abono.monto, fecha=date.today(),
        moneda="VES" if es_ves else "USD",
        tasa_cambio=abono.tasa_cambio, monto_ves=abono.monto_ves
    )
    db.add(ingreso)
    db.commit()
    return {"mensaje": f"¡Abono de ${abono.monto:.2f} registrado con éxito a la cuenta de caja!"}