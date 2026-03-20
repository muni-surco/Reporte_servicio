# 📊 Surco - Reporte Integrado de Servicio (MSS)

Sistema avanzado de gestión y visualización de unidades de seguridad ciudadana para la Municipalidad de Santiago de Surco. Este proyecto permite el seguimiento en tiempo real, la edición de estados y la generación de reportes integrados en formato PDF para múltiples sectores operativos.

---

## ✨ Características Principales

-   **Dashboard de Control**: Gestión completa de unidades (Choferes, Motorizados y Serenos).
-   **Visualización Panorámica**: Vista resumen de la operatividad y personal de todos los sectores (GIR, Rescate, Sectores 1-9).
-   **Generación de Reportes**: Exportación a PDF (formato horizontal) con tablas detalladas por sector y tipo de unidad.
-   **Gestión de Estados**: Seguimiento de operatividad, combustible, kilometraje y partes/ocurrencias.
-   **Interfaz Premium**: Diseño moderno con Tailwind CSS, modo oscuro integrado y micro-animaciones.
-   **Integración GAS**: Preparado para despliegue como Web App en Google Apps Script.

## 🛠️ Stack Tecnológico

-   **Frontend**: [React 18](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
-   **Build Tool**: [Vite 6](https://vitejs.dev/)
-   **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
-   **PDF**: [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable)
-   **Backend**: [Google Apps Script](https://developers.google.com/apps-script)

## 📁 Estructura del Proyecto

```text
Reporte_servicio/
├── App.tsx             # Componente raíz y gestión de estado global
├── Code.gs             # Lógica de servidor para Google Apps Script
├── components/         # Componentes React (Sidebar, Header, UnitCard, etc.)
├── constants.ts        # Datos maestros, sectores y configuraciones iniciales
├── types.ts            # Definiciones de interfaces y enums de TypeScript
└── dist/               # Archivos compilados listos para producción
```

## 🚀 Instalación y Desarrollo

### Requisitos Previos
- Node.js (versión 18 o superior)
- npm o yarn

### Pasos para ejecución local

1. Clonar el repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
4. Abrir `http://localhost:5173` en el navegador.

## 📄 Licencia

Este proyecto es de uso exclusivo para la gestión de Seguridad Ciudadana de la Municipalidad de Santiago de Surco.

---
*Desarrollado con ❤️ para mejorar la eficiencia operativa en Surco.*
