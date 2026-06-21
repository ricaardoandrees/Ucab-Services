/* 
   FUNCIONES - ZONA 2
   RN-35: dias_habiles(fecha_inicio, fecha_fin)
   Cuenta dias habiles (lunes a viernes) entre dos fechas,
   sin descontar feriados (alcance acordado).
 */

CREATE OR REPLACE FUNCTION dias_habiles(fecha_inicio TIMESTAMP, fecha_fin TIMESTAMP)
RETURNS INT AS $$
DECLARE
    v_dias INT;
BEGIN
    IF fecha_fin IS NULL OR fecha_inicio IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT count(*) INTO v_dias
    FROM generate_series(fecha_inicio::date, fecha_fin::date, '1 day'::interval) AS d
    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);

    RETURN v_dias;
END;
$$ LANGUAGE plpgsql;

/* 
   FUNCIONES - ZONA 3
   RN-48: calcular_saldo_factura
   RN-52: calcular_monto_convertido
 */

CREATE OR REPLACE FUNCTION calcular_saldo_factura(p_numero_de_control INT)
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC(10,2);
    v_pagado NUMERIC(10,2);
BEGIN
    SELECT monto_total INTO v_total FROM Factura WHERE numero_de_control = p_numero_de_control;

    IF v_total IS NULL THEN
        RAISE EXCEPTION 'No existe la factura numero %', p_numero_de_control;
    END IF;

    SELECT COALESCE(SUM(monto),0) INTO v_pagado FROM Pagos WHERE numero_de_control = p_numero_de_control;

    RETURN v_total - v_pagado;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION calcular_monto_convertido(p_monto NUMERIC, p_fecha_hora_pago TIMESTAMP, p_moneda VARCHAR)
RETURNS NUMERIC AS $$
DECLARE
    v_tasa NUMERIC(6,2);
BEGIN
    SELECT monto INTO v_tasa
    FROM Tasa
    WHERE Fecha_hora = p_fecha_hora_pago AND Moneda = p_moneda;

    IF v_tasa IS NULL THEN
        RAISE EXCEPTION 'RN-52: no existe una Tasa registrada para % en %', p_moneda, p_fecha_hora_pago;
    END IF;

    RETURN p_monto * v_tasa;
END;
$$ LANGUAGE plpgsql;
