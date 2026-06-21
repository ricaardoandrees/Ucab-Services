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
