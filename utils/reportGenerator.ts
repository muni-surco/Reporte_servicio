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
  const motoUnits = units.filter(u => {
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
  const normalize = (v: unknown) => String(v ?? '').trim().toUpperCase();

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

  const formatLongDate = (dateStr: string) => {
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

  const inoperativeStatuses = ['MANTENIMIENTO', 'DESPERFECTOS', 'SINIESTRO'];
  const isPatrullandoStatus = (status: unknown) => {
    const s = String(status || '').trim().toUpperCase();
    return s === 'PATRULLANDO' || s === 'APOYO' || s.includes('APOYO');
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
    const sinPatrullar = efectivo - inoperativos - patrullando;

    return [
      s,
      blankZero(efectivo),
      blankZero(inoperativos),
      blankZero(patrullando),
      blankZero(sinPatrullar)
    ];
  });

  // Calculate Totals
  const totals = summaryRows.reduce((acc: number[], curr: any[]) => {
    acc[0] += Number(curr[1]) || 0;
    acc[1] += Number(curr[2]) || 0;
    acc[2] += Number(curr[3]) || 0;
    acc[3] += Number(curr[4]) || 0;
    return acc;
  }, [0, 0, 0, 0]);

  summaryRows.push([
    'TOTALES',
    blankZero(totals[0]),
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

  let finalY = (doc as any).lastAutoTable.finalY + 8;

  // --- PERMANENCIA (sin cuadro OPERADOR CCO) ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;
  // Supervisor CCO debe provenir del sector C4 (requerimiento específico para reporte de motos)
  const c4Key = Object.keys(settingsMap).find(k => k.trim().toUpperCase().replace(/^SECTOR\s+/, '') === 'C4');
  const c4Settings = (c4Key ? (settingsMap as any)[c4Key] : null) || (settingsMap as any)['C4'] || (settingsMap as any)['SECTOR C4'] || null;
  const c4Supervisor = (c4Settings?.supervisor || '').trim() || firstSectorSettings.supervisor || '';
  const resolvedOperator = operatorName || firstSectorSettings.operador || '--';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0);

  finalY += 8;

  // --- DETAILS --- n° / unidad / estado / motivo
  const inopData = motoUnits
    .filter(u => !isPatrullandoStatus(u.status) && inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || 'NO APLICA', (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase()]);

  const sinPatrullarData = motoUnits
    .filter(u => !isPatrullandoStatus(u.status) && !inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map((u, idx) => [String(idx + 1), u.indicative || u.id, normalize(u.status) || '', (u.motivoEstado || u.mechanics || '').toString().toUpperCase()]);

  // Cuatro columnas para detalles: n° / unidad / estado / motivo
  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'INOPERATIVOS', colSpan: 4, styles: { halign: 'center', fillColor: [220, 53, 69] } }
    ], [
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: inopData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 15 }, 2: { cellWidth: 28 }, 3: { cellWidth: 25 } },
    margin: { left: margin },
    tableWidth: (pageWidth / 2) - margin - 5
  });

  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'SIN PATRULLAR', colSpan: 4, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }
    ], [
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: sinPatrullarData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 15 }, 2: { cellWidth: 28 }, 3: { cellWidth: 25 } },
    margin: { left: pageWidth / 2 + 5 },
    tableWidth: (pageWidth / 2) - margin - 5
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
  const normalize = (v: unknown) => String(v ?? '').trim().toUpperCase();

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
  const motoUnitsFor = (modelFilter: string, titleSuffix: string) => {
    const filterKeys = modelKeysFor(modelFilter, titleSuffix);
    return units.filter(u => {
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

  const formatLongDate = (dateStr: string) => {
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

  const inoperativeStatuses = ['MANTENIMIENTO', 'DESPERFECTOS', 'SINIESTRO'];
  const isPatrullandoStatus = (status: unknown) => {
    const s = String(status || '').trim().toUpperCase();
    return s === 'PATRULLANDO' || s === 'APOYO' || s.includes('APOYO');
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
      const sinPatrullar = efectivo - inoperativos - patrullando;

      return [
        sectorCode,
        blankZero(efectivo),
        blankZero(inoperativos),
        blankZero(patrullando),
        blankZero(sinPatrullar)
      ];
    });

    // Calculate Totals
    const totals = summaryRows.reduce((acc: number[], curr: any[]) => {
      acc[0] += Number(curr[1]) || 0;
      acc[1] += Number(curr[2]) || 0;
      acc[2] += Number(curr[3]) || 0;
      acc[3] += Number(curr[4]) || 0;
      return acc;
    }, [0, 0, 0, 0]);

    summaryRows.push([
      'TOTALES',
      blankZero(totals[0]),
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

    return (doc as any).lastAutoTable.finalY + 8;
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
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;
  // Supervisor CCO debe provenir del sector C4 (requerimiento específico para reporte de motos)
  const c4Key = Object.keys(settingsMap).find(k => k.trim().toUpperCase().replace(/^SECTOR\s+/, '') === 'C4');
  const c4Settings = (c4Key ? (settingsMap as any)[c4Key] : null) || (settingsMap as any)['C4'] || (settingsMap as any)['SECTOR C4'] || null;
  const c4Supervisor = (c4Settings?.supervisor || '').trim() || firstSectorSettings.supervisor || '';
  const resolvedOperator = operatorName || firstSectorSettings.operador || '--';

  finalY += 8;

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
  const normalize = (value: unknown) => String(value ?? '').trim().toUpperCase();
  const fleetMobileIds = new Set(
    mobileData
      .filter(m => opts.fleetPredicate(m))
      .map(m => normalize(m.id))
  );
  const vehicleUnits = units.filter(u => u.type === 'CHOFER' && fleetMobileIds.has(normalize(u.id)));

  const formatLongDate = (dateStr: string) => {
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

  const inoperativeStatuses = ['MANTENIMIENTO', 'DESPERFECTOS', 'SINIESTRO'];

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
    const sectorChoferUnits = units.filter(u =>
      u.type === 'CHOFER' &&
      (isOtrasAreas ? normalize(u.sector) === 'OTRAS AREAS' : normalize(u.sector).includes(s))
    );
    const countReten = sectorChoferUnits.filter(u => normalize(u.id).startsWith('AR-')).length;

    // Regular statuses only for non-AR units
    const regularUnits = sectorUnits.filter(u => !normalize(u.id).startsWith('AR-'));

    const countInoperativos = regularUnits.filter(u => inoperativeStatuses.includes(normalize(u.status))).length;
    // TACTICO PP.FF. se considera como PATRULLANDO
    const countPatrullando = regularUnits.filter(u =>
      normalize(u.status) === 'PATRULLANDO' || isTacticoPPFFStatus(u.status)
    ).length;
    const countSinPatrullar = regularUnits.filter(u =>
      normalize(u.status) !== 'PATRULLANDO' &&
      !inoperativeStatuses.includes(normalize(u.status)) &&
      normalize(u.status) !== 'SIN VEHICULO' &&
      !isTacticoPPFFStatus(u.status)
    ).length;

    const efectivo = baseFleet; // Usar flota base

    return [
      s,
      blankZero(efectivo),
      blankZero(countInoperativos),
      blankZero(countPatrullando),
      blankZero(countSinPatrullar),
      // En FLOTA CAMIONETAS el retén no aplica
      retenNA ? 'NO APLICA' : blankZero(countReten)
    ];
  };

  // Calculate Totals
  const withTotals = (rows: any[][], retenNA: boolean) => {
    const totals = rows.reduce((acc: number[], curr: any[]) => {
      acc[0] += Number(curr[1]) || 0;
      acc[1] += Number(curr[2]) || 0;
      acc[2] += Number(curr[3]) || 0;
      acc[3] += Number(curr[4]) || 0;
      acc[4] += Number(curr[5]) || 0;
      return acc;
    }, [0, 0, 0, 0, 0]);

    rows.push([
      'TOTALES',
      blankZero(totals[0]),
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

  let finalY = (doc as any).lastAutoTable.finalY + 4;

  // --- PERMANENCIA + OPERADOR CCO ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;
  // Supervisor CCO debe provenir del sector C4 (mismo criterio que reporte motos)
  const c4Key = Object.keys(settingsMap).find(k => k.trim().toUpperCase().replace(/^SECTOR\s+/, '') === 'C4');
  const c4Settings = (c4Key ? (settingsMap as any)[c4Key] : null) || (settingsMap as any)['C4'] || (settingsMap as any)['SECTOR C4'] || null;
  const c4Supervisor = (c4Settings?.supervisor || '').trim() || firstSectorSettings.supervisor || '';
  const resolvedOperator = operatorName || firstSectorSettings.operador || '--';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  finalY += 5;

  // --- DETAILS TABLES ---
  const retenByUnit = new Map<string, string>();
  retenData.forEach(r => {
    const key = normalize(r.replacedUnit);
    if (key && !retenByUnit.has(key)) retenByUnit.set(key, String(r.retenUnit || '').trim());
  });

  const inopData = vehicleUnits
    .filter(u => !normalize(u.id).startsWith('AR-') && inoperativeStatuses.includes(normalize(u.status)))
    .map((u, idx) => [
      String(idx + 1),
      u.id,
      (u.lugarEstado || 'NO APLICA').toString().toUpperCase(),
      (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase(),
      retenByUnit.get(normalize(u.id)) || 'NO APLICA'
    ]);

  const sinPatrullarData = vehicleUnits
    .filter(u => {
      const status = normalize(u.status);
      const id = normalize(u.id);
      return (
        !id.startsWith('AR-') &&
        status !== 'PATRULLANDO' &&
        !inoperativeStatuses.includes(status) &&
        status !== 'SIN VEHICULO' &&
        !isTacticoPPFFStatus(u.status)
      );
    })
    .map((u, idx) => [String(idx + 1), u.id, normalize(u.status) || 'NO APLICA', (u.motivoEstado || u.mechanics || 'NO APLICA').toString().toUpperCase()]);

  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'INOPERATIVOS', colSpan: 5, styles: { halign: 'center', fillColor: [220, 53, 69] } }
    ], [
      'N°', 'UNIDAD', 'LUGAR', 'MOTIVO', 'RETEN'
    ]],
    body: inopData,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 14 }, 2: { cellWidth: 22 }, 4: { cellWidth: 18 } },
    margin: { left: margin },
    tableWidth: (pageWidth / 2) - margin - 2
  });

  (doc as any).autoTable({
    startY: finalY,
    head: [[
      { content: 'SIN PATRULLAR', colSpan: 4, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }
    ], [
      'N°', 'UNIDAD', 'ESTADO', 'MOTIVO'
    ]],
    body: sinPatrullarData,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center' },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 14 }, 2: { cellWidth: 28 } },
    margin: { left: pageWidth / 2 + 2 },
    tableWidth: (pageWidth / 2) - margin - 2
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
  filePrefix: 'REPORTE_VEHICULOS_RENTING'
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
  tableHeader: 'FLOTA VEHICULAR SIPCOP',
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

  const formatLongDate = (dateStr: string) => {
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

  // Helper to normalize names for perfect matching
  const normalize = (val: any) => {
    return (val || '').toString()
      .trim()
      .toUpperCase()
      .replace(/\./g, '') // Remove dots (e.g., SOT. -> SOT)
      .replace(/,/g, '')  // Remove commas
      .replace(/\s+/g, ' '); // Normalize spaces
  };

  // 1. Identify present vs explicitly absent personnel names
  const presentNames = new Set<string>();
  const explicitAbsentInUnits = new Set<string>();
  // Map name -> { sector, motivo } for absent people from units
  const nameToSector = new Map<string, string>();
  const nameToUnitMotivo = new Map<string, string>();

  console.log("DEBUG: Inicio de procesamiento. Unidades totales:", units.length);

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
      console.log(`DEBUG: Ausencia detectada para: '${name}' (Unidad ${u.id})`);
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

  console.log("DEBUG: Total ausencias únicas en Set:", explicitAbsentInUnits.size);
  console.log("DEBUG: Contenido del Set de ausentes:", Array.from(explicitAbsentInUnits));

  // 2. Filter personnel list (solo personal de la hoja Personal)
  const absents = personnel.filter(p => {
    const name = normalize(p.apellidos_nombres);
    const isExplicit = explicitAbsentInUnits.has(name);
    if (isExplicit) {
        console.log(`DEBUG: Personal encontrado en ausentes: '${name}'`);
    }
    return isExplicit; 
  });

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
        
        console.log(`DEBUG: Agregando ${data.length} personas al grupo ${regimeKey} para el motivo ${motivo}`);

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

  const formatLongDate = (dateStr: string) => {
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

  const normalize = (val: any) => {
    return (val || '').toString()
      .trim()
      .toUpperCase()
      .replace(/\./g, '')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ');
  };

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

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

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
  const firstSectorSettings = (Object.values(settingsMap)[0] || { operador: '' }) as any;
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

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  };

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
