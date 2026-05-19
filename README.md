<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Reporte de Servicio

Aplicación web para la gestión operativa de unidades de seguridad, personal y reportes integrados por fecha, turno y sector. El frontend está construido con React, TypeScript y Vite, y se ejecuta como Web App en Google Apps Script con persistencia en Google Sheets.

## Vistas de la Aplicación

- **Dashboard (Panel de Edición):** Registro y edición en tiempo real de unidades operativas (Choferes, Motorizados, Serenos) organizadas por sector, cuadrante y estado de servicio.
- **Gestión de Retenes:** Administración y registro histórico de vehículos de reemplazo y bitácora de taller (ingreso, salida, horarios y motivos).
- **Vista Despachador (Visualización):** Vista consolidada de solo lectura de todos los sectores para el Reporte Integrado de Turno.
- **Buscador de Vehículos:** Consulta rápida de vehículos requisitoriados e información del estado del vehículo desde una base de datos externa.
- **Estadísticas:** Análisis visual de métricas operativas y distribución de recursos.
- **Vista de Personal:** Base de datos operativa de los serenos e inspectores, con soporte para visualizar régimen laboral, función actual y fotos del personal.
- **Centro de Reportes:** Generación y descarga directa en el cliente de reportes PDF estructurados (motos Yamaha/Honda, vehículos renting, reportes de asistencia detallados por régimen laboral y observaciones mecánicas).

## Últimas Actualizaciones

- **Visualización de Fotos de Personal:** Integración con la columna `foto_url` de la hoja externa de personal para mostrar imágenes del personal operativo de forma dinámica.
- **Buscador de Vehículos Integrado:** Mejoras en el buscador de requisitorias agregando el campo de **Estado del Vehículo**.
- **Gestión Completa de Retenes:** Automatización de entrada/salida de unidades de reemplazo y vinculación con observaciones de taller.
- **Motor de Reportes PDF:** Generación nativa en cliente mediante `jsPDF` y `jsPDF-autotable`, reduciendo la carga del servidor de Google Apps Script.

## Ejecución Local

**Requisitos previos:** Node.js instalado.

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo local
npm run dev
```

## Construcción y Despliegue para Google Apps Script

GAS requiere una estructura particular. Para empaquetar la aplicación ejecute:

```bash
npm run build:gas
```

Este comando genera los artefactos listos para su uso en la carpeta `dist/`:
- **`dist/Code.gs`**: Código backend de GAS.
- **`dist/index.html`**: Archivo de entrada HTML estructurado con directivas de GAS.
- **`dist/JavaScript.html`**: Bundle de JavaScript inyectado.
- **`dist/styles.html`**: Estilos compilados inyectados.
- **`dist/XLSX.html`**: Librería de soporte para manejo de hojas de cálculo.

Copia los contenidos de estos archivos al editor de Google Apps Script para actualizar la aplicación web.

Más detalles en [docs/ANALYSIS.md](docs/ANALYSIS.md) y [gas_deployment_instructions.txt](gas_deployment_instructions.txt).

