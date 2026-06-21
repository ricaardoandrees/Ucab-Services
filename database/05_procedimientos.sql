/*
   PROCEDIMIENTOS ALMACENADOS - ZONA 2
   RN-33/41/46/47: crear_solicitud
   Inserta una Solicitud junto con su primer Paso_Actividad
   en una sola transaccion, garantizando que nunca exista una
   solicitud sin al menos un paso.
 */

CREATE OR REPLACE PROCEDURE crear_solicitud(
    p_ci VARCHAR,
    p_nombre_servicio VARCHAR,
    p_numero_servicio INT,
    p_descripcion_paso1 VARCHAR,
    p_ci_responsable VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
BEGIN
    INSERT INTO Solicitud (fecha_hora_creacion, CI, nombre_servicio, numero_servicio, estado)
    VALUES (v_ahora, p_ci, p_nombre_servicio, p_numero_servicio, 'En Proceso');

    INSERT INTO Paso_Actividad (numero_paso, fecha_hora_creacion_solicitud, estado, descripcion, CI)
    VALUES (1, v_ahora, 'Pendiente', p_descripcion_paso1, p_ci_responsable);

    RAISE NOTICE 'Solicitud creada con fecha_hora_creacion = %', v_ahora;
END;
$$;

/* 
   PROCEDIMIENTOS ALMACENADOS - ZONA 3
   RN-41/46/47: generar_factura
   RN-52/53: registrar_pago_multimoneda
*/

CREATE OR REPLACE PROCEDURE generar_factura(
    p_fecha_hora_apertura TIMESTAMP,
    p_fecha_hora_creacion_solicitud TIMESTAMP,
    p_rif VARCHAR DEFAULT NULL,
    p_ci VARCHAR DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC(10,2);
    v_numero INT;
BEGIN
    SELECT COALESCE(SUM(cantidad * precio_unitario + impuestos), 0) INTO v_total
    FROM Item_Consumo
    WHERE fecha_hora_apertura = p_fecha_hora_apertura
      AND fecha_hora_creacion_solicitud = p_fecha_hora_creacion_solicitud;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'RN-47: el folio no tiene items de consumo, no se puede generar una factura con monto 0';
    END IF;

    UPDATE Folio_Consumo
    SET estado = 'Cerrado'
    WHERE fecha_hora_apertura = p_fecha_hora_apertura
      AND fecha_hora_creacion_solicitud = p_fecha_hora_creacion_solicitud;

    SELECT COALESCE(MAX(numero_de_control), 0) + 1 INTO v_numero FROM Factura;

    INSERT INTO Factura (numero_de_control, estado, monto_total, fecha_de_emision, fecha_hora_apertura, fecha_hora_creacion_solicitud, RIF, CI)
    VALUES (v_numero, 'Pendiente', v_total, clock_timestamp(), p_fecha_hora_apertura, p_fecha_hora_creacion_solicitud, p_rif, p_ci);

    RAISE NOTICE 'Factura % creada con monto_total = %', v_numero, v_total;
END;
$$;


CREATE OR REPLACE PROCEDURE registrar_pago_multimoneda(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_tipo VARCHAR,                    -- 'Zelle', 'Crypto' o 'Efectivo'
    p_moneda_tasa VARCHAR DEFAULT NULL,    -- codigo para Tasa: 'USD','USDT','EUR' (no aplica a Efectivo en Bolivares)
    p_tasa NUMERIC DEFAULT NULL,
    p_correo VARCHAR DEFAULT NULL,
    p_codigo_confirmacion VARCHAR DEFAULT NULL,
    p_nombre_titular VARCHAR DEFAULT NULL,
    p_direccion_billetera VARCHAR DEFAULT NULL,
    p_txid VARCHAR DEFAULT NULL,
    p_red VARCHAR DEFAULT NULL,
    p_moneda_efectivo VARCHAR DEFAULT NULL, -- 'Bolivares','Dolares','Euros'
    p_monto_recibido NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
    v_requiere_tasa BOOLEAN;
BEGIN
    v_requiere_tasa := (p_tipo IN ('Zelle','Crypto')) OR (p_tipo = 'Efectivo' AND p_moneda_efectivo <> 'Bolivares');

    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control) VALUES (v_ahora, p_monto, p_numero_de_control);

    IF v_requiere_tasa THEN
        IF p_moneda_tasa IS NULL OR p_tasa IS NULL THEN
            RAISE EXCEPTION 'RN-53: este pago es multimoneda y requiere moneda_tasa y tasa';
        END IF;
        INSERT INTO Tasa (Fecha_hora, Moneda, monto, Monto_Pago, Fecha_Hora_Pago)
        VALUES (v_ahora, p_moneda_tasa, p_tasa, p_monto, v_ahora);
    END IF;

    IF p_tipo = 'Zelle' THEN
        INSERT INTO Pago_Digital (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
        INSERT INTO Zelle (fecha_hora_pago, monto, correo_electronico_origen, codigo_confirmacion, nombre_titular)
        VALUES (v_ahora, p_monto, p_correo, p_codigo_confirmacion, p_nombre_titular);

    ELSIF p_tipo = 'Crypto' THEN
        INSERT INTO Pago_Digital (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
        INSERT INTO Crypto (fecha_hora_pago, monto, direccion_billetera, TXID, red)
        VALUES (v_ahora, p_monto, p_direccion_billetera, p_txid, p_red);

    ELSIF p_tipo = 'Efectivo' THEN
        INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
        INSERT INTO Efectivo (fecha_hora_pago, monto, moneda, monto_recibido)
        VALUES (v_ahora, p_monto, p_moneda_efectivo, p_monto_recibido);

    ELSE
        RAISE EXCEPTION 'RN-53: tipo de pago multimoneda no reconocido: %', p_tipo;
    END IF;

    RAISE NOTICE 'Pago % registrado con fecha_hora_pago = %', p_tipo, v_ahora;
END;
$$;
