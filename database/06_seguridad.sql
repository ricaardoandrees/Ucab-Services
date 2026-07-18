/*
   Roles definidos:
     rol_consulta       → Público externo (solo lectura)
     rol_operador       → Miembros, Egresados, Profesores
     rol_aliado_externo → Entidades externas (concesionarios, aliados comerciales)
     rol_rrhh           → Administradores de RRHH y Miembros
     rol_finanzas       → Administradores Financieros
     rol_infraestructura→ Administradores de Sedes y Catálogo
 */


DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_consulta') THEN
        CREATE ROLE rol_consulta;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_operador') THEN
        CREATE ROLE rol_operador;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_aliado_externo') THEN
        CREATE ROLE rol_aliado_externo;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_rrhh') THEN
        CREATE ROLE rol_rrhh;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_finanzas') THEN
        CREATE ROLE rol_finanzas;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rol_infraestructura') THEN
        CREATE ROLE rol_infraestructura;
    END IF;
END
$$;

/* 
   rol_consulta — Solo lectura en tablas públicas
   Actores: Público externo (HU-36, HU-40, HU-41, HU-51)
 */
GRANT SELECT ON
    Servicio, CategoriaServicio, Suplemento, Publica,
    EspacioFisico, Edificacion, Sede,
    OfertaLaboral, EntidadPrestadora, EntidadExterna,
    EntidadInterna, Historial_Tarifas
TO rol_consulta;

/*
  rol_operador — Operaciones transaccionales
   Actores: Miembro, Egresado, Becario, Preparador, Estudiante, Profesor
*/
GRANT rol_consulta TO rol_operador;

-- Perfil y sesión
GRANT SELECT, UPDATE ON Miembro TO rol_operador;
GRANT SELECT, INSERT  ON Sesion  TO rol_operador;

-- Especializaciones (solo lectura)
GRANT SELECT ON
    Estudiante, Becario, Preparador,
    Profesor, PersonalAdministrativo, Egresado
TO rol_operador;

-- Vinculaciones (leer historial propio)
GRANT SELECT ON PeriodoVinculacion TO rol_operador;

-- Beneficiarios y acompañantes
GRANT SELECT, INSERT         ON Beneficiario TO rol_operador;
GRANT SELECT, INSERT         ON CargaMenor   TO rol_operador;
GRANT SELECT, INSERT         ON CargaMayor   TO rol_operador;
GRANT SELECT, INSERT, DELETE ON Acompanante  TO rol_operador;

-- Vehículos
GRANT SELECT, INSERT, DELETE ON Vehiculo TO rol_operador;

-- Solicitudes y pasos
GRANT SELECT, INSERT, UPDATE ON Solicitud      TO rol_operador;
GRANT SELECT, INSERT         ON Paso_Actividad TO rol_operador;

-- Reservas y estacionamiento
GRANT SELECT, INSERT, UPDATE ON Reserva                TO rol_operador;
GRANT SELECT                 ON Puesto_Estacionamiento  TO rol_operador;
GRANT SELECT                 ON Estacionamiento         TO rol_operador;

-- Voluntariado
GRANT SELECT                 ON Voluntariado TO rol_operador;
GRANT SELECT, INSERT, DELETE ON Inscribe     TO rol_operador;

-- Bolsa de trabajo
GRANT SELECT                 ON OfertaLaboral TO rol_operador;
GRANT SELECT, INSERT, DELETE ON Postula       TO rol_operador;

-- Contactos
GRANT SELECT, INSERT ON Contactos TO rol_operador;

-- Folios, facturas, pagos (solo lectura para el miembro)
GRANT SELECT ON
    Folio_Consumo, Item_Consumo, Factura,
    Pagos, Tasa
TO rol_operador;

-- Funciones de consulta
GRANT EXECUTE ON FUNCTION
    dias_habiles(TIMESTAMP, TIMESTAMP),
    calcular_saldo_factura(INT),
    calcular_monto_convertido(NUMERIC, TIMESTAMP, VARCHAR),
    tiempo_resolucion_solicitud(TIMESTAMP),
    indice_recurrencia(VARCHAR),
    costo_con_descuento(VARCHAR, INT, VARCHAR, VARCHAR),
    buscar_candidatos_egresados(VARCHAR, NUMERIC, INT)
TO rol_operador;

-- Procedimiento de solicitudes
GRANT EXECUTE ON PROCEDURE
    crear_solicitud(VARCHAR, VARCHAR, INT, VARCHAR, VARCHAR)
TO rol_operador;

/*
  rol_aliado_externo — Bolsa de trabajo desde el lado del aliado
   Actores: Entidad Externa (concesionario, aliado comercial)
   El filtro de "solo mis propias ofertas/postulaciones" (por RIF)
   lo aplica el backend, no la seguridad a nivel de fila.
*/
GRANT rol_consulta TO rol_aliado_externo;
GRANT SELECT, INSERT, UPDATE ON OfertaLaboral TO rol_aliado_externo;
GRANT SELECT ON Postula TO rol_aliado_externo;
GRANT SELECT, UPDATE ON EntidadExterna TO rol_aliado_externo;
GRANT SELECT, INSERT ON Contactos TO rol_aliado_externo;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_aliado_externo;

/* ==========================================================
   ROLES ADMINISTRATIVOS (Heredan de rol_operador)
   ========================================================== */
GRANT rol_operador TO rol_rrhh;
GRANT rol_operador TO rol_finanzas;
GRANT rol_operador TO rol_infraestructura;

/* ----------------------------------------------------------
   ROL RRHH: Gestión de Miembros, Vinculaciones y Beneficiarios
---------------------------------------------------------- */
GRANT INSERT, DELETE ON Miembro TO rol_rrhh;
GRANT INSERT, UPDATE, DELETE ON Estudiante, Becario, Preparador, Profesor, PersonalAdministrativo, Egresado TO rol_rrhh;
GRANT INSERT, UPDATE, DELETE ON PeriodoVinculacion TO rol_rrhh;
GRANT UPDATE, DELETE ON Beneficiario, CargaMenor, CargaMayor TO rol_rrhh;
GRANT INSERT, UPDATE, DELETE ON OfertaLaboral, Voluntariado TO rol_rrhh;

/* ----------------------------------------------------------
   ROL INFRAESTRUCTURA: Catálogo, Sedes y Entidades
---------------------------------------------------------- */
GRANT SELECT, INSERT, UPDATE, DELETE ON Sede, Edificacion, EspacioFisico, Estacionamiento, Puesto_Estacionamiento, Recursos, Ajusta TO rol_infraestructura;
GRANT SELECT, INSERT, UPDATE, DELETE ON Servicio, CategoriaServicio, Suplemento, Publica, Historial_Tarifas TO rol_infraestructura;
GRANT SELECT, INSERT, UPDATE, DELETE ON EntidadPrestadora, EntidadExterna, EntidadInterna TO rol_infraestructura;
GRANT UPDATE, DELETE ON Paso_Actividad TO rol_infraestructura;

/* ----------------------------------------------------------
   ROL FINANZAS: Pagos, Facturación y Tasas
---------------------------------------------------------- */
GRANT SELECT, INSERT, UPDATE, DELETE ON Folio_Consumo, Item_Consumo, Factura, Pagos, Pago_Digital, Pago_Presencial, Zelle, Crypto, Efectivo, Denominaciones, Tarjeta, PagoMovil, TAI TO rol_finanzas;
GRANT SELECT, INSERT, UPDATE ON Tasa TO rol_finanzas;

GRANT EXECUTE ON PROCEDURE
    generar_factura(TIMESTAMP, TIMESTAMP, VARCHAR, VARCHAR),
    registrar_pago_zelle(INT, NUMERIC, VARCHAR, NUMERIC, VARCHAR, VARCHAR, VARCHAR),
    registrar_pago_crypto(INT, NUMERIC, VARCHAR, NUMERIC, VARCHAR, VARCHAR, VARCHAR),
    registrar_pago_efectivo(INT, NUMERIC, VARCHAR, NUMERIC, VARCHAR, NUMERIC),
    registrar_pago_tarjeta(INT, NUMERIC, VARCHAR, VARCHAR, VARCHAR, DATE, VARCHAR),
    registrar_pago_movil(INT, NUMERIC, VARCHAR, VARCHAR, VARCHAR),
    registrar_pago_tai(INT, NUMERIC, VARCHAR, VARCHAR),
    actualizar_tasas_diarias()
TO rol_finanzas;

GRANT EXECUTE ON FUNCTION fn_garantizar_tasa_del_dia(VARCHAR, NUMERIC) TO rol_finanzas;

-- Secuencias
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_operador;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_rrhh;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_finanzas;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rol_infraestructura;

/* ==========================================================
   ROW LEVEL SECURITY (RLS)
   ========================================================== */
ALTER TABLE Miembro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS policy_miembro_operador ON Miembro;
CREATE POLICY policy_miembro_operador
    ON Miembro
    FOR ALL
    TO rol_operador
    USING (ci = current_user);

DROP POLICY IF EXISTS policy_miembro_rrhh ON Miembro;
CREATE POLICY policy_miembro_rrhh
    ON Miembro
    FOR ALL
    TO rol_rrhh
    USING (true);

DROP POLICY IF EXISTS policy_miembro_finanzas ON Miembro;
CREATE POLICY policy_miembro_finanzas
    ON Miembro
    FOR ALL
    TO rol_finanzas
    USING (true);

DROP POLICY IF EXISTS policy_miembro_infraestructura ON Miembro;
CREATE POLICY policy_miembro_infraestructura
    ON Miembro
    FOR ALL
    TO rol_infraestructura
    USING (true);

-- Solicitud: un miembro (rol_operador) solo ve/crea sus propias solicitudes;
-- el personal administrativo (rrhh/finanzas/infraestructura) necesita ver
-- todas para procesar pasos de actividad, aunque ninguno tenga un GRANT
-- propio sobre la tabla (solo heredan SELECT/INSERT/UPDATE de rol_operador
-- via membresia de rol) — RLS no amplia privilegios, solo filas visibles.
ALTER TABLE Solicitud ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_solicitud_operador ON Solicitud;
CREATE POLICY policy_solicitud_operador
    ON Solicitud
    FOR ALL
    TO rol_operador
    USING (ci = current_user);

DROP POLICY IF EXISTS policy_solicitud_staff ON Solicitud;
CREATE POLICY policy_solicitud_staff
    ON Solicitud
    FOR ALL
    TO rol_rrhh, rol_finanzas, rol_infraestructura
    USING (true);

-- Reserva: visible solo si la Solicitud que la origino es del miembro;
-- el personal administrativo ve todas (mismo motivo que Solicitud).
ALTER TABLE Reserva ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_reserva_operador ON Reserva;
CREATE POLICY policy_reserva_operador
    ON Reserva
    FOR ALL
    TO rol_operador
    USING (fecha_hora_creacion_solicitud IN (
        SELECT fecha_hora_creacion FROM Solicitud WHERE ci = current_user
    ));

DROP POLICY IF EXISTS policy_reserva_staff ON Reserva;
CREATE POLICY policy_reserva_staff
    ON Reserva
    FOR ALL
    TO rol_rrhh, rol_finanzas, rol_infraestructura
    USING (true);

-- Vehiculo: un miembro solo ve/gestiona sus propios vehiculos; el personal
-- administrativo ve todos (mismo motivo que Solicitud).
ALTER TABLE Vehiculo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_vehiculo_operador ON Vehiculo;
CREATE POLICY policy_vehiculo_operador
    ON Vehiculo
    FOR ALL
    TO rol_operador
    USING (ci = current_user);

DROP POLICY IF EXISTS policy_vehiculo_staff ON Vehiculo;
CREATE POLICY policy_vehiculo_staff
    ON Vehiculo
    FOR ALL
    TO rol_rrhh, rol_finanzas, rol_infraestructura
    USING (true);

-- Beneficiario: el miembro solo ve/registra los suyos; RRHH ve todos
-- (tiene GRANT propio de UPDATE/DELETE sobre esta tabla).
ALTER TABLE Beneficiario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_beneficiario_operador ON Beneficiario;
CREATE POLICY policy_beneficiario_operador
    ON Beneficiario
    FOR ALL
    TO rol_operador
    USING (ci_miembro = current_user);

DROP POLICY IF EXISTS policy_beneficiario_rrhh ON Beneficiario;
CREATE POLICY policy_beneficiario_rrhh
    ON Beneficiario
    FOR ALL
    TO rol_rrhh
    USING (true);

-- Folio_Consumo / Item_Consumo: visibles solo si la solicitud es del
-- miembro; Finanzas ve todo (tiene GRANT propio ALL sobre estas tablas).
ALTER TABLE Folio_Consumo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_folio_operador ON Folio_Consumo;
CREATE POLICY policy_folio_operador
    ON Folio_Consumo
    FOR ALL
    TO rol_operador
    USING (fecha_hora_creacion_solicitud IN (
        SELECT fecha_hora_creacion FROM Solicitud WHERE ci = current_user
    ));

DROP POLICY IF EXISTS policy_folio_finanzas ON Folio_Consumo;
CREATE POLICY policy_folio_finanzas
    ON Folio_Consumo
    FOR ALL
    TO rol_finanzas
    USING (true);

ALTER TABLE Item_Consumo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_item_operador ON Item_Consumo;
CREATE POLICY policy_item_operador
    ON Item_Consumo
    FOR ALL
    TO rol_operador
    USING (fecha_hora_creacion_solicitud IN (
        SELECT fecha_hora_creacion FROM Solicitud WHERE ci = current_user
    ));

DROP POLICY IF EXISTS policy_item_finanzas ON Item_Consumo;
CREATE POLICY policy_item_finanzas
    ON Item_Consumo
    FOR ALL
    TO rol_finanzas
    USING (true);

-- Factura: el miembro solo ve las suyas (facturas RIF quedan fuera, un
-- rol_operador nunca es dueno de una factura corporativa); Finanzas ve todo.
ALTER TABLE Factura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_factura_operador ON Factura;
CREATE POLICY policy_factura_operador
    ON Factura
    FOR ALL
    TO rol_operador
    USING (ci = current_user);

DROP POLICY IF EXISTS policy_factura_finanzas ON Factura;
CREATE POLICY policy_factura_finanzas
    ON Factura
    FOR ALL
    TO rol_finanzas
    USING (true);

-- Pagos: no tiene CI propio, se resuelve via la Factura a la que pertenece.
ALTER TABLE Pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_pagos_operador ON Pagos;
CREATE POLICY policy_pagos_operador
    ON Pagos
    FOR ALL
    TO rol_operador
    USING (numero_de_control IN (
        SELECT numero_de_control FROM Factura WHERE ci = current_user
    ));

DROP POLICY IF EXISTS policy_pagos_finanzas ON Pagos;
CREATE POLICY policy_pagos_finanzas
    ON Pagos
    FOR ALL
    TO rol_finanzas
    USING (true);

/* ==========================================================
   CREACIÓN DE USUARIOS DE PRUEBA Y ASIGNACIÓN DE ROLES
   ========================================================== */
DO $$
BEGIN
    -- Director (Laura Torres) - Todos los privilegios
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-13999999') THEN
        CREATE USER "V-13999999" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador, rol_rrhh, rol_finanzas, rol_infraestructura TO "V-13999999";

    -- Funcionario Caja (Pedro Ramirez) - Finanzas
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-10888888') THEN
        CREATE USER "V-10888888" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador, rol_finanzas TO "V-10888888";

    -- Funcionario Oficina (Sofia Blanco) - Infraestructura / RRHH
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-12444444') THEN
        CREATE USER "V-12444444" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador, rol_infraestructura, rol_rrhh TO "V-12444444";

    -- Estudiante Becario (Carlos Rodriguez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-20222222') THEN
        CREATE USER "V-20222222" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-20222222";

    -- Profesor (Jose Gonzalez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-06666666') THEN
        CREATE USER "V-06666666" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-06666666";

    -- Funcionaria Seguridad (Andrea Salazar) - Solo Operador
    -- (no existe un rol_seguridad dedicado; igual que Caja/Oficina/Secretaria,
    -- las acciones reales de la app pasan por el pool de la app, no por este
    -- usuario de Postgres, que solo se usa para validar la contrasena en login)
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-11555555') THEN
        CREATE USER "V-11555555" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-11555555";

    -- Estudiante (Maria Perez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-20111111') THEN
        CREATE USER "V-20111111" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-20111111";

    -- Estudiante (Valentina Diaz) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-20555555') THEN
        CREATE USER "V-20555555" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-20555555";

    -- Becaria (Ana Martinez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-20333333') THEN
        CREATE USER "V-20333333" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-20333333";

    -- Preparador (Luis Hernandez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-20444444') THEN
        CREATE USER "V-20444444" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-20444444";

    -- Profesora (Carmen Flores) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-07777777') THEN
        CREATE USER "V-07777777" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-07777777";

    -- Egresado (Roberto Castillo) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-17101010') THEN
        CREATE USER "V-17101010" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-17101010";

    -- Egresada (Patricia Lopez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-18202020') THEN
        CREATE USER "V-18202020" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-18202020";

    -- Egresado (Miguel Sanchez) - Solo Operador
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'V-16303030') THEN
        CREATE USER "V-16303030" WITH PASSWORD '1234';
    END IF;
    GRANT rol_operador TO "V-16303030";
END
$$;
