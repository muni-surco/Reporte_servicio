# Caso UX: Sistema Integrado de Control Operativo (SICO) — MSS

## Resumen

**Reporte Integrado MSS** es una aplicación web SPA embebida en Google Apps Script que permite al equipo de Seguridad Ciudadana de Surco (Lima, Perú) registrar, monitorear y reportar el estado operativo de unidades de patrullaje en 14 sectores, durante 3 turnos diarios. Reemplazó un proceso manual en hojas de cálculo con una interfaz en tiempo real sobre Firebase Realtime Database.

**Rol en el proyecto:** Desarrollo full-stack (React + TypeScript + Tailwind → GAS → Firebase RTDB + Google Sheets).

---

## 1. Contexto y problema

### Usuarios identificados

| Persona | Rol | Necesidad principal | Dolor |
|---|---|---|---|
| **Operador C4** | Digitador por sector/turno | Registrar el estado de cada unidad (chofer, moto, sereno) de forma rápida y precisa | Interfaz lenta, datos dispersos en Sheets, pérdida de cambios no guardados |
| **Despachador** | Supervisor de todas las unidades en vivo | Ver el estado completo de los 14 sectores simultáneamente | No existía una vista unificada; debía preguntar sector por sector |
| **Jefe de Área** | Encargado de turno | Validar que el personal esté completo y los vehículos operativos | No tenía métricas ni dashboard de indicadores |
| **Analista** | Genera reportes diarios | Exportar reportes estructurados (observaciones, flota, faltas) | Proceso manual de copiar/pegar datos de Sheets a Word |

### Problemas detectados en el flujo anterior

1. **Sin persistencia en edición:** los operadores perdían cambios si cerraban la pestaña.
2. **Sin vista unificada:** el despachador debía consultar 14 hojas una por una.
3. **Sin indicadores:** no existía disponibilidad operativa en tiempo real.
4. **Reportes manuales:** cada reporte requería 20+ minutos de copiado/pegado.
5. **Sin trazabilidad:** no se registraba quién hizo cada cambio ni cuándo.

---

## 2. Principios de diseño

1. **Una página, sin navegación pesada:** todo ocurre en un solo HTML; los cambios de vista son inmediatos (sin recarga).
2. **Edición no bloqueante:** el operador puede seguir trabajando mientras los datos se guardan en segundo plano.
3. **Responsive para mobile:** los operadores usan tablets y laptops en campo.
4. **Offline-friendly (lectura):** los datos cacheados permiten consultar sin conexión.
5. **Carga progresiva:** primero la UI, luego los datos — el esqueleto de la app aparece antes que Firebase responda.

---

## 3. Flujos principales

### 3.1 Registro de unidad (DASHBOARD)

```
[Llega unidad al sector]
       ↓
Operador busca ID en autocomplete
       ↓
Selecciona tipo (CHOFER/MOTO/SERENO)
       ↓
Llena: personal, radio, cuadrante, estado, km, combustible
       ↓
Campos dinámicos según estado:
  - "MANTENIMIENTO" → oculta radio/cuadrante
  - "SIN VEHICULO" → requiere lugarEstado
       ↓
Click "GUARDAR" → cola de guardado no bloqueante
       ↓
Feedback visual: ícono de checkmark verde
```

**Decisión de UX:** Se usa cola de guardado asíncrona (enqueue + processQueue) porque el operador puede editar varias unidades rápidamente. El feedback visual (checkmark verde, checkmark rojo si falla) es inmediato sin bloquear la interfaz.

### 3.2 Monitoreo unificado (VISUALIZATION)

```
Despachador cambia a "Vista de Despachador"
       ↓
App dispara 14 llamadas paralelas (una por sector)
       ↓
Cada sector retorna solo unidades activas/patrullando
       ↓
Tarjetas agrupadas por sector en grilla responsive
       ↓
Cada tarjeta muestra: placa, personal, radio, estado
```

**Decisión de UX:** Las 14 llamadas paralelas usan un contador de completado (`completed++`) para agregar resultados cuando todas terminan. Timeout de seguridad de 15s para evitar que la UI se quede cargando infinitamente si una llamada falla.

### 3.3 Mapa de cuadrantes (MAP)

```
Carga GeoJSON de cuadrantes (getQuadrantsData)
       ↓
Renderiza polígonos en Leaflet con CartoDB tiles
       ↓
Color verde = personal asignado | rojo = vacío
       ↓
Opacidad variable según cantidad de unidades
       ↓
Click en cuadrante → popup con lista de unidades
       ↓
Buscador lateral: filtra por ID, nombre o radio
       ↓
Toggle de capas: dark/light mode
```

**Decisión de UX:** Dos refs independientes (`lightLayerRef`/`darkLayerRef`) evitan recrear el mapa al cambiar de tema. Los íconos Material Symbols se usan como texto en los popups para evitar dependencias de fuentes externas.

### 3.4 Estadísticas (STATISTICS)

```
Carga datos de 14 sectores en paralelo
       ↓
Calcula KPIs localmente:
  - Disponibilidad operativa (%)
  - Ratio personal/vehículo
  - Vehículos patrullando por sector
  - Personal presente por tipo
       ↓
Alertas automáticas:
  - Vehículos sin radio
  - Unidades sin chofer
  - Choferes sin vehículo
  - Unidades en mantenimiento
```

**Decisión de UX:** Todos los cálculos son client-side (sin round-trip al servidor). Las alertas usan códigos de color: rojo (error), ámbar (warning), azul (info). Las tarjetas de resumen usan colores distintivos (verde, slate, azul) para jerarquía visual.

---

## 4. Arquitectura de UX

### Mapa de navegación

```
Sidebar (íconos, 76px)
  │
  ├── Dashboard (default)
  │     └── Sector selector + Shift selector
  │         ├── CHOFERES (UnitCards editables)
  │         ├── MOTORIZADOS (UnitCards editables)
  │         └── SERENOS (UnitCards editables)
  │
  ├── Despachador (VISUALIZATION)
  │     └── Grilla de 14 sectores
  │
  ├── Estadísticas (STATISTICS)
  │     ├── KPIs principales
  │     ├── Tabla de patrullaje
  │     ├── Tabla de personal
  │     └── Alertas
  │
  ├── Mapa (MAP)
  │     ├── Leaflet map
  │     ├── Popups de cuadrantes
  │     ├── Buscador
  │     └── Filtros por tipo
  │
  ├── Reportes (REPORTS)
  │     └── 6 tipos de PDF + Excel
  │
  ├── Retenes (RETEN)
  │     ├── Formulario de ingreso
  │     └── Tabla de registros
  │
  ├── Personal (PERSONNEL)
  │     └── Buscador + tabla
  │
  ├── Vehículos (VEHICLE_SEARCH)
  │     └── Buscador por placa + resultados
  │
  └── Buscados (WANTED)
        └── Galería de fotos + modal detalle
```

### Patrón de interacción principal

```
[Vista actual] → useEffect → loadData()
  ├── Si view = VISUALIZATION → 14 calls paralelas con lastFetchedAtMap
  ├── Si view = STATISTICS/MAP → 14 calls paralelas sin caché
  ├── Si view = RETEN → 1 call por sector actual
  └── Default (DASHBOARD) → 1 call por sector actual
```

### Estados de la UI

Cada componente maneja 3 estados:

| Estado | Visual | Ejemplo |
|---|---|---|
| **Loading** | Skeleton/spinner | `loading === true` mientras Firebase responde |
| **Data** | Contenido completo | Tablas, tarjetas, mapa con datos |
| **Empty** | Mensaje "Sin datos" | `units.length === 0` en sector sin asignaciones |
| **Error** | Toast o console.error | Fallo en google.script.run |

---

## 5. Decisiones técnicas con impacto UX

### 5.1 Cola de guardado no bloqueante

```typescript
// App.tsx — enqueueSave / processQueue
saveQueueRef.current.push({ unit });
if (!isSavingRef.current) processQueue();
```

**Por qué:** El operador edita muchas unidades seguidas. Un save sincrónico bloquearía la UI 1-2 segundos por unidad. Con cola asíncrona, el feedback es instantáneo.

### 5.2 Cache de dos niveles en GAS

```javascript
// ScriptCache (rápido, intra-ejecución) + PropertiesService (persistente)
const cached = cache.get(cacheKey);
// si no, leer de PropertiesService
// si no, leer de Firebase RTDB
// escribir en ambos
```

**Por qué:** Las 14 llamadas paralelas de VISUALIZATION/STATISTICS/MAP compiten por los mismos datos. El cache evita 14 lecturas redundantes a Firebase RTDB (plan gratuito con límite de descargas).

### 5.3 Deduplicación de unidades

```typescript
// App.tsx — deduplicación por unit_id + sector + displayId
const finalUnitsMap = new Map<string, UnitData>();
incomingUnits.forEach(u => {
  const uniqueKey = `${sectorKey}_${displayId}`;
  if (!finalUnitsMap.has(uniqueKey)) finalUnitsMap.set(uniqueKey, u);
});
```

**Por qué:** Firebase puede devolver duplicados si un registro se escribió múltiples veces. La deduplicación garantiza que el operador vea cada unidad una sola vez.

### 5.4 Timeout de seguridad

```typescript
setTimeout(() => {
  if (loadingIdRef.current === currentLoadId) {
    setLoading(false); // fuerza fin de carga
  }
}, 15000);
```

**Por qué:** google.script.run no tiene timeout configurable. Si una llamada al servidor cuelga (Firebase lento, GAS timeout), la UI se queda en "cargando" para siempre.

### 5.5 Cuadrantes multi-select

```typescript
// Unidad puede cubrir múltiples cuadrantes separados por coma
parseQuadrants(u.quadrant).forEach(q => { ... });
```

**Por qué:** Una unidad de patrullaje no está fija en un solo cuadrante; puede cubrir varios. El separador `,` permite asignación múltiple.

---

## 6. Métricas de UX (objetivo)

| Métrica | Objetivo | Método de medición |
|---|---|---|
| Tiempo para cargar vista principal | < 3s | `console.time()` en loadData |
| Tiempo de guardado por unidad | < 1s (feedback inmediato) | Percepción del usuario + saveStatus |
| Tasa de éxito de guardado | > 99% | Conteo de success/error en cola |
| Tiempo para cargar Estadísticas | < 5s (14 sectores en paralelo) | `console.time()` en STATISTICS handler |
| Lecturas a Firebase por carga | < 15 (1 por sector) | `_fbReads` counter |
| Disponibilidad del mapa | 100% de cuadrantes renderizados | Conteo de features Leaflet vs SECTORS |

---

## 7. Próximas mejoras de UX identificadas

1. **Modo offline:** Service Worker para cachear el bundle HTML/JS y datos de referencia.
2. **Notificaciones en tiempo real:** Firebase Realtime Database listeners para actualizar datos sin click en "Actualizar".
3. **Editor colaborativo:** Detectar cuando otro operador editó la misma unidad (conflict resolution).
4. **Historial de cambios por unidad:** Línea de tiempo visual de cada `auditLog`.
5. **Tema personalizable:** El toggle dark/light actual es manual; podría sincronizarse con preferencia del sistema.
6. **Atajos de teclado:** Para operadores avanzados que prefieren navegar sin mouse.

---

*Documento generado el 2026-06-07*
