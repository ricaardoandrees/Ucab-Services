/* ============================================================
   PROCEDIMIENTOS ALMACENADOS - ZONA 2
   RN-33/41/46/47: crear_solicitud
   Inserta una Solicitud junto con su primer Paso_Actividad
   en una sola transaccion, garantizando que nunca exista una
   solicitud sin al menos un paso.
============================================================ */

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
/* ============================================================
   PROCEDIMIENTOS ALMACENADOS - ZONA 3
   RN-41/46/47: generar_factura
   RN-52/53: registrar_pago_multimoneda
============================================================ */

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


/* ============================================================
   fn_garantizar_tasa_del_dia: pieza compartida por los 3
   procedimientos de pago multimoneda. Si ya existe una Tasa
   para hoy + esa moneda, no hace nada. Si no existe, la crea.
   Siempre devuelve la fecha de hoy, para que el que la llama
   no tenga que recalcular CURRENT_DATE por su cuenta.
============================================================ */

CREATE OR REPLACE FUNCTION fn_garantizar_tasa_del_dia(p_moneda VARCHAR, p_tasa NUMERIC)
RETURNS DATE AS $$
DECLARE
    v_hoy DATE := CURRENT_DATE;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Tasa WHERE Fecha = v_hoy AND Moneda = p_moneda) THEN
        INSERT INTO Tasa (Fecha, Moneda, monto) VALUES (v_hoy, p_moneda, p_tasa);
    END IF;
    RETURN v_hoy;
END;
$$ LANGUAGE plpgsql;


/* ============================================================
   registrar_pago_zelle
============================================================ */
CREATE OR REPLACE PROCEDURE registrar_pago_zelle(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_moneda_tasa VARCHAR,
    p_tasa NUMERIC,
    p_correo VARCHAR,
    p_codigo_confirmacion VARCHAR,
    p_nombre_titular VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
    v_fecha_tasa DATE;
BEGIN
    v_fecha_tasa := fn_garantizar_tasa_del_dia(p_moneda_tasa, p_tasa);

    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control, Fecha_Tasa, Moneda_Tasa)
    VALUES (v_ahora, p_monto, p_numero_de_control, v_fecha_tasa, p_moneda_tasa);

    INSERT INTO Pago_Digital (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO Zelle (fecha_hora_pago, monto, correo_electronico_origen, codigo_confirmacion, nombre_titular)
    VALUES (v_ahora, p_monto, p_correo, p_codigo_confirmacion, p_nombre_titular);

    RAISE NOTICE 'Pago Zelle registrado con fecha_hora_pago = %', v_ahora;
END;
$$;


/* ============================================================
   registrar_pago_crypto
============================================================ */
CREATE OR REPLACE PROCEDURE registrar_pago_crypto(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_moneda_tasa VARCHAR,
    p_tasa NUMERIC,
    p_direccion_billetera VARCHAR,
    p_txid VARCHAR,
    p_red VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
    v_fecha_tasa DATE;
BEGIN
    v_fecha_tasa := fn_garantizar_tasa_del_dia(p_moneda_tasa, p_tasa);

    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control, Fecha_Tasa, Moneda_Tasa)
    VALUES (v_ahora, p_monto, p_numero_de_control, v_fecha_tasa, p_moneda_tasa);

    INSERT INTO Pago_Digital (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO Crypto (fecha_hora_pago, monto, direccion_billetera, TXID, red)
    VALUES (v_ahora, p_monto, p_direccion_billetera, p_txid, p_red);

    RAISE NOTICE 'Pago Crypto registrado con fecha_hora_pago = %', v_ahora;
END;
$$;


/* ============================================================
   registrar_pago_efectivo: la Tasa solo se garantiza si la
   moneda no es Bolivares (efectivo local no necesita tasa)
============================================================ */
CREATE OR REPLACE PROCEDURE registrar_pago_efectivo(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_moneda_efectivo VARCHAR,
    p_monto_recibido NUMERIC,
    p_moneda_tasa VARCHAR DEFAULT NULL,
    p_tasa NUMERIC DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
    v_fecha_tasa DATE := NULL;
    v_moneda_tasa VARCHAR(10) := NULL;
BEGIN
    IF p_moneda_efectivo <> 'Bolivares' THEN
        IF p_moneda_tasa IS NULL OR p_tasa IS NULL THEN
            RAISE EXCEPTION 'RN-53: un pago en efectivo en % requiere moneda_tasa y tasa', p_moneda_efectivo;
        END IF;
        v_fecha_tasa := fn_garantizar_tasa_del_dia(p_moneda_tasa, p_tasa);
        v_moneda_tasa := p_moneda_tasa;
    END IF;

    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control, Fecha_Tasa, Moneda_Tasa)
    VALUES (v_ahora, p_monto, p_numero_de_control, v_fecha_tasa, v_moneda_tasa);

    INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO Efectivo (fecha_hora_pago, monto, moneda, monto_recibido)
    VALUES (v_ahora, p_monto, p_moneda_efectivo, p_monto_recibido);

    RAISE NOTICE 'Pago Efectivo (%) registrado con fecha_hora_pago = %', p_moneda_efectivo, v_ahora;
END;
$$;

-- El procedimiento generico anterior se reemplaza por los 3 de arriba
DROP PROCEDURE IF EXISTS registrar_pago_multimoneda(INT, NUMERIC, VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, NUMERIC);
/* ============================================================
   registrar_pago_tarjeta, registrar_pago_movil, registrar_pago_tai
   Mismo patron que Zelle/Crypto/Efectivo, pero sin Tasa porque
   estos 3 siempre son en Bolivares - no son multimoneda.
============================================================ */

CREATE OR REPLACE PROCEDURE registrar_pago_tarjeta(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_tipo VARCHAR,
    p_red VARCHAR,
    p_num_tarjeta VARCHAR,
    p_fecha_vencimiento DATE,
    p_compania VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
BEGIN
    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control)
    VALUES (v_ahora, p_monto, p_numero_de_control);

    INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO Tarjeta (fecha_hora_pago, monto, tipo, red, num_tarjeta, fecha_vencimiento, compania)
    VALUES (v_ahora, p_monto, p_tipo, p_red, p_num_tarjeta, p_fecha_vencimiento, p_compania);

    RAISE NOTICE 'Pago con Tarjeta registrado con fecha_hora_pago = %', v_ahora;
END;
$$;


CREATE OR REPLACE PROCEDURE registrar_pago_movil(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_telefono VARCHAR,
    p_numero_referencia VARCHAR,
    p_banco_emisor VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
BEGIN
    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control)
    VALUES (v_ahora, p_monto, p_numero_de_control);

    INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO PagoMovil (fecha_hora_pago, monto, telefono, numero_referencia, banco_emisor)
    VALUES (v_ahora, p_monto, p_telefono, p_numero_referencia, p_banco_emisor);

    RAISE NOTICE 'Pago Movil registrado con fecha_hora_pago = %', v_ahora;
END;
$$;


-- registrar_pago_tai: el chequeo de saldo_virtual (RN-58) ya lo
-- hace el trigger trg_validar_saldo_tai al insertar en TAI, este
-- procedimiento solo encadena los 3 inserts.
CREATE OR REPLACE PROCEDURE registrar_pago_tai(
    p_numero_de_control INT,
    p_monto NUMERIC,
    p_uid VARCHAR,
    p_pos VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_ahora TIMESTAMP := clock_timestamp();
BEGIN
    INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control)
    VALUES (v_ahora, p_monto, p_numero_de_control);

    INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES (v_ahora, p_monto);
    INSERT INTO TAI (fecha_hora_pago, monto, UID, POS)
    VALUES (v_ahora, p_monto, p_uid, p_pos);

    RAISE NOTICE 'Pago TAI registrado con fecha_hora_pago = %', v_ahora;
END;
$$;
/* ============================================================
   actualizar_tasas_diarias: simula la actualizacion diaria del
   BCV. Sube cada moneda conocida un 2% sobre su ultima tasa
   registrada, e inserta la tasa de hoy (idempotente si se
   corre dos veces el mismo dia: actualiza en vez de duplicar).
============================================================ */

CREATE OR REPLACE PROCEDURE actualizar_tasas_diarias()
LANGUAGE plpgsql
AS $$
DECLARE
    v_moneda VARCHAR(10);
    v_ultima_tasa NUMERIC(6,2);
    v_nueva_tasa NUMERIC(6,2);
    v_hoy DATE := CURRENT_DATE;
BEGIN
    FOR v_moneda IN SELECT DISTINCT Moneda FROM Tasa LOOP
        SELECT monto INTO v_ultima_tasa
        FROM Tasa
        WHERE Moneda = v_moneda
        ORDER BY Fecha DESC LIMIT 1;

        v_nueva_tasa := ROUND(v_ultima_tasa * 1.02, 2);

        INSERT INTO Tasa (Fecha, Moneda, monto)
        VALUES (v_hoy, v_moneda, v_nueva_tasa)
        ON CONFLICT (Fecha, Moneda) DO UPDATE SET monto = EXCLUDED.monto;

        RAISE NOTICE 'Tasa % actualizada: % -> % (+2%%)', v_moneda, v_ultima_tasa, v_nueva_tasa;
    END LOOP;
END;
$$;


/* ============================================================
   buscar_candidatos_egresados: emparejamiento de la bolsa de
   trabajo. Dado un titulo buscado (texto parcial), un indice
   minimo, y cuantos anos recientes de graduacion contar,
   devuelve los egresados que califican.
============================================================ */


CREATE OR REPLACE PROCEDURE finalizar_voluntariados_vencidos()
LANGUAGE plpgsql
AS $$
DECLARE
    v_actualizados INT;
BEGIN
    -- Finaliza Abiertos Y Cerrados cuya fecha_fin ya pasó
    UPDATE Voluntariado
    SET estado = 'Finalizado'
    WHERE fecha_fin IS NOT NULL
      AND fecha_fin < NOW()
      AND estado IN ('Abierto', 'Cerrado');

    GET DIAGNOSTICS v_actualizados = ROW_COUNT;
    RAISE NOTICE '% voluntariado(s) marcado(s) como Finalizado.', v_actualizados;
END;
$$;
/* ============================================================
   PROCEDIMIENTO: finalizar_voluntariados_vencidos
   Cambia a 'Finalizado' todos los voluntariados cuya
   fecha_fin ya pasó y aún están en estado 'Abierto'.
   Uso: CALL finalizar_voluntariados_vencidos();
============================================================ */
