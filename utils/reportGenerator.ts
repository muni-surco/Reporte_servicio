// We use the global jspdf and jspdf-autotable from the CDN in index.html
declare const jspdf: any;
declare const google: any;
declare const XLSX: any;

import { UnitData, AppSettings, Sector, PersonnelData, MobileReference, RetenReplacement, isTacticoPPFFStatus, sourceSectorsFor } from '../types';

// Los valores numéricos iguales a 0 se muestran en blanco en los reportes
const blankZero = (v: number | string): string => {
  const n = Number(v);
  return n ? String(v) : '';
};

// EFECTIVO debe ser igual o mayor que la suma de INOPERATIVOS + PATRULLANDO + SIN PATRULLAR.
// Solo cuando la suma es inferior a la flota del sector la celda se marca como
// 'Pendiente'; si es igual o mayor se muestra el número de efectivo.
const PENDING = 'Pendiente';
const efectivoOrPending = (efectivo: number, suma: number): string =>
  suma >= efectivo ? blankZero(efectivo) : PENDING;

// Línea gruesa y negra de separación vertical entre los bloques
// INOPERATIVOS | SIN PATRULLAR cuando se dibujan lado a lado.
// boundaryColumn = índice de la primera columna del bloque SIN PATRULLAR.
// Se usa con los hooks willDrawPage/didDrawPage para cubrir la altura
// dibujada en cada página (títulos + cabeceras + filas).
const blockSeparatorHooks = (doc: any, boundaryColumn: number, width: number = 2.2) => {
  const pageTops = new Map<number, number>();
  const boundaryX = (data: any) => {
    const m = data.settings.margin;
    const left = typeof m === 'number' ? m : (m && m.left) || 10;
    let x = left;
    for (let i = 0; i < boundaryColumn && i < data.table.columns.length; i++) {
      x += data.table.columns[i].width;
    }
    return x;
  };
  return {
    willDrawPage: (data: any) => {
      pageTops.set(data.pageNumber, data.cursor.y);
    },
    didDrawPage: (data: any) => {
      const topY = pageTops.get(data.pageNumber);
      if (topY == null) return;
      const x = boundaryX(data);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(width);
      doc.line(x, topY, x, data.cursor.y);
      doc.setLineWidth(0.15);
    }
  };
};

// --- HELPERS COMPARTIDOS (evitar duplicación entre generadores) ---

// Fecha larga en español: "lunes, 5 de mayo de 2026"
const formatLongDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return dateStr;
  }
};

// Fecha corta: "5-may-2026"
const formatShortDate = (dateStr: string): string => {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
};

// Normaliza texto a mayúsculas (para sectores, IDs, estados)
const normalizeText = (v: unknown) => String(v ?? '').trim().toUpperCase();

// Los reportes de motos reciben las unidades de getShiftData, que lee TODOS los
// buckets de sector. Al cambiar de sector, una unidad puede quedar almacenada en
// dos buckets a la vez y, como el sector se reasigna por el ID de la hoja DATA
// (mobileData), se contaría dos veces. Se conserva una sola copia por unidad,
// priorizando la que está guardada en el sector que manda la hoja DATA.
const dedupeUnitsByDataId = (units: UnitData[], mobileData: MobileReference[]): UnitData[] => {
  const dataSectorById = new Map<string, string>();
  mobileData.forEach(m => {
    const id = normalizeText(m.id);
    if (id && m.sector) dataSectorById.set(id, normalizeText(m.sector));
  });

  const keyOf = (u: UnitData): string => {
    const id = normalizeText(u.id);
    const type = normalizeText(u.type);
    if (id) return 'ID|' + id + '|' + type;
    const uid = String(u.unit_id || '').trim();
    if (uid) return 'UID|' + uid;
    return 'P1|' + normalizeText(u.personnel1) + '|' + type;
  };

  const best = new Map<string, UnitData>();
  units.forEach(u => {
    const key = keyOf(u);
    const current = best.get(key);
    if (!current) {
      best.set(key, u);
      return;
    }
    const dataSector = dataSectorById.get(normalizeText(u.id));
    if (!dataSector) return;
    const isPreferred = normalizeText(u.sector) === dataSector;
    const currentPreferred = normalizeText(current.sector) === dataSector;
    if (isPreferred && !currentPreferred) best.set(key, u);
  });

  return Array.from(best.values());
};

// Normaliza nombres de personal para matching exacto (sin puntos, comas ni espacios dobles)
const normalizeName = (val: any) => {
  return (val || '').toString()
    .trim()
    .toUpperCase()
    .replace(/\./g, '') // Remove dots (e.g., SOT. -> SOT)
    .replace(/,/g, '')  // Remove commas
    .replace(/\s+/g, ' '); // Normalize spaces
};

// Resuelve el operador del reporte: el pasado por parámetro o el del primer sector
const resolveOperator = (settingsMap: Record<string, any> | undefined, operatorName?: string) => {
  const first = ((settingsMap && Object.values(settingsMap)[0]) || { operador: '' }) as any;
  return operatorName || first.operador || '--';
};

// Supervisor CCO desde los ajustes del sector C4 (misma regla en todos los reportes)
const resolveC4Supervisor = (settingsMap: Record<string, any> | undefined) => {
  const map = settingsMap || {};
  const first = (Object.values(map)[0] || {}) as any;
  const c4Key = Object.keys(map).find(k => k.trim().toUpperCase().replace(/^SECTOR\s+/, '') === 'C4');
  const c4 = (c4Key ? (map as any)[c4Key] : null) || (map as any)['C4'] || (map as any)['SECTOR C4'] || null;
  return (((c4 as any)?.supervisor || '').trim() || first.supervisor || '').trim();
};

// Pie de página en TODAS las páginas: Generado el (izq.) alineado en la
// misma línea con SUPERVISOR CCO (der.), y OPERADOR CCO debajo
const stampReportFooter = (
  doc: any,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  supervisor: string,
  operator: string,
  timestamp: string
) => {
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado el: ${timestamp}`, margin, pageHeight - 9);
    doc.setFont('helvetica', 'bold');
    doc.text(`SUPERVISOR CCO: ${supervisor || '--'}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    doc.text(`OPERADOR CCO: ${operator || '--'}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  doc.setPage(totalPages);
};

export const generateMotoReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  modelFilter: string = 'XTZ150',
  titleSuffix: string = 'YAMAHA XTZ150',
  operatorName?: string,
  mobileData: MobileReference[] = []
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Filter specifically for the selected model (tolerant: ignores spaces/punctuation
  // and uses the short model key, since DATA may store 'XTZ 150' instead of 'YAMAHA XTZ150')
  const normModel = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[\s.\-_]+/g, '');
  const filterKeys = [normModel(modelFilter), normModel(titleSuffix)].filter(k => k);
  const motoUnits = dedupeUnitsByDataId(units, mobileData).filter(u => {
    if (u.type !== 'MOTO') return false;
    const m = normModel(u.model);
    if (!m) return false;
    return filterKeys.some(k => m.includes(k) || k.includes(m));
  });
  // Matcher del modelo para la flota DATA (misma tolerancia que el filtro de registros)
  const isFleetModel = (model: unknown) => {
    const m = normModel(model);
    if (!m) return false;
    return filterKeys.some(k => m.includes(k) || k.includes(m));
  };

  // Normalizador de texto (declarado antes de su primer uso)
  const normalize = normalizeText;

  // Sector por ID de mobileData (hoja DATA), con fallback a u.sector
  const sectorById = new Map<string, string>();
  mobileData.forEach(m => {
    const id = normalize(m.id);
    if (m.sector) sectorById.set(id, normalize(m.sector));
  });
  const getSector = (u: UnitData) => {
    const fromData = sectorById.get(normalize(u.id));
    return fromData || normalize(u.sector);
  };

  // --- HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`REPORTE NUMÉRICO MOTOS ${titleSuffix}`, pageWidth / 2, 15, { align: 'center' });

  // Shift Box
  doc.setLineWidth(0.7);
  doc.rect(margin + 20, 20, pageWidth - (margin * 2) - 40, 15);
  doc.setFontSize(22);
  doc.text(`TURNO ${shift}`, pageWidth / 2, 31, { align: 'center' });

  // Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(formatLongDate(date).toUpperCase(), pageWidth / 2, 42, { align: 'center' });

  // --- SUMMARY TABLE ---
  const sectors = [
    '1A', '1B', '2A', '2B', '3',
    '4', '5', '6', '7', '8',
    '9A', '9B', 'GIR', 'OTRAS AREAS'
  ];

  // MANTENIMIENTO se considera PATRULLANDO (no inoperativo) en motos.
  const inoperativeStatuses = ['DESPERFECTOS', 'SINIESTRO'];
  const isPatrullandoStatus = (status: unknown) => {
    const s = String(status || '').trim().toUpperCase();
    return s === 'PATRULLANDO' || s === 'APOYO' || s.includes('APOYO') || s === 'MANTENIMIENTO';
  };

  const summaryRows = sectors.map(s => {
    const sectorCode = normalize(s);
    // OTRAS AREAS agrupa FISCA/ADM/TRANSITO (igual que el reporte de flota)
    const allowedSectors = sectorCode === 'OTRAS AREAS'
      ? sourceSectorsFor(s).map(x => normalize(x))
      : [sectorCode];
    const inSector = (sectorValue: unknown) => allowedSectors.includes(normalize(sectorValue));
    const sectorUnits = motoUnits.filter(u => inSector(getSector(u)));
    // EFECTIVO: total por sector desde la hoja DATA (mobileData), no cuenta registros.
    // Se matchea solo por modelo (sin exigir type=MOTO) para no excluir filas
    // DATA con la columna tipo vacía o mal rotulada.
    const efectivo = mobileData.filter(m => isFleetModel(m.model) && inSector(m.sector)).length;
    const inoperativos = sectorUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const patrullando = sectorUnits.filter(u => isPatrullandoStatus(u.status)).length;
    // SIN PATRULLAR se calcula por conteo directo, no por resta, para detectar
    // inconsistencias entre la flota (DATA) y los registros del turno.
    const sinPatrullar = sectorUnits.filter(u => !isPatrullandoStatus(u.status) && !inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const suma = inoperativos + patrullando + sinPatrullar;

    return [
      s,
      efectivoOrPending(efectivo, suma),
      blankZero(inoperativos),
      blankZero(patrullando),
      blankZero(sinPatrullar)
    ];
  });

  // Calculate Totals (los 'Pendiente' se acumulan como pendientes, no como cero)
  const totals = summaryRows.reduce((acc: number[], curr: any[]) => {
    acc[0] += curr[1] === PENDING ? 0 : (Number(curr[1]) || 0);
    acc[1] += Number(curr[2]) || 0;
    acc[2] += Number(curr[3]) || 0;
    acc[3] += Number(curr[4]) || 0;
    acc[4] += curr[1] === PENDING ? 1 : 0;
    return acc;
  }, [0, 0, 0, 0, 0]);

  summaryRows.push([
    'TOTALES',
    totals[4] > 0 ? PENDING : blankZero(totals[0]),
    blankZero(totals[1]),
    blankZero(totals[2]),
    blankZero(totals[3])
  ]);

  (doc as any).autoTable({
    startY: 48,
    head: [[
      { content: `PATRULLAJE MOTOS ${titleSuffix}`, colSpan: 5, styles: { halign: 'center', fillColor: [38, 70, 83] } }
    ], [
      'SECTORES', 'EFECTIVO', 'INOPERATIVOS', 'PATRULLANDO', 'SIN PATRULLAR'
    ]],
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 9, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [42, 157, 143], textColor: [255, 255, 255], fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 35, fillColor: [240, 240, 240] },
      1: { cellWidth: 25 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 }
    },
    didParseCell: function (data: any) {
      if (data.row.section === 'body') {
        const isTotalRow = data.row.index === summaryRows.length - 1;

        // Color for 'EFECTIVO' column (Green)
        if (data.column.index === 1) {
          data.cell.styles.fillColor = [144, 238, 144]; // Light Green
        }
        // Color for 'INOPERATIVOS' column (Red)
        if (data.column.index === 2) {
          data.cell.styles.fillColor = [255, 182, 193]; // Light Coral
        }
        // Color for 'PATRULLANDO' and 'SIN PATRULLAR' (Yellowish)
        if (data.column.index >= 3) {
          data.cell.styles.fillColor = [255, 255, 224]; // Light Yellow
        }

        if (isTotalRow) {
          data.cell.styles.fillColor = [38, 70, 83];
          data.cell.styles.textColor = [255, 255, 255];
          if (data.column.index === 1) data.cell.styles.fillColor = [40, 167, 69];
          if (data.column.index === 2) data.cell.styles.fillColor = [220, 53, 69];
          if (data.column.index >= 3) data.cell.styles.fillColor = [255, 193, 7];
        }
      }
    },
    margin: { left: 30, right: 30 }
  });

  let finalY = (doc as any).lastAutoTable.finalY + 2;

  // --- PERMANENCIA (sin cuadro OPERADOR CCO) ---
  // Supervisor CCO debe provenir del sector C4 (requerimiento específico para reporte de motos)
  const c4Supervisor = resolveC4Supervisor(settingsMap) || (((Object.values(settingsMap)[0] || {}) as any).supervisor || '');
  const resolvedOperator = resolveOperator(settingsMap, operatorName);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0);

  finalY += 2;

  // --- DETAILS --- n° / unidad / estado / motivo
  const inopData = motoUnits
    .filter(u => !isPatrullandoStatus(u.status) && inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || 'NO APLICA', (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase()]);

  const sinPatrullarData = motoUnits
    .filter(u => !isPatrullandoStatus(u.status) && !inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || '', (u.motivoEstado || u.mechanics || '').toString().toUpperCase()]);

  // Una sola tabla de 8 columnas (dos bloques lado a lado) para que
  // INOPERATIVOS y SIN PATRULLAR siempre queden alineados,
  // incluso si el contenido fluye a más páginas
  const detailRows: any[][] = [];
  const maxDetailRows = Math.max(inopData.length, sinPatrullarData.length);
  for (let i = 0; i < maxDetailRows; i++) {
    detailRows.push([
      ...(inopData[i] || ['', '', '', '']),
      ...(sinPatrullarData[i] || ['', '', '', ''])
    ]);
  }

  // Bloques INOPERATIVOS | SIN PATRULLAR lado a lado con correlativo a la izquierda
  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'INOPERATIVOS', colSpan: 4, styles: { halign: 'center', fillColor: [220, 53, 69] } },
      { content: 'SIN PATRULLAR', colSpan: 4, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }
    ], [
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO',
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: detailRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 15 }, 2: { cellWidth: 24 },
      4: { cellWidth: 8 }, 5: { cellWidth: 14 }, 6: { cellWidth: 24 }
    },
    ...blockSeparatorHooks(doc, 4),
    margin: { left: margin, right: margin }
  });

  // --- FOOTER (mismo estilo que reporte renting) ---
  const footerY = pageHeight - 20;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  stampReportFooter(doc, pageWidth, pageHeight, margin, c4Supervisor, resolvedOperator, new Date().toLocaleString());

  // Timestamp
  // Timestamp integrado al pie de página (stampReportFooter)

  const fileName = `REPORTE_MOTOS_${titleSuffix.toUpperCase()}_${shift}_${date}.pdf`;
  doc.save(fileName);
};

export const generateConsolidatedMotoReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string,
  mobileData: MobileReference[] = []
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Normalizador de texto (declarado antes de su primer uso)
  const normalize = normalizeText;

  // Sector por ID de mobileData (hoja DATA), con fallback a u.sector
  const sectorById = new Map<string, string>();
  mobileData.forEach(m => {
    const id = normalize(m.id);
    if (m.sector) sectorById.set(id, normalize(m.sector));
  });
  const getSector = (u: UnitData) => {
    const fromData = sectorById.get(normalize(u.id));
    return fromData || normalize(u.sector);
  };

  // Tolerant model matching (same criteria as the individual moto reports)
  const normModel = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[\s.\-_]+/g, '');
  const modelKeysFor = (modelFilter: string, titleSuffix: string) =>
    [normModel(modelFilter), normModel(titleSuffix)].filter(k => k);
  const uniqueUnits = dedupeUnitsByDataId(units, mobileData);
  const motoUnitsFor = (modelFilter: string, titleSuffix: string) => {
    const filterKeys = modelKeysFor(modelFilter, titleSuffix);
    return uniqueUnits.filter(u => {
      if (u.type !== 'MOTO') return false;
      const m = normModel(u.model);
      if (!m) return false;
      return filterKeys.some(k => m.includes(k) || k.includes(m));
    });
  };
  const yamahaUnits = motoUnitsFor('YAMAHA XTZ150', 'YAMAHA XTZ150');
  const hondaUnits = motoUnitsFor('HONDA SAHARA XRE 300', 'HONDA SAHARA XRE 300');
  // Matcher combinado Yamaha+Honda para contar la flota desde DATA
  const allModelKeys = [...modelKeysFor('YAMAHA XTZ150', 'YAMAHA XTZ150'), ...modelKeysFor('HONDA SAHARA XRE 300', 'HONDA SAHARA XRE 300')];
  const isFleetModel = (model: unknown) => {
    const m = normModel(model);
    if (!m) return false;
    return allModelKeys.some(k => m.includes(k) || k.includes(m));
  };

  // --- HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REPORTE NUMÉRICO MOTOS', pageWidth / 2, 15, { align: 'center' });

  // Shift Box
  doc.setLineWidth(0.7);
  doc.rect(margin + 20, 20, pageWidth - (margin * 2) - 40, 15);
  doc.setFontSize(22);
  doc.text(`TURNO ${shift}`, pageWidth / 2, 31, { align: 'center' });

  // Date
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(formatLongDate(date).toUpperCase(), pageWidth / 2, 42, { align: 'center' });

  // --- SUMMARY TABLES ---
  const sectors = [
    '1A', '1B', '2A', '2B', '3',
    '4', '5', '6', '7', '8',
    '9A', '9B', 'GIR', 'OTRAS AREAS'
  ];

  // MANTENIMIENTO se considera PATRULLANDO (no inoperativo) en motos.
  const inoperativeStatuses = ['DESPERFECTOS', 'SINIESTRO'];
  const isPatrullandoStatus = (status: unknown) => {
    const s = String(status || '').trim().toUpperCase();
    return s === 'PATRULLANDO' || s === 'APOYO' || s.includes('APOYO') || s === 'MANTENIMIENTO';
  };

  const renderMotoSummary = (motoUnits: UnitData[], label: string, startY: number) => {
    const summaryRows = sectors.map(s => {
      const sectorCode = normalize(s);
      // OTRAS AREAS agrupa FISCA/ADM/TRANSITO (igual que el reporte de flota)
      const allowedSectors = sectorCode === 'OTRAS AREAS'
        ? sourceSectorsFor(s).map(x => normalize(x))
        : [sectorCode];
      const inSector = (sectorValue: unknown) => allowedSectors.includes(normalize(sectorValue));
      const sectorUnits = motoUnits.filter(u => inSector(getSector(u)));
      // EFECTIVO: total por sector desde la hoja DATA (mobileData), no cuenta registros
      const efectivo = mobileData.filter(m => isFleetModel(m.model) && inSector(m.sector)).length;
      const inoperativos = sectorUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
      const patrullando = sectorUnits.filter(u => isPatrullandoStatus(u.status)).length;
      // SIN PATRULLAR por conteo directo para detectar inconsistencias
      const sinPatrullar = sectorUnits.filter(u => !isPatrullandoStatus(u.status) && !inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
      const suma = inoperativos + patrullando + sinPatrullar;

      return [
        sectorCode,
        efectivoOrPending(efectivo, suma),
        blankZero(inoperativos),
        blankZero(patrullando),
        blankZero(sinPatrullar)
      ];
    });

    // Calculate Totals (los 'Pendiente' se acumulan como pendientes, no como cero)
    const totals = summaryRows.reduce((acc: number[], curr: any[]) => {
      acc[0] += curr[1] === PENDING ? 0 : (Number(curr[1]) || 0);
      acc[1] += Number(curr[2]) || 0;
      acc[2] += Number(curr[3]) || 0;
      acc[3] += Number(curr[4]) || 0;
      acc[4] += curr[1] === PENDING ? 1 : 0;
      return acc;
    }, [0, 0, 0, 0, 0]);

    summaryRows.push([
      'TOTALES',
      totals[4] > 0 ? PENDING : blankZero(totals[0]),
      blankZero(totals[1]),
      blankZero(totals[2]),
      blankZero(totals[3])
    ]);

    (doc as any).autoTable({
      startY,
      head: [[
        { content: `PATRULLAJE MOTOS ${label}`, colSpan: 5, styles: { halign: 'center', fillColor: [38, 70, 83] } }
      ], [
        'SECTORES', 'EFECTIVO', 'INOPERATIVOS', 'PATRULLANDO', 'SIN PATRULLAR'
      ]],
      body: summaryRows,
      theme: 'grid',
      styles: { fontSize: 9, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { fillColor: [42, 157, 143], textColor: [255, 255, 255], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35, fillColor: [240, 240, 240] },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 }
      },
      didParseCell: function (data: any) {
        if (data.row.section === 'body') {
          const isTotalRow = data.row.index === summaryRows.length - 1;

          // Color for 'EFECTIVO' column (Green)
          if (data.column.index === 1) {
            data.cell.styles.fillColor = [144, 238, 144]; // Light Green
          }
          // Color for 'INOPERATIVOS' column (Red)
          if (data.column.index === 2) {
            data.cell.styles.fillColor = [255, 182, 193]; // Light Coral
          }
          // Color for 'PATRULLANDO' and 'SIN PATRULLAR' (Yellowish)
          if (data.column.index >= 3) {
            data.cell.styles.fillColor = [255, 255, 224]; // Light Yellow
          }

          if (isTotalRow) {
            data.cell.styles.fillColor = [38, 70, 83];
            data.cell.styles.textColor = [255, 255, 255];
            if (data.column.index === 1) data.cell.styles.fillColor = [40, 167, 69];
            if (data.column.index === 2) data.cell.styles.fillColor = [220, 53, 69];
            if (data.column.index >= 3) data.cell.styles.fillColor = [255, 193, 7];
          }
        }
      },
      margin: { left: 30, right: 30 }
    });

    return (doc as any).lastAutoTable.finalY + 2;
  };

  // Resumen único combinado Yamaha + Honda
  // (evita duplicados si una unidad matcheara ambos modelos)
  const seenMotoKeys = new Set<string>();
  const allMotoUnits = [...yamahaUnits, ...hondaUnits].filter(u => {
    const key = u.unit_id || u.id;
    if (key && seenMotoKeys.has(key)) return false;
    if (key) seenMotoKeys.add(key);
    return true;
  });
  let finalY = renderMotoSummary(allMotoUnits, 'YAMAHA + HONDA', 48);

  // --- FOOTER DATA ---
  // Supervisor CCO debe provenir del sector C4 (requerimiento específico para reporte de motos)
  const c4Supervisor = resolveC4Supervisor(settingsMap) || (((Object.values(settingsMap)[0] || {}) as any).supervisor || '');
  const resolvedOperator = resolveOperator(settingsMap, operatorName);

  finalY += 2;

  // --- DETAILS (combined Yamaha + Honda) --- n° / unidad / estado / motivo
  // Una sola tabla de 8 columnas (dos bloques lado a lado) para que
  // INOPERATIVOS y SIN PATRULLAR siempre queden al mismo nivel,
  // incluso si el contenido fluye a más páginas
  const inopRows = allMotoUnits
    .filter(u => !isPatrullandoStatus(u.status) && inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || 'NO APLICA', (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase()]);

  const sinPatRows = allMotoUnits
    .filter(u => !isPatrullandoStatus(u.status) && !inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || '', (u.motivoEstado || u.mechanics || '').toString().toUpperCase()]);

  const detailRows: any[][] = [];
  // Solo registros, sin filas en blanco de relleno
  const maxDetailRows = Math.max(inopRows.length, sinPatRows.length);
  for (let i = 0; i < maxDetailRows; i++) {
    detailRows.push([
      ...(inopRows[i] || ['', '', '', '']),
      ...(sinPatRows[i] || ['', '', '', ''])
    ]);
  }

  // Si el bloque de detalle no cabe en la página, empezar en una nueva
  if (finalY > pageHeight - 85) {
    doc.addPage();
    finalY = 15;
  }

  // Bloques INOPERATIVOS | SIN PATRULLAR lado a lado con correlativo a la izquierda
  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'INOPERATIVOS', colSpan: 4, styles: { halign: 'center', fillColor: [220, 53, 69] } },
      { content: 'SIN PATRULLAR', colSpan: 4, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }
    ], [
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO',
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: detailRows,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 15 }, 2: { cellWidth: 24 },
      4: { cellWidth: 8 }, 5: { cellWidth: 14 }, 6: { cellWidth: 24 }
    },
    ...blockSeparatorHooks(doc, 4),
    margin: { left: margin, right: margin }
  });

  // --- FOOTER (mismo estilo que reporte renting) ---
  const footerY = pageHeight - 20;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  stampReportFooter(doc, pageWidth, pageHeight, margin, c4Supervisor, resolvedOperator, new Date().toLocaleString());

  // Timestamp
  // Timestamp integrado al pie de página (stampReportFooter)

  const fileName = `REPORTE_MOTOS_CONSOLIDADO_${shift}_${date}.pdf`;
  doc.save(fileName);
};

export interface FleetReportOptions {
  fleetPredicate: (m: MobileReference) => boolean;
  title: string;
  tableHeader: string;
  camionetaHeader: string;
  filePrefix: string;
  // true = una sola tabla con todos los sectores (no separa FLOTA CAMIONETAS)
  singleTable?: boolean;
  // true = la flota usa retén; en la tabla INOPERATIVOS la columna RETEN
  // muestra 'NO APLICA' solo para esta flota (autos renting)
  retenAplica?: boolean;
}

const generateFleetReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName: string,
  mobileData: MobileReference[],
  retenData: RetenReplacement[] = [],
  opts: FleetReportOptions
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Filter for CHOFER units (Vehicles) belonging to the fleet (RENTING / SIPCOP)
  const normalize = normalizeText;

  // Vigencia del retén según hora actual: sigue vigente salvo que tenga salida
  // de taller registrada con fecha/hora ya pasada (el reemplazo ya terminó).
  // Sin salida registrada o con formato inválido se considera vigente.
  const reportNow = new Date().getTime();
  const parseRetenSalida = (r: RetenReplacement): number | null => {
    const fs = (r.fechaSalidaTaller || '').trim();
    if (!fs) return null;
    const hs = (r.horaSalidaTaller || '').trim() || '00:00';
    const d = new Date(`${fs}T${/^\d{2}:\d{2}$/.test(hs) ? hs + ':00' : hs}`);
    const t = d.getTime();
    return isNaN(t) ? null : t;
  };
  const isRetenActive = (r: RetenReplacement) => {
    const salida = parseRetenSalida(r);
    return salida === null || salida > reportNow;
  };
  // retenUnit -> tiene al menos un registro vigente (false = todos terminados)
  const retenHasActive = new Map<string, boolean>();
  (retenData || []).forEach(r => {
    const key = normalize(r.retenUnit);
    if (!key) return;
    if (isRetenActive(r)) retenHasActive.set(key, true);
    else if (!retenHasActive.has(key)) retenHasActive.set(key, false);
  });
  const fleetMobileIds = new Set(
    mobileData
      .filter(m => opts.fleetPredicate(m))
      .map(m => normalize(m.id))
  );
  // Evita contar dos veces una unidad que quedó guardada en más de un sector
  const uniqueUnits = dedupeUnitsByDataId(units, mobileData);
  const vehicleUnits = uniqueUnits.filter(u => u.type === 'CHOFER' && fleetMobileIds.has(normalize(u.id)));

  // --- HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.title, pageWidth / 2, 12, { align: 'center' });

  // Shift Box
  doc.setLineWidth(0.5);
  doc.rect(margin + 20, 16, pageWidth - (margin * 2) - 40, 12);
  doc.setFontSize(22);
  doc.text(shift.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

  // Date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(formatLongDate(date), pageWidth / 2, 33, { align: 'center' });

  // --- SUMMARY TABLES (FLOTA VEHICULAR + FLOTA CAMIONETAS) ---
  // OTRAS AREAS agrupa la flota/unidades de los sectores FISCA, ADM y TRANSITO.
  // GIR, RESCATE y OTRAS AREAS van en una tabla aparte debajo: FLOTA CAMIONETAS.
  const mainSectors = [
    '1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B'
  ];
  const camionetaSectors = ['GIR', 'RESCATE', 'OTRAS AREAS'];

  // MANTENIMIENTO se considera PATRULLANDO (no inoperativo) en vehículos.
  const inoperativeStatuses = ['DESPERFECTOS', 'SINIESTRO'];

  const buildFleetRow = (s: string, retenNA = false) => {
    const isOtrasAreas = normalize(s) === 'OTRAS AREAS';
    const sectorUnits = vehicleUnits.filter(u =>
      isOtrasAreas ? normalize(u.sector) === 'OTRAS AREAS' : normalize(u.sector).includes(s)
    );
    const baseFleet = mobileData.filter(u =>
      opts.fleetPredicate(u) &&
      (isOtrasAreas ? sourceSectorsFor(s).includes(normalize(u.sector)) : normalize(u.sector).includes(s))
    ).length;

    // Count Reten based on ID starting with AR- (replacement vehicles AR-1 to AR-12).
    // AR units are counted even when their DATA row lacks the fleet mark
    // (e.g. SIPCOP), since a registered replacement always belongs to the sector.
    const sectorChoferUnits = uniqueUnits.filter(u =>
      u.type === 'CHOFER' &&
      (isOtrasAreas ? normalize(u.sector) === 'OTRAS AREAS' : normalize(u.sector).includes(s))
    );
    // Solo cuentan los retenes vigentes: si su reemplazo ya terminó (salida de taller pasada), no cuenta
    const countReten = sectorChoferUnits.filter(u => {
      const id = normalize(u.id);
      return id.startsWith('AR-') && retenHasActive.get(id) !== false;
    }).length;

    // Regular statuses only for non-AR units
    const regularUnits = sectorUnits.filter(u => !normalize(u.id).startsWith('AR-'));

    const countInoperativos = regularUnits.filter(u => inoperativeStatuses.includes(normalize(u.status))).length;
    // TACTICO PP.FF. y MANTENIMIENTO se consideran como PATRULLANDO
    const countPatrullando = regularUnits.filter(u =>
      normalize(u.status) === 'PATRULLANDO' ||
      normalize(u.status) === 'MANTENIMIENTO' ||
      isTacticoPPFFStatus(u.status)
    ).length;
    const countSinPatrullar = regularUnits.filter(u =>
      normalize(u.status) !== 'PATRULLANDO' &&
      normalize(u.status) !== 'MANTENIMIENTO' &&
      !inoperativeStatuses.includes(normalize(u.status)) &&
      normalize(u.status) !== 'SIN VEHICULO' &&
      !isTacticoPPFFStatus(u.status)
    ).length;

    const efectivo = baseFleet; // Usar flota base
    // Validación: EFECTIVO debe ser la suma de INOPERATIVOS + PATRULLANDO + SIN PATRULLAR
    const sumaEfectivo = countInoperativos + countPatrullando + countSinPatrullar;

    return [
      s,
      efectivoOrPending(efectivo, sumaEfectivo),
      blankZero(countInoperativos),
      blankZero(countPatrullando),
      blankZero(countSinPatrullar),
      // En FLOTA CAMIONETAS el retén no aplica
      retenNA ? 'NO APLICA' : blankZero(countReten)
    ];
  };

  // Calculate Totals (los 'Pendiente' se acumulan como pendientes, no como cero)
  const withTotals = (rows: any[][], retenNA: boolean) => {
    const totals = rows.reduce((acc: number[], curr: any[]) => {
      acc[0] += curr[1] === PENDING ? 0 : (Number(curr[1]) || 0);
      acc[1] += Number(curr[2]) || 0;
      acc[2] += Number(curr[3]) || 0;
      acc[3] += Number(curr[4]) || 0;
      acc[4] += Number(curr[5]) || 0;
      acc[5] += curr[1] === PENDING ? 1 : 0;
      return acc;
    }, [0, 0, 0, 0, 0, 0]);

    rows.push([
      'TOTALES',
      totals[5] > 0 ? PENDING : blankZero(totals[0]),
      blankZero(totals[1]),
      blankZero(totals[2]),
      blankZero(totals[3]),
      retenNA ? 'NO APLICA' : blankZero(totals[4])
    ]);
    return rows;
  };

  const renderFleetSummary = (title: string, rows: any[][], startY: number) => {
    (doc as any).autoTable({
      startY,
      head: [[
        { content: title, colSpan: 6, styles: { halign: 'center', fillColor: [38, 70, 83] } }
      ], [
        'SECTORES', 'EFECTIVO', 'INOPERATIVOS', 'PATRULLANDO', 'SIN PATRULLAR', 'RETEN'
      ]],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 7.5, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 1 },
      headStyles: { fillColor: [42, 157, 143], textColor: [255, 255, 255], fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 35, fillColor: [240, 240, 240] },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 }
      },
      didParseCell: function (data: any) {
        if (data.row.section === 'body') {
          const isTotalRow = data.row.index === rows.length - 1;

          if (data.column.index === 1) data.cell.styles.fillColor = [220, 255, 220];
          if (data.column.index === 2) data.cell.styles.fillColor = [255, 200, 200];
          if (data.column.index === 3) data.cell.styles.fillColor = [255, 255, 200];
          if (data.column.index === 4) data.cell.styles.fillColor = [255, 255, 200];
          if (data.column.index === 5) data.cell.styles.fillColor = [255, 230, 230];

          if (isTotalRow) {
            data.cell.styles.fillColor = [38, 70, 83];
            data.cell.styles.textColor = [255, 255, 255];
            if (data.column.index === 1) data.cell.styles.fillColor = [40, 167, 69];
            if (data.column.index === 2) data.cell.styles.fillColor = [220, 53, 69];
            if (data.column.index === 3) data.cell.styles.fillColor = [255, 193, 7];
            if (data.column.index === 4) data.cell.styles.fillColor = [255, 193, 7];
            if (data.column.index === 5) data.cell.styles.fillColor = [220, 160, 160];
          }
        }
      },
      margin: { left: 15, right: 15 }
    });
    return (doc as any).lastAutoTable.finalY;
  };

  if (opts.singleTable) {
    // Una sola tabla consolidada con todos los sectores (no se separa camionetas)
    const consolidatedRows = withTotals(
      [...mainSectors, ...camionetaSectors].map(s => buildFleetRow(s, false)),
      false
    );
    renderFleetSummary(opts.tableHeader, consolidatedRows, 38);
  } else {
    const summaryRows = withTotals(mainSectors.map(s => buildFleetRow(s, false)), false);
    const camionetaRows = withTotals(camionetaSectors.map(s => buildFleetRow(s, true)), true);
    renderFleetSummary(opts.tableHeader, summaryRows, 38);
    renderFleetSummary(opts.camionetaHeader, camionetaRows, (doc as any).lastAutoTable.finalY + 6);
  }

  let finalY = (doc as any).lastAutoTable.finalY + 2;

  // --- PERMANENCIA + OPERADOR CCO ---
  // Supervisor CCO debe provenir del sector C4 (mismo criterio que reporte motos)
  const c4Supervisor = resolveC4Supervisor(settingsMap) || (((Object.values(settingsMap)[0] || {}) as any).supervisor || '');
  const resolvedOperator = resolveOperator(settingsMap, operatorName);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  finalY += 2;

  // --- DETAILS TABLES ---
  const retenByUnit = new Map<string, string>();
  (retenData || []).forEach(r => {
    if (!isRetenActive(r)) return; // los terminados se agregan después con etiqueta
    const key = normalize(r.replacedUnit);
    if (key && !retenByUnit.has(key)) retenByUnit.set(key, String(r.retenUnit || '').trim());
  });
  // Reemplazos terminados: TERMINADO (hora salida taller)
  (retenData || []).forEach(r => {
    if (isRetenActive(r)) return;
    const key = normalize(r.replacedUnit);
    if (key && !retenByUnit.has(key)) {
      const hora = (r.horaSalidaTaller || '').trim() || (r.fechaSalidaTaller || '').trim();
      retenByUnit.set(key, hora ? `TERMINADO (${hora.toUpperCase()})` : 'TERMINADO');
    }
  });

  const inopData = vehicleUnits
    .filter(u => !normalize(u.id).startsWith('AR-') && inoperativeStatuses.includes(normalize(u.status)))
    .map((u, idx) => [
      String(idx + 1),
      u.id,
      (u.lugarEstado || 'NO APLICA').toString().toUpperCase(),
      (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase(),
      // 'NO APLICA' en RETEN para los sectores sin retén (GIR, RESCATE, OTRAS AREAS);
      // 'NO APLICA' por defecto para la flota de autos renting (retenAplica=false);
      // en SIPCOP/Consolidado se muestra '--' si no tiene retén asignado
      camionetaSectors.includes(normalize(u.sector))
        ? 'NO APLICA'
        : (opts.retenAplica === false
            ? (retenByUnit.get(normalize(u.id)) || 'NO APLICA')
            : (retenByUnit.get(normalize(u.id)) || '--'))
    ]);

  const sinPatrullarData = vehicleUnits
    .filter(u => {
      const status = normalize(u.status);
      const id = normalize(u.id);
      return (
        !id.startsWith('AR-') &&
        status !== 'PATRULLANDO' &&
        status !== 'MANTENIMIENTO' &&
        !inoperativeStatuses.includes(status) &&
        status !== 'SIN VEHICULO' &&
        status !== 'FIN APOYO' &&
        !isTacticoPPFFStatus(u.status)
      );
    })
    .map((u, idx) => [String(idx + 1), u.id, normalize(u.status) || 'NO APLICA', (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase()]);

  // Una sola tabla de 9 columnas (dos bloques lado a lado) para que
  // INOPERATIVOS y SIN PATRULLAR siempre queden alineados,
  // incluso si el contenido fluye a más páginas
  const detailRows: any[][] = [];
  const maxDetailRows = Math.max(inopData.length, sinPatrullarData.length);
  for (let i = 0; i < maxDetailRows; i++) {
    detailRows.push([
      ...(inopData[i] || ['', '', '', '', '']),
      ...(sinPatrullarData[i] || ['', '', '', ''])
    ]);
  }

  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'INOPERATIVOS', colSpan: 5, styles: { halign: 'center', fillColor: [220, 53, 69] } },
      { content: 'SIN PATRULLAR', colSpan: 4, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }
    ], [
      'N°', 'UNIDAD', 'LUGAR', 'MOTIVO', 'RETEN',
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: detailRows,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 8 }, 1: { cellWidth: 14 }, 2: { cellWidth: 22 }, 4: { cellWidth: 18 },
      5: { cellWidth: 8 }, 6: { cellWidth: 14 }, 7: { cellWidth: 28 }
    },
    ...blockSeparatorHooks(doc, 5),
    margin: { left: margin, right: margin }
  });

  const previousAutoTable = (doc as any).lastAutoTable;
  const finalDetailY = Math.max(previousAutoTable ? previousAutoTable.finalY : 0, finalY);

  // --- FOOTER ---
  const footerY = pageHeight - 20;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  stampReportFooter(doc, pageWidth, pageHeight, margin, c4Supervisor, resolvedOperator, new Date().toLocaleString());

  // Timestamp integrado al pie de página (stampReportFooter)

  const fileName = `${opts.filePrefix}_${shift.toUpperCase()}_${date}.pdf`;
  doc.save(fileName);
};

export const generateVehicleReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName: string,
  mobileData: MobileReference[],
  retenData: RetenReplacement[] = []
) => generateFleetReport(units, settingsMap, date, shift, operatorName, mobileData, retenData, {
  fleetPredicate: (m) => m.type === 'CHOFER' && String(m.propiedad ?? '').trim().toUpperCase() === 'RENTING',
  title: 'REPORTE NUMÉRICO DE VEHÍCULOS RENTING',
  tableHeader: 'FLOTA AUTOS',
  camionetaHeader: 'FLOTA CAMIONETAS',
  filePrefix: 'REPORTE_VEHICULOS_RENTING',
  retenAplica: true
});

export const generateSipcopReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName: string,
  mobileData: MobileReference[],
  retenData: RetenReplacement[] = []
) => generateFleetReport(units, settingsMap, date, shift, operatorName, mobileData, retenData, {
  fleetPredicate: (m) => m.type === 'CHOFER' && String(m.sipcop ?? '').trim().toUpperCase() === 'SIPCOP',
  title: 'REPORTE NUMÉRICO DE VEHÍCULOS SIPCOP',
  tableHeader: 'FLOTA AUTOS SIPCOP',
  camionetaHeader: 'FLOTA CAMIONETAS SIPCOP',
  filePrefix: 'REPORTE_VEHICULOS_SIPCOP'
});

// Predicado del consolidado extraído para reutilizarlo en el diagnóstico
const consolidatedNorm = (v: unknown) => String(v ?? '').trim().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const consolidatedFleetPredicate = (m: MobileReference) => {
  // Tipo desde la columna tipo de la hoja DATA (CAMIONETA, MINIVAN, AUTOMOVIL).
  // Fallback a CHOFER si el backend aún no envía el campo tipo (pre-redeploy).
  const t = consolidatedNorm(m.tipo);
  const tipoOk = t
    ? ['CAMIONETA', 'MINIVAN', 'AUTOMOVIL'].some(k => t.includes(k) || (t.length >= 3 && k.includes(t)))
    : consolidatedNorm(m.type) === 'CHOFER';
  if (!tipoOk) return false;
  const p = consolidatedNorm(m.propiedad);
  return ['RENTING', 'SURCO', 'LIMA'].some(k => p === k || p.includes(k));
};

export const generateConsolidatedMobileReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName: string,
  mobileData: MobileReference[],
  retenData: RetenReplacement[] = []
) => {
  return generateFleetReport(units, settingsMap, date, shift, operatorName, mobileData, retenData, {
  fleetPredicate: consolidatedFleetPredicate,
  title: 'REPORTE CONSOLIDADO UNIDADES MÓVILES',
  tableHeader: 'FLOTA CONSOLIDADA',
  camionetaHeader: 'FLOTA CAMIONETAS CONSOLIDADA',
  filePrefix: 'REPORTE_CONSOLIDADO_MOVILES',
  singleTable: true
  });
};

// Tabla "ASISTENCIA DEL PERSONAL" (consolidado + totales) usada por
// generatePersonnelAbsenceReport y replicada al final de
// generatePersonnelStatusReport. Devuelve la nueva posición Y.
const renderAttendanceConsolidated = (doc: any, units: UnitData[], personnel: PersonnelData[], allSectorSettings: Record<string, AppSettings>, currentY: number, margin: number, contentWidth: number): number => {
  const normalize = normalizeName;

  // C4 y COVV se consolidan en una sola fila; GIR se muestra como G.I.R.
  const sectorLabelFor = (raw: unknown) => {
    const n = normalize(raw).replace(/^SECTOR\s+/, '');
    if (n === 'C4' || n === 'COVV') return 'CCO y COVV';
    if (n === 'GIR') return 'G.I.R.';
    return n;
  };

  const attendanceBuckets = ['CHOFERES', 'MOTORIZADOS', 'SERENOS'] as const;
  type AttendanceCell = { efectivo: number; faltos: number; disponibles: number };
  const attendance = new Map<string, Record<string, AttendanceCell>>();
  const ensureAttendanceRow = (label: string) => {
    if (!attendance.has(label)) {
      attendance.set(label, {
        CHOFERES: { efectivo: 0, faltos: 0, disponibles: 0 },
        MOTORIZADOS: { efectivo: 0, faltos: 0, disponibles: 0 },
        SERENOS: { efectivo: 0, faltos: 0, disponibles: 0 }
      });
    }
    return attendance.get(label)!;
  };

  // CONSOLIDADO según las condiciones solicitadas:
  //   1. Solo personal registrado en personal_1 (hoja Personal)
  //   2. DISPONIBLES = solo estados PATRULLANDO y SIN VEHICULO (no Apoyo ni otros)
  //   3. FALTOS = solo estado FALTO
  //   EFECTIVO = FALTOS + DISPONIBLES
  // Matching insensible a tildes (MÁRQUEZ = MARQUEZ): normalizeName no las elimina.
  const normMatch = (v: unknown) => normalize(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Mapa: nombre normalizado (hoja Personal) -> rol de origen
  const personnelRolByName = new Map<string, string>();
  personnel.forEach(p => {
    const name = normMatch(p.apellidos_nombres);
    if (!name) return;
    if (p.rol_operativo) personnelRolByName.set(name, String(p.rol_operativo));
  });

  const bucketFor = (u: UnitData) => {
    const t = (u.type || '').toString().toUpperCase();
    if (t === 'MOTO') return 'MOTORIZADOS' as const;
    if (t === 'CHOFER') return 'CHOFERES' as const;
    // Sin tipo registrado se infiere por el ID (misma regla que getUnitType en DATA):
    // los prefijos H- / A-G- corresponden a motos.
    if (!t) {
      const rawId = String(u.id || '').trim().toUpperCase();
      if (rawId.startsWith('H') || rawId.startsWith('A-G')) return 'MOTORIZADOS' as const;
    }
    // Fallback: rol de origen en la hoja Personal (cubre registros SIN VEHICULO
    // sin ID ni tipo, que no pueden inferirse de la unidad).
    const rol = (personnelRolByName.get(normMatch(u.personnel1)) || '').toString().toUpperCase();
    if (rol.includes('CHOFER')) return 'CHOFERES' as const;
    if (rol.includes('MOTORIZADO')) return 'MOTORIZADOS' as const;
    return 'SERENOS' as const;
  };

  // Clave canónica de sector (C4/COVV se unifican; GIR -> G.I.R.)
  const canonSector = (raw: unknown) => {
    const n = normalize(raw).replace(/^SECTOR\s+/, '');
    if (n === 'C4' || n === 'COVV') return 'CCO Y COVV';
    if (n === 'GIR') return 'G.I.R.';
    return n;
  };

  // Mapa: nombre normalizado (hoja Personal) -> sector de origen
  const originSectorByName = new Map<string, string>();
  personnel.forEach(p => {
    const name = normMatch(p.apellidos_nombres);
    if (!name) return;
    const origin = canonSector(p.sector_id);
    if (origin) originSectorByName.set(name, origin);
  });

  // El registro cuenta en la fila de SU SECTOR DE ORIGEN (sector_id de la hoja
  // Personal), no en el sector donde quedó guardada la ficha.
  //   - Condición 1: personal_1 debe existir en la hoja Personal.
  //   - Condición 2: DISPONIBLES = solo PATRULLANDO y SIN VEHICULO.
  //   - Condición 3: FALTOS = solo FALTO.
  units.forEach(u => {
    const name = normMatch(u.personnel1);
    const origin = originSectorByName.get(name);
    const rowKey = origin ? (origin === 'CCO Y COVV' ? 'CCO y COVV' : origin) : sectorLabelFor(u.sector);
    const bucket = bucketFor(u);
    const status = (u.status || '').toString().trim().toUpperCase();

    let accion: 'faltos' | 'disponibles' | null = null;
    if (!name || !origin) {
      // Sin personal_1 o fuera de la hoja Personal -> no cuenta
    } else if (status === 'FALTO') accion = 'faltos';
    else if (status === 'PATRULLANDO' || status === 'SIN VEHICULO') accion = 'disponibles';

    if (accion && rowKey) ensureAttendanceRow(rowKey)[bucket][accion]++;
  });

  // Supervisores y jefes de área (permanencia) por sector, en columna SERENOS.
  // Mismas reglas de estado: FALTO -> FALTOS; PATRULLANDO / SIN VEHICULO -> DISPONIBLES.
  Object.keys(allSectorSettings).forEach(sectorDisplay => {
    const s = allSectorSettings[sectorDisplay];
    const rowKey = sectorLabelFor(sectorDisplay);
    if (!rowKey) return;
    const addSup = (nameVal: unknown, estado: unknown) => {
      if (!String(nameVal || '').trim()) return;
      const st = String(estado || '').trim().toUpperCase();
      if (st === 'FALTO') ensureAttendanceRow(rowKey).SERENOS.faltos++;
      else if (st === 'PATRULLANDO' || st === 'SIN VEHICULO') ensureAttendanceRow(rowKey).SERENOS.disponibles++;
    };
    addSup(s.supervisor, s.supervisorEstado);
    addSup(s.permanencia, s.permanenciaEstado);
  });

  // EFECTIVO = FALTOS + DISPONIBLES
  attendance.forEach(row => {
    attendanceBuckets.forEach(b => {
      row[b].efectivo = row[b].faltos + row[b].disponibles;
    });
  });

  const attendanceSectorOrder = ['1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B', 'G.I.R.', 'RETEN', 'OPERACIONES', 'CCO y COVV'];
  const attendanceLabels = Array.from(attendance.keys()).sort((a, b) => {
    const ia = attendanceSectorOrder.indexOf(a);
    const ib = attendanceSectorOrder.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });

  const blankIfZero = (n: number) => (n ? String(n) : '');
  const attendanceBody: any[][] = attendanceLabels.map(label => {
    const row = attendance.get(label)!;
    const cells: any[] = [label];
    attendanceBuckets.forEach(b => {
      const { efectivo, faltos, disponibles } = row[b];
      cells.push(blankIfZero(efectivo), blankIfZero(faltos), blankIfZero(disponibles));
    });
    return cells;
  });

  // Fila TOTALES
  const totalsRow: any[] = ['TOTALES'];
  attendanceBuckets.forEach(b => {
    let efectivo = 0, faltos = 0, disponibles = 0;
    attendance.forEach(row => {
      efectivo += row[b].efectivo;
      faltos += row[b].faltos;
      disponibles += row[b].disponibles;
    });
    totalsRow.push(String(efectivo), blankIfZero(faltos), blankIfZero(disponibles));
  });
  attendanceBody.push(totalsRow);

  (doc as any).autoTable({
    startY: currentY,
    head: [[
      { content: 'ASISTENCIA DEL PERSONAL', colSpan: 10, styles: { halign: 'center', fillColor: [38, 70, 83], textColor: [255, 255, 255], fontSize: 11 } }
    ], [
      { content: '', styles: { fillColor: [38, 70, 83] } },
      { content: 'CHOFERES', colSpan: 3, styles: { halign: 'center', fillColor: [62, 96, 111], textColor: [255, 255, 255], fontSize: 9 } },
      { content: 'MOTORIZADOS', colSpan: 3, styles: { halign: 'center', fillColor: [62, 96, 111], textColor: [255, 255, 255], fontSize: 9 } },
      { content: 'SERENOS', colSpan: 3, styles: { halign: 'center', fillColor: [62, 96, 111], textColor: [255, 255, 255], fontSize: 9 } }
    ], [
      { content: 'SECTORES', styles: { fillColor: [31, 78, 121], textColor: [255, 255, 255], fontSize: 7 } },
      ...['EFECTIVO', 'FALTOS', 'DISPONIBLES', 'EFECTIVO', 'FALTOS', 'DISPONIBLES', 'EFECTIVO', 'FALTOS', 'DISPONIBLES'].map((t, i) => ({
        content: t,
        styles: {
          fillColor: i % 3 === 0 ? [67, 160, 71] : i % 3 === 1 ? [211, 47, 47] : [255, 235, 59],
          textColor: i % 3 === 2 ? [0, 0, 0] : [255, 255, 255],
          fontSize: 6.5
        }
      }))
    ]],
    body: attendanceBody,
    theme: 'grid',
    styles: { fontSize: 7.5, halign: 'center', cellPadding: 1.2, lineColor: [255, 255, 255], lineWidth: 0.3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', fillColor: [31, 78, 121], textColor: [255, 255, 255] },
      1: { cellWidth: 18 }, 2: { cellWidth: 18 }, 3: { cellWidth: 18 },
      4: { cellWidth: 18 }, 5: { cellWidth: 18 }, 6: { cellWidth: 18 },
      7: { cellWidth: 18 }, 8: { cellWidth: 18 }, 9: { cellWidth: 18 }
    },
    didParseCell: function (data: any) {
      if (data.row.section === 'body') {
        const isTotalRow = data.row.index === attendanceBody.length - 1;
        if (isTotalRow) {
          data.cell.styles.fillColor = [38, 70, 83];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 8;
        }
      }
    },
    margin: { left: margin, right: margin }
  });

  let y = (doc as any).lastAutoTable.finalY;

  // --- TABLA SIMPLE DE TOTALES GENERALES (EFECTIVO / FALTOS / DISPONIBLES) ---
  const grandTotals = { efectivo: 0, faltos: 0, disponibles: 0 };
  attendance.forEach(row => {
    attendanceBuckets.forEach(b => {
      grandTotals.efectivo += row[b].efectivo;
      grandTotals.faltos += row[b].faltos;
      grandTotals.disponibles += row[b].disponibles;
    });
  });

  (doc as any).autoTable({
    startY: y + 4,
    head: [[
      { content: 'EFECTIVO', styles: { halign: 'center', fillColor: [67, 160, 71], textColor: [255, 255, 255], fontSize: 9 } },
      { content: 'FALTOS', styles: { halign: 'center', fillColor: [211, 47, 47], textColor: [255, 255, 255], fontSize: 9 } },
      { content: 'DISPONIBLES', styles: { halign: 'center', fillColor: [255, 235, 59], textColor: [0, 0, 0], fontSize: 9 } }
    ]],
    body: [[String(grandTotals.efectivo), String(grandTotals.faltos), String(grandTotals.disponibles)]],
    theme: 'grid',
    styles: { halign: 'center', fontSize: 11, fontStyle: 'bold', cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: contentWidth / 3 },
      1: { cellWidth: contentWidth / 3 },
      2: { cellWidth: contentWidth / 3 }
    },
    margin: { left: margin, right: margin }
  });

  return (doc as any).lastAutoTable.finalY;
};

export const generatePersonnelAbsenceReport = (
  units: UnitData[],
  personnel: PersonnelData[],
  allSectorSettings: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  // Normaliza nombres para matching exacto (helper compartido)
  const normalize = normalizeName;

  // 1. Identify present vs explicitly absent personnel names
  const presentNames = new Set<string>();
  const explicitAbsentInUnits = new Set<string>();
  // Map name -> { sector, motivo } for absent people from units
  const nameToSector = new Map<string, string>();
  const nameToUnitMotivo = new Map<string, string>();

  units.forEach(u => {
    // Solo considerar registros con PERSONAL_1 llenado
    if (!u.personnel1 || String(u.personnel1).trim() === '') return;

    // Solo procesar personnel1, ignorar personnel2
    const name = normalize(u.personnel1);

    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const status = (u.status || '').toString().trim().toUpperCase();
    const motivo = (u.motivoEstado || '').toString().trim().toUpperCase();

    // SOLO considerar ESTADO: FALTO
    if (status === 'FALTO') {
      explicitAbsentInUnits.add(name);
      nameToSector.set(name, sector);
      nameToUnitMotivo.set(name, motivo || 'INASISTENCIA');
    }
  });

  // 1b. Add supervisor/permanencia with Falto from settings
  Object.keys(allSectorSettings).forEach(sectorDisplay => {
    const s = allSectorSettings[sectorDisplay];
    const sector = sectorDisplay.toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const supName = normalize(s.supervisor);
    const permName = normalize(s.permanencia);
    const supEstado = (s.supervisorEstado || '').toString().trim().toUpperCase();
    const permEstado = (s.permanenciaEstado || '').toString().trim().toUpperCase();
    if (supName && supEstado === 'FALTO') {
      explicitAbsentInUnits.add(supName);
      nameToSector.set(supName, sector);
      nameToUnitMotivo.set(supName, (s.supervisorMotivo || '').toUpperCase() || 'INASISTENCIA');
    }
    if (permName && permEstado === 'FALTO') {
      explicitAbsentInUnits.add(permName);
      nameToSector.set(permName, sector);
      nameToUnitMotivo.set(permName, (s.permanenciaMotivo || '').toUpperCase() || 'INASISTENCIA');
    }
  });

  // 2. Filter personnel list (solo personal de la hoja Personal)
  const absents = personnel.filter(p => explicitAbsentInUnits.has(normalize(p.apellidos_nombres)));

  // NOTA: no se agregan ausentes sin ficha en Personal (solo hoja Personal)

  // 4. Group by regime and motif
  const getRegime = (p: any) => {
    const reg = (p.regimen_laboral || '').toString().toUpperCase();
    if (/276/.test(reg)) return '276';
    if (/728/.test(reg)) return '728';
    if (/1057.*INDETERMINADO/i.test(reg)) return '1057-INDETERMINADO';
    if (/1057.*DETERMINADO/i.test(reg)) return '1057-DETERMINADO';
    if (/1057.*CONFIANZA/i.test(reg)) return '1057-CONFIANZA';
    if (/1057|CAS/i.test(reg)) return '1057-OTRO';
    return 'OS';
  };

  const getRegimeLabel = (regimeKey: string) => {
    switch(regimeKey) {
        case '276': return 'PLANILLA D.L. N° 276';
        case '728': return 'PLANILLA D.L. N° 728';
        case '1057-CONFIANZA': return 'D.L. N° 1057 (Confianza)';
        case '1057-DETERMINADO': return 'D.L. N° 1057 (Determinado)';
        case '1057-INDETERMINADO': return 'D.L. N° 1057 (Indeterminado)';
        case '1057-OTRO': return 'D.L. N° 1057';
        case 'OS': return 'ORDEN DE SERVICIO';
        default: return regimeKey;
    }
  };

  const motifs = [
    'CAMBIO DE TURNO',
    'CAMBIO DESCANSO FISICO',
    'CITA MEDICA',
    'DESCANSO COMPENSATORIO',
    'DESCANSO FISICO',
    'DESCANSO MEDICO',
    'INASISTENCIA',
    'LICENCIA MATERNIDAD',
    'LICENCIA PATERNIDAD',
    'ONOMASTICO',
    'PERMISO',
    'VACACIONES'
  ];
  
  const resolvedOperator = operatorName || '--';
  let currentY = 10;
  let firstPage = true;

  motifs.forEach((motivo, motifIndex) => {
    const motifAbsents = absents.filter(p => {
        const nameNorm = normalize(p.apellidos_nombres);
        const m = nameToUnitMotivo.get(nameNorm) || 'INASISTENCIA';
        return m === motivo;
    });

    if (motifAbsents.length === 0) return;

    if (!firstPage) {
        doc.addPage();
        currentY = 10;
    }
    firstPage = false;

    // Draw Main Report Header
    doc.setFillColor(38, 70, 83);
    doc.rect(margin, currentY, contentWidth, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('SURCO', margin + 5, currentY + 11);

    doc.setFontSize(11);
    doc.text(`REPORTE DE ${motivo} POR RÉGIMEN`, margin + 35, currentY + 11);

    doc.setFontSize(8);
    doc.text(formatLongDate(date).toUpperCase(), pageWidth - margin - 5, currentY + 7, { align: 'right' });
    doc.text(`TURNO: ${shift.toUpperCase()}`, pageWidth - margin - 5, currentY + 13, { align: 'right' });

    currentY += 22;

    // Sub-header: OPERADOR CCO
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OPERADOR CCO:', margin + 3, currentY + 4.8);
    doc.setFont('helvetica', 'normal');
    doc.text(resolvedOperator, margin + 38, currentY + 4.8);
    doc.setTextColor(0, 0, 0);

    currentY += 11;

    const regimes = ['276', '728', '1057-CONFIANZA', '1057-DETERMINADO', '1057-INDETERMINADO', '1057-OTRO', 'OS'];
    
    regimes.forEach(regimeKey => {
        const data = motifAbsents.filter(p => getRegime(p) === regimeKey);
        if (data.length === 0) return;

        // Check if we need a new page
        if (currentY > 250) {
            doc.addPage();
            currentY = 20;
        }

        // Header de grupo (Sub-title)
        doc.setFillColor(0, 92, 187);
        doc.rect(margin, currentY, contentWidth, 7, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`${getRegimeLabel(regimeKey)}`, margin + 3, currentY + 4.8);
        doc.text(`TOTAL: ${data.length}`, margin + contentWidth - 3, currentY + 4.8, { align: 'right' });

        currentY += 7;

        const tableData = data.map(p => {
            const nameNorm = normalize(p.apellidos_nombres);
            return [
                p.apellidos_nombres?.toUpperCase() || '',
                (p.rol_operativo || '').toUpperCase() || '',
                shift.toUpperCase(),
                // Sector asignado originalmente (hoja Personal, columna sector_id);
                // fallback al sector del registro del turno
                (p.sector_id || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '') || nameToSector.get(nameNorm) || '--'
            ];
        });

        (doc as any).autoTable({
            startY: currentY,
            head: [['APELLIDOS Y NOMBRES', 'CARGO', 'TURNO', 'SECTOR']],
            body: tableData,
            theme: 'grid',
            headStyles: {
                fillColor: [240, 240, 240],
                textColor: [50, 50, 50],
                fontSize: 8,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 8,
                cellPadding: 1.5,
                valign: 'middle'
            },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 40, halign: 'center' },
                2: { cellWidth: 25, halign: 'center' },
                3: { cellWidth: 35, halign: 'center' }
            },
            margin: { left: margin, right: margin },
            didDrawPage: (data: any) => {
                currentY = data.cursor.y;
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 8;
    });
  });

  // --- TABLA CONSOLIDADA DE ASISTENCIA (EFECTIVO / FALTOS / DISPONIBLES por rol y sector) ---
  // En una página nueva (o la actual si ningún motivo generó contenido)
  if (!firstPage) {
    doc.addPage();
    currentY = 10;
  }
  firstPage = false;

  // Encabezado principal
  doc.setFillColor(38, 70, 83);
  doc.rect(margin, currentY, contentWidth, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SURCO', margin + 5, currentY + 11);
  doc.setFontSize(11);
  doc.text('CONSOLIDADO DE ASISTENCIA DEL PERSONAL', margin + 35, currentY + 11);
  doc.setFontSize(8);
  doc.text(formatLongDate(date).toUpperCase(), pageWidth - margin - 5, currentY + 7, { align: 'right' });
  doc.text(`TURNO: ${shift.toUpperCase()}`, pageWidth - margin - 5, currentY + 13, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  currentY += 24;

  currentY = renderAttendanceConsolidated(doc, units, personnel, allSectorSettings, currentY, margin, contentWidth);

  // --- FOOTER (pie de página en todas las páginas) ---
  stampReportFooter(doc, pageWidth, pageHeight, margin, resolveC4Supervisor(allSectorSettings), resolvedOperator, new Date().toLocaleString());

  // Timestamp integrado al pie de página (stampReportFooter)

  doc.save(`REPORTE_ASISTENCIA_REGIMEN_${shift}_${date}.pdf`);
};

export const generatePersonnelStatusReport = (
  units: UnitData[],
  personnel: PersonnelData[],
  allSectorSettings: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  const normalize = normalizeName;

  const statusToReport = ['PATRULLANDO', 'SIN VEHICULO', 'SIN DOCUMENTOS'];
  const explicitInUnits = new Set<string>();
  const nameToSector = new Map<string, string>();
  const nameToStatus = new Map<string, string>();

  units.forEach(u => {
    // Solo considerar registros con PERSONAL_1 llenado
    if (!u.personnel1 || String(u.personnel1).trim() === '') return;

    // Solo procesar personnel1, ignorar personnel2
    const name = normalize(u.personnel1);

    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const status = (u.status || '').toString().trim().toUpperCase();

    if (statusToReport.includes(status)) {
      explicitInUnits.add(name);
      nameToSector.set(name, sector);
      nameToStatus.set(name, status);
    }
  });

  // 1b. Add supervisor/permanencia with matching status from settings
  Object.keys(allSectorSettings).forEach(sectorDisplay => {
    const s = allSectorSettings[sectorDisplay];
    const sector = sectorDisplay.toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const supName = normalize(s.supervisor);
    const permName = normalize(s.permanencia);
    const supEstado = (s.supervisorEstado || '').toString().trim().toUpperCase();
    const permEstado = (s.permanenciaEstado || '').toString().trim().toUpperCase();
    if (supName && statusToReport.includes(supEstado)) {
      explicitInUnits.add(supName);
      nameToSector.set(supName, sector);
      nameToStatus.set(supName, supEstado);
    }
    if (permName && statusToReport.includes(permEstado)) {
      explicitInUnits.add(permName);
      nameToSector.set(permName, sector);
      nameToStatus.set(permName, permEstado);
    }
  });

  // Solo personal de la hoja Personal (no se agregan nombres sin ficha)
  const filteredPersonnel = personnel.filter(p => explicitInUnits.has(normalize(p.apellidos_nombres)));

  const getRegime = (p: any) => {
    const reg = (p.regimen_laboral || '').toString().toUpperCase();
    if (/276/.test(reg)) return '276';
    if (/728/.test(reg)) return '728';
    if (/1057.*INDETERMINADO/i.test(reg)) return '1057-INDETERMINADO';
    if (/1057.*DETERMINADO/i.test(reg)) return '1057-DETERMINADO';
    if (/1057.*CONFIANZA/i.test(reg)) return '1057-CONFIANZA';
    if (/1057|CAS/i.test(reg)) return '1057-OTRO';
    return 'OS';
  };

  const getRegimeLabel = (regimeKey: string) => {
    switch(regimeKey) {
        case '276': return 'PLANILLA D.L. N° 276';
        case '728': return 'PLANILLA D.L. N° 728';
        case '1057-CONFIANZA': return 'D.L. N° 1057 (Confianza)';
        case '1057-DETERMINADO': return 'D.L. N° 1057 (Determinado)';
        case '1057-INDETERMINADO': return 'D.L. N° 1057 (Indeterminado)';
        case '1057-OTRO': return 'D.L. N° 1057';
        case 'OS': return 'ORDEN DE SERVICIO';
        default: return regimeKey;
    }
  };

  const resolvedOperator = operatorName || '--';
  let currentY = 10;

  // Header
  doc.setFillColor(38, 70, 83);
  doc.rect(margin, currentY, contentWidth, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SURCO', margin + 5, currentY + 11);
  doc.setFontSize(11);
  doc.text(`REPORTE DE ASISTENCIA POR RÉGIMEN (PRESENTES)`, margin + 35, currentY + 11);
  doc.setFontSize(8);
  doc.text(formatLongDate(date).toUpperCase(), pageWidth - margin - 5, currentY + 7, { align: 'right' });
  doc.text(`TURNO: ${shift.toUpperCase()}`, pageWidth - margin - 5, currentY + 13, { align: 'right' });

  currentY += 22;

  // Operator
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, currentY, contentWidth, 7, 'F');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OPERADOR CCO:', margin + 3, currentY + 4.8);
  doc.setFont('helvetica', 'normal');
  doc.text(resolvedOperator, margin + 38, currentY + 4.8);
  doc.setTextColor(0, 0, 0);

  currentY += 11;

  const regimes = ['276', '728', '1057-CONFIANZA', '1057-DETERMINADO', '1057-INDETERMINADO', '1057-OTRO', 'OS'];
  
  regimes.forEach(regimeKey => {
      const data = filteredPersonnel.filter(p => getRegime(p) === regimeKey);
      if (data.length === 0) return;
      
      if (currentY > 250) {
          doc.addPage();
          currentY = 20;
      }

      doc.setFillColor(0, 92, 187);
      doc.rect(margin, currentY, contentWidth, 7, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`${getRegimeLabel(regimeKey)}`, margin + 3, currentY + 4.8);
      doc.text(`TOTAL: ${data.length}`, margin + contentWidth - 3, currentY + 4.8, { align: 'right' });

      currentY += 7;

      const tableData = data.map(p => {
          const nameNorm = normalize(p.apellidos_nombres);
          return [
              p.apellidos_nombres?.toUpperCase() || '',
              (p.rol_operativo || '').toUpperCase() || '',
              shift.toUpperCase(),
              // Sector asignado originalmente (hoja Personal, columna sector_id);
              // fallback al sector del registro del turno
              (p.sector_id || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '') || nameToSector.get(nameNorm) || '--'
          ];
      });

      (doc as any).autoTable({
          startY: currentY,
          head: [['APELLIDOS Y NOMBRES', 'CARGO', 'TURNO', 'SECTOR']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [240, 240, 240], textColor: [50, 50, 50], fontSize: 8, fontStyle: 'bold', halign: 'center' },
          styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
          columnStyles: {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 40, halign: 'center' },
              2: { cellWidth: 25, halign: 'center' },
              3: { cellWidth: 35, halign: 'center' }
          },
          margin: { left: margin, right: margin },
          didDrawPage: (data: any) => { currentY = data.cursor.y; }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  // Replica de la tabla consolidada (ASISTENCIA DEL PERSONAL) + totales al final
  currentY = renderAttendanceConsolidated(doc, units, personnel, allSectorSettings, currentY, margin, contentWidth);

  const footerY = pageHeight - 15;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0); // Explicitly set text color to black
  // Pie de página en todas las páginas
  stampReportFooter(doc, pageWidth, pageHeight, margin, resolveC4Supervisor(allSectorSettings), resolvedOperator, new Date().toLocaleString());
  // Timestamp integrado al pie de página (stampReportFooter)

  doc.save(`REPORTE_PERSONAL_ESTADO_${shift}_${date}.pdf`);
};


export const generateAllRecordsReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  const rows: any[] = [];
  units.forEach(u => {
    const idStr = (u.id || '').toString();
    const p1Str = (u.personnel1 || '').toString();
    const p2Str = (u.personnel2 || '').toString();

    // Only include rows that have at least some data (ID or personnel)
    if (idStr.trim() === '' && p1Str.trim() === '' && p2Str.trim() === '') return;

    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const unitId = (idStr || '--').toUpperCase();
    const status = (u.status || '').toString().toUpperCase();
    const mechanics = (u.mechanics || '').toString().toUpperCase();
    const unitType = (u.type || '').toString().toUpperCase();
    const plate = (u.plate || '').toString().toUpperCase();

    // Combine radio
    const radioArr = [];
    if (u.radio) radioArr.push(`${u.radio}`);
    const radioStr = radioArr.join('\n');
    const cuadrante = (u.quadrant || '').toString().toUpperCase();
    const indicative = (u.indicative || '').toString().toUpperCase();

    // Combine personnel
    const persArr = [];
    if (p1Str) persArr.push(p1Str.toUpperCase());
    if (p2Str) {
      persArr.push(indicative ? `${p2Str.toUpperCase()} (IND: ${indicative})` : p2Str.toUpperCase());
    } else if (indicative) {
      persArr.push(`IND: ${indicative}`);
    }
    const personnel = persArr.join('\n');

    // Kilometraje
    let kmStr = '--';
    const start = (u.kmStart || '0').toString();
    const end = (u.kmEnd || '0').toString();
    const total = (u.totalKm || '0').toString();
    const recarga = (u.kmRecarga || '0').toString();

    if (start !== '0' || end !== '0' || total !== '0' || recarga !== '0') {
      kmStr = `INICIO:${start} FIN:${end}\nRECORRIDO:${total} RECARGA:${recarga}`;
    }

    // Combustible y Gasto
    const primaryFuel = `${(u.fuel || '').toString() || '--'}\n${(u.expense || '').toString() || 'S/ 0.00'}`;
    const secondFuel = u.fuel2
      ? `\n${u.fuel2.toString()}\n${(u.expense2 || '').toString() || 'S/ 0.00'}`
      : '';
    const fuelExp = `${primaryFuel}${secondFuel}`;

    rows.push({
      sector,
      unitType,
      unitId,
      plate,
      radioStr,
      cuadrante,
      personnel,
      status,
      lugarEstado: u.lugarEstado || '--',
      motivoEstado: u.motivoEstado || '--',
      kmStr,
      fuelExp,
      mechanics
    });
  });

  // Extract unique sectors and sort them
  const uniqueSectors = Array.from(new Set(rows.map(r => r.sector))).sort((a, b) => a.localeCompare(b));

  const firstSettings = Object.values(settingsMap)[0] || {} as AppSettings;
  const permanencia = firstSettings.permanencia || '--';
  const permanenciaLabel = 'PERMANENCIA';

  const resolvedOperator = operatorName || firstSettings.operador || '--';
  const dayOfWeek = new Date(date + 'T12:00:00').getDay();
  const showPermanencia = dayOfWeek === 0 || dayOfWeek === 6 || shift === 'NOCHE';

  let currentY = 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`REPORTE GENERAL DE REGISTROS - TURNO ${shift.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const permanenciaStr = showPermanencia ? `   |   ${permanenciaLabel}: ${permanencia}` : '';
  doc.text(`FECHA: ${formatShortDate(date)}${permanenciaStr}   |   OPERADOR CCO: ${resolvedOperator}`, pageWidth / 2, currentY + 5, { align: 'center' });

  currentY += 12;

  uniqueSectors.forEach((sector) => {
    // Header styling for the SECTOR
    if (currentY > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      currentY = 15;
    }

    const sectorSettings = settingsMap[sector] || settingsMap[`SECTOR ${sector}`] || {} as AppSettings;
    const operador = sectorSettings.operador || 'N/A';
    const supervisor = sectorSettings.supervisor || 'N/A';

    doc.setFillColor(38, 70, 83); // Dark slate background for sector title
    doc.rect(margin, currentY, pageWidth - (margin * 2), 7, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(`SECTOR: ${sector}`, margin + 5, currentY + 5);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`OPERADOR: ${operador.toUpperCase()}   |   SUPERVISOR: ${supervisor.toUpperCase()}`, pageWidth - margin - 5, currentY + 4.8, { align: 'right' });

    currentY += 9;
    doc.setTextColor(0, 0, 0); // Reset text color to black

    const sections = [
      { key: 'CHOFER', label: 'CHOFERES' },
      { key: 'MOTO', label: 'MOTORIZADOS' },
      { key: 'SERENO', label: 'SERENOS' }
    ];

    sections.forEach(sec => {
      // Filter rows for the current sector and unit type
      const sectorTypeRows = rows
        .filter(r => r.sector === sector && r.unitType === sec.key)
        .sort((a, b) => a.unitId.localeCompare(b.unitId));

      if (sectorTypeRows.length === 0) return;

      const totalEfectivos = sectorTypeRows.length;

      const tableData = sectorTypeRows.map(r => [
        r.unitId,
        r.plate,
        r.radioStr,
        r.cuadrante,
        r.personnel,
        r.status,
        r.lugarEstado,
        r.motivoEstado,
        r.kmStr,
        r.fuelExp,
        r.mechanics
      ]);

      // Add a total row
      tableData.push([
        { content: `TOTAL UNIDADES: ${totalEfectivos}`, colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'right' } },
        { content: '', colSpan: 6, styles: { fillColor: [240, 240, 240] } }
      ]);

      if (currentY > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        currentY = 15;
      }

      (doc as any).autoTable({
        startY: currentY,
        head: [[
          { content: sec.label, colSpan: 11, styles: { halign: 'left', fillColor: [180, 180, 180], textColor: [0, 0, 0], fontSize: 8 } }
        ], [
          'UNIDAD', 'PLACA', 'RADIO', 'CUADRANTE', 'NOMBRES Y APELLIDOS / COPILOTO', 'ESTADO', 'LUGAR ESTADO', 'MOTIVO ESTADO', 'KILOMETRAJE', 'COMBUSTIBLE / GASTO', 'OBSERVACIONES'
        ]],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 6.5, halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 0.8 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 14 },
          1: { cellWidth: 15 },
          2: { cellWidth: 12 },
          3: { cellWidth: 16 },
          4: { cellWidth: 50, halign: 'left' },
          5: { cellWidth: 18, halign: 'center' },
          6: { cellWidth: 18, halign: 'center' },
          7: { cellWidth: 18, halign: 'center' },
          8: { cellWidth: 22 },
          9: { cellWidth: 18 },
          10: { cellWidth: 'auto', halign: 'left' }
        },
        margin: { left: margin, right: margin }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;
    });

    currentY += 4;
  });

  // --- FOOTER ---
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  // Pie de página en todas las páginas
  stampReportFooter(doc, pageWidth, pageHeight, margin, resolveC4Supervisor(settingsMap), resolvedOperator, new Date().toLocaleString());

  // Timestamp integrado al pie de página (stampReportFooter)

  doc.save(`REPORTE_GENERAL_${shift}_${date}.pdf`);
};

export const generateRetenReport = (
  replacements: any[],
  date: string,
  shift: string,
  operatorName?: string,
  settingsMap?: Record<string, AppSettings>
) => {
  if (!replacements || replacements.length === 0) {
    alert("No hay registros para generar el reporte.");
    return;
  }

  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('REPORTE DE RELEVOS - UNIDADES RETÉN (AR)', pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`FECHA: ${date}`, margin, 25);
  doc.text(`TURNO: ${shift.toUpperCase()}`, margin + 60, 25);

  const tableRows = replacements.map(r => [
    r.hora,
    r.turno,
    r.retenUnit,
    r.placaReten || '-',
    r.replacedUnit,
    r.placa,
    r.motivo || '-',
    r.fechaIngresoTaller ? `${r.fechaIngresoTaller} ${r.horaIngresoTaller || ''}` : '-',
    r.fechaSalidaTaller ? `${r.fechaSalidaTaller} ${r.horaSalidaTaller || ''}` : '-'
  ]);

  (doc as any).autoTable({
    startY: 30,
    head: [['HORA', 'TURNO', 'U. RETÉN', 'PLACA RETÉN', 'U. REEMPLAZADA', 'PLACA', 'MOTIVO', 'INGRESO TALLER', 'SALIDA TALLER']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [0, 61, 107], textColor: [255, 255, 255] },
    styles: { fontSize: 8, halign: 'center' },
    columnStyles: {
      6: { halign: 'left', cellWidth: 30 },
      7: { halign: 'left', cellWidth: 'auto' },
      8: { halign: 'left', cellWidth: 'auto' }
    }
  });

  // --- FOOTER (pie de página en todas las páginas) ---
  stampReportFooter(doc, pageWidth, pageHeight, margin, resolveC4Supervisor(settingsMap), operatorName || '______________________', new Date().toLocaleString());

  // Timestamp integrado al pie de página (stampReportFooter)

  doc.save(`REPORTE_RETEN_${shift}_${date}.pdf`);
};

export const generateRetenExcel = async (
  replacements: any[],
  date: string,
  shift: string
) => {
  const xlsxLib: any = (window as any).XLSX || (globalThis as any).XLSX;

  if (!xlsxLib) {
    alert("Error: La librería de Excel (SheetJS) no se ha cargado correctamente. Esto puede deberse a restricciones de red o a que el script fue bloqueado por el navegador. Por favor, intenta recargar la página.");
    return;
  }

  if (!replacements || replacements.length === 0) {
    alert("No hay registros para generar el reporte.");
    return;
  }

  const data = replacements.map(r => ({
    'FECHA': r.fecha,
    'HORA': r.hora,
    'TURNO': r.turno,
    'UNIDAD RETÉN': r.retenUnit,
    'PLACA RETÉN': r.placaReten || '-',
    'UNIDAD REEMPLAZADA': r.replacedUnit,
    'PLACA REEMPLAZADA': r.placa,
    'MOTIVO': r.motivo || '-',
    'FECHA INGRESO TALLER': r.fechaIngresoTaller || '-',
    'HORA INGRESO TALLER': r.horaIngresoTaller || '-',
    'FECHA SALIDA TALLER': r.fechaSalidaTaller || '-',
    'HORA SALIDA TALLER': r.horaSalidaTaller || '-'
  }));

  const worksheet = xlsxLib.utils.json_to_sheet(data);
  const now = new Date();
  xlsxLib.utils.sheet_add_aoa(worksheet, [['']], { origin: -1 });
  xlsxLib.utils.sheet_add_aoa(worksheet, [[`Generado el: ${now.toLocaleString()}`]], { origin: -1 });
  const workbook = xlsxLib.utils.book_new();
  xlsxLib.utils.book_append_sheet(workbook, worksheet, "Relevos Retén");

  xlsxLib.writeFile(workbook, `REPORTE_RETEN_${shift}_${date}.xlsx`);
};

export const generateTaserReport = (
  units: UnitData[],
  allSectorSettings: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;

  const resolvedOperator = operatorName || '--';

  // Filter units with TASER or BODYCAM data
  const taserUnits = units.filter(u =>
    u.taser || u.bodycam || u.codigoTaser || u.codigoBodycam
  );

  const rows: any[] = [];
  taserUnits.forEach(u => {
    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const dateFormatted = formatShortDate(date);
    rows.push([
      dateFormatted,
      shift.toUpperCase(),
      sector,
      (u.id || '--').toUpperCase(),
      (u.personnel1 || '').toUpperCase(),
      (u.radio || '--'),
      u.taser === 'SI' ? 'SI' : (u.taser === 'NO' ? 'NO' : '--'),
      (u.codigoTaser || '--'),
      u.bodycam === 'SI' ? 'SI' : (u.bodycam === 'NO' ? 'NO' : '--'),
      (u.codigoBodycam || '--'),
      (u.obsBodycam || '')
    ]);
  });

  // Add supervisor/permanencia with equipment from settings
  const dateFormatted = formatShortDate(date);
  Object.keys(allSectorSettings).forEach(sectorDisplay => {
    const s = allSectorSettings[sectorDisplay];
    const sector = sectorDisplay.toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    if (s.supervisorTaser === 'SI' || s.supervisorBodycam === 'SI' || s.supervisorCodigoTaser || s.supervisorCodigoBodycam) {
      rows.push([
        dateFormatted, shift.toUpperCase(), sector, '--',
        (s.supervisor || '').toUpperCase(),
        (s.supervisorRadio || '--'),
        s.supervisorTaser === 'SI' ? 'SI' : (s.supervisorTaser === 'NO' ? 'NO' : '--'),
        (s.supervisorCodigoTaser || '--'),
        s.supervisorBodycam === 'SI' ? 'SI' : (s.supervisorBodycam === 'NO' ? 'NO' : '--'),
        (s.supervisorCodigoBodycam || '--'), ''
      ]);
    }
    if (s.permanenciaTaser === 'SI' || s.permanenciaBodycam === 'SI' || s.permanenciaCodigoTaser || s.permanenciaCodigoBodycam) {
      rows.push([
        dateFormatted, shift.toUpperCase(), sector, '--',
        (s.permanencia || '').toUpperCase(),
        (s.permanenciaRadio || '--'),
        s.permanenciaTaser === 'SI' ? 'SI' : (s.permanenciaTaser === 'NO' ? 'NO' : '--'),
        (s.permanenciaCodigoTaser || '--'),
        s.permanenciaBodycam === 'SI' ? 'SI' : (s.permanenciaBodycam === 'NO' ? 'NO' : '--'),
        (s.permanenciaCodigoBodycam || '--'), ''
      ]);
    }
  });

  // Sort by sector then by unit ID
  rows.sort((a, b) => {
    const cmp = a[2].localeCompare(b[2]);
    if (cmp !== 0) return cmp;
    return a[3].localeCompare(b[3], undefined, { numeric: true });
  });

  // Totals (from rows to include supervisor/permanencia)
  const totalTaserSI = rows.filter(r => r[6] === 'SI').length;
  const totalTaserNO = rows.filter(r => r[6] === 'NO').length;
  const totalBodycamSI = rows.filter(r => r[8] === 'SI').length;
  const totalBodycamNO = rows.filter(r => r[8] === 'NO').length;
  const totalCodigosTaser = rows.filter(r => r[7] !== '--').length;
  const totalCodigosBodycam = rows.filter(r => r[9] !== '--').length;

  (doc as any).autoTable({
    startY: 15,
    head: [[
      { content: `REPORTE DE TASER Y BODYCAM - TURNO ${shift.toUpperCase()}`, colSpan: 11, styles: { halign: 'center', fillColor: [0, 94, 165], textColor: [255, 255, 255], fontSize: 11 } }
    ], [
      'FECHA', 'TURNO', 'SECTOR', 'UNIDAD', 'NOMBRE PERSONAL', 'RADIO', 'TASER', 'CÓDIGO TASER', 'BODYCAM', 'CÓDIGO BODYCAM', 'OBSERVACIÓN'
    ]],
    body: rows,
    foot: [[
      { content: 'TOTALES', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [220, 220, 220] } },
      { content: `SI: ${totalTaserSI} / NO: ${totalTaserNO}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } },
      { content: `${totalCodigosTaser} códigos`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } },
      { content: `SI: ${totalBodycamSI} / NO: ${totalBodycamNO}`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } },
      { content: `${totalCodigosBodycam} códigos`, styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } },
      { content: '', styles: { fillColor: [220, 220, 220] } }
    ]],
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 15 },
      2: { cellWidth: 15 },
      3: { cellWidth: 18 },
      4: { cellWidth: 55, halign: 'left' },
      5: { cellWidth: 18 },
      6: { cellWidth: 15 },
      7: { cellWidth: 30 },
      8: { cellWidth: 15 },
      9: { cellWidth: 30 },
      10: { cellWidth: 'auto', halign: 'left' }
    },
    margin: { left: margin, right: margin }
  });

  // FOOTER
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  // Pie de página en todas las páginas
  stampReportFooter(doc, pageWidth, pageHeight, margin, resolveC4Supervisor(allSectorSettings), resolvedOperator, new Date().toLocaleString());

  // Timestamp integrado al pie de página (stampReportFooter)

  doc.save(`REPORTE_TASER_${shift}_${date}.pdf`);
};

export const generateOperatividadReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  operatorName?: string,
  mobileData: MobileReference[] = [],
  retenData: RetenReplacement[] = []
) => {
  const doc = new jspdf.jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const normalize = normalizeText;

  // Mapa de sector desde hoja DATA (mobileData), con fallback a u.sector
  const sectorById = new Map<string, string>();
  mobileData.forEach(m => {
    const id = normalize(m.id);
    if (m.sector) sectorById.set(id, normalize(m.sector));
  });
  const getSector = (u: UnitData) => {
    const fromData = sectorById.get(normalize(u.id));
    return fromData || normalize(u.sector);
  };

  // Clasificación de estados operativos
  const inoperativeStatuses = ['DESPERFECTOS', 'SINIESTRO', 'MANTENIMIENTO'];
  const isPatrullando = (u: UnitData) => {
    const s = normalize(u.status);
    return s === 'PATRULLANDO' || s === 'APOYO' || s.includes('APOYO') || isTacticoPPFFStatus(u.status);
  };
  const isInoperative = (u: UnitData) => {
    const s = normalize(u.status);
    return inoperativeStatuses.includes(s);
  };

  // Deduplicar registros de unidades
  const cleanUnits = dedupeUnitsByDataId(units, mobileData);

  // Mapeo de retenes activos
  const retenByUnit = new Map<string, string>();
  (retenData || []).forEach(r => {
    const key = normalize(r.replacedUnit);
    if (key && !retenByUnit.has(key)) retenByUnit.set(key, String(r.retenUnit || '').trim());
  });

  // --- ENCABEZADO INSTITUCIONAL ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 45, 90);
  doc.text('REPORTE CONSOLIDADO DE OPERATIVIDAD', pageWidth / 2, 13, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('SUBGERENCIA DE SEGURIDAD CIUDADANA · CENTRO DE CONTROL DE OPERACIONES (CCO)', pageWidth / 2, 17.5, { align: 'center' });

  // Banner Turno
  doc.setDrawColor(0, 75, 147);
  doc.setLineWidth(0.6);
  doc.setFillColor(245, 248, 252);
  doc.roundedRect(margin + 25, 20.5, pageWidth - (margin * 2) - 50, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 75, 147);
  doc.text(`TURNO ${shift.toUpperCase()}`, pageWidth / 2, 27.5, { align: 'center' });

  // Fecha
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(formatLongDate(date).toUpperCase(), pageWidth / 2, 35, { align: 'center' });

  // Sectores canónicos de la Municipalidad de Santiago de Surco
  const sectors = [
    '1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B',
    'RESCATE', 'GIR', 'C4', 'COVV', 'OTRAS AREAS'
  ];

  // Cálculo por sector
  const sectorRows: any[][] = [];
  let totalFlotaAcum = 0;
  let totalOperativasAcum = 0;
  let totalInoperativasAcum = 0;
  let totalSinPatrullarAcum = 0;
  let totalRetenAcum = 0;

  sectors.forEach(s => {
    const secNorm = normalize(s);
    const allowed = secNorm === 'OTRAS AREAS' ? sourceSectorsFor(s).map(x => normalize(x)) : [secNorm];
    const inSec = (val: unknown) => allowed.includes(normalize(val));

    // Flota de referencia DATA o unidades registradas en el turno
    const dataFleet = mobileData.filter(m => inSec(m.sector));
    const secUnits = cleanUnits.filter(u => inSec(getSector(u)));

    const efectivos = dataFleet.length > 0 ? dataFleet.length : secUnits.length;
    const operativas = secUnits.filter(u => isPatrullando(u)).length;
    const inoperativas = secUnits.filter(u => isInoperative(u)).length;
    const sinPatrullar = secUnits.filter(u => !isPatrullando(u) && !isInoperative(u)).length;
    const retens = secUnits.filter(u => retenByUnit.has(normalize(u.id))).length;

    const pctOperatividad = efectivos > 0 ? Math.min(100, Math.round((operativas / efectivos) * 100)) : 0;

    totalFlotaAcum += efectivos;
    totalOperativasAcum += operativas;
    totalInoperativasAcum += inoperativas;
    totalSinPatrullarAcum += sinPatrullar;
    totalRetenAcum += retens;

    sectorRows.push([
      s,
      efectivos || '--',
      operativas || '--',
      inoperativas || '--',
      sinPatrullar || '--',
      retens || '--',
      efectivos > 0 ? `${pctOperatividad}%` : '0%'
    ]);
  });

  const pctGlobal = totalFlotaAcum > 0 ? Math.min(100, Math.round((totalOperativasAcum / totalFlotaAcum) * 100)) : 0;

  // Fila de totales
  sectorRows.push([
    'TOTALES',
    totalFlotaAcum,
    totalOperativasAcum,
    totalInoperativasAcum,
    totalSinPatrullarAcum,
    totalRetenAcum,
    `${pctGlobal}%`
  ]);

  // Strip de Tarjetas KPI Ejecutivas
  (doc as any).autoTable({
    startY: 38,
    head: [[
      { content: `FLOTA TOTAL\n${totalFlotaAcum}`, styles: { halign: 'center', fillColor: [0, 45, 90], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 1.8 } },
      { content: `OPERATIVOS\n${totalOperativasAcum}`, styles: { halign: 'center', fillColor: [40, 167, 69], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 1.8 } },
      { content: `INOPERATIVOS\n${totalInoperativasAcum}`, styles: { halign: 'center', fillColor: [220, 53, 69], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 1.8 } },
      { content: `SIN PATRULLAR\n${totalSinPatrullarAcum}`, styles: { halign: 'center', fillColor: [245, 158, 11], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 1.8 } },
      { content: `TASA OPERATIVIDAD\n${pctGlobal}%`, styles: { halign: 'center', fillColor: [13, 148, 136], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', cellPadding: 1.8 } }
    ]],
    body: [],
    theme: 'grid',
    margin: { left: margin, right: margin }
  });

  const kpiFinalY = (doc as any).lastAutoTable.finalY + 2.5;

  // Tabla 1: RESUMEN DE OPERATIVIDAD POR SECTOR
  (doc as any).autoTable({
    startY: kpiFinalY,
    head: [[
      { content: 'OPERATIVIDAD CONSOLIDADA POR SECTOR', colSpan: 7, styles: { halign: 'center', fillColor: [0, 45, 90], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' } }
    ], [
      'SECTORES', 'FLOTA EFECTIVA', 'OPERATIVAS', 'INOPERATIVAS', 'SIN PATRULLAR', 'RETÉN', '% OPERAT.'
    ]],
    body: sectorRows,
    theme: 'grid',
    styles: { fontSize: 6.8, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 0.8 },
    headStyles: { fillColor: [42, 157, 143], textColor: [255, 255, 255], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 32, fillColor: [241, 245, 249], fontStyle: 'bold' },
      1: { cellWidth: 26 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 24 },
      6: { cellWidth: 30 }
    },
    didParseCell: function (data: any) {
      if (data.row.section === 'body') {
        const isTotalRow = data.row.index === sectorRows.length - 1;
        if (!isTotalRow) {
          if (data.column.index === 1) data.cell.styles.fillColor = [240, 248, 255];
          if (data.column.index === 2) data.cell.styles.fillColor = [220, 255, 220];
          if (data.column.index === 3) data.cell.styles.fillColor = [255, 220, 220];
          if (data.column.index === 4) data.cell.styles.fillColor = [255, 250, 205];
          if (data.column.index === 5) data.cell.styles.fillColor = [245, 240, 255];
          if (data.column.index === 6) {
            const rawVal = parseInt(data.cell.raw) || 0;
            if (rawVal >= 75) {
              data.cell.styles.fillColor = [209, 250, 229];
              data.cell.styles.textColor = [6, 95, 70];
            } else if (rawVal >= 50) {
              data.cell.styles.fillColor = [254, 243, 199];
              data.cell.styles.textColor = [146, 64, 14];
            } else {
              data.cell.styles.fillColor = [254, 226, 226];
              data.cell.styles.textColor = [153, 27, 27];
            }
          }
        } else {
          data.cell.styles.fillColor = [0, 45, 90];
          data.cell.styles.textColor = [255, 255, 255];
          if (data.column.index === 2) data.cell.styles.fillColor = [40, 167, 69];
          if (data.column.index === 3) data.cell.styles.fillColor = [220, 53, 69];
          if (data.column.index === 4) data.cell.styles.fillColor = [230, 140, 0];
          if (data.column.index === 6) data.cell.styles.fillColor = [13, 148, 136];
        }
      }
    },
    margin: { left: margin, right: margin }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 2.5;

  // Tabla 2: OPERATIVIDAD POR CATEGORÍA DE FLOTA
  const normModel = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[\s.\-_]+/g, '');
  const isYamaha = (m: unknown) => normModel(m).includes('XTZ') || normModel(m).includes('YAMAHA');
  const isHonda = (m: unknown) => normModel(m).includes('SAHARA') || normModel(m).includes('HONDA') || normModel(m).includes('XRE');

  const fleetCategories = [
    {
      name: 'CAMIONETAS Y AUTOS (MÓVILES)',
      predicate: (u: UnitData) => u.type === 'CHOFER'
    },
    {
      name: 'MOTOS YAMAHA XTZ150',
      predicate: (u: UnitData) => u.type === 'MOTO' && isYamaha(u.model)
    },
    {
      name: 'MOTOS HONDA SAHARA XRE 300',
      predicate: (u: UnitData) => u.type === 'MOTO' && isHonda(u.model)
    },
    {
      name: 'SERENOS / PUESTOS FIJOS (A PIE)',
      predicate: (u: UnitData) => u.type === 'SERENO'
    }
  ];

  const categoryRows = fleetCategories.map(cat => {
    const catUnits = cleanUnits.filter(cat.predicate);
    const catTotal = catUnits.length;
    const catOperativos = catUnits.filter(isPatrullando).length;
    const catInoperativos = catUnits.filter(isInoperative).length;
    const catSinPatrullar = catUnits.filter(u => !isPatrullando(u) && !isInoperative(u)).length;
    const catPct = catTotal > 0 ? Math.min(100, Math.round((catOperativos / catTotal) * 100)) : 0;
    return [
      cat.name,
      catTotal || '--',
      catOperativos || '--',
      catInoperativos || '--',
      catSinPatrullar || '--',
      catTotal > 0 ? `${catPct}%` : '0%'
    ];
  });

  (doc as any).autoTable({
    startY: currentY,
    head: [[
      { content: 'DESGLOSE DE OPERATIVIDAD POR CATEGORÍA DE FLOTA', colSpan: 6, styles: { halign: 'center', fillColor: [38, 70, 83], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' } }
    ], [
      'CATEGORÍA DE FLOTA / RECURSO', 'TOTAL', 'OPERATIVOS', 'INOPERATIVOS', 'SIN PATRULLAR', '% OPERATIVIDAD'
    ]],
    body: categoryRows,
    theme: 'grid',
    styles: { fontSize: 6.8, fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1, cellPadding: 0.9 },
    headStyles: { fillColor: [42, 157, 143], textColor: [255, 255, 255], fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 65, halign: 'left', fillColor: [248, 250, 252] },
      1: { cellWidth: 25 },
      2: { cellWidth: 25, fillColor: [220, 255, 220] },
      3: { cellWidth: 25, fillColor: [255, 220, 220] },
      4: { cellWidth: 25, fillColor: [255, 250, 205] },
      5: { cellWidth: 25, fillColor: [209, 250, 229] }
    },
    margin: { left: margin, right: margin }
  });

  currentY = (doc as any).lastAutoTable.finalY + 2.5;

  // Tabla 3: DETALLE DE UNIDADES INOPERATIVAS Y SIN PATRULLAR
  const inopData = cleanUnits
    .filter(u => isInoperative(u))
    .map((u, idx) => [
      String(idx + 1),
      u.id || '--',
      u.type || '--',
      getSector(u) || '--',
      (u.lugarEstado || 'TALLER').toString().toUpperCase(),
      (u.motivoEstado || u.mechanics || u.reason || 'NO APLICA').toString().toUpperCase(),
      retenByUnit.get(normalize(u.id)) || '--'
    ]);

  const sinPatrullarData = cleanUnits
    .filter(u => !isPatrullando(u) && !isInoperative(u))
    .map((u, idx) => [
      String(idx + 1),
      u.id || '--',
      u.type || '--',
      getSector(u) || '--',
      normalize(u.status) || 'SIN PATRULLAR',
      (u.motivoEstado || u.reason || u.mechanics || '--').toString().toUpperCase()
    ]);

  // Si hay inoperativos, renderizar tabla de inoperativos
  if (inopData.length > 0) {
    (doc as any).autoTable({
      startY: currentY,
      head: [[
        { content: `DETALLE DE UNIDADES INOPERATIVAS (${inopData.length})`, colSpan: 7, styles: { halign: 'center', fillColor: [220, 53, 69], textColor: [255, 255, 255], fontSize: 7.2, fontStyle: 'bold' } }
      ], [
        'N°', 'UNIDAD', 'TIPO', 'SECTOR', 'LUGAR', 'MOTIVO / FALLA TÉCNICA', 'RETÉN'
      ]],
      body: inopData,
      theme: 'grid',
      styles: { fontSize: 6.3, halign: 'center', cellPadding: 0.7 },
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16, fontStyle: 'bold' },
        2: { cellWidth: 16 },
        3: { cellWidth: 18 },
        4: { cellWidth: 24 },
        5: { cellWidth: 'auto', halign: 'left' },
        6: { cellWidth: 20 }
      },
      margin: { left: margin, right: margin }
    });
    currentY = (doc as any).lastAutoTable.finalY + 2.5;
  }

  // Si hay sin patrullar, renderizar tabla de sin patrullar
  if (sinPatrullarData.length > 0) {
    (doc as any).autoTable({
      startY: currentY,
      head: [[
        { content: `DETALLE DE UNIDADES SIN PATRULLAR (${sinPatrullarData.length})`, colSpan: 6, styles: { halign: 'center', fillColor: [217, 119, 6], textColor: [255, 255, 255], fontSize: 7.2, fontStyle: 'bold' } }
      ], [
        'N°', 'UNIDAD', 'TIPO', 'SECTOR', 'ESTADO', 'MOTIVO / OBSERVACIONES'
      ]],
      body: sinPatrullarData,
      theme: 'grid',
      styles: { fontSize: 6.3, halign: 'center', cellPadding: 0.7 },
      headStyles: { fillColor: [180, 83, 9], textColor: [255, 255, 255], fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16, fontStyle: 'bold' },
        2: { cellWidth: 16 },
        3: { cellWidth: 18 },
        4: { cellWidth: 26, fontStyle: 'bold' },
        5: { cellWidth: 'auto', halign: 'left' }
      },
      margin: { left: margin, right: margin }
    });
  }

  // Pie de página en todas las páginas
  const c4Supervisor = resolveC4Supervisor(settingsMap) || (((Object.values(settingsMap)[0] || {}) as any).supervisor || '');
  const resolvedOperator = resolveOperator(settingsMap, operatorName);
  stampReportFooter(doc, pageWidth, pageHeight, margin, c4Supervisor, resolvedOperator, new Date().toLocaleString());

  const fileName = `REPORTE_OPERATIVIDAD_${shift.toUpperCase()}_${date}.pdf`;
  doc.save(fileName);
};
