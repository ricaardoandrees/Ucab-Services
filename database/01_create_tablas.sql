/* ============================================================
   UCAB-SERVICES - SCRIPT DE CREACIÓN DE TABLAS
   PostgreSQL
============================================================ */

CREATE TABLE Miembro (
    CI VARCHAR(15) NOT NULL,
    correo VARCHAR(50) NOT NULL UNIQUE CHECK (correo LIKE '%@ucab%'),
    estado_de_cuenta VARCHAR(15) CHECK (estado_de_cuenta IN ('Activa', 'Suspendida', 'Bloqueada')),
    fecha_nacimiento DATE,
    primer_nombre VARCHAR(20) NOT NULL,
    primer_apellido VARCHAR(20) NOT NULL,
    segundo_nombre VARCHAR(20),
    segundo_apellido VARCHAR(20),
    ult_fecha_cambio TIMESTAMP,
    num_personal VARCHAR(15),
    calle1 VARCHAR(70) NOT NULL,
    estado VARCHAR(25) NOT NULL,
    residencia VARCHAR(30) NOT NULL,
    saldo_virtual NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (saldo_virtual >= 0),
    sexo VARCHAR(1) NOT NULL CHECK (sexo IN ('M','F')),

    CONSTRAINT PK_MIEMBRO PRIMARY KEY (CI)
);

CREATE TABLE Egresado (
    CI VARCHAR(15) NOT NULL,
    indice_final NUMERIC(4,2) NOT NULL,
    titulo VARCHAR(20) NOT NULL,
    ano_graduacion INT NOT NULL,

    CONSTRAINT PK_EGRESADO PRIMARY KEY (CI),
    CONSTRAINT FK_EGRESADO_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE Estudiante (
    CI VARCHAR(15) NOT NULL,
    promedio_ponderado NUMERIC(4,2) NOT NULL,
    Escuela VARCHAR(20) NOT NULL,
    semestre_actual INT NOT NULL,
    UC_aprobadas INT NOT NULL,
    Facultad VARCHAR(20) NOT NULL,

    CONSTRAINT PK_ESTUDIANTE PRIMARY KEY (CI),
    CONSTRAINT FK_ESTUDIANTE_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE Becario (
    CI VARCHAR(15) NOT NULL,
    tipo_beca VARCHAR(20) NOT NULL CHECK (tipo_beca IN ('Comedor','Excelencia','Ayuda Economica')),
    estatus_beneficio VARCHAR(10) NOT NULL CHECK (estatus_beneficio IN ('Activo','Inactivo')),
    cumplimiento_indice BOOLEAN NOT NULL,

    CONSTRAINT PK_BECARIO PRIMARY KEY (CI),
    CONSTRAINT FK_BECARIO_ESTUDIANTE FOREIGN KEY (CI) REFERENCES Estudiante(CI) ON DELETE CASCADE
);

CREATE TABLE Preparador (
    CI VARCHAR(15) NOT NULL,
    asignatura VARCHAR(20) NOT NULL,
    horas INT NOT NULL,

    CONSTRAINT PK_PREPARADOR PRIMARY KEY (CI),
    CONSTRAINT FK_PREPARADOR_ESTUDIANTE FOREIGN KEY (CI) REFERENCES Estudiante(CI) ON DELETE CASCADE
);

CREATE TABLE Profesor (
    CI VARCHAR(15) NOT NULL,
    carga_horaria INT NOT NULL,
    escalafon VARCHAR(100) NOT NULL,
    cod_investigador INT,

    CONSTRAINT PK_PROFESOR PRIMARY KEY (CI),
    CONSTRAINT FK_PROFESOR_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE PersonalAdministrativo (
    CI VARCHAR(15) NOT NULL,
    adscripcion_presupuestaria VARCHAR(25) NOT NULL,
    cargo VARCHAR(20) NOT NULL,
    carga_semanal INT,

    CONSTRAINT PK_PERSONALADMINISTRATIVO PRIMARY KEY (CI),
    CONSTRAINT FK_PERSONALADMINISTRATIVO_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE Sesion (
    fecha_inicio TIMESTAMP NOT NULL,
    uid_dispositivo VARCHAR(40) NOT NULL,
    CI VARCHAR(15) NOT NULL,
    geolocalizacion VARCHAR(80),
    intentos_fallidos INT,
    MFA VARCHAR(10),

    CONSTRAINT PK_SESION PRIMARY KEY (fecha_inicio, uid_dispositivo, CI),
    CONSTRAINT FK_SESION_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE PeriodoVinculacion (
    Fecha_Inicio TIMESTAMP NOT NULL,
    Fecha_Fin TIMESTAMP,
    CI VARCHAR(15) NOT NULL,
    rol VARCHAR(25),   

    CONSTRAINT PK_PERIODOVINCULACION PRIMARY KEY (Fecha_Inicio, CI),
    CONSTRAINT FK_PERIODOVINCULACION_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE Vehiculo (
    Placa VARCHAR(10) NOT NULL,
    Modelo VARCHAR(20) NOT NULL,
    Color VARCHAR(15) NOT NULL,
    Tipo VARCHAR(15) NOT NULL CHECK (Tipo IN ('Moto','Carro')),
    Ano INT NOT NULL,
    CI VARCHAR(15) NOT NULL,

    CONSTRAINT PK_VEHICULO PRIMARY KEY (Placa),
    CONSTRAINT FK_VEHICULO_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE Beneficiario (
    CI VARCHAR(15) NOT NULL,
    Nombre VARCHAR(30) NOT NULL,
    Parentesco VARCHAR(20) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    estatus_cobertura VARCHAR(15) NOT NULL CHECK (estatus_cobertura IN ('Inhabilitado','Habilitado')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    CI_miembro VARCHAR(15) NOT NULL,
    CONSTRAINT CK_BENEFICIARIO_FECHA_FIN CHECK (fecha_fin IS NULL OR estatus_cobertura = 'Inhabilitado'),

    CONSTRAINT PK_BENEFICIARIO PRIMARY KEY (CI),
    CONSTRAINT FK_BENEFICIARIO_MIEMBRO FOREIGN KEY (CI_miembro) REFERENCES Miembro(CI) ON DELETE CASCADE
);

CREATE TABLE CargaMenor (
    CI VARCHAR(15) NOT NULL,
    centro_educacion_inicial VARCHAR(100),
    esquema_vacunacion VARCHAR(100),

    CONSTRAINT PK_CARGAMENOR PRIMARY KEY (CI),
    CONSTRAINT FK_CARGAMENOR_BENEFICIARIO FOREIGN KEY (CI) REFERENCES Beneficiario(CI) ON DELETE CASCADE
);

CREATE TABLE CargaMayor (
    CI VARCHAR(15) NOT NULL,
    constancia_estudios_uni VARCHAR(100),
    certificado_solteria VARCHAR(100),

    CONSTRAINT PK_CARGAMAYOR PRIMARY KEY (CI),
    CONSTRAINT FK_CARGAMAYOR_BENEFICIARIO FOREIGN KEY (CI) REFERENCES Beneficiario(CI) ON DELETE CASCADE
);

CREATE TABLE EntidadPrestadora (
    ID_EP INT NOT NULL,

    CONSTRAINT PK_ENTIDADPRESTADORA PRIMARY KEY (ID_EP)
);

CREATE TABLE EntidadInterna (
    codigo INT NOT NULL,
    director_oficina VARCHAR(20) NOT NULL,
    nombre VARCHAR(25) NOT NULL,
    tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('Facultad','Direccion')),
    ID_EP INT,

    CONSTRAINT PK_ENTIDADINTERNA PRIMARY KEY (codigo, director_oficina),
    CONSTRAINT FK_ENTIDADINTERNA_ENTIDADPRESTADORA FOREIGN KEY (ID_EP) REFERENCES EntidadPrestadora(ID_EP) ON DELETE CASCADE
);

CREATE TABLE EntidadExterna (
    RIF VARCHAR(20) NOT NULL,
    razon_social VARCHAR(20) NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Concesionario','Aliado Comercial')),
    ID_EP INT,

    CONSTRAINT PK_ENTIDADEXTERNA PRIMARY KEY (RIF),
    CONSTRAINT FK_ENTIDADEXTERNA_ENTIDADPRESTADORA FOREIGN KEY (ID_EP) REFERENCES EntidadPrestadora(ID_EP) ON DELETE CASCADE
);

CREATE TABLE Contactos (
    Nombre VARCHAR(25) NOT NULL,
    numero_tlf VARCHAR(20) NOT NULL,
    RIF VARCHAR(20) NOT NULL,

    CONSTRAINT PK_CONTACTOS PRIMARY KEY (Nombre, numero_tlf, RIF),
    CONSTRAINT FK_CONTACTOS_ENTIDADEXTERNA FOREIGN KEY (RIF) REFERENCES EntidadExterna(RIF) ON DELETE CASCADE
);

CREATE TABLE OfertaLaboral (
    Fecha_Oferta TIMESTAMP NOT NULL,
    cargo VARCHAR(20) NOT NULL,
    RIF VARCHAR(20) NOT NULL,
    responsabilidades VARCHAR(150) NOT NULL,
    perfil_buscado VARCHAR(150) NOT NULL,
    beneficios VARCHAR(150) NOT NULL,
    estatus VARCHAR(15) NOT NULL CHECK (estatus IN ('Finalizada','Disponible')),

    CONSTRAINT PK_OFERTALABORAL PRIMARY KEY (Fecha_Oferta, cargo, RIF),
    CONSTRAINT FK_OFERTALABORAL_ENTIDADEXTERNA FOREIGN KEY (RIF) REFERENCES EntidadExterna(RIF) ON DELETE CASCADE
);

CREATE TABLE Postula (
    CI VARCHAR(15) NOT NULL,
    Fecha_Oferta TIMESTAMP NOT NULL,
    cargo VARCHAR(20) NOT NULL,
    RIF VARCHAR(20) NOT NULL,

    CONSTRAINT PK_POSTULA PRIMARY KEY (CI, RIF, cargo, Fecha_Oferta),
    CONSTRAINT FK_POSTULA_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI),
    CONSTRAINT FK_POSTULA_OFERTALABORAL FOREIGN KEY (Fecha_Oferta, cargo, RIF) REFERENCES OfertaLaboral(Fecha_Oferta, cargo, RIF)
);

CREATE TABLE Voluntariado (
    nombre VARCHAR(25) NOT NULL,
    ID_EP INT NOT NULL,
    descripcion VARCHAR(250) NOT NULL,
    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP,
    estado VARCHAR(15) NOT NULL CHECK (estado IN ('Abierto','Cerrado','Finalizado')),
    CONSTRAINT CK_VOLUNTARIADO_FECHAS CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),

    CONSTRAINT PK_VOLUNTARIADO PRIMARY KEY (nombre),
    CONSTRAINT FK_VOLUNTARIADO_ENTIDADPRESTADORA FOREIGN KEY (ID_EP) REFERENCES EntidadPrestadora(ID_EP)
);

CREATE TABLE Inscribe (
    CI VARCHAR(15) NOT NULL,
    nombre VARCHAR(25) NOT NULL,

    CONSTRAINT PK_INSCRIBE PRIMARY KEY (CI, nombre),
    CONSTRAINT FK_INSCRIBE_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI),
    CONSTRAINT FK_INSCRIBE_VOLUNTARIADO FOREIGN KEY (nombre) REFERENCES Voluntariado(nombre)
);

CREATE TABLE CategoriaServicio (
    Nombre VARCHAR(20) NOT NULL,

    CONSTRAINT PK_CATEGORIASERVICIO PRIMARY KEY (Nombre)
);

CREATE TABLE Servicio (
    nombre VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    requisitos VARCHAR(200),
    descripcion VARCHAR(200) NOT NULL,
    precio_base NUMERIC(10,2) NOT NULL CHECK (precio_base > 0),
    nombre_categoria VARCHAR(20) NOT NULL,
    ID_EP INT NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,

    CONSTRAINT PK_SERVICIO PRIMARY KEY (nombre, numero_servicio),
    CONSTRAINT FK_SERVICIO_CATEGORIA FOREIGN KEY (nombre_categoria) REFERENCES CategoriaServicio(Nombre),
    CONSTRAINT FK_SERVICIO_PRESTADORA FOREIGN KEY (ID_EP) REFERENCES EntidadPrestadora(ID_EP)
);

CREATE TABLE Suplemento (
    concepto VARCHAR(20) NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    precio_unitario NUMERIC(6,2),

    CONSTRAINT PK_SUPLEMENTO PRIMARY KEY (concepto, nombre, numero_servicio),
    CONSTRAINT FK_SUPLEMENTO_SERVICIO FOREIGN KEY (nombre, numero_servicio) REFERENCES Servicio(nombre, numero_servicio) ON DELETE CASCADE
);

CREATE TABLE Publica (
    nombre VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    ID_EP INT NOT NULL,

    CONSTRAINT PK_PUBLICA PRIMARY KEY (nombre, numero_servicio, ID_EP),
    CONSTRAINT FK_PUBLICA_SERVICIO FOREIGN KEY (nombre, numero_servicio) REFERENCES Servicio(nombre, numero_servicio),
    CONSTRAINT FK_PUBLICA_PRESTADORA FOREIGN KEY (ID_EP) REFERENCES EntidadPrestadora(ID_EP)
);

CREATE TABLE Historial_Tarifas (
    fecha_hora_vigencia TIMESTAMP NOT NULL,
    nombre_servicio VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    precio_final NUMERIC(10,2) NOT NULL CHECK (precio_final > 0),
    perfil_solicitante VARCHAR(20) NOT NULL CHECK (perfil_solicitante IN ('Miembro Activo','Egresado','Publico Externo')),

    CONSTRAINT PK_HISTORIAL_TARIFAS PRIMARY KEY (fecha_hora_vigencia, nombre_servicio, numero_servicio, perfil_solicitante),
    CONSTRAINT FK_HISTORIAL_SERVICIO FOREIGN KEY (nombre_servicio, numero_servicio) REFERENCES Servicio(nombre, numero_servicio) ON DELETE CASCADE
);

CREATE TABLE Solicitud (
    fecha_hora_creacion TIMESTAMP NOT NULL,
    CI VARCHAR(15) NOT NULL,
    nombre_servicio VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    estado VARCHAR(15) NOT NULL CHECK (estado IN ('En Proceso','Completada','Cancelada')),
    fecha_hora_finalizado TIMESTAMP,

    CONSTRAINT PK_SOLICITUD PRIMARY KEY (fecha_hora_creacion),
    CONSTRAINT FK_SOLICITUD_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI),
    CONSTRAINT FK_SOLICITUD_SERVICIO FOREIGN KEY (nombre_servicio, numero_servicio) REFERENCES Servicio(nombre, numero_servicio)
);

CREATE TABLE Acompanante (
    documento_identidad VARCHAR(20) NOT NULL,
    nombre VARCHAR(30) NOT NULL,
    fecha_hora_creacion TIMESTAMP NOT NULL,

    CONSTRAINT PK_ACOMPANANTE PRIMARY KEY (documento_identidad, fecha_hora_creacion),
    CONSTRAINT FK_ACOMPANANTE_SOLICITUD FOREIGN KEY (fecha_hora_creacion) REFERENCES Solicitud(fecha_hora_creacion) ON DELETE CASCADE
);

CREATE TABLE Paso_Actividad (
    numero_paso INT NOT NULL,
    fecha_hora_creacion_solicitud TIMESTAMP NOT NULL,
    estado VARCHAR(15) NOT NULL CHECK (estado IN ('Pendiente','Completado')),
    descripcion VARCHAR(200) NOT NULL,
    CI VARCHAR(15) NOT NULL,
    fecha_hora_finalizado TIMESTAMP,

    CONSTRAINT PK_PASO_ACTIVIDAD PRIMARY KEY (numero_paso, fecha_hora_creacion_solicitud),
    CONSTRAINT FK_PASO_SOLICITUD FOREIGN KEY (fecha_hora_creacion_solicitud) REFERENCES Solicitud(fecha_hora_creacion) ON DELETE CASCADE,
    CONSTRAINT FK_PASO_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI)
);

CREATE TABLE Sede (
    nombre VARCHAR(50) NOT NULL,
    ubicacion VARCHAR(50) NOT NULL,

    CONSTRAINT PK_SEDE PRIMARY KEY (nombre)
);

-- Servicio se crea antes que Sede en este script; el FK se agrega aqui
-- porque Sede ya existe en este punto (referencia hacia adelante).
ALTER TABLE Servicio
    ADD CONSTRAINT FK_SERVICIO_SEDE FOREIGN KEY (nombre_sede) REFERENCES Sede(nombre);

CREATE TABLE Edificacion (
    nombre VARCHAR(50) NOT NULL,
    direccion_exacta VARCHAR(70) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,

    CONSTRAINT PK_EDIFICACION PRIMARY KEY (nombre, direccion_exacta, nombre_sede),
    CONSTRAINT FK_EDIFICACION_SEDE FOREIGN KEY (nombre_sede) REFERENCES Sede(nombre) ON DELETE CASCADE
);

CREATE TABLE EspacioFisico (
    numero INT NOT NULL,
    nombre_edif VARCHAR(50) NOT NULL,
    direccion_exacta VARCHAR(70) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,
    capacidad_max INT NOT NULL CHECK (capacidad_max > 0),
    disponibilidad VARCHAR(15) NOT NULL CHECK (disponibilidad IN ('Disponible','No Disponible')),

    CONSTRAINT PK_ESPACIO_FISICO PRIMARY KEY (numero, nombre_edif, direccion_exacta, nombre_sede),
    CONSTRAINT FK_ESPACIO_EDIFICACION FOREIGN KEY (nombre_edif, direccion_exacta, nombre_sede) REFERENCES Edificacion(nombre, direccion_exacta, nombre_sede) ON DELETE CASCADE
);

CREATE TABLE Recursos (
    numero INT NOT NULL,
    nombre_espacio_fisico VARCHAR(50) NOT NULL,
    direccion_exacta VARCHAR(70) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,
    recurso VARCHAR(50) NOT NULL,

    CONSTRAINT PK_RECURSOS PRIMARY KEY (numero, nombre_espacio_fisico, direccion_exacta, nombre_sede, recurso),
    CONSTRAINT FK_RECURSOS_ESPACIOFISICO FOREIGN KEY (numero, nombre_espacio_fisico, direccion_exacta, nombre_sede) REFERENCES EspacioFisico(numero, nombre_edif, direccion_exacta, nombre_sede) ON DELETE CASCADE
);

CREATE TABLE Ajusta (
    nombre_categoria VARCHAR(20) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,
    aumento NUMERIC(5,2) NOT NULL,
    maximo_limite NUMERIC(10,2) NOT NULL,
    minimo_limite NUMERIC(10,2) NOT NULL CHECK (minimo_limite < maximo_limite),

    CONSTRAINT PK_AJUSTA PRIMARY KEY (nombre_categoria, nombre_sede),
    CONSTRAINT FK_AJUSTA_CATEGORIA FOREIGN KEY (nombre_categoria) REFERENCES CategoriaServicio(Nombre),
    CONSTRAINT FK_AJUSTA_SEDE FOREIGN KEY (nombre_sede) REFERENCES Sede(nombre)
);

CREATE TABLE Estacionamiento (
    nombre VARCHAR(50) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,
    capacidad_maxima INT NOT NULL CHECK (capacidad_maxima > 0),
    ubicacion VARCHAR(100) NOT NULL,

    CONSTRAINT PK_ESTACIONAMIENTO PRIMARY KEY (nombre, nombre_sede),
    CONSTRAINT FK_ESTACIONAMIENTO_SEDE FOREIGN KEY (nombre_sede) REFERENCES Sede(nombre) ON DELETE CASCADE
);

CREATE TABLE Puesto_Estacionamiento (
    numero INT NOT NULL,
    nombre_estacionamiento VARCHAR(50) NOT NULL,
    nombre_sede VARCHAR(50) NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('Libre','Ocupado','Reservado','En Mantenimiento')),
    tipo_vehiculo VARCHAR(20) NOT NULL,

    CONSTRAINT PK_PUESTO PRIMARY KEY (numero, nombre_estacionamiento, nombre_sede),
    CONSTRAINT FK_PUESTO_ESTACIONAMIENTO FOREIGN KEY (nombre_estacionamiento, nombre_sede) REFERENCES Estacionamiento(nombre, nombre_sede) ON DELETE CASCADE
);

CREATE TABLE Reserva (
    nombre_servicio VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    fecha_hora TIMESTAMP NOT NULL,
    fecha_hora_creacion_solicitud TIMESTAMP NOT NULL,

    numero_espacio INT,
    nombre_edif VARCHAR(50),
    direccion_exacta VARCHAR(70),
    nombre_sede_espacio VARCHAR(50),

    numero_puesto INT,
    nombre_estacionamiento VARCHAR(50),
    nombre_sede_puesto VARCHAR(50),

    estado VARCHAR(15) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Confirmada','Cancelada')),

    CONSTRAINT PK_RESERVA PRIMARY KEY (nombre_servicio, numero_servicio, fecha_hora),
    CONSTRAINT FK_RESERVA_SERVICIO FOREIGN KEY (nombre_servicio, numero_servicio) REFERENCES Servicio(nombre, numero_servicio),
    CONSTRAINT FK_RESERVA_SOLICITUD FOREIGN KEY (fecha_hora_creacion_solicitud) REFERENCES Solicitud(fecha_hora_creacion),
    CONSTRAINT FK_RESERVA_ESPACIO FOREIGN KEY (numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio) REFERENCES EspacioFisico(numero, nombre_edif, direccion_exacta, nombre_sede),
    CONSTRAINT FK_RESERVA_PUESTO FOREIGN KEY (numero_puesto, nombre_estacionamiento, nombre_sede_puesto) REFERENCES Puesto_Estacionamiento(numero, nombre_estacionamiento, nombre_sede),
    CONSTRAINT CK_RESERVA_XOR CHECK (
        (numero_espacio IS NOT NULL AND numero_puesto IS NULL) OR
        (numero_espacio IS NULL AND numero_puesto IS NOT NULL)
    )
);

CREATE TABLE Folio_Consumo (
    fecha_hora_apertura TIMESTAMP NOT NULL,
    fecha_hora_creacion_solicitud TIMESTAMP NOT NULL,
    estado VARCHAR(10) NOT NULL CHECK (estado IN ('Abierto','Cerrado')),

    CONSTRAINT PK_FOLIO_CONSUMO PRIMARY KEY (fecha_hora_apertura, fecha_hora_creacion_solicitud),
    CONSTRAINT FK_FOLIO_SOLICITUD FOREIGN KEY (fecha_hora_creacion_solicitud) REFERENCES Solicitud(fecha_hora_creacion) ON DELETE CASCADE
);

CREATE TABLE Item_Consumo (
    concepto VARCHAR(100) NOT NULL,
    fecha_hora_item TIMESTAMP NOT NULL,
    fecha_hora_apertura TIMESTAMP NOT NULL,
    fecha_hora_creacion_solicitud TIMESTAMP NOT NULL,
    fecha_hora_vigencia TIMESTAMP NOT NULL,
    nombre_servicio VARCHAR(50) NOT NULL,
    numero_servicio INT NOT NULL,
    perfil_solicitante VARCHAR(20) NOT NULL CHECK (perfil_solicitante IN ('Miembro Activo','Egresado','Publico Externo')),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario > 0),
    impuestos NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (impuestos >= 0),

    CONSTRAINT PK_ITEM_CONSUMO PRIMARY KEY (concepto, fecha_hora_item, fecha_hora_apertura, fecha_hora_creacion_solicitud),
    CONSTRAINT FK_ITEM_FOLIO FOREIGN KEY (fecha_hora_apertura, fecha_hora_creacion_solicitud) REFERENCES Folio_Consumo(fecha_hora_apertura, fecha_hora_creacion_solicitud) ON DELETE CASCADE,
    CONSTRAINT FK_ITEM_HISTORIAL FOREIGN KEY (fecha_hora_vigencia, nombre_servicio, numero_servicio, perfil_solicitante) REFERENCES Historial_Tarifas(fecha_hora_vigencia, nombre_servicio, numero_servicio, perfil_solicitante)
);

CREATE TABLE Factura (
    numero_de_control INT NOT NULL,
    estado VARCHAR(25) NOT NULL CHECK (estado IN ('Pendiente','Parcialmente Pagada','Pagada')),
    monto_total NUMERIC(10,2) NOT NULL CHECK (monto_total > 0),
    fecha_de_emision TIMESTAMP NOT NULL,
    fecha_hora_apertura TIMESTAMP NOT NULL,
    fecha_hora_creacion_solicitud TIMESTAMP NOT NULL,
    RIF VARCHAR(20),
    CI VARCHAR(15),

    CONSTRAINT PK_FACTURA PRIMARY KEY (numero_de_control),
    CONSTRAINT FK_FACTURA_FOLIO FOREIGN KEY (fecha_hora_apertura, fecha_hora_creacion_solicitud) REFERENCES Folio_Consumo(fecha_hora_apertura, fecha_hora_creacion_solicitud),
    CONSTRAINT FK_FACTURA_EXTERNA FOREIGN KEY (RIF) REFERENCES EntidadExterna(RIF),
    CONSTRAINT FK_FACTURA_MIEMBRO FOREIGN KEY (CI) REFERENCES Miembro(CI),
    CONSTRAINT CK_FACTURA_XOR CHECK (
        (RIF IS NOT NULL AND CI IS NULL) OR
        (RIF IS NULL AND CI IS NOT NULL)
    )
);

CREATE TABLE Tasa (
    Fecha DATE NOT NULL,
    Moneda VARCHAR(10) NOT NULL,
    monto NUMERIC(6,2) NOT NULL CHECK (monto > 0),

    CONSTRAINT PK_TASA PRIMARY KEY (Fecha, Moneda)
);

CREATE TABLE Pagos (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL CHECK (monto > 0),
    numero_de_control INT NOT NULL,
    Fecha_Tasa DATE,
    Moneda_Tasa VARCHAR(10),

    CONSTRAINT PK_PAGOS PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_PAGOS_FACTURA FOREIGN KEY (numero_de_control) REFERENCES Factura(numero_de_control),
    CONSTRAINT FK_PAGOS_TASA FOREIGN KEY (Fecha_Tasa, Moneda_Tasa) REFERENCES Tasa(Fecha, Moneda),
    CONSTRAINT CK_PAGOS_TASA_XOR CHECK (
        (Fecha_Tasa IS NULL AND Moneda_Tasa IS NULL) OR
        (Fecha_Tasa IS NOT NULL AND Moneda_Tasa IS NOT NULL)
    )
);

CREATE TABLE Pago_Presencial (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,

    CONSTRAINT PK_PAGO_PRESENCIAL PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_PRESENCIAL_PAGOS FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pagos(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Pago_Digital (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,

    CONSTRAINT PK_PAGO_DIGITAL PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_DIGITAL_PAGOS FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pagos(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Zelle (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    correo_electronico_origen VARCHAR(100) NOT NULL,
    codigo_confirmacion VARCHAR(50) NOT NULL,
    nombre_titular VARCHAR(100) NOT NULL,

    CONSTRAINT PK_ZELLE PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_ZELLE_DIGITAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Digital(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Crypto (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    direccion_billetera VARCHAR(100) NOT NULL,
    TXID VARCHAR(100) NOT NULL,
    red VARCHAR(10) NOT NULL CHECK (red IN ('TRC20','ERC20')),

    CONSTRAINT PK_CRYPTO PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_CRYPTO_DIGITAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Digital(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Tarjeta (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('Credito','Debito')),
    red VARCHAR(15) NOT NULL CHECK (red IN ('Nacional','Internacional')),
    num_tarjeta VARCHAR(20) NOT NULL UNIQUE,
    fecha_vencimiento DATE NOT NULL,
    compania VARCHAR(30) NOT NULL,

    CONSTRAINT PK_TARJETA PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_TARJETA_PRESENCIAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Presencial(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE PagoMovil (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    numero_referencia VARCHAR(30) NOT NULL UNIQUE,
    banco_emisor VARCHAR(50) NOT NULL,

    CONSTRAINT PK_PAGOMOVIL PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_PAGOMOVIL_PRESENCIAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Presencial(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE TAI (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    UID VARCHAR(50) NOT NULL UNIQUE,
    POS VARCHAR(30) NOT NULL,

    CONSTRAINT PK_TAI PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_TAI_PRESENCIAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Presencial(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Efectivo (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    moneda VARCHAR(15) NOT NULL CHECK (moneda IN ('Bolivares','Dolares','Euros')),
    monto_recibido NUMERIC(10,2) NOT NULL CHECK (monto_recibido > 0),

    CONSTRAINT PK_EFECTIVO PRIMARY KEY (fecha_hora_pago, monto),
    CONSTRAINT FK_EFECTIVO_PRESENCIAL FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Pago_Presencial(fecha_hora_pago, monto) ON DELETE CASCADE
);

CREATE TABLE Denominaciones (
    fecha_hora_pago TIMESTAMP NOT NULL,
    monto NUMERIC(10,2) NOT NULL,
    valor_denominacion NUMERIC(10,2) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),

    CONSTRAINT PK_DENOMINACIONES PRIMARY KEY (fecha_hora_pago, monto, valor_denominacion),
    CONSTRAINT FK_DENOMINACIONES_EFECTIVO FOREIGN KEY (fecha_hora_pago, monto) REFERENCES Efectivo(fecha_hora_pago, monto) ON DELETE CASCADE
);
