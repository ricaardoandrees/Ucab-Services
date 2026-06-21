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
