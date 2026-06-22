/* ============================================================
   TRIGGERS UNICIDAD TEMPORAL
============================================================ */

-- ------------------------------------------------------------
-- RN-05: un miembro no puede tener dos PeriodoVinculacion
-- abiertos (Fecha_Fin IS NULL) al mismo tiempo.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_periodo_unico()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.Fecha_Fin IS NULL THEN
        IF EXISTS (
            SELECT 1 FROM PeriodoVinculacion
            WHERE CI = NEW.CI
              AND Fecha_Fin IS NULL
              AND Fecha_Inicio <> NEW.Fecha_Inicio
        ) THEN
            RAISE EXCEPTION 'RN-05: el miembro % ya tiene un periodo de vinculacion abierto', NEW.CI;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_periodo_unico
BEFORE INSERT OR UPDATE ON PeriodoVinculacion
FOR EACH ROW
EXECUTE FUNCTION fn_validar_periodo_unico();

-- ------------------------------------------------------------
-- RN-21 / RN-60: no puede haber dos reservas CONFIRMADAS para
-- el mismo espacio fisico o el mismo puesto en el mismo horario.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_reserva_unica()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'Confirmada' THEN
        -- RN-21: choque por espacio fisico
        IF NEW.numero_espacio IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM Reserva
                WHERE numero_espacio = NEW.numero_espacio
                  AND nombre_edif = NEW.nombre_edif
                  AND direccion_exacta = NEW.direccion_exacta
                  AND nombre_sede_espacio = NEW.nombre_sede_espacio
                  AND fecha_hora = NEW.fecha_hora
                  AND estado = 'Confirmada'
                  AND (nombre_servicio <> NEW.nombre_servicio OR numero_servicio <> NEW.numero_servicio)
            ) THEN
                RAISE EXCEPTION 'RN-21: ya existe una reserva confirmada para ese espacio fisico en ese horario';
            END IF;
        END IF;

        -- RN-60: choque por puesto de estacionamiento
        IF NEW.numero_puesto IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM Reserva
                WHERE numero_puesto = NEW.numero_puesto
                  AND nombre_estacionamiento = NEW.nombre_estacionamiento
                  AND nombre_sede_puesto = NEW.nombre_sede_puesto
                  AND fecha_hora = NEW.fecha_hora
                  AND estado = 'Confirmada'
                  AND (nombre_servicio <> NEW.nombre_servicio OR numero_servicio <> NEW.numero_servicio)
            ) THEN
                RAISE EXCEPTION 'RN-60: ya existe una reserva confirmada para ese puesto en ese horario';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reserva_unica
BEFORE INSERT OR UPDATE ON Reserva
FOR EACH ROW
EXECUTE FUNCTION fn_validar_reserva_unica();
/* ============================================================
   TRIGGERS- MIEMBROS Y SEGURIDAD
============================================================ */

-- ------------------------------------------------------------
-- RN-03: 3 intentos fallidos en una Sesion -> bloquear al Miembro
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bloqueo_intentos_fallidos()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.intentos_fallidos >= 3 THEN
        UPDATE Miembro
        SET estado_de_cuenta = 'Bloqueada'
        WHERE CI = NEW.CI AND estado_de_cuenta <> 'Bloqueada';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bloqueo_intentos_fallidos
AFTER INSERT OR UPDATE ON Sesion
FOR EACH ROW
EXECUTE FUNCTION fn_bloqueo_intentos_fallidos();

-- ------------------------------------------------------------
-- RN-06: si se cierra un periodo y no queda ninguno abierto
-- para ese miembro -> Suspendida (solo si estaba Activa)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_suspender_sin_periodo()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.Fecha_Fin IS NULL AND NEW.Fecha_Fin IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM PeriodoVinculacion
            WHERE CI = NEW.CI AND Fecha_Fin IS NULL
        ) THEN
            UPDATE Miembro
            SET estado_de_cuenta = 'Suspendida'
            WHERE CI = NEW.CI AND estado_de_cuenta = 'Activa';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_suspender_sin_periodo
AFTER UPDATE ON PeriodoVinculacion
FOR EACH ROW
EXECUTE FUNCTION fn_suspender_sin_periodo();

-- ------------------------------------------------------------
-- RN-07: no registrar Beneficiario si el miembro esta
-- suspendido o bloqueado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_estado_beneficiario()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM Miembro
        WHERE CI = NEW.CI_miembro AND estado_de_cuenta IN ('Suspendida','Bloqueada')
    ) THEN
        RAISE EXCEPTION 'RN-07: el miembro % esta suspendido o bloqueado, no puede registrar beneficiarios', NEW.CI_miembro;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_estado_beneficiario
BEFORE INSERT ON Beneficiario
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_beneficiario();

-- ------------------------------------------------------------
-- RN-08: no registrar Vehiculo si el miembro esta
-- suspendido o bloqueado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_estado_vehiculo()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM Miembro
        WHERE CI = NEW.CI AND estado_de_cuenta IN ('Suspendida','Bloqueada')
    ) THEN
        RAISE EXCEPTION 'RN-08: el miembro % esta suspendido o bloqueado, no puede registrar vehiculos', NEW.CI;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_estado_vehiculo
BEFORE INSERT ON Vehiculo
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_vehiculo();

-- ------------------------------------------------------------
-- RN-09: no crear Solicitud si el miembro esta
-- suspendido o bloqueado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_estado_solicitud()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM Miembro
        WHERE CI = NEW.CI AND estado_de_cuenta IN ('Suspendida','Bloqueada')
    ) THEN
        RAISE EXCEPTION 'RN-09: el miembro % esta suspendido o bloqueado, no puede crear solicitudes', NEW.CI;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_estado_solicitud
BEFORE INSERT ON Solicitud
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_solicitud();

-- ------------------------------------------------------------
-- RN-11: Fecha_Fin debe ser posterior a Fecha_Inicio
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_fechas_periodo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.Fecha_Fin IS NOT NULL AND NEW.Fecha_Fin <= NEW.Fecha_Inicio THEN
        RAISE EXCEPTION 'RN-11: Fecha_Fin (%) debe ser posterior a Fecha_Inicio (%)', NEW.Fecha_Fin, NEW.Fecha_Inicio;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_fechas_periodo
BEFORE INSERT OR UPDATE ON PeriodoVinculacion
FOR EACH ROW
EXECUTE FUNCTION fn_validar_fechas_periodo();

-- ------------------------------------------------------------
-- RN-14 / RN-15: CargaMenor y CargaMayor son mutuamente
-- excluyentes para un mismo Beneficiario
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_carga_menor()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM CargaMayor WHERE CI = NEW.CI) THEN
        RAISE EXCEPTION 'RN-14: el beneficiario % ya esta registrado como CargaMayor', NEW.CI;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_carga_menor
BEFORE INSERT ON CargaMenor
FOR EACH ROW
EXECUTE FUNCTION fn_validar_carga_menor();

CREATE OR REPLACE FUNCTION fn_validar_carga_mayor()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM CargaMenor WHERE CI = NEW.CI) THEN
        RAISE EXCEPTION 'RN-15: el beneficiario % ya esta registrado como CargaMenor', NEW.CI;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_carga_mayor
BEFORE INSERT ON CargaMayor
FOR EACH ROW
EXECUTE FUNCTION fn_validar_carga_mayor();

-- ------------------------------------------------------------
-- RN-16: solo puede registrar beneficiarios un miembro que
-- tenga periodo activo Y sea Profesor o PersonalAdministrativo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_rol_registrante()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM PeriodoVinculacion
        WHERE CI = NEW.CI_miembro AND Fecha_Fin IS NULL
    ) THEN
        RAISE EXCEPTION 'RN-16: el miembro % no tiene un periodo de vinculacion activo', NEW.CI_miembro;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM Profesor WHERE CI = NEW.CI_miembro)
       AND NOT EXISTS (SELECT 1 FROM PersonalAdministrativo WHERE CI = NEW.CI_miembro) THEN
        RAISE EXCEPTION 'RN-16: el miembro % debe ser Profesor o PersonalAdministrativo para registrar beneficiarios', NEW.CI_miembro;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_rol_registrante
BEFORE INSERT ON Beneficiario
FOR EACH ROW
EXECUTE FUNCTION fn_validar_rol_registrante();
/* ============================================================
   TRIGGERS - SERVICIOS, TARIFAS Y SOLICITUDES
============================================================ */

-- ------------------------------------------------------------
-- RN-17: no se puede agregar un Acompanante a una Solicitud
-- que ya esta Cancelada
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_acompanante_solicitud()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM Solicitud
        WHERE fecha_hora_creacion = NEW.fecha_hora_creacion
          AND estado = 'Cancelada'
    ) THEN
        RAISE EXCEPTION 'RN-17: la solicitud esta Cancelada, no se le pueden agregar acompanantes';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_acompanante_solicitud
BEFORE INSERT ON Acompanante
FOR EACH ROW
EXECUTE FUNCTION fn_validar_acompanante_solicitud();

-- ------------------------------------------------------------
-- RN-23: el precio_final de una tarifa debe estar dentro de los
-- limites (minimo_limite, maximo_limite) que define Ajusta para
-- la categoria y sede del Servicio correspondiente
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_limites_tarifa()
RETURNS TRIGGER AS $$
DECLARE
    v_categoria VARCHAR(20);
    v_sede VARCHAR(50);
    v_min NUMERIC(10,2);
    v_max NUMERIC(10,2);
BEGIN
    SELECT nombre_categoria, nombre_sede INTO v_categoria, v_sede
    FROM Servicio
    WHERE nombre = NEW.nombre_servicio AND numero_servicio = NEW.numero_servicio;

    SELECT minimo_limite, maximo_limite INTO v_min, v_max
    FROM Ajusta
    WHERE nombre_categoria = v_categoria AND nombre_sede = v_sede;

    IF v_min IS NULL THEN
        RAISE EXCEPTION 'RN-23: no existe un ajuste definido para la categoria % en la sede %', v_categoria, v_sede;
    END IF;

    IF NEW.precio_final < v_min OR NEW.precio_final > v_max THEN
        RAISE EXCEPTION 'RN-23: el precio % esta fuera del rango permitido (% - %) para % en %',
            NEW.precio_final, v_min, v_max, v_categoria, v_sede;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_limites_tarifa
BEFORE INSERT ON Historial_Tarifas
FOR EACH ROW
EXECUTE FUNCTION fn_validar_limites_tarifa();

-- ------------------------------------------------------------
-- RN-28: una EntidadExterna con fecha_vencimiento pasada no
-- puede publicar nuevos servicios (no aplica a EntidadInterna)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_entidad_vencida()
RETURNS TRIGGER AS $$
DECLARE
    v_vencimiento DATE;
BEGIN
    SELECT fecha_vencimiento INTO v_vencimiento
    FROM EntidadExterna
    WHERE ID_EP = NEW.ID_EP;

    IF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
        RAISE EXCEPTION 'RN-28: la entidad externa esta vencida desde %, no puede publicar servicios', v_vencimiento;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_entidad_vencida
BEFORE INSERT ON Publica
FOR EACH ROW
EXECUTE FUNCTION fn_validar_entidad_vencida();

-- ------------------------------------------------------------
-- RN-34: un Paso_Actividad no puede iniciarse si el paso
-- anterior de esa misma Solicitud no esta Completado
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_paso_secuencial()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_paso > 1 THEN
        IF NOT EXISTS (
            SELECT 1 FROM Paso_Actividad
            WHERE fecha_hora_creacion_solicitud = NEW.fecha_hora_creacion_solicitud
              AND numero_paso = NEW.numero_paso - 1
              AND estado = 'Completado'
        ) THEN
            RAISE EXCEPTION 'RN-34: el paso % no puede iniciarse porque el paso % no esta Completado', NEW.numero_paso, NEW.numero_paso - 1;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_paso_secuencial
BEFORE INSERT ON Paso_Actividad
FOR EACH ROW
EXECUTE FUNCTION fn_validar_paso_secuencial();
/* ============================================================
   TRIGGERS - FINANZAS
============================================================ */

-- ------------------------------------------------------------
-- RN-22: al confirmar una Reserva, marcar el espacio fisico o
-- el puesto de estacionamiento como no disponible. Si la
-- reserva se cancela despues de estar confirmada, se libera
-- de nuevo (complemento logico, no rompe nada existente).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_actualizar_disponibilidad_reserva()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'Confirmada' THEN
        IF NEW.numero_espacio IS NOT NULL THEN
            UPDATE EspacioFisico SET disponibilidad = 'No Disponible'
            WHERE numero = NEW.numero_espacio
              AND nombre_edif = NEW.nombre_edif
              AND direccion_exacta = NEW.direccion_exacta
              AND nombre_sede = NEW.nombre_sede_espacio;
        ELSIF NEW.numero_puesto IS NOT NULL THEN
            UPDATE Puesto_Estacionamiento SET estado = 'Reservado'
            WHERE numero = NEW.numero_puesto
              AND nombre_estacionamiento = NEW.nombre_estacionamiento
              AND nombre_sede = NEW.nombre_sede_puesto;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'Confirmada' AND NEW.estado = 'Cancelada' THEN
        IF NEW.numero_espacio IS NOT NULL THEN
            UPDATE EspacioFisico SET disponibilidad = 'Disponible'
            WHERE numero = NEW.numero_espacio
              AND nombre_edif = NEW.nombre_edif
              AND direccion_exacta = NEW.direccion_exacta
              AND nombre_sede = NEW.nombre_sede_espacio;
        ELSIF NEW.numero_puesto IS NOT NULL THEN
            UPDATE Puesto_Estacionamiento SET estado = 'Libre'
            WHERE numero = NEW.numero_puesto
              AND nombre_estacionamiento = NEW.nombre_estacionamiento
              AND nombre_sede = NEW.nombre_sede_puesto;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_actualizar_disponibilidad_reserva
AFTER INSERT OR UPDATE ON Reserva
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_disponibilidad_reserva();

-- ------------------------------------------------------------
-- RN-49: cada vez que entra un Pago, recalcular el estado de
-- la Factura segun cuanto se ha pagado en total
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_recalcular_estado_factura()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(10,2);
    v_pagado NUMERIC(10,2);
BEGIN
    SELECT monto_total INTO v_total FROM Factura WHERE numero_de_control = NEW.numero_de_control;
    SELECT COALESCE(SUM(monto),0) INTO v_pagado FROM Pagos WHERE numero_de_control = NEW.numero_de_control;

    UPDATE Factura
    SET estado = CASE
        WHEN v_pagado >= v_total THEN 'Pagada'
        WHEN v_pagado > 0 THEN 'Parcialmente Pagada'
        ELSE 'Pendiente'
    END
    WHERE numero_de_control = NEW.numero_de_control;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_recalcular_estado_factura
AFTER INSERT ON Pagos
FOR EACH ROW
EXECUTE FUNCTION fn_recalcular_estado_factura();

-- ------------------------------------------------------------
-- RN-58: un pago TAI no puede superar el saldo_virtual del
-- miembro asociado a la factura, y debe descontarlo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_saldo_tai()
RETURNS TRIGGER AS $$
DECLARE
    v_ci VARCHAR(15);
    v_saldo NUMERIC(10,2);
BEGIN
    SELECT f.CI INTO v_ci
    FROM Pagos p
    JOIN Factura f ON f.numero_de_control = p.numero_de_control
    WHERE p.fecha_hora_pago = NEW.fecha_hora_pago AND p.monto = NEW.monto;

    IF v_ci IS NULL THEN
        RAISE EXCEPTION 'RN-58: el pago TAI debe estar asociado a una factura de un miembro (no de una entidad externa)';
    END IF;

    SELECT saldo_virtual INTO v_saldo FROM Miembro WHERE CI = v_ci;

    IF NEW.monto > v_saldo THEN
        RAISE EXCEPTION 'RN-58: el monto % supera el saldo virtual disponible (%) del miembro %', NEW.monto, v_saldo, v_ci;
    END IF;

    UPDATE Miembro SET saldo_virtual = saldo_virtual - NEW.monto WHERE CI = v_ci;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validar_saldo_tai
BEFORE INSERT ON TAI
FOR EACH ROW
EXECUTE FUNCTION fn_validar_saldo_tai();


-- ------------------------------------------------------------
-- RN-10: un miembro suspendido o bloqueado no puede crear una
-- reserva. El CI se obtiene via Solicitud (fecha_hora_creacion_solicitud)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_estado_reserva()
RETURNS TRIGGER AS $$
DECLARE
    v_ci VARCHAR(15);
    v_estado VARCHAR(15);
BEGIN
    SELECT CI INTO v_ci FROM Solicitud WHERE fecha_hora_creacion = NEW.fecha_hora_creacion_solicitud;
    SELECT estado_de_cuenta INTO v_estado FROM Miembro WHERE CI = v_ci;

    IF v_estado IN ('Suspendida','Bloqueada') THEN
        RAISE EXCEPTION 'RN-10: el miembro % esta % y no puede crear reservas', v_ci, v_estado;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validar_estado_reserva
BEFORE INSERT ON Reserva
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_reserva();

-- ------------------------------------------------------------
-- RN-42: el precio_unitario de un item debe coincidir exactamente
-- con el precio_final del historial de tarifas que referencia
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_precio_item()
RETURNS TRIGGER AS $$
DECLARE
    v_precio_tarifa NUMERIC(10,2);
BEGIN
    SELECT precio_final INTO v_precio_tarifa
    FROM Historial_Tarifas
    WHERE fecha_hora_vigencia = NEW.fecha_hora_vigencia
      AND nombre_servicio = NEW.nombre_servicio
      AND numero_servicio = NEW.numero_servicio
      AND perfil_solicitante = NEW.perfil_solicitante;

    IF NEW.precio_unitario <> v_precio_tarifa THEN
        RAISE EXCEPTION 'RN-42: el precio_unitario (%) no coincide con la tarifa vigente (%)', NEW.precio_unitario, v_precio_tarifa;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validar_precio_item
BEFORE INSERT ON Item_Consumo
FOR EACH ROW
EXECUTE FUNCTION fn_validar_precio_item();

-- ------------------------------------------------------------
-- RN-53  Zelle, Crypto, y Efectivo en
-- divisas deben tener su Pagos vinculado a una Tasa (Fecha_Tasa
-- no nulo). registrar_pago_multimoneda ya garantiza esto, este
-- trigger cubre el caso de un INSERT directo que se salte el
-- procedimiento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_tasa_digital()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Pagos
        WHERE fecha_hora_pago = NEW.fecha_hora_pago AND monto = NEW.monto AND Fecha_Tasa IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'RN-53: este pago multimoneda requiere que su fila en Pagos tenga Fecha_Tasa/Moneda_Tasa asignados';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validar_tasa_zelle
BEFORE INSERT ON Zelle
FOR EACH ROW
EXECUTE FUNCTION fn_validar_tasa_digital();

CREATE OR REPLACE TRIGGER trg_validar_tasa_crypto
BEFORE INSERT ON Crypto
FOR EACH ROW
EXECUTE FUNCTION fn_validar_tasa_digital();

CREATE OR REPLACE FUNCTION fn_validar_tasa_efectivo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.moneda <> 'Bolivares' AND NOT EXISTS (
        SELECT 1 FROM Pagos
        WHERE fecha_hora_pago = NEW.fecha_hora_pago AND monto = NEW.monto AND Fecha_Tasa IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'RN-53: un pago en efectivo en % requiere que su fila en Pagos tenga Fecha_Tasa/Moneda_Tasa asignados', NEW.moneda;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_validar_tasa_efectivo
BEFORE INSERT ON Efectivo
FOR EACH ROW
EXECUTE FUNCTION fn_validar_tasa_efectivo();

-- ------------------------------------------------------------
-- RN-65: cumplimiento_indice (Becario) se calcula solo, no se
-- puede manipular manualmente: TRUE si promedio_ponderado >= 15.
-- estatus_beneficio se ajusta junto con el indice.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_inicializar_indice_becario()
RETURNS TRIGGER AS $$
DECLARE
    v_promedio NUMERIC(4,2);
BEGIN
    SELECT promedio_ponderado INTO v_promedio FROM Estudiante WHERE CI = NEW.CI;
    NEW.cumplimiento_indice := (v_promedio >= 15);
    NEW.estatus_beneficio := CASE WHEN v_promedio >= 15 THEN 'Activo' ELSE 'Inactivo' END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_inicializar_indice_becario
BEFORE INSERT ON Becario
FOR EACH ROW
EXECUTE FUNCTION fn_inicializar_indice_becario();

CREATE OR REPLACE FUNCTION fn_actualizar_indice_becario()
RETURNS TRIGGER AS $$
DECLARE
    v_cumple BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM Becario WHERE CI = NEW.CI) THEN
        v_cumple := (NEW.promedio_ponderado >= 15);
        UPDATE Becario
        SET cumplimiento_indice = v_cumple,
            estatus_beneficio = CASE WHEN v_cumple THEN 'Activo' ELSE 'Inactivo' END
        WHERE CI = NEW.CI;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_actualizar_indice_becario
AFTER UPDATE ON Estudiante
FOR EACH ROW
WHEN (OLD.promedio_ponderado IS DISTINCT FROM NEW.promedio_ponderado)
EXECUTE FUNCTION fn_actualizar_indice_becario();

-- ------------------------------------------------------------
-- fecha_hora_finalizado de un Paso_Actividad
-- se graba sola al completarse, y no se puede alterar manualmente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bitacora_paso_finalizado()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado = 'Completado' THEN
        IF TG_OP = 'INSERT' OR OLD.estado <> 'Completado' THEN
            NEW.fecha_hora_finalizado := clock_timestamp();
        ELSE
            NEW.fecha_hora_finalizado := OLD.fecha_hora_finalizado;
        END IF;
    ELSE
        NEW.fecha_hora_finalizado := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_bitacora_paso_finalizado
BEFORE INSERT OR UPDATE ON Paso_Actividad
FOR EACH ROW
EXECUTE FUNCTION fn_bitacora_paso_finalizado();
/* ============================================================
   RN-22
============================================================ */

CREATE OR REPLACE FUNCTION fn_disponibilidad_espacio()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_espacio IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.estado = 'Confirmada' THEN
        UPDATE EspacioFisico SET disponibilidad = 'No Disponible'
        WHERE numero = NEW.numero_espacio AND nombre_edif = NEW.nombre_edif
          AND direccion_exacta = NEW.direccion_exacta AND nombre_sede = NEW.nombre_sede_espacio;
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'Confirmada' AND NEW.estado = 'Cancelada' THEN
        UPDATE EspacioFisico SET disponibilidad = 'Disponible'
        WHERE numero = NEW.numero_espacio AND nombre_edif = NEW.nombre_edif
          AND direccion_exacta = NEW.direccion_exacta AND nombre_sede = NEW.nombre_sede_espacio;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_disponibilidad_espacio
AFTER INSERT OR UPDATE ON Reserva
FOR EACH ROW
EXECUTE FUNCTION fn_disponibilidad_espacio();


CREATE OR REPLACE FUNCTION fn_disponibilidad_puesto()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_puesto IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.estado = 'Confirmada' THEN
        UPDATE Puesto_Estacionamiento SET estado = 'Reservado'
        WHERE numero = NEW.numero_puesto AND nombre_estacionamiento = NEW.nombre_estacionamiento
          AND nombre_sede = NEW.nombre_sede_puesto;
    ELSIF TG_OP = 'UPDATE' AND OLD.estado = 'Confirmada' AND NEW.estado = 'Cancelada' THEN
        UPDATE Puesto_Estacionamiento SET estado = 'Libre'
        WHERE numero = NEW.numero_puesto AND nombre_estacionamiento = NEW.nombre_estacionamiento
          AND nombre_sede = NEW.nombre_sede_puesto;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_disponibilidad_puesto
AFTER INSERT OR UPDATE ON Reserva
FOR EACH ROW
EXECUTE FUNCTION fn_disponibilidad_puesto();

-- El trigger viejo (fn_actualizar_disponibilidad_reserva /
-- trg_actualizar_disponibilidad_reserva) se reemplaza por estos dos.
DROP TRIGGER IF EXISTS trg_actualizar_disponibilidad_reserva ON Reserva;
DROP FUNCTION IF EXISTS fn_actualizar_disponibilidad_reserva();
