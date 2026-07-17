# 🎓 UCAB Services - Plataforma de Gestión Administrativa

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E)

Bienvenido al repositorio de **UCAB Services**, un sistema web integral diseñado para la gestión administrativa, roles, servicios financieros, infraestructura y control de usuarios dentro del ecosistema universitario.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Uso del Sistema](#-uso-del-sistema)
- [Usuarios de Prueba](#-usuarios-de-prueba)

---

## 🚀 Características Principales

- **Gestión de Roles (Vinculaciones):** Administración dinámica del ciclo de vida académico y laboral (Estudiantes, Profesores, Personal Administrativo, Egresados).
- **Control Financiero:** Emisión de facturas, pago de servicios (Zelle, PagoMóvil, Cripto, etc.), y gestión de monedero virtual.
- **Seguridad Robusta:** Implementación de Row-Level Security (RLS) a nivel de base de datos para restringir acceso según roles.
- **Módulos Integrados:** Bolsa de trabajo, Beneficiarios, Vehículos, Infraestructura y Voluntariado.

---

## 🛠️ Requisitos Previos

Asegúrate de tener instalado el siguiente software en tu máquina antes de comenzar:

- [Node.js](https://nodejs.org/) (v14 o superior)
- [PostgreSQL](https://www.postgresql.org/) (v12 o superior)
- **pgAdmin 4** (Opcional, pero recomendado para gestión de BD)

---

## ⚙️ Instalación y Configuración

Sigue estos pasos para levantar el entorno de desarrollo localmente:

### 1. Clonar e Instalar Dependencias

Abre una terminal en la raíz del proyecto y ejecuta:

```bash
# Instalar los paquetes de Node.js necesarios
npm install
```

### 2. Configurar la Base de Datos

1. Abre **pgAdmin** (o psql) y crea una nueva base de datos vacía.
2. Ejecuta los scripts ubicados en la carpeta `database/` en el siguiente orden estricto:
   - `01_create_tablas.sql` _(Estructura y tablas base)_
   - `03_triggers.sql` _(Automatizaciones)_
   - `04_funciones.sql` _(Funciones de BD)_
   - `05_procedimientos.sql` _(Lógica de negocio almacenada)_
   - `06_seguridad.sql` _(Usuarios de PostgreSQL, roles, permisos y RLS)_
   - `02_inserts.sql` _(Datos semilla y usuarios de prueba)_

> **Nota:** Si necesitas limpiar la base de datos por completo, puedes ejecutar `00_drop.sql` antes de comenzar.

---

## 💻 Uso del Sistema

Para levantar el servidor de desarrollo (backend y frontend integrados):

```bash
# Inicia el servidor con recarga automática
npm run dev
```

Una vez que el servidor indique que está corriendo (usualmente en el puerto 3000), abre tu navegador de preferencia y visita el punto de entrada oficial:

👉 **[http://localhost:3000/login/login.html](http://localhost:3000/login/login.html)**

---

## 🔑 Usuarios de Prueba

> **👩‍🏫 NOTA PARA LA EVALUACIÓN:**
> Profesora, para probar el sistema con **acceso total** a todos los módulos (Recursos Humanos, Control de Usuarios, Finanzas e Infraestructura) le recomendamos iniciar sesión con la cuenta de **Director / Admin**.
> Si desea comprobar cómo el sistema restringe el acceso y adapta las vistas, puede iniciar sesión como **Estudiante Becario** o **Profesor**.

Todos los usuarios comparten la misma contraseña por defecto: **`1234`**

| Rol / Cargo | Departamento | Nombre | Correo Electrónico |
| :--- | :--- | :--- | :--- |
| **Director / Admin (Recomendado)** | Secretaría | Laura Torres | `laura.torres@ucab.edu.ve` |
| **Caja / Finanzas** | Caja | Pedro Ramirez | `pedro.ramirez@ucab.edu.ve` |
| **Oficina / RRHH** | Oficina | Sofia Blanco | `sofia.blanco@ucab.edu.ve` |
| **Profesor** | N/A | Jose Gonzalez | `jose.gonzalez@ucab.edu.ve` |
| **Estudiante Becario** | N/A | Carlos Rodriguez | `carlos.rodriguez@ucab.edu.ve` |

> 💡 **Nota sobre Trámites y Departamentos:** El sistema asigna automáticamente los pasos de las solicitudes (workflows) al departamento correspondiente (`Caja`, `Secretaría`, `Oficina`, etc.). Por lo tanto, el personal administrativo solo podrá visualizar y completar los pasos que estén asignados directamente al departamento al que pertenecen.

*(Revisa el archivo `database/02_inserts.sql` para ver la lista completa de miembros).*
