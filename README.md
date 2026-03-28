<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Reporte de Servicio

Aplicación web para la gestión operativa de unidades de seguridad, personal y reportes integrados por fecha, turno y sector. El frontend está construido con React, TypeScript y Vite, y el backend está pensado para ejecutarse como Web App en Google Apps Script con persistencia en Google Sheets.

## Documentación

Para una descripción de arquitectura, modelo de datos y vistas principales, revisa [Analysis Report](docs/ANALYSIS.md).

## Ejecutar localmente

**Prerequisites:** Node.js

1. Instala dependencias:
   `npm install`
2. Inicia el entorno de desarrollo:
   `npm run dev`

## Build de producción

Genera una versión empaquetada en un solo archivo HTML, lista para copiar a Google Apps Script:

`npm run build`

El artefacto generado queda en `dist/index.html`.

## Despliegue en Google Apps Script

Sigue las instrucciones de [gas_deployment_instructions.txt](gas_deployment_instructions.txt).
