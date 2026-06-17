# Manual de Uso — Sistema Integrado de Control Operativo

**Sistema de Seguridad Ciudadana** — Municipalidad de Santiago de Surco  
Versión: v2.5.0-PRO

---

## Índice

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Interfaz General](#3-interfaz-general)
4. [Panel de Edición (Dashboard)](#4-panel-de-edición-dashboard)
5. [Barra Superior (Header)](#5-barra-superior-header)
6. [Gestión de Retenes](#6-gestión-de-retenes)
7. [Vista Despachador (Visualization)](#7-vista-despachador-visualization)
8. [Mapa de Cuadrantes](#8-mapa-de-cuadrantes)
9. [Rostros Buscados](#9-rostros-buscados)
10. [Buscador de Vehículos Sospechosos](#10-buscador-de-vehículos-sospechosos)
11. [Estadísticas](#11-estadísticas)
12. [Vista de Personal](#12-vista-de-personal)
13. [Centro de Reportes](#13-centro-de-reportes)
14. [Cómo Guardar la Información](#14-cómo-guardar-la-información)
15. [Turnos Pasados — Solo Lectura](#15-turnos-pasados--solo-lectura)
16. [Preguntas Frecuentes](#16-preguntas-frecuentes)

---

## 1. Introducción

**Reporte Integrado MSS** es un sistema web para la gestión y reporte del servicio de seguridad ciudadana. Permite registrar el estado operativo de las unidades (CHOFERES, MOTORIZADOS, SERENOS), gestionar reemplazos de vehículos (retenes), consultar personal, buscar vehículos sospechosos, generar estadísticas y exportar reportes en PDF.

**Funcionalidades principales:**

- Registro diario de unidades por sector y turno
- Asignación de personal, radios, combustible y kilometraje
- Gestión de reemplazos de vehículos (retenes) con control de taller
- Vista consolidada de todos los sectores (Despachador)
- Búsqueda de vehículos sospechosos en base de datos RQ
- Estadísticas operativas en tiempo real
- Consulta de base de datos de personal con fotos
- Generación de reportes PDF (5 tipos)
- Exportación de datos a Excel
- Autocompletado de datos desde hoja de referencia móvil
- Puente de kilometraje entre turnos

---

## 2. Acceso al Sistema

El sistema es una **Google Apps Script Web App** alojada en Google Sheets.

1. Abra el enlace proporcionado por su administrador (dominio `script.google.com`)
2. El sistema se cargará automáticamente — no requiere inicio de sesión adicional si ya está autenticado en su cuenta Google corporativa
3. Si ve una pantalla en blanco o "Cargando Datos...", espere unos segundos mientras se cargan los datos del día

**Nota:** El sistema requiere conexión a Internet y una cuenta de Google (@surco.gob.pe o similar) con acceso a las hojas de cálculo vinculadas.

---

## 3. Interfaz General

### 3.1 Barra Lateral (Sidebar)

La barra lateral izquierda contiene 7 módulos de navegación. Por defecto está colapsada (76px de ancho). Al pasar el mouse sobre ella se expande (260px) mostrando las etiquetas de cada módulo.

| Icono | Módulo | Descripción |
|---|---|---|
| 📊 Panel de Edición | Edición de unidades del sector actual |
| 🔄 Gestión de Retenes | Registro de reemplazos de vehículos |
| 📋 Vista Despachador | Vista general de todos los sectores |
| 🔍 Buscador Vehículos | Consulta de vehículos sospechosos (RQ) |
| 📈 Estadísticas | Indicadores operativos |
| 👥 Vista de Personal | Directorio de personal con fotos |
| 📑 Centro de Reportes | Generación de reportes PDF |

### 3.2 Barra Superior (Header)

La barra superior contiene los controles principales:

- **Selector de Sector:** Menú desplegable para elegir el sector a editar (1A, 1B, 2A, 2B, 3–9B, RESCATE, GIR)
- **Selector de Fecha:** Calendario para elegir el día del reporte
- **Selector de Turno:** Botones segmentados MAÑANA / TARDE / NOCHE
- **Operador:** Campo editable con autocompletado para el operador a cargo (específico del sector)
- **Supervisor:** Campo editable con autocompletado para el supervisor (específico del sector)
- **Jefe de Área / Permanencia:** Campo editable con autocompletado para el jefe de área o permanencia (específico del sector, ya no se replica entre sectores)
- **Botón Sincronizar (↻):** Recarga los datos del sector actual (oculto en modo solo lectura)
- **Botón Guardar (💾):** Guarda todos los cambios del sector actual (visible solo en edición y turno actual)
- **Botón ACTUALIZAR:** Recarga los datos (visible en vistas de solo lectura)

**Nota:** Los campos OPERADOR, SUPERVISOR y PERMANENCIA son independientes por cada sector. Ya no se replica el valor de PERMANENCIA entre sectores.

---

## 4. Panel de Edición (Dashboard)

Es la vista principal donde se registran y editan las unidades del sector seleccionado.

### 4.1 Secciones de Unidades

Las unidades están organizadas en tres secciones:

| Sección | Color | Descripción |
|---|---|---|
| **CHOFER** | Azul | Unidades móviles con chofer (M-01, M-02, ...) |
| **MOTORIZADOS** | Violeta | Motociclistas (H-01, H-02, ...) |
| **SERENOS** | Verde | Personal de serenazgo a pie (S-01, S-02, ...) |

Cada sección muestra un encabezado con el nombre, un badge con la cantidad de unidades y un botón **+ NUEVO REGISTRO** para añadir una unidad nueva (oculto en modo solo lectura).

### 4.2 Tarjeta de Unidad (UnitCard) — Vista Lectura

Cada unidad se muestra como una tarjeta en modo vista con las siguientes columnas:

| Columna | Descripción |
|---|---|
| **ID** | Código de la unidad (ej. M-01, H-03) |
| **CHOFER** | Nombre del personal asignado (con régimen laboral en texto pequeño debajo) |
| **COPILOTO** | Copiloto (solo CHOFER) |
| **RADIO** | Código de radio |
| **PLACA** | Placa del vehículo |
| **ESTADO** | Estado operativo (con badge de color) |
| **KM** | Kilometraje: inicio / fin / total / recarga |
| **COMBUSTIBLE** | Tipo y cantidad de combustible (GL) |
| **HORAS** | Horario trabajado |
| **GASTO** | Gastos registrados (S/ 0.00) |
| **CUADRANTE** | Cuadrante asignado |
| **OBSERVACIONES** | Notas mecánicas adicionales |
| **✏️** | Botón para editar la unidad (oculto en modo solo lectura) |
| **Indicador de Guardado** | Icono de spinner, check o error |

**Nota:** En pantallas menores a 1400px, las columnas COPILOTO, PLACA y COMBUSTIBLE se ocultan automáticamente para mejor visualización.

### 4.3 Modo Edición

Al hacer clic en el botón ✏️, la tarjeta se expande a modo edición con todos los campos disponibles:

- **ID:** Código de la unidad (con autocompletado para CHOFER y MOTO)
- **Modelo:** Modelo del vehículo (autocompletado al escribir el ID)
- **Personal 1 (CHOFER):** Nombre del personal
- **Personal 2 (COPILOTO):** Copiloto (solo CHOFER) — acepta letras y números (para casos como "PNP-12345")
- **Placa:** Placa del vehículo (autocompletado al escribir el ID)
- **Indicativo:** Indicativo de radio del copiloto
- **Radio:** Código de radio
- **Estado:** Menú desplegable con opciones operativas
- **Motivo:** Razón o nota adicional
- **KM Inicio:** Kilometraje inicial — se autocompleta desde el turno anterior si existe (puente de kilometraje)
- **KM Fin:** Kilometraje final
- **KM Recarga:** Kilometraje en el que se recargó combustible
- **Horario:** Horas trabajadas (formato "HH:MM - HH:MM")
- **Combustible:** Tipo (GLP/GASOLINA/PETROLEO) y cantidad en galones
- **Gasto:** Monto en soles (formato "S/ 0.00")
- **Cuadrante:** Cuadrante asignado (soporta múltiples valores separados por coma)
- **Observaciones:** Notas adicionales

**TASER y BODYCAM (segunda fila):**

Los campos de TASER y BODYCAM aparecen en la segunda fila del modo edición para todos los tipos de unidad (CHOFER, MOTO, SERENO), excepto para los sectores COVV, C4 y RESCATE donde están ocultos.

| Campo | Tipo | Descripción |
|---|---|---|
| **TIENE TASER** | Toggle (interruptor) | Activar si la unidad porta un dispositivo TASER |
| **CÓDIGO TASER** | Autocomplete | Seleccionar el código del dispositivo TASER de la lista predefinida. **Solo se habilita cuando el toggle TIENE TASER está en SI** |
| **TIENE BODYCAM** | Toggle (interruptor) | Activar si la unidad porta una cámara corporal (bodycam) |
| **CÓDIGO BODYCAM** | Autocomplete | Seleccionar el código de la bodycam de la lista predefinida. **Solo se habilita cuando el toggle TIENE BODYCAM está en SI** |
| **OBS. BODYCAM/TASER** | Texto | Observaciones adicionales sobre los dispositivos |

**Comportamiento de los toggles:**
- Al hacer clic en el toggle, cambia entre **NO** (apagado, valor vacío) y **SI** (encendido, valor "SI")
- No existe un estado "NO" persistente — si se desactiva, el campo se limpia
- Los campos de código asociados aparecen **deshabilitados** (fondo gris, no interactivos) hasta que su toggle respectivo esté en **SI**
- Al activar el toggle, el campo de código se habilita automáticamente para que pueda seleccionar un valor de la lista

**Validaciones:**

- El campo ID es obligatorio para **PATRULLANDO** y se valida contra duplicados
- Para CHOFER y MOTO, el ID debe existir en los datos de referencia
- Los campos CHOFER (personal1), RADIO y CUADRANTE son obligatorios solo para el estado **PATRULLANDO**
- **CON DESPERFECTOS** requiere ID y radio, pero no cuadrante
- **SIN VEHICULO**, **APOYO OTRA AREA**, **CAMBIO DE TURNO** y **CAMBIO DESCANSO** requieren personal pero no ID, radio ni cuadrante
- **SIN CONDUCTOR**, **MANTENIMIENTO**, **SINIESTRO**, **SIN DOCUMENTOS** y **FALTO (INASISTENCIA)** no requieren personal ni ID, radio o cuadrante
- **CÓDIGO TASER:** Es obligatorio si TIENE TASER = SI. Muestra "Requerido" si está vacío o el código no está en la lista predefinida
- **CÓDIGO BODYCAM:** Es obligatorio si TIENE BODYCAM = SI. Muestra "Requerido" si está vacío o el código no está en la lista predefinida

### 4.4 Catálogo de Estados

Cada estado tiene un escenario de uso específico. A continuación se definen todos los estados disponibles y cuándo debe usar cada uno:

#### Catálogo completo de estados

| Estado | Color | ID | Radio | Cuadrante | Personal | ¿Cuándo usarlo? |
|---|---|---|---|---|---|---|---|
| **PATRULLANDO** | 🟢 Verde | Sí | Sí | Sí* | Sí | Unidad operativa realizando patrullaje normal en su sector. Estado por defecto. |
| **APOYO OTRA AREA** | 🔵 Azul | No | No | No | Sí | Personal comisionado temporalmente a otra área. |
| **SIN VEHICULO** | 🟡 Ámbar | No | No | No | Sí | Personal presente sin vehículo asignado (falta de unidades). |
| **SIN CONDUCTOR** | 🟡 Ámbar | No | No | No | No | Vehículo disponible sin chofer. Dejar personal vacío. |
| **SIN DOCUMENTOS** | 🟡 Ámbar | No | No | No | No | Unidad disponible sin documentación (SOAT, revisión técnica). |
| **CON DESPERFECTOS** | 🔴 Rojo | Sí | Sí | No | No | Unidad con fallas mecánicas/electrónicas. Detallar en Observaciones. |
| **MANTENIMIENTO** | 🔴 Rojo | No | No | No | No | Unidad en taller (mantenimiento programado o correctivo). |
| **SINIESTRO** | 🔴 Rojo | No | No | No | No | Unidad accidentada (choque, vuelco). Detallar en Observaciones. |
| **FALTO (INASISTENCIA)** | 🔴 Rojo | No | No | No | No | Personal que no se presentó a laborar. Solo se registra el nombre. |
| **CAMBIO DE TURNO** | ⚪ Gris | No | No | No | Sí | Personal en transición entre turnos. Solo se registra el nombre. |
| **CAMBIO DESCANSO** | ⚪ Gris | No | No | No | Sí | Personal en descanso dentro del turno. Solo se registra el nombre. |
| **FIN RETEN** | ⚪ Gris | No | No | No | No | Retén termina de patrullar y se reemplaza por retorno de unidad móvil del sector. |

\* *Exento para SERENO y RESCATE.*

#### Resumen Visual por Color

| Color | Categoría |
|---|---|
| 🟢 Verde | Unidad o personal operativo patrullando |
| 🔵 Azul | Unidad o personal en Apoyo a otra área (APOYO OTRA AREA) |
| 🟡 Ámbar | Unidad o personal presente pero con limitaciones (sin vehículo, sin documentos, sin chofer) |
| 🔴 Rojo | Fuera de servicio (Con desperfectos, Mantenimiento, Siniestro, Falta) |
| ⚪ Gris | Personal en cambio de turno, descanso o fin de retén |

**Reglas generales (según validación del código):**
- Solo **PATRULLANDO** exige ID, radio y cuadrante (cuadrante exento para SERENO y RESCATE)
- **CON DESPERFECTOS** exige ID y radio, pero no cuadrante ni personal
- **APOYO OTRA AREA, SIN VEHICULO, CAMBIO DE TURNO, CAMBIO DESCANSO** requieren personal pero no ID, radio ni cuadrante
- **SIN CONDUCTOR, SIN DOCUMENTOS, MANTENIMIENTO, SINIESTRO, FALTO (INASISTENCIA)** no requieren personal, ID, radio ni cuadrante

### 4.5 Puente de Kilometraje

Cuando se crea una unidad nueva (o se carga un sector), el sistema busca automáticamente el **KM_FIN** de la unidad en el turno anterior y lo coloca como **KM_INICIO** del turno actual. Esto permite llevar un control continuo del kilometraje.

---

## 5. Barra Superior (Header) — Detalle

### 5.1 Selector de Sector

El menú de sectores lista los 14 sectores operativos. Al seleccionar uno, el sistema guarda automáticamente los cambios del sector actual antes de cambiar (solo si está en modo edición).

### 5.2 Selector de Turno

Tres botones segmentados:

| Turno | Horario |
|---|---|
| **MAÑANA** | 06:30 – 14:30 |
| **TARDE** | 14:30 – 22:30 |
| **NOCHE** | 22:30 – 06:30 |

El sistema detecta automáticamente el turno actual basado en la hora del día.

### 5.3 Personal a Cargo por Sector

Los campos OPERADOR, SUPERVISOR y PERMANENCIA son editables y cuentan con autocompletado desde la base de datos de personal de la municipalidad.

**Importante:** Cada sector tiene sus propios valores independientes para estos tres campos. El cambio de operador/supervisor/permanencia en un sector no afecta a los demás sectores.

---

## 6. Gestión de Retenes

La vista **Gestión de Retenes** permite registrar y dar seguimiento a los reemplazos de vehículos operativos.

### 6.1 Registro de Nuevo Retén

Para añadir un reemplazo:

1. Complete la **UNIDAD REEMPLAZADA** (la unidad que sale de servicio, ej. M-01)
   - El sistema busca automáticamente la placa asociada
2. Seleccione el **MOTIVO** del reemplazo (taller, mantenimiento, etc.)
3. Ingrese **FECHA INGRESO TALLER** y **HORA INGRESO TALLER** — si la unidad tiene un registro previo sin salida de taller, se autocompleta
4. Ingrese la **UNIDAD RETEN** (vehículo de reemplazo, ej. AR-1 a AR-12)
   - El sistema muestra las placas disponibles
5. Complete **HORA** del reemplazo
6. Haga clic en **REGISTRAR REEMPLAZO**

### 6.2 Salida de Taller

Cuando la unidad original sale del taller:

1. Busque el registro en la tabla
2. Haga clic en **REGISTRAR SALIDA**
3. Complete la fecha y hora de salida

### 6.3 Exportar a Excel

Haga clic en **EXPORTAR EXCEL** para descargar todos los registros de retenes visibles en formato `.xlsx`.

### 6.4 Columnas de la Tabla

| Columna | Descripción |
|---|---|
| FECHA | Fecha del reemplazo |
| TURNO | Turno (MAÑANA/TARDE/NOCHE) |
| UNIDAD RETEN | Vehículo de reemplazo (AR-xx) |
| PLACA RETEN | Placa del vehículo de reemplazo |
| UNIDAD REEMPLAZADA | Unidad que salió de servicio |
| PLACA | Placa de la unidad reemplazada |
| MOTIVO | Razón del reemplazo |
| HORA | Hora del cambio |
| INGRESO TALLER | Fecha y hora de ingreso a taller |
| SALIDA TALLER | Fecha y hora de salida de taller |
| ACCIONES | Botón "REGISTRAR SALIDA" (si aplica) |

---

## 7. Vista Despachador (Visualization)

La **Vista Despachador** muestra una lectura consolidada de **todos los sectores** en una sola pantalla. Es de solo lectura — no permite editar datos.

### 7.1 Navegación Rápida

En la parte superior hay botones de acceso rápido para saltar a cualquier sector (1A, 1B, 2, 3, 4, 5, 6, 7, 8, 9A, 9B, RESCATE, GIR).

### 7.2 Unidades Mostradas

La vista del despachador muestra únicamente las unidades en estado **PATRULLANDO** o **APOYO OTRA AREA**. Unidades en cualquier otro estado (mantenimiento, falta, descanso, etc.) quedan ocultas.

### 7.3 Información por Sector

Cada sector muestra:

- **Encabezado:** Nombre del sector, OPERADOR, SUPERVISOR, JEFE DE ÁREA / PERMANENCIA
- **Estadísticas:** Total de unidades y porcentaje de operatividad
- **Tarjetas de unidades** compactas con:
  - Indicador de estado (círculo de color)
  - ID y CHOFER (con badge "PNP" si el copiloto contiene "PNP")
  - RADIO y CUADRANTE

---

## 8. Mapa de Cuadrantes

Esta vista permite visualizar la distribución de unidades operativas sobre el plano de cuadrantes.

- **Filtros:** Puede filtrar por estado, tipo de unidad o sector.
- **Visualización:** Muestra el número de unidades activas (CHOFER, MOTO, SERENO) en cada cuadrante resaltado en el mapa.
- **Detalle:** Al hacer clic en un cuadrante, se despliega una lista con los IDs, personal, placa y radio de las unidades presentes en dicho cuadrante.

## 9. Rostros Buscados

Esta vista permite consultar la base de datos de rostros buscados (personas requisitoriadas).

- **Visualización:** Muestra una cuadrícula de fotos de personas buscadas.
- **Búsqueda:** Filtra por nombre o apellido.
- **Detalle:** Al hacer clic en la foto, se muestra información detallada (nombre, estado, tipo de búsqueda).

## 10. Buscador de Vehículos Sospechosos

Esta vista permite consultar y registrar vehículos en la base de datos de **Vehículos RQ** (vehículos implicados en delitos).

### 8.1 Búsqueda por Placa

1. En el campo de búsqueda, escriba la placa parcial o completa
2. Aparecerá un menú desplegable con sugerencias basadas en las placas existentes
3. Seleccione una placa o presione **Enter** para buscar
4. Los resultados se muestran en una tabla con las siguientes columnas:

| Columna | Descripción |
|---|---|
| SADE | Número de registro SADE |
| FECHA | Fecha del registro |
| TIPO | Tipo de vehículo (AUTO/CAMIONETA/MOTOTAXI/MOTO) |
| MARCA | Marca del vehículo |
| MODELO | Modelo del vehículo |
| COLOR | Color con indicación visual |
| PLACA | Placa del vehículo |
| ESTADO | Estado (IMPLICADO/ROBADO/SOSPECHOSO/REQUISITORIADO) |
| RELATO | Descripción del incidente |
| TIPO DELITO | Tipo de delito |
| SUBTIPO | Subtipo de delito |
| SECTOR | Sector asignado |
| CUADRANTE | Cuadrante asignado |

### 8.2 Agregar Nuevo Vehículo

Para añadir un vehículo a la base de datos RQ:

1. Haga clic en el botón **+ AGREGAR**
2. Complete el formulario modal. **Campos obligatorios** (marcados con *):
   - **SADE:** Número de registro
   - **FECHA:** Fecha del evento
   - **TIPO:** AUTO, CAMIONETA, MOTOTAXI o MOTO
   - **PLACA:** Placa del vehículo
   - **ESTADO:** IMPLICADO, ROBADO, SOSPECHOSO o REQUISITORIADO
3. Campos opcionales: MARCA, MODELO, COLOR, RELATO, TIPO DELITO, SUBTIPO DELITO, SECTOR, CUADRANTE (con autocompletado)
4. Haga clic en **GUARDAR** para registrar

---

## 11. Estadísticas

El módulo de **Estadísticas** muestra indicadores operativos en tiempo real basados en los datos del turno actual de **todos los sectores**.

### 9.1 Tarjetas de Resumen (Summary Cards)

Indicadores generales del sistema:
- Total de personal
- Unidades operativas
- Porcentaje de operatividad general
- Alertas activas

### 9.2 Alertas y Advertencias

Lista de situaciones que requieren atención:
- Unidades con estado crítico (MANTENIMIENTO, SINIESTRO, FALTO)
- Personal ausente
- Unidades sin chofer asignado
- Problemas de combustible o kilometraje

### 9.3 Tasas de Disponibilidad

Porcentaje de disponibilidad por tipo de unidad (CHOFER, MOTO, SERENO).

### 9.4 Proporción Vehículo/Personal

Relación entre la cantidad de vehículos y el personal disponible.

### 9.5 Desglose de Estados Operativos

Distribución de todos los estados operativos en formato de lista o gráfico.

### 9.6 Vehículos Patrullando por Sector

Tabla que muestra cuántas unidades están en estado PATRULLANDO en cada sector.

### 9.7 Personal Presente por Sector

Tabla del personal registrado en cada sector.

---

## 12. Vista de Personal

El módulo **Vista de Personal** permite consultar la base de datos de todo el personal de seguridad ciudadana.

### 10.1 Búsqueda

- **Campo de búsqueda:** Filtra por nombre, DNI o código interno
- **Filtro por rol:** Seleccione un rol operativo específico (CHOFER, MOTORIZADO, SERENO, OPERADOR C4, etc.)

### 10.2 Tabla de Personal

| Columna | Descripción |
|---|---|
| DNI | Número de documento |
| NOMBRES | Nombre completo |
| REGIMEN | Régimen laboral (276, 728, 1057, OS) |
| CODIGO | Código interno |
| SECTOR | Sector asignado |
| ROL | Rol operativo |
| ESTADO | ACTIVO (verde) / CESADO o INACTIVO (rojo) |
| CORREO | Correo electrónico |
| TELÉFONO | Teléfono de contacto |
| FOTO | Miniatura de 40×40 — pase el mouse para ver en tamaño grande (192×192) |

### 10.3 Pie de Página

Muestra el total de registros encontrados: "Mostrando X personal(es)".

---

## 13. Centro de Reportes

El módulo **Centro de Reportes** permite generar documentos PDF con los datos del servicio.

### 11.1 Tipos de Reporte

| Reporte | Descripción |
|---|---|---|
| **Observaciones** | Reporte de observaciones y novedades del puesto de comando y cambios de turno |
| **Motos Yamaha XTZ150** | Reporte numérico de la flota de motos Yamaha |
| **Motos Honda SAHARA XRE300** | Reporte numérico de la flota de motos Honda |
| **Flota Renting** | Reporte de la flota de vehículos de renting |
| **Asistencia por Regimen** | Reporte de inasistencias agrupado por régimen laboral (276, 728, 1057, OS) |
| **Reporte General** | Reporte consolidado de todos los registros |
| **Reporte TASER y BODYCAM** | Reporte de asignación de dispositivos TASER y bodycam por unidad |

### 11.2 Columnas del Reporte TASER y BODYCAM

El reporte TASER y BODYCAM incluye las siguientes columnas:

| Columna | Descripción |
|---|---|
| **FECHA** | Fecha del reporte |
| **TURNO** | Turno (MAÑANA/TARDE/NOCHE) |
| **SECTOR** | Sector operativo |
| **UNIDAD** | ID de la unidad |
| **NOMBRE PERSONAL** | Personal asignado a la unidad |
| **RADIO** | Código de radio |
| **TASER** | SI/NO si la unidad porta TASER |
| **CÓDIGO TASER** | Código del dispositivo TASER asignado |
| **BODYCAM** | SI/NO si la unidad porta bodycam |
| **CÓDIGO BODYCAM** | Código de la bodycam asignada |
| **OBSERVACIÓN** | Observaciones adicionales |

### 11.3 Cómo Generar un Reporte

1. Seleccione el tipo de reporte haciendo clic en la tarjeta correspondiente (se resalta con borde azul)
2. Seleccione la **FECHA** y el **TURNO** en los filtros superiores
3. Haga clic en **GENERAR REPORTE**
4. El PDF se generará automáticamente en el navegador y se abrirá en una nueva pestaña o se descargará

### 11.4 Progreso

Durante la generación, la tarjeta activa muestra un spinner giratorio y el texto "PROCESANDO...". Una vez completado, se restablece el estado normal.

---

## 14. Cómo Guardar la Información

El sistema maneja el guardado de datos de forma automática y manual:

### 12.1 Guardado Automático

- **Cola de guardado no bloqueante:** Cuando edita una unidad y cambia de campo, los cambios se encolan para guardarse uno por uno sin bloquear la interfaz
- **Indicador por unidad:** Cada tarjeta muestra un icono de estado:
  - ⏳ Spinner girando = guardando...
  - ✅ Check verde = guardado correctamente (desaparece a los 2 segundos)
  - ❌ X roja = error al guardar
- **Guardado al cambiar de sector:** Al seleccionar otro sector, el sistema guarda automáticamente los cambios del sector actual

### 12.2 Guardado Manual

- Haga clic en el botón **💾** (Guardar) en la barra superior para forzar un guardado completo del sector actual
- El botón muestra "GUARDANDO..." mientras se procesa
- El botón Guardar solo está visible para el turno actual

### 12.3 Sincronización

El botón **SINCRONIZAR** sincroniza los datos con el sistema externo de recolección de datos móviles. Solo está visible en el turno actual (oculto en turnos pasados y en pantallas menores a 1400px).

### 12.4 Solución de Problemas de Guardado

- Si ve un icono ❌ en una tarjeta, intente guardar manualmente con el botón 💾
- Si el guardado falla repetidamente, actualice la página con el botón ↻ y vuelva a intentar
- En caso de error de bloqueo (LockService), el sistema reintenta automáticamente hasta 5 veces con intervalos crecientes (1s, 2s, 4s, 8s, 16s)

---

## 15. Turnos Pasados — Solo Lectura

Cuando se selecciona una fecha o turno que ya ha pasado, el sistema automáticamente bloquea la edición de toda la información:

### 13.1 Comportamiento

- **Campos de personal** (OPERADOR, SUPERVISOR, PERMANENCIA): se muestran como texto, no permiten edición
- **Unidades:** el botón de editar (✏️) y el de nuevo registro (+ NUEVO REGISTRO) no se muestran
- **Botón GUARDAR:** oculto
- **Botón SINCRONIZAR:** oculto
- **Navegación:** aún puede cambiar de sector, fecha y turno para consultar información pasada

### 13.2 Lógica de Turno Actual

El sistema determina el turno actual según la hora del día:

| Turno | Horario |
|---|---|
| **MAÑANA** | 06:30 – 14:29 |
| **TARDE** | 14:30 – 22:29 |
| **NOCHE** | 22:30 – 06:29 (día siguiente) |

Para la NOCHE que cruza la medianoche, el sistema considera que el turno activo pertenece al día anterior (hasta las 06:29).

### 13.3 ¿Qué se puede hacer en modo solo lectura?

- Ver todas las unidades registradas
- Consultar el régimen laboral del personal asignado
- Cambiar de sector para ver otros sectores
- Cambiar de fecha o turno para ver datos históricos
- Navegar a otras vistas (Despachador, Estadísticas, etc.)
- Generar reportes PDF

---

## 16. Preguntas Frecuentes

### ¿Cómo agrego una unidad nueva?

En el Panel de Edición, dentro de la sección correspondiente (CHOFER/MOTORIZADOS/SERENOS), haga clic en **+ NUEVO REGISTRO**. Complete el ID de la unidad; si existe en los datos de referencia, los campos PLACA, MODELO y CUADRANTE se autocompletarán.

### ¿Por qué no puedo editar ciertos campos?

- La **Vista Despachador**, **Estadísticas** y **Vista de Personal** son de solo lectura
- Los turnos pasados también son de solo lectura — solo puede editar el turno actual
- Solo el **Panel de Edición** y **Gestión de Retenes** permiten modificar datos (en el turno actual)
- El **Buscador de Vehículos** permite agregar nuevos registros pero no editar existentes

### ¿Cómo cambio de sector?

Use el menú desplegable de sectores en la barra superior. El sistema guardará automáticamente los cambios del sector actual antes de cambiar (solo si está en el turno actual).

### ¿Qué significa cada color en los badges de estado?

- **Verde:** PATRULLANDO (unidad operativa)
- **Azul:** APOYO OTRA AREA
- **Ámbar:** SIN DOCUMENTOS, SIN CONDUCTOR, SIN VEHICULO
- **Rojo:** MANTENIMIENTO, SINIESTRO, FALTO (INASISTENCIA), CON DESPERFECTOS
- **Gris:** CAMBIO DE TURNO, CAMBIO DESCANSO, FIN RETEN

### ¿Cuándo no son obligatorios el ID, radio y cuadrante?

Solo el estado **PATRULLANDO** exige ID, radio y cuadrante. Todos los demás estados (APOYO OTRA AREA, SIN VEHICULO, SIN CONDUCTOR, SIN DOCUMENTOS, CON DESPERFECTOS, MANTENIMIENTO, SINIESTRO, FALTO (INASISTENCIA), CAMBIO DE TURNO, CAMBIO DESCANSO) eximen de estos campos según las reglas específicas de cada uno.

### ¿El régimen laboral aparece en las tarjetas de unidad?

Sí. En la vista de lectura de cada tarjeta de unidad, debajo del nombre del personal se muestra el régimen laboral en texto pequeño (ej. "276", "728", "1057", "OS").

### ¿Cómo se calcula el KM total?

El sistema resta **KM_INICIO** de **KM_FIN** automáticamente. El KM_INICIO se hereda del turno anterior automáticamente (puente de kilometraje).

### ¿El sistema funciona sin Internet?

No. El sistema requiere conexión a Internet para comunicarse con Google Sheets y Google Apps Script.

### ¿Cómo exporto los datos?

Puede generar reportes PDF desde el **Centro de Reportes** o exportar la tabla de retenes a Excel desde **Gestión de Retenes**. No hay exportación directa del Panel de Edición.

### ¿Qué hago si veo un error de "Lock timeout"?

Es normal cuando múltiples usuarios guardan al mismo tiempo. El sistema reintenta automáticamente. Espere unos segundos y verifique que los datos se hayan guardado (icono ✅). Si el error persiste, actualice la página.

### ¿El valor de Permanencia se replica entre sectores?

No. Desde la versión actual, cada sector tiene su propio valor independiente de OPERADOR, SUPERVISOR y PERMANENCIA. El cambio en un sector no afecta a los demás.

---

*Documento actualizado el 17 de junio de 2026*  
*Municipalidad de Santiago de Surco — Subgerencia de Seguridad Ciudadana*
