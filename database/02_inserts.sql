INSERT INTO Miembro (CI, correo, estado_de_cuenta, fecha_nacimiento, primer_nombre, primer_apellido, segundo_nombre, segundo_apellido, ult_fecha_cambio, num_personal, calle1, estado, residencia, saldo_virtual, sexo) VALUES
('V-20111111','maria.perez@ucab.edu.ve','Activa','2002-03-15','Maria','Perez','Jose',NULL,'2026-01-10 09:00:00',NULL,'Av. Libertador, Res. Las Acacias','Miranda','Caracas',25.50,'F'),
('V-20222222','carlos.rodriguez@ucab.edu.ve','Activa','2001-07-22','Carlos','Rodriguez','Eduardo',NULL,'2025-11-05 14:20:00',NULL,'Calle Real de Sabana Grande','Distrito Capital','Caracas',40.00,'M'),
('V-20333333','ana.martinez@ucab.edu.ve','Activa','2003-01-30','Ana','Martinez',NULL,'Gonzalez','2026-02-01 10:00:00',NULL,'Urb. Los Palos Grandes','Miranda','Caracas',15.75,'F'),
('V-20444444','luis.hernandez@ucab.edu.ve','Activa','2002-09-10','Luis','Hernandez','Alberto',NULL,'2025-12-15 08:30:00',NULL,'Av. Francisco de Miranda','Miranda','Caracas',0.00,'M'),
('V-20555555','valentina.diaz@ucab.edu.ve','Suspendida','2002-05-05','Valentina','Diaz',NULL,NULL,'2025-08-20 16:45:00',NULL,'Urb. La Florida','Distrito Capital','Caracas',5.00,'F'),
('V-15666666','jose.gonzalez@ucab.edu.ve','Activa','1978-04-12','Jose','Gonzalez','Ramon',NULL,'2025-10-01 11:00:00','PROF-001','Av. Universidad','Distrito Capital','Caracas',10.00,'M'),
('V-15777777','carmen.flores@ucab.edu.ve','Activa','1980-11-25','Carmen','Flores',NULL,'Diaz','2025-09-15 09:30:00','PROF-002','Urb. Bello Monte','Distrito Capital','Caracas',8.50,'F'),
('V-12888888','pedro.ramirez@ucab.edu.ve','Activa','1985-02-18','Pedro','Ramirez',NULL,NULL,'2025-07-10 13:15:00','ADM-001','Av. Roosevelt','Distrito Capital','Caracas',12.00,'M'),
('V-12999999','laura.torres@ucab.edu.ve','Activa','1990-06-30','Laura','Torres','Isabel',NULL,'2025-06-01 10:45:00','ADM-002','Urb. Chacao','Miranda','Caracas',20.00,'F'),
('V-10101010','roberto.castillo@ucab.edu.ve','Activa','1995-03-08','Roberto','Castillo',NULL,'Mendoza','2025-05-20 15:00:00',NULL,'Av. Andres Bello','Distrito Capital','Caracas',0.00,'M'),
('V-10202020','patricia.lopez@ucab.edu.ve','Activa','1996-08-14','Patricia','Lopez',NULL,NULL,'2025-04-10 12:00:00',NULL,'Urb. El Rosal','Distrito Capital','Caracas',0.00,'F'),
('V-10303030','miguel.sanchez@ucab.edu.ve','Activa','1994-12-01','Miguel','Sanchez','Angel',NULL,'2025-03-05 09:00:00',NULL,'Av. Casanova','Distrito Capital','Caracas',0.00,'M');

INSERT INTO Egresado (CI, indice_final, titulo, ano_graduacion) VALUES
('V-10101010',16.50,'Ing. Informatico',2024),
('V-10202020',17.20,'Lic. Administracion',2023),
('V-10303030',15.80,'Ingeniero Civil',2022);

INSERT INTO Estudiante (CI, promedio_ponderado, Escuela, semestre_actual, UC_aprobadas, Facultad) VALUES
('V-20111111',16.00,'Informatica',6,110,'Ingenieria'),
('V-20222222',17.50,'Informatica',8,145,'Ingenieria'),
('V-20333333',18.20,'Comunicacion Social',5,95,'Humanidades'),
('V-20444444',15.30,'Derecho',7,130,'Ciencias Juridicas'),
('V-20555555',14.00,'Economia',4,70,'Ciencias Economicas');

INSERT INTO Becario (CI, tipo_beca, estatus_beneficio, cumplimiento_indice) VALUES
('V-20222222','Excelencia','Activo',TRUE),
('V-20333333','Ayuda Economica','Activo',TRUE);

INSERT INTO Preparador (CI, asignatura, horas) VALUES
('V-20444444','Programacion I',8);

INSERT INTO Profesor (CI, carga_horaria, escalafon, cod_investigador) VALUES
('V-15666666',16,'Asociado',2024001),
('V-15777777',12,'Titular',NULL);

INSERT INTO PersonalAdministrativo (CI, adscripcion_presupuestaria, cargo, carga_semanal) VALUES
('V-12888888','Direccion de Finanzas','Analista Financiero',40),
('V-12999999','Secretaria General','Coordinadora Admin.',40);

INSERT INTO Sesion (fecha_inicio, uid_dispositivo, CI, geolocalizacion, intentos_fallidos, MFA) VALUES
('2026-06-01 08:15:00','DEV-A1B2C3','V-20111111','Caracas, Venezuela',0,'Activo'),
('2026-06-08 09:30:00','DEV-A1B2C3','V-20111111','Caracas, Venezuela',0,'Activo'),
('2026-06-02 14:10:00','DEV-D4E5F6','V-20222222','Caracas, Venezuela',1,'Inactivo'),
('2026-06-09 10:00:00','DEV-D4E5F6','V-20222222','Caracas, Venezuela',0,'Inactivo'),
('2026-06-03 07:45:00','DEV-G7H8I9','V-20333333','Caracas, Venezuela',0,'Activo'),
('2026-06-04 16:20:00','DEV-J1K2L3','V-20444444','Caracas, Venezuela',2,'Inactivo'),
('2026-06-05 11:05:00','DEV-M4N5O6','V-20555555','Caracas, Venezuela',3,'Inactivo'),
('2026-06-06 09:00:00','DEV-P7Q8R9','V-15666666','Caracas, Venezuela',0,'Activo'),
('2026-06-07 13:30:00','DEV-S1T2U3','V-15777777','Caracas, Venezuela',0,'Activo'),
('2026-06-01 10:45:00','DEV-V4W5X6','V-12888888','Caracas, Venezuela',0,'Activo'),
('2026-06-02 08:00:00','DEV-Y7Z8A9','V-12999999','Caracas, Venezuela',0,'Activo'),
('2026-05-15 09:10:00','DEV-B1C2D3','V-10101010','Caracas, Venezuela',0,'Inactivo'),
('2026-05-16 09:10:00','DEV-E4F5G6','V-10202020','Caracas, Venezuela',0,'Inactivo'),
('2026-05-17 09:10:00','DEV-H7I8J9','V-10303030','Caracas, Venezuela',0,'Inactivo');

INSERT INTO PeriodoVinculacion (Fecha_Inicio, Fecha_Fin, CI) VALUES
('2022-09-01 00:00:00',NULL,'V-20111111'),
('2021-09-01 00:00:00',NULL,'V-20222222'),
('2023-03-01 00:00:00',NULL,'V-20333333'),
('2021-03-01 00:00:00',NULL,'V-20444444'),
('2022-03-01 00:00:00','2025-12-15 00:00:00','V-20555555'),
('2010-01-15 00:00:00',NULL,'V-15666666'),
('2008-09-01 00:00:00',NULL,'V-15777777'),
('2015-06-01 00:00:00',NULL,'V-12888888'),
('2018-02-01 00:00:00',NULL,'V-12999999'),
('2018-09-01 00:00:00','2024-07-15 00:00:00','V-10101010'),
('2017-09-01 00:00:00','2023-07-15 00:00:00','V-10202020'),
('2016-09-01 00:00:00','2022-07-15 00:00:00','V-10303030');

INSERT INTO Vehiculo (Placa, Modelo, Color, Tipo, Ano, CI) VALUES
('ABC-123','Toyota Corolla','Blanco','Carro',2020,'V-20111111'),
('XYZ-789','Honda Civic','Gris','Carro',2019,'V-15666666'),
('DEF-456','Yamaha YBR','Negro','Moto',2021,'V-12888888'),
('GHI-321','Chevrolet Aveo','Azul','Carro',2018,'V-10202020');

INSERT INTO Beneficiario (CI, Nombre, Parentesco, fecha_nacimiento, estatus_cobertura, fecha_inicio, fecha_fin, CI_miembro) VALUES
('V-30111111','Sofia Gonzalez','Hija','2020-05-01','Habilitado','2020-06-01',NULL,'V-15666666'),
('V-30222222','Mateo Flores','Hijo','2021-09-15','Habilitado','2021-10-01',NULL,'V-15777777'),
('V-08111111','Rosa Ramirez','Esposa','1986-01-10','Habilitado','2010-01-01',NULL,'V-12888888'),
('V-09222222','Daniel Torres','Esposo','1988-03-20','Habilitado','2015-05-05',NULL,'V-12999999');

INSERT INTO CargaMenor (CI, centro_educacion_inicial, esquema_vacunacion) VALUES
('V-30111111','Centro de Educacion Inicial Sucre','Completo'),
('V-30222222','Jardin Infantil Mi Pequeno Mundo','Completo');

INSERT INTO CargaMayor (CI, constancia_estudios_uni, certificado_solteria) VALUES
('V-08111111',NULL,NULL),
('V-09222222',NULL,NULL);

INSERT INTO EntidadPrestadora (ID_EP) VALUES
(1),(2),(3),(4),(5),(6),(7),(8);

INSERT INTO EntidadInterna (codigo, director_oficina, nombre, tipo, ID_EP) VALUES
(101,'Decanato Ingenieria','Facultad de Ingenieria','Facultad',1),
(201,'Direccion de Cultura','Direccion de Cultura','Direccion',2),
(202,'Dir. de Deportes','Direccion Deportes','Direccion',3),
(203,'Dir. Salud Estud.','Centro de Salud Univ.','Direccion',4),
(204,'Dir. Infraestruct.','Dir. Infraestruct.','Direccion',8);

INSERT INTO EntidadExterna (RIF, razon_social, fecha_vencimiento, tipo, ID_EP) VALUES
('J-12345678-9','Lab. La Sante C.A.','2027-12-31','Aliado Comercial',5),
('J-23456789-0','Banco Mercantil C.A.','2028-06-30','Aliado Comercial',6),
('J-34567890-1','Cafeteria UCAB C.A.','2026-09-15','Concesionario',7);

INSERT INTO Contactos (Nombre, numero_tlf, RIF) VALUES
('Maria Fernandez','0212-5551234','J-12345678-9'),
('Jose Lugo','0212-5555678','J-23456789-0'),
('Ana Soto','0212-5559012','J-34567890-1');

INSERT INTO OfertaLaboral (Fecha_Oferta, cargo, RIF, responsabilidades, perfil_buscado, beneficios, estatus) VALUES
('2026-04-01 09:00:00','Analista Compensac.','J-12345678-9','Analisis de nomina y beneficios','Egresado de Administracion o afines','Seguro HCM, bono anual','Disponible'),
('2026-04-05 10:00:00','Ing. Sist. Junior','J-23456789-0','Soporte de infraestructura bancaria','Egresado de Ingenieria Informatica','Seguro HCM, ticket alimentacion','Disponible'),
('2026-03-01 08:00:00','Cajero','J-34567890-1','Atencion al cliente en cafeteria','Estudiante activo, disponibilidad horaria','Comidas incluidas','Finalizada');

INSERT INTO Postula (CI, Fecha_Oferta, cargo, RIF) VALUES
('V-10101010','2026-04-05 10:00:00','Ing. Sist. Junior','J-23456789-0'),
('V-10202020','2026-04-01 09:00:00','Analista Compensac.','J-12345678-9'),
('V-20444444','2026-03-01 08:00:00','Cajero','J-34567890-1');

INSERT INTO Voluntariado (nombre, ID_EP, descripcion, fecha_inicio, fecha_fin, estado) VALUES
('Jornada de Reforestacion',2,'Plantacion de arboles en zonas verdes del campus','2026-07-01 08:00:00','2026-07-01 12:00:00','Abierto'),
('Banco de Alimentos UCAB',2,'Recoleccion y distribucion de alimentos a comunidades cercanas','2026-06-20 09:00:00','2026-06-20 14:00:00','Cerrado'),
('Tutoria Escolar Comunit.',1,'Apoyo academico a ninos de comunidades vecinas','2026-05-01 08:00:00','2026-05-30 12:00:00','Finalizado');

INSERT INTO Inscribe (CI, nombre) VALUES
('V-20111111','Jornada de Reforestacion'),
('V-20333333','Jornada de Reforestacion'),
('V-20222222','Banco de Alimentos UCAB'),
('V-10101010','Tutoria Escolar Comunit.');

INSERT INTO Sede (nombre, ubicacion) VALUES
('Montalban','Caracas, Distrito Capital'),
('Guayana','Puerto Ordaz, Estado Bolivar');

INSERT INTO CategoriaServicio (Nombre) VALUES
('Salud'),('Educacion Continua'),('Cultura'),('Deporte'),('Estacionamiento');

INSERT INTO Servicio (nombre, numero_servicio, requisitos, descripcion, precio_base, nombre_categoria, ID_EP, nombre_sede) VALUES
('Consulta Medica General',1,'Carnet estudiantil vigente','Consulta con medico general en el centro de salud universitario',25.00,'Salud',4,'Montalban'),
('Examen de Laboratorio',1,'Orden medica','Toma de muestras y examenes de laboratorio clinico',15.00,'Salud',4,'Guayana'),
('Curso de Extension en Python',1,'Ninguno','Curso introductorio de programacion en Python',80.00,'Educacion Continua',1,'Montalban'),
('Diplomado en Gerencia de Proyectos',1,'Titulo universitario','Diplomado de formacion gerencial avanzada',350.00,'Educacion Continua',1,'Guayana'),
('Alquiler de Auditorio Hermano Lanz',1,'Solicitud con 5 dias de anticipacion','Alquiler de auditorio para eventos institucionales o externos',150.00,'Cultura',2,'Montalban'),
('Uso de Cancha Deportiva',1,'Carnet vigente','Reserva de cancha multiuso para actividades deportivas',10.00,'Deporte',3,'Montalban'),
('Clases de Natacion',1,'Certificado medico','Clases grupales de natacion en la piscina universitaria',40.00,'Deporte',3,'Montalban'),
('Reserva de Puesto de Estacionamiento',1,'Vehiculo registrado en la plataforma','Reserva anticipada de un puesto de estacionamiento',5.00,'Estacionamiento',8,'Montalban');

INSERT INTO Suplemento (concepto, nombre, numero_servicio, precio_unitario) VALUES
('Equipo de Sonido','Alquiler de Auditorio Hermano Lanz',1,50.00),
('Servicio Catering','Alquiler de Auditorio Hermano Lanz',1,80.00),
('Alquiler Casillero','Clases de Natacion',1,5.00);

INSERT INTO Publica (nombre, numero_servicio, ID_EP) VALUES
('Consulta Medica General',1,4),
('Examen de Laboratorio',1,4),
('Curso de Extension en Python',1,1),
('Diplomado en Gerencia de Proyectos',1,1),
('Alquiler de Auditorio Hermano Lanz',1,2),
('Uso de Cancha Deportiva',1,3),
('Clases de Natacion',1,3),
('Reserva de Puesto de Estacionamiento',1,8);

INSERT INTO Historial_Tarifas (fecha_hora_vigencia, nombre_servicio, numero_servicio, precio_final, perfil_solicitante) VALUES
('2026-01-01 00:00:00','Consulta Medica General',1,25.0,'Miembro Activo'),
('2026-01-01 00:00:00','Consulta Medica General',1,30.0,'Egresado'),
('2026-01-01 00:00:00','Consulta Medica General',1,37.5,'Publico Externo'),
('2026-01-01 00:00:00','Examen de Laboratorio',1,15.0,'Miembro Activo'),
('2026-01-01 00:00:00','Examen de Laboratorio',1,18.0,'Egresado'),
('2026-01-01 00:00:00','Examen de Laboratorio',1,22.5,'Publico Externo'),
('2026-01-01 00:00:00','Curso de Extension en Python',1,80.0,'Miembro Activo'),
('2026-01-01 00:00:00','Curso de Extension en Python',1,96.0,'Egresado'),
('2026-01-01 00:00:00','Curso de Extension en Python',1,120.0,'Publico Externo'),
('2026-01-01 00:00:00','Diplomado en Gerencia de Proyectos',1,350.0,'Miembro Activo'),
('2026-01-01 00:00:00','Diplomado en Gerencia de Proyectos',1,420.0,'Egresado'),
('2026-01-01 00:00:00','Diplomado en Gerencia de Proyectos',1,525.0,'Publico Externo'),
('2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,150.0,'Miembro Activo'),
('2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,180.0,'Egresado'),
('2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,225.0,'Publico Externo'),
('2026-01-01 00:00:00','Uso de Cancha Deportiva',1,10.0,'Miembro Activo'),
('2026-01-01 00:00:00','Uso de Cancha Deportiva',1,12.0,'Egresado'),
('2026-01-01 00:00:00','Uso de Cancha Deportiva',1,15.0,'Publico Externo'),
('2026-01-01 00:00:00','Clases de Natacion',1,40.0,'Miembro Activo'),
('2026-01-01 00:00:00','Clases de Natacion',1,48.0,'Egresado'),
('2026-01-01 00:00:00','Clases de Natacion',1,60.0,'Publico Externo'),
('2026-01-01 00:00:00','Reserva de Puesto de Estacionamiento',1,5.0,'Miembro Activo'),
('2026-01-01 00:00:00','Reserva de Puesto de Estacionamiento',1,6.0,'Egresado'),
('2026-01-01 00:00:00','Reserva de Puesto de Estacionamiento',1,7.5,'Publico Externo');

INSERT INTO Edificacion (nombre, direccion_exacta, nombre_sede) VALUES
('Edificio de Postgrado','Av. Teheran, Montalban','Montalban'),
('Edificio Cincuentenario','Av. Teheran, Montalban','Montalban'),
('Edificio Administrativo','Av. Guayana, Puerto Ordaz','Guayana'),
('Edificio de Laboratorios','Av. Guayana, Puerto Ordaz','Guayana');

INSERT INTO EspacioFisico (numero, nombre_edif, direccion_exacta, nombre_sede, capacidad_max, disponibilidad) VALUES
(1,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban',250,'Disponible'),
(2,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban',40,'Disponible'),
(1,'Edificio Cincuentenario','Av. Teheran, Montalban','Montalban',30,'Disponible'),
(2,'Edificio Cincuentenario','Av. Teheran, Montalban','Montalban',60,'No Disponible'),
(1,'Edificio Administrativo','Av. Guayana, Puerto Ordaz','Guayana',20,'Disponible'),
(2,'Edificio Administrativo','Av. Guayana, Puerto Ordaz','Guayana',35,'Disponible'),
(1,'Edificio de Laboratorios','Av. Guayana, Puerto Ordaz','Guayana',25,'Disponible'),
(2,'Edificio de Laboratorios','Av. Guayana, Puerto Ordaz','Guayana',25,'Disponible');

INSERT INTO Recursos (numero, nombre_espacio_fisico, direccion_exacta, nombre_sede, recurso) VALUES
(1,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban','Proyector'),
(1,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban','Sistema de Sonido'),
(2,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban','Pizarra Inteligente'),
(1,'Edificio Cincuentenario','Av. Teheran, Montalban','Montalban','Proyector'),
(2,'Edificio Cincuentenario','Av. Teheran, Montalban','Montalban','Aire Acondicionado'),
(1,'Edificio Administrativo','Av. Guayana, Puerto Ordaz','Guayana','Computadoras'),
(2,'Edificio Administrativo','Av. Guayana, Puerto Ordaz','Guayana','Proyector'),
(1,'Edificio de Laboratorios','Av. Guayana, Puerto Ordaz','Guayana','Servidores'),
(2,'Edificio de Laboratorios','Av. Guayana, Puerto Ordaz','Guayana','Microscopios');

INSERT INTO Ajusta (nombre_categoria, nombre_sede, aumento, maximo_limite, minimo_limite) VALUES
('Salud','Montalban',0.00,200.00,20.00),
('Salud','Guayana',-10.00,150.00,15.00),
('Educacion Continua','Montalban',5.00,500.00,50.00),
('Educacion Continua','Guayana',0.00,400.00,40.00),
('Cultura','Montalban',0.00,300.00,30.00),
('Cultura','Guayana',-5.00,250.00,25.00),
('Deporte','Montalban',0.00,60.00,5.00),
('Deporte','Guayana',-5.00,50.00,5.00),
('Estacionamiento','Montalban',0.00,20.00,2.00),
('Estacionamiento','Guayana',0.00,15.00,2.00);

INSERT INTO Estacionamiento (nombre, nombre_sede, capacidad_maxima, ubicacion) VALUES
('Estacionamiento Norte','Montalban',50,'Entrada Norte Campus Montalban'),
('Estacionamiento Guayana','Guayana',30,'Entrada Principal Campus Guayana');

INSERT INTO Puesto_Estacionamiento (numero, nombre_estacionamiento, nombre_sede, estado, tipo_vehiculo) VALUES
(1,'Estacionamiento Norte','Montalban','Ocupado','Carro'),
(2,'Estacionamiento Norte','Montalban','Libre','Carro'),
(3,'Estacionamiento Norte','Montalban','Libre','Moto'),
(4,'Estacionamiento Norte','Montalban','Reservado','Carro'),
(5,'Estacionamiento Norte','Montalban','En Mantenimiento','Carro'),
(1,'Estacionamiento Guayana','Guayana','Libre','Carro'),
(2,'Estacionamiento Guayana','Guayana','Libre','Moto'),
(3,'Estacionamiento Guayana','Guayana','Ocupado','Carro');

INSERT INTO Solicitud (fecha_hora_creacion, CI, nombre_servicio, numero_servicio, estado, fecha_hora_finalizado) VALUES
('2026-05-01 09:00:00','V-20111111','Consulta Medica General',1,'Completada','2026-05-01 10:30:00'),
('2026-05-02 10:15:00','V-20222222','Examen de Laboratorio',1,'Completada','2026-05-02 11:00:00'),
('2026-05-03 14:00:00','V-20333333','Curso de Extension en Python',1,'Completada','2026-05-10 09:00:00'),
('2026-05-04 08:30:00','V-15666666','Diplomado en Gerencia de Proyectos',1,'En Proceso',NULL),
('2026-05-05 16:00:00','V-12999999','Alquiler de Auditorio Hermano Lanz',1,'Completada','2026-05-05 18:00:00'),
('2026-05-06 07:45:00','V-20444444','Uso de Cancha Deportiva',1,'Completada','2026-05-06 09:45:00'),
('2026-05-07 11:20:00','V-20111111','Clases de Natacion',1,'Completada','2026-05-14 12:00:00'),
('2026-05-08 13:10:00','V-10202020','Consulta Medica General',1,'Cancelada',NULL),
('2026-05-09 09:50:00','V-15777777','Uso de Cancha Deportiva',1,'En Proceso',NULL),
('2026-05-10 15:30:00','V-20222222','Clases de Natacion',1,'Completada','2026-05-17 16:00:00'),
('2026-05-11 08:00:00','V-20111111','Reserva de Puesto de Estacionamiento',1,'Completada','2026-05-11 08:10:00');

INSERT INTO Paso_Actividad (numero_paso, fecha_hora_creacion_solicitud, estado, descripcion, CI, fecha_hora_finalizado) VALUES
(1,'2026-05-01 09:00:00','Completado','Verificacion de solvencia en caja','V-12888888','2026-05-01 09:20:00'),
(2,'2026-05-01 09:00:00','Completado','Atencion medica en consultorio','V-15666666','2026-05-01 10:30:00'),
(1,'2026-05-02 10:15:00','Completado','Verificacion de orden medica','V-12888888','2026-05-02 10:30:00'),
(2,'2026-05-02 10:15:00','Completado','Toma de muestra de laboratorio','V-15666666','2026-05-02 11:00:00'),
(1,'2026-05-03 14:00:00','Completado','Inscripcion confirmada en el curso','V-12999999','2026-05-03 15:00:00'),
(2,'2026-05-03 14:00:00','Completado','Finalizacion y emision de certificado','V-12999999','2026-05-10 09:00:00'),
(1,'2026-05-04 08:30:00','Completado','Verificacion de titulo universitario','V-12999999','2026-05-04 10:00:00'),
(2,'2026-05-04 08:30:00','Pendiente','Confirmacion de cupo en el diplomado','V-12999999',NULL),
(1,'2026-05-05 16:00:00','Completado','Verificacion de disponibilidad del auditorio','V-12999999','2026-05-05 16:30:00'),
(2,'2026-05-05 16:00:00','Completado','Confirmacion y cierre del evento','V-12999999','2026-05-05 18:00:00'),
(1,'2026-05-06 07:45:00','Completado','Verificacion de carnet vigente','V-12888888','2026-05-06 08:00:00'),
(2,'2026-05-06 07:45:00','Completado','Uso de cancha confirmado','V-12888888','2026-05-06 09:45:00'),
(1,'2026-05-07 11:20:00','Completado','Verificacion de certificado medico','V-12888888','2026-05-07 11:40:00'),
(2,'2026-05-07 11:20:00','Completado','Finalizacion del ciclo de clases','V-12888888','2026-05-14 12:00:00'),
(1,'2026-05-08 13:10:00','Completado','Solicitud cancelada por el miembro','V-12888888','2026-05-08 13:15:00'),
(1,'2026-05-09 09:50:00','Completado','Verificacion de carnet vigente','V-12888888','2026-05-09 10:05:00'),
(2,'2026-05-09 09:50:00','Pendiente','Confirmacion de horario de cancha','V-12888888',NULL),
(1,'2026-05-10 15:30:00','Completado','Verificacion de certificado medico','V-12888888','2026-05-10 15:45:00'),
(2,'2026-05-10 15:30:00','Completado','Finalizacion del ciclo de clases','V-12888888','2026-05-17 16:00:00'),
(1,'2026-05-11 08:00:00','Completado','Verificacion de vehiculo registrado','V-12999999','2026-05-11 08:10:00');

INSERT INTO Acompanante (documento_identidad, nombre, fecha_hora_creacion) VALUES
('V-40111111','Gabriel Suarez','2026-05-05 16:00:00'),
('V-40222222','Daniela Briceno','2026-05-05 16:00:00');

INSERT INTO Folio_Consumo (fecha_hora_apertura, fecha_hora_creacion_solicitud, estado) VALUES
('2026-05-01 09:00:00','2026-05-01 09:00:00','Cerrado'),
('2026-05-02 10:15:00','2026-05-02 10:15:00','Cerrado'),
('2026-05-03 14:00:00','2026-05-03 14:00:00','Cerrado'),
('2026-05-04 08:30:00','2026-05-04 08:30:00','Abierto'),
('2026-05-05 16:00:00','2026-05-05 16:00:00','Cerrado'),
('2026-05-06 07:45:00','2026-05-06 07:45:00','Cerrado'),
('2026-05-07 11:20:00','2026-05-07 11:20:00','Cerrado'),
('2026-05-09 09:50:00','2026-05-09 09:50:00','Abierto'),
('2026-05-10 15:30:00','2026-05-10 15:30:00','Cerrado'),
('2026-05-11 08:00:00','2026-05-11 08:00:00','Cerrado');

INSERT INTO Item_Consumo (concepto, fecha_hora_item, fecha_hora_apertura, fecha_hora_creacion_solicitud, fecha_hora_vigencia, nombre_servicio, numero_servicio, perfil_solicitante, cantidad, precio_unitario, impuestos) VALUES
('Consulta Medica General','2026-05-01 09:01:00','2026-05-01 09:00:00','2026-05-01 09:00:00','2026-01-01 00:00:00','Consulta Medica General',1,'Miembro Activo',1,25.0,4.0),
('Examen de Laboratorio','2026-05-02 10:16:00','2026-05-02 10:15:00','2026-05-02 10:15:00','2026-01-01 00:00:00','Examen de Laboratorio',1,'Miembro Activo',1,15.0,2.4),
('Curso de Extension en Python','2026-05-03 14:01:00','2026-05-03 14:00:00','2026-05-03 14:00:00','2026-01-01 00:00:00','Curso de Extension en Python',1,'Miembro Activo',1,80.0,12.8),
('Alquiler de Auditorio Hermano Lanz','2026-05-05 16:01:00','2026-05-05 16:00:00','2026-05-05 16:00:00','2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,'Miembro Activo',1,150.0,24.0),
('Equipo de Sonido','2026-05-05 16:02:00','2026-05-05 16:00:00','2026-05-05 16:00:00','2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,'Miembro Activo',1,50.0,8.0),
('Servicio de Catering','2026-05-05 16:03:00','2026-05-05 16:00:00','2026-05-05 16:00:00','2026-01-01 00:00:00','Alquiler de Auditorio Hermano Lanz',1,'Miembro Activo',1,80.0,12.8),
('Uso de Cancha Deportiva','2026-05-06 07:46:00','2026-05-06 07:45:00','2026-05-06 07:45:00','2026-01-01 00:00:00','Uso de Cancha Deportiva',1,'Miembro Activo',1,10.0,1.6),
('Clases de Natacion','2026-05-07 11:21:00','2026-05-07 11:20:00','2026-05-07 11:20:00','2026-01-01 00:00:00','Clases de Natacion',1,'Miembro Activo',1,40.0,6.4),
('Clases de Natacion','2026-05-10 15:31:00','2026-05-10 15:30:00','2026-05-10 15:30:00','2026-01-01 00:00:00','Clases de Natacion',1,'Miembro Activo',1,40.0,6.4),
('Reserva de Puesto de Estacionamiento','2026-05-11 08:01:00','2026-05-11 08:00:00','2026-05-11 08:00:00','2026-01-01 00:00:00','Reserva de Puesto de Estacionamiento',1,'Miembro Activo',1,5.0,0.8);

INSERT INTO Factura (numero_de_control, estado, monto_total, fecha_de_emision, fecha_hora_apertura, fecha_hora_creacion_solicitud, RIF, CI) VALUES
(1,'Pagada',29.0,'2026-05-01 10:30:00','2026-05-01 09:00:00','2026-05-01 09:00:00',NULL,'V-20111111'),
(2,'Pagada',17.4,'2026-05-02 11:00:00','2026-05-02 10:15:00','2026-05-02 10:15:00',NULL,'V-20222222'),
(3,'Pagada',92.8,'2026-05-10 09:00:00','2026-05-03 14:00:00','2026-05-03 14:00:00',NULL,'V-20333333'),
(4,'Parcialmente Pagada',324.8,'2026-05-05 18:00:00','2026-05-05 16:00:00','2026-05-05 16:00:00',NULL,'V-12999999'),
(5,'Pagada',11.6,'2026-05-06 09:45:00','2026-05-06 07:45:00','2026-05-06 07:45:00',NULL,'V-20444444'),
(6,'Pagada',46.4,'2026-05-14 12:00:00','2026-05-07 11:20:00','2026-05-07 11:20:00',NULL,'V-20111111'),
(7,'Pendiente',46.4,'2026-05-17 16:00:00','2026-05-10 15:30:00','2026-05-10 15:30:00',NULL,'V-20222222'),
(8,'Pagada',5.8,'2026-05-11 08:10:00','2026-05-11 08:00:00','2026-05-11 08:00:00',NULL,'V-20111111');INSERT INTO Reserva (nombre_servicio, numero_servicio, fecha_hora, fecha_hora_creacion_solicitud, numero_espacio, nombre_edif, direccion_exacta, nombre_sede_espacio, numero_puesto, nombre_estacionamiento, nombre_sede_puesto, estado) VALUES
('Alquiler de Auditorio Hermano Lanz',1,'2026-05-05 16:00:00','2026-05-05 16:00:00',1,'Edificio de Postgrado','Av. Teheran, Montalban','Montalban',NULL,NULL,NULL,'Confirmada'),
('Uso de Cancha Deportiva',1,'2026-05-06 07:45:00','2026-05-06 07:45:00',2,'Edificio Cincuentenario','Av. Teheran, Montalban','Montalban',NULL,NULL,NULL,'Confirmada'),
('Reserva de Puesto de Estacionamiento',1,'2026-05-11 08:00:00','2026-05-11 08:00:00',NULL,NULL,NULL,NULL,4,'Estacionamiento Norte','Montalban','Confirmada');

INSERT INTO Tasa (Fecha, Moneda, monto) VALUES
('2026-05-10','USD',36.50),
('2026-05-14','USDT',36.80);

INSERT INTO Pagos (fecha_hora_pago, monto, numero_de_control, Fecha_Tasa, Moneda_Tasa) VALUES
('2026-05-01 10:35:00',29.00,1,NULL,NULL),
('2026-05-02 11:05:00',17.40,2,NULL,NULL),
('2026-05-10 09:10:00',92.80,3,'2026-05-10','USD'),
('2026-05-05 18:10:00',150.00,4,NULL,NULL),
('2026-05-06 09:50:00',11.60,5,NULL,NULL),
('2026-05-14 12:10:00',46.40,6,'2026-05-14','USDT'),
('2026-05-11 08:15:00',5.80,8,NULL,NULL);

INSERT INTO Pago_Presencial (fecha_hora_pago, monto) VALUES
('2026-05-01 10:35:00',29.00),
('2026-05-02 11:05:00',17.40),
('2026-05-05 18:10:00',150.00),
('2026-05-06 09:50:00',11.60),
('2026-05-11 08:15:00',5.80);

INSERT INTO Pago_Digital (fecha_hora_pago, monto) VALUES
('2026-05-10 09:10:00',92.80),
('2026-05-14 12:10:00',46.40);

INSERT INTO Zelle (fecha_hora_pago, monto, correo_electronico_origen, codigo_confirmacion, nombre_titular) VALUES
('2026-05-10 09:10:00',92.80,'ana.martinez.pagos@gmail.com','ZL998877','Ana Martinez');

INSERT INTO Crypto (fecha_hora_pago, monto, direccion_billetera, TXID, red) VALUES
('2026-05-14 12:10:00',46.40,'TBx9F3kP8vQzR2mNc7dWfYhJk1LpQsTuVe','0x9988776655443322110099887766554433','TRC20');

INSERT INTO Tarjeta (fecha_hora_pago, monto, tipo, red, num_tarjeta, fecha_vencimiento, compania) VALUES
('2026-05-01 10:35:00',29.00,'Debito','Nacional','4532-0000-0000-1111','2028-09-30','Visa'),
('2026-05-11 08:15:00',5.80,'Credito','Internacional','4532-0000-0000-2222','2029-03-31','Mastercard');

INSERT INTO PagoMovil (fecha_hora_pago, monto, telefono, numero_referencia, banco_emisor) VALUES
('2026-05-02 11:05:00',17.40,'0414-1234567','001234567890','Banesco');

INSERT INTO TAI (fecha_hora_pago, monto, UID, POS) VALUES
('2026-05-06 09:50:00',11.60,'TAI-0001','POS-CAJA-01');

INSERT INTO Efectivo (fecha_hora_pago, monto, moneda, monto_recibido) VALUES
('2026-05-05 18:10:00',150.00,'Bolivares',5500.00);

INSERT INTO Denominaciones (fecha_hora_pago, monto, valor_denominacion, cantidad) VALUES
('2026-05-05 18:10:00',150.00,1000.00,5),
('2026-05-05 18:10:00',150.00,500.00,1);