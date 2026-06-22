/* ============================================================
   FUNCIONES - ZONA 2
   RN-35: dias_habiles(fecha_inicio, fecha_fin)
   Cuenta dias habiles (lunes a viernes) entre dos fechas,
   sin descontar feriados (alcance acordado).
============================================================ */

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
/* ============================================================
   FUNCIONES - ZONA 3
   RN-48: calcular_saldo_factura
   RN-52: calcular_monto_convertido
============================================================ */

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
    WHERE Fecha = p_fecha_hora_pago::date AND Moneda = p_moneda;

    IF v_tasa IS NULL THEN
        RAISE EXCEPTION 'RN-52: no existe una Tasa registrada para % el %', p_moneda, p_fecha_hora_pago::date;
    END IF;

    RETURN p_monto * v_tasa;
END;
$$ LANGUAGE plpgsql;
/* ============================================================
   FUNCIONES NUEVAS - del enunciado narrativo (despues de pagos)
============================================================ */

-- ------------------------------------------------------------
-- tiempo_resolucion_solicitud: tiempo de resolucion de una
-- solicitud dado su identificador (fecha_hora_creacion)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION tiempo_resolucion_solicitud(p_fecha_hora_creacion TIMESTAMP)
RETURNS INT AS $$
DECLARE
    v_finalizado TIMESTAMP;
BEGIN
    SELECT fecha_hora_finalizado INTO v_finalizado
    FROM Solicitud WHERE fecha_hora_creacion = p_fecha_hora_creacion;

    IF v_finalizado IS NULL THEN
        RETURN NULL; -- la solicitud todavia no se ha resuelto
    END IF;

    RETURN dias_habiles(p_fecha_hora_creacion, v_finalizado);
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- indice_recurrencia: clasifica a un miembro como Preferencial,
-- Frecuente o Regular, segun su actividad en los ultimos 6 meses
-- (volumen de servicios completados y frecuencia de reservas).
-- Los pesos y umbrales son una decision de diseno, ajustable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION indice_recurrencia(p_ci VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_servicios_completados INT;
    v_reservas_confirmadas INT;
    v_puntaje NUMERIC;
BEGIN
    SELECT count(*) INTO v_servicios_completados
    FROM Solicitud
    WHERE CI = p_ci AND estado = 'Completada'
      AND fecha_hora_creacion > (CURRENT_DATE - INTERVAL '6 months');

    SELECT count(*) INTO v_reservas_confirmadas
    FROM Reserva r
    JOIN Solicitud s ON s.fecha_hora_creacion = r.fecha_hora_creacion_solicitud
    WHERE s.CI = p_ci AND r.estado = 'Confirmada'
      AND r.fecha_hora > (CURRENT_DATE - INTERVAL '6 months');

    v_puntaje := (v_servicios_completados * 2) + (v_reservas_confirmadas * 1);

    IF v_puntaje >= 5 THEN
        RETURN 'Preferencial';
    ELSIF v_puntaje >= 2 THEN
        RETURN 'Frecuente';
    ELSE
        RETURN 'Regular';
    END IF;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- costo_con_descuento: precio final de un servicio para un
-- miembro, aplicando el descuento segun su clasificacion de
-- indice_recurrencia. Preferencial=10%, Frecuente=5%, Regular=0%.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION costo_con_descuento(
    p_nombre_servicio VARCHAR,
    p_numero_servicio INT,
    p_perfil_solicitante VARCHAR,
    p_ci VARCHAR
)
RETURNS NUMERIC AS $$
DECLARE
    v_precio_base NUMERIC(10,2);
    v_clasificacion VARCHAR;
    v_descuento NUMERIC;
BEGIN
    SELECT precio_final INTO v_precio_base
    FROM Historial_Tarifas
    WHERE nombre_servicio = p_nombre_servicio AND numero_servicio = p_numero_servicio
      AND perfil_solicitante = p_perfil_solicitante
      AND fecha_hora_vigencia <= CURRENT_TIMESTAMP
    ORDER BY fecha_hora_vigencia DESC LIMIT 1;

    IF v_precio_base IS NULL THEN
        RAISE EXCEPTION 'No existe una tarifa vigente para % (perfil %)', p_nombre_servicio, p_perfil_solicitante;
    END IF;

    v_clasificacion := indice_recurrencia(p_ci);

    v_descuento := CASE v_clasificacion
        WHEN 'Preferencial' THEN 0.10
        WHEN 'Frecuente' THEN 0.05
        ELSE 0
    END;

    RETURN ROUND(v_precio_base * (1 - v_descuento), 2);
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION buscar_candidatos_egresados(
    p_titulo_buscado VARCHAR,
    p_indice_minimo NUMERIC,
    p_anos_recientes INT DEFAULT 2
)
RETURNS TABLE (
    CI VARCHAR,
    primer_nombre VARCHAR,
    primer_apellido VARCHAR,
    titulo VARCHAR,
    indice_final NUMERIC,
    ano_graduacion INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.CI, m.primer_nombre, m.primer_apellido, e.titulo, e.indice_final, e.ano_graduacion
    FROM Egresado e
    JOIN Miembro m ON m.CI = e.CI
    WHERE e.titulo ILIKE '%' || p_titulo_buscado || '%'
      AND e.indice_final > p_indice_minimo
      AND e.ano_graduacion >= (EXTRACT(YEAR FROM CURRENT_DATE) - p_anos_recientes);
END;
$$ LANGUAGE plpgsql;
