<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Reporte de Servicio

Aplicación web para la gestión operativa de unidades de seguridad, personal y reportes integrados por fecha, turno y sector. El frontend está construido con React, TypeScript y Vite, y se ejecuta como Web App en Google Apps Script con persistencia en Google Sheets.

## Vistas

- **Dashboard:** Edición en tiempo real de unidades (Choferes, Motos, Serenos) por sector
- **Visualización:** Vista consolidada de todos los sectores para el Reporte Integrado
- **Personal:** Gestión de la base de datos de personal operativo
- **Estadísticas:** Análisis visual de métricas operativas

## Ejecutar localmente

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

## Build para Google Apps Script

Genera una versión empaquetada en un solo archivo HTML:

```bash
npm run build:gas
```

El artefacto generado queda en `dist/index.html`. Copia el contenido a Google Apps Script.

Más detalles en [docs/ANALYSIS.md](docs/ANALYSIS.md) y [gas_deployment_instructions.txt](gas_deployment_instructions.txt).
