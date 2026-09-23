# 📊 Surco - Reporte Integrado de Servicio (MSS)

# 📊 Surco - Reporte Integrado de Servicio (MSS)

Aplicación web para la gestión operativa de unidades de seguridad, personal y reportes integrados por fecha, turno y sector. Este proyecto permite el seguimiento en tiempo real, la edición de estados y la generación de reportes integrados en formato PDF; el frontend está construido con React, TypeScript y Vite y se puede desplegar como Web App en Google Apps Script con persistencia en Google Sheets.

---

## ✨ Características Principales

- **Dashboard de Control:** Gestión completa de unidades (Choferes, Motorizados y Serenos).
- **Visualización Panorámica / Panel de Edición:** Vista resumen y edición en tiempo real de la operatividad y personal de todos los sectores (GIR, Rescate, Sectores 1-9) organizada por sector, cuadrante y estado de servicio.
- **Generación de Reportes:** Exportación a PDF (formato horizontal) con tablas detalladas por sector y tipo de unidad; generación nativa en cliente mediante `jsPDF` y `jsPDF-AutoTable`.
- **Gestión de Retenes:** Administración y registro histórico de vehículos de reemplazo y bitácora de taller (ingresos, salidas, horarios y motivos).
- **Gestión de Estados:** Seguimiento de operatividad, combustible, kilometraje y partes/ocurrencias.
- **Buscador de Vehículos:** Consulta rápida de vehículos requisitoriados e integración del campo **Estado del Vehículo**.
- **Vista de Personal:** Base de datos operativa de serenos e inspectores, con soporte para régimen laboral, función actual y visualización de fotos (columna `foto_url`).
- **Interfaz Premium:** Diseño moderno con Tailwind CSS, modo oscuro integrado y micro-animaciones.
- **Integración GAS:** Preparado y empaquetado específicamente para despliegue como Web App en Google Apps Script.

## 🛠️ Stack Tecnológico

- **Frontend:** React 18 + TypeScript
- **Build Tool:** Vite
- **Estilos:** Tailwind CSS
- **PDF:** jsPDF & jsPDF-AutoTable
- **Backend / Deploy:** Google Apps Script (persistencia en Google Sheets)

## 📁 Estructura del Proyecto (resumen)

```text
Reporte_servicio/
├── App.tsx             # Componente raíz y gestión de estado global
├── Code.gs             # Lógica de servidor para Google Apps Script
├── components/         # Componentes React (Sidebar, Header, UnitCard, etc.)
├── constants.ts        # Datos maestros, sectores y configuraciones iniciales
├── types.ts            # Definiciones de interfaces y enums de TypeScript
└── dist/               # Archivos compilados listos para producción
```

## Vistas de la Aplicación

- **Dashboard (Panel de Edición):** Registro y edición en tiempo real de unidades operativas por sector y estado.
- **Vista Despachador (Visualización):** Consola de solo lectura para el Reporte Integrado de Turno.
- **Gestión de Retenes:** Control y bitácora de unidades de reemplazo.
- **Buscador de Vehículos:** Búsqueda rápida con estado del vehículo.
- **Estadísticas:** Análisis visual de métricas operativas y distribución de recursos.
- **Centro de Reportes:** Generación y descarga directa de reportes PDF por tipo de unidad y régimen laboral.

## 🚀 Instalación y Desarrollo

### Requisitos Previos
- Node.js (recomendado v18+)
- npm o yarn

### Pasos para ejecución local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## ☁️ Construcción y Despliegue para Google Apps Script (GAS)

Este proyecto está optimizado para su despliegue como Web App en GAS. Hay dos flujos documentados según el empaquetado deseado:

- Flujo simple (bundled inline):

```bash
npm run build
```

Genera un `dist/index.html` con recursos inlined que puede copiarse a un archivo `index` en el editor de GAS.

- Flujo GAS específico (artefactos separados):

```bash
npm run build:gas
```

Genera artefactos listos para pegar en el editor de Google Apps Script en `dist/`:
- `dist/Code.gs` — código backend para GAS
- `dist/index.html` — HTML de entrada con directivas de GAS
- `dist/JavaScript.html` — bundle de JavaScript inyectado
- `dist/styles.html` — estilos compilados inyectados

### Pasos para publicar en GAS
1. Ejecutar el build (uno de los comandos anteriores según el flujo).
2. Copiar `dist/Code.gs` (o `Code.gs`) al editor de Google Apps Script.
3. Crear/actualizar el archivo `index` con el contenido de `dist/index.html`.
4. Implementar: "Implementar" > "Nueva implementación" > "Aplicación web".

> TIP: GAS no soporta rutas relativas, por eso el build puede inyectar CSS/JS directamente en `index.html`.

Más detalles técnicos y análisis en `docs/ANALYSIS.md` y `gas_deployment_instructions.txt` (si existen en el repo).

## Últimas Actualizaciones

- Integración para mostrar fotos del personal desde la columna `foto_url`.
- Mejora del buscador de requisitorias añadiendo el campo **Estado del Vehículo**.
- Automatización de la entrada/salida de unidades de reemplazo y vinculación con observaciones de taller.
- Motor de reportes en cliente usando `jsPDF` y `jsPDF-autotable` para reducir carga en GAS.

## 📄 Licencia

Este proyecto es de uso exclusivo para la gestión de Seguridad Ciudadana de la Municipalidad de Santiago de Surco.

---
*Desarrollado con ❤️ para mejorar la eficiencia operativa en Surco.*
