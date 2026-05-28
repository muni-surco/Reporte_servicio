// We use the global jspdf and jspdf-autotable from the CDN in index.html
declare const jspdf: any;
declare const XLSX: any;

import { UnitData, AppSettings, Sector, PersonnelData } from '../types';

export const generateMotoReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  modelFilter: string = 'XTZ150',
  titleSuffix: string = 'YAMAHA XTZ150',
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

  // Filter specifically for the selected model
  const motoUnits = units.filter(u => u.type === 'MOTO' && (u.model || '').toUpperCase().includes(titleSuffix.toUpperCase()));

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
    'SECTOR 1A', 'SECTOR 1B', 'SECTOR 2A', 'SECTOR 2B', 'SECTOR 3',
    'SECTOR 4', 'SECTOR 5', 'SECTOR 6', 'SECTOR 7', 'SECTOR 8',
    'SECTOR 9A', 'GIR'
  ];

  const inoperativeStatuses = ['MANTENIMIENTO', 'DESPERFECTOS', 'SINIESTRO'];

  const summaryRows = sectors.map(s => {
    const sectorCode = s.replace('SECTOR ', '');
    const sectorUnits = motoUnits.filter(u => (u.sector || '').toUpperCase().includes(sectorCode));
    const efectivo = sectorUnits.length;
    const inoperativos = sectorUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const patrullando = sectorUnits.filter(u => (u.status || '').toUpperCase() === 'PATRULLANDO').length;
    const sinPatrullar = efectivo - inoperativos - patrullando;

    return [
      sectorCode,
      efectivo || '0',
      inoperativos || '0',
      patrullando || '0',
      sinPatrullar || '0'
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
    totals[0].toString(),
    totals[1].toString(),
    totals[2].toString(),
    totals[3].toString()
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

  // --- PERMANENCIA / JEFE DE ÁREA ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;
  const permanenciaLabel = shift === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0);
  doc.rect(margin, finalY, pageWidth - (margin * 2), 10);
  doc.text(`${permanenciaLabel} :`, margin + 5, finalY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(firstSectorSettings.permanencia || '--', margin + 45, finalY + 6.5);

  finalY += 15;

  // --- DETAILS ---
  const inopData = motoUnits
    .filter(u => u.status !== 'PATRULLANDO' && inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.indicative || u.id, u.mechanics || u.status]);

  while (inopData.length < 15) inopData.push(['', '']);

  const sinPatrullarData = motoUnits
    .filter(u => u.status !== 'PATRULLANDO' && !inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.indicative || u.id, u.mechanics || u.status]);

  while (sinPatrullarData.length < 15) sinPatrullarData.push(['', '']);

  // Two columns for details
  (doc as any).autoTable({
    startY: finalY,
    head: [[{ content: 'INOPERATIVOS', colSpan: 2, styles: { halign: 'center', fillColor: [220, 53, 69] } }]],
    body: inopData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { textColor: [255, 255, 255] },
    margin: { left: margin },
    tableWidth: (pageWidth / 2) - margin - 5
  });

  (doc as any).autoTable({
    startY: finalY,
    head: [[{ content: 'SIN PATRULLAR', colSpan: 2, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }]],
    body: sinPatrullarData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1 },
    margin: { left: pageWidth / 2 + 5 },
    tableWidth: (pageWidth / 2) - margin - 5
  });

  // --- SIGNATURES ---
  const footerY = pageHeight - 35;
  doc.setLineWidth(0.5);
  doc.line(margin + 10, footerY, margin + 70, footerY);
  doc.line(pageWidth - margin - 70, footerY, pageWidth - margin - 10, footerY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('SUPERVISOR CCO', margin + 40, footerY + 5, { align: 'center' });
  doc.text('OPERADOR CCO', pageWidth - margin - 40, footerY + 5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.text(firstSectorSettings.supervisor || '______________________', margin + 40, footerY + 10, { align: 'center' });
  doc.text(operatorName || '______________________', pageWidth - margin - 40, footerY + 10, { align: 'center' });

  // Timestamp
  const now = new Date();
  doc.setFontSize(7);
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  const fileName = `REPORTE_MOTOS_${titleSuffix.toUpperCase()}_${shift}_${date}.pdf`;
  doc.save(fileName);
};

export const generateVehicleReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
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

  // Filter for CHOFER units (Vehicles)
  const vehicleUnits = units.filter(u => u.type === 'CHOFER');

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
  doc.text('REPORTE NUMÉRICO DE VEHÍCULOS RENTING', pageWidth / 2, 12, { align: 'center' });

  // Shift Box
  doc.setLineWidth(0.5);
  doc.rect(margin + 20, 16, pageWidth - (margin * 2) - 40, 12);
  doc.setFontSize(22);
  doc.text(shift.toUpperCase(), pageWidth / 2, 25, { align: 'center' });

  // Date
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(formatLongDate(date), pageWidth / 2, 33, { align: 'center' });

  // --- SUMMARY TABLE (FLOTA VEHICULAR) ---
  const sectors = [
    '1A', '1B', '2A', '2B', '3', '4', '5', '6', '7', '8', '9A', '9B', 'GIR', 'RESCATE'
  ];

  const inoperativeStatuses = ['MANTENIMIENTO', 'DESPERFECTOS', 'SINIESTRO'];

  const summaryRows = sectors.map(s => {
    const sectorUnits = vehicleUnits.filter(u => (u.sector || '').toUpperCase().includes(s));

    // Count Reten based on ID starting with AR- (replacement vehicles AR-1 to AR-12)
    const countReten = sectorUnits.filter(u => (u.id || '').startsWith('AR-')).length;

    // Regular statuses only for non-AR units
    const regularUnits = sectorUnits.filter(u => !(u.id || '').startsWith('AR-'));

    const countInoperativos = regularUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const countPatrullando = regularUnits.filter(u => (u.status || '').toUpperCase() === 'PATRULLANDO').length;
    const countSinPatrullar = regularUnits.filter(u =>
      u.status !== 'PATRULLANDO' &&
      !inoperativeStatuses.includes((u.status || '').toUpperCase()) &&
      u.status !== 'SIN VEHICULO'
    ).length;

    const efectivo = countPatrullando + countSinPatrullar;

    return [
      s,
      efectivo || '0',
      countInoperativos || '0',
      countPatrullando || '0',
      countSinPatrullar || '0',
      countReten || '0'
    ];
  });

  // Calculate Totals
  const totals = summaryRows.reduce((acc: number[], curr: any[]) => {
    acc[0] += Number(curr[1]) || 0;
    acc[1] += Number(curr[2]) || 0;
    acc[2] += Number(curr[3]) || 0;
    acc[3] += Number(curr[4]) || 0;
    acc[4] += Number(curr[5]) || 0;
    return acc;
  }, [0, 0, 0, 0, 0]);

  summaryRows.push([
    'TOTALES',
    totals[0].toString(),
    totals[1].toString(),
    totals[2].toString(),
    totals[3].toString(),
    totals[4].toString()
  ]);

  (doc as any).autoTable({
    startY: 38,
    head: [[
      { content: 'FLOTA VEHICULAR', colSpan: 6, styles: { halign: 'center', fillColor: [38, 70, 83] } }
    ], [
      'SECTORES', 'EFECTIVO', 'INOPERATIVOS', 'PATRULLANDO', 'SIN PATRULLAR', 'RETEN'
    ]],
    body: summaryRows,
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
        const isTotalRow = data.row.index === summaryRows.length - 1;

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

  let finalY = (doc as any).lastAutoTable.finalY + 4;

  // --- CHOFERES SIN CARRO bar ---
  const choferesSinCarro = vehicleUnits.filter(u => (u.status || '').toUpperCase() === 'SIN VEHICULO').length;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(38, 70, 83);
  doc.rect(margin + 10, finalY, 50, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('CHOFERES SIN CARRO', margin + 12, finalY + 3.8);
  doc.setDrawColor(0);
  doc.rect(margin + 60, finalY, 20, 5);
  doc.setTextColor(0, 0, 0);
  doc.text(choferesSinCarro.toString(), margin + 70, finalY + 3.8, { align: 'center' });

  finalY += 9;

  // --- PERMANENCIA / JEFE DE ÁREA ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;
  const permanenciaLabel = shift === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA';

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(38, 70, 83);
  doc.rect(margin, finalY, 40, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(` ${permanenciaLabel} :`, margin + 2, finalY + 4.8);

  doc.setDrawColor(0);
  doc.rect(margin + 40, finalY, pageWidth - (margin * 2) - 40, 7);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(firstSectorSettings.permanencia || '--', margin + 45, finalY + 4.8);

  finalY += 9;

  // --- DETAILS TABLES ---
  const inopData = vehicleUnits
    .filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.id, u.plate || '', u.mechanics || u.status]);

  while (inopData.length < 15) inopData.push(['', '', '']);

  const sinPatrullarData = vehicleUnits
    .filter(u =>
      (u.status || '').toUpperCase() !== 'PATRULLANDO' &&
      !inoperativeStatuses.includes((u.status || '').toUpperCase()) &&
      (u.status || '').toUpperCase() !== 'SIN VEHICULO'
    )
    .map(u => [u.id, u.plate || '', u.mechanics || u.status]);

  while (sinPatrullarData.length < 15) sinPatrullarData.push(['', '', '']);

  (doc as any).autoTable({
    startY: finalY,
    head: [[{ content: 'INOPERATIVOS', colSpan: 3, styles: { halign: 'center', fillColor: [220, 53, 69] } }]],
    body: inopData,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center' },
    headStyles: { textColor: [255, 255, 255] },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 15 } },
    margin: { left: margin },
    tableWidth: (pageWidth / 2) - margin - 2
  });

  (doc as any).autoTable({
    startY: finalY,
    head: [[{ content: 'SIN PATRULLAR', colSpan: 3, styles: { halign: 'center', fillColor: [255, 193, 7], textColor: [0, 0, 0] } }]],
    body: sinPatrullarData,
    theme: 'grid',
    styles: { fontSize: 6.5, cellPadding: 0.8, halign: 'center' },
    columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 15 } },
    margin: { left: pageWidth / 2 + 2 },
    tableWidth: (pageWidth / 2) - margin - 2
  });

  const previousAutoTable = (doc as any).lastAutoTable;
  const finalDetailY = Math.max(previousAutoTable ? previousAutoTable.finalY : 0, finalY);

  // --- FOOTER ---
  const footerY = pageHeight - 20;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(`SUPERVISOR CCO: ${firstSectorSettings.supervisor || '--'}`, pageWidth - margin, footerY, { align: 'right' });
  doc.text(`OPERADOR CCO: ${operatorName || '--'}`, pageWidth - margin, footerY + 3, { align: 'right' });

  // Timestamp
  const now = new Date();
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  const fileName = `REPORTE_VEHICULOS_RENTING_${shift.toUpperCase()}_${date}.pdf`;
  doc.save(fileName);
};

export const generatePersonnelAbsenceReport = (
  units: UnitData[],
  personnel: PersonnelData[],
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
  // Map name -> { sector, status } for absent people from units
  const nameToSector = new Map<string, string>();
  const nameToUnitStatus = new Map<string, string>();

  const absenceStatuses = [
    'FALTO',
    'DESCANSO MEDICO',
    'DESCANSO MÉDICO',
    'DESCANSO FISICO',
    'DESCANSO COMPENSATORIO',
    'ONOMASTICO',
    'ONOMÁSTICO',
    'PERMISO',
  ];

  units.forEach(u => {
    const names: string[] = [];
    if (u.personnel1 && String(u.personnel1).trim() !== '') names.push(normalize(u.personnel1));
    if (u.personnel2 && String(u.personnel2).trim() !== '') names.push(normalize(u.personnel2));

    // Store assigned sector for each person found in units
    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const status = (u.status || '').toString().trim().toUpperCase();

    const motivo = (u.motivoEstado || '').toString().trim().toUpperCase();
    if (status === 'FALTO' && motivo === 'INASISTENCIA') {
      // Explicit absence: add to absent set and store sector/status
      names.forEach(name => {
        explicitAbsentInUnits.add(name);
        nameToSector.set(name, sector);
        nameToUnitStatus.set(name, status);
      });
    } else if (status !== 'FALTO') {
      // Only mark as present if NOT FALTO (FALTO with other motivo should not be counted)
      names.forEach(name => {
        if (!explicitAbsentInUnits.has(name)) {
          presentNames.add(name);
          nameToSector.set(name, sector);
        }
      });
    }
  });

  // 2. Filter personnel list for "ABSENT" — explicit unit absences take priority
  const absents = personnel.filter(p => {
    const name = normalize(p.apellidos_nombres);

    // If explicitly absent in a unit record → always include (overrides presentNames)
    if (explicitAbsentInUnits.has(name)) return true;

    // If present in an active unit → exclude
    if (presentNames.has(name)) return false;

    // Check spreadsheet/personnel status as fallback
    const statusSS = (p.estado || '').toString().trim().toUpperCase();
    return absenceStatuses.includes(statusSS);
  });

  // 3. Find absent people from units who are NOT in the personnel list (unmatched)
  const personnelNormalizedNames = new Set(personnel.map(p => normalize(p.apellidos_nombres)));
  explicitAbsentInUnits.forEach(name => {
    if (!personnelNormalizedNames.has(name)) {
      absents.push({
        apellidos_nombres: name,
        regimen_laboral: 'OS', // Default to ORDEN DE SERVICIO
        rol_operativo: '--',
        estado: nameToUnitStatus.get(name) || 'FALTO',
        n: '', dni: '', codigo_interno: '', sector_id: '', correo: '', telefono: '', rol_sistema: '', persona_id: '', pin_operativo: '', fecha_alta: '', fecha_baja: '', foto_url: ''
      });
    }
  });

  // 4. Group by regime
  const getRegime = (p: any) => {
    const reg = (p.regimen_laboral || '').toString().toUpperCase();
    if (/276/.test(reg)) return '276';
    if (/728/.test(reg)) return '728';
    // 1057 subtypes — check INDETERMINADO before DETERMINADO to avoid partial match
    if (/1057.*INDETERMINADO/i.test(reg)) return '1057-INDETERMINADO';
    if (/1057.*DETERMINADO/i.test(reg)) return '1057-DETERMINADO';
    if (/1057.*CONFIANZA/i.test(reg)) return '1057-CONFIANZA';
    if (/1057|CAS/i.test(reg)) return '1057-OTRO'; // fallback genérico 1057
    // Orden de servicio
    return 'OS';
  };

  const groupsToDraw = [
    { data: absents.filter(p => getRegime(p) === '276'),               label: 'FALTOS PLANILLA D.L. N° 276',                color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '728'),               label: 'FALTOS PLANILLA D.L. N° 728',                color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '1057-CONFIANZA'),    label: 'FALTOS D.L. N° 1057 (Confianza)',            color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '1057-DETERMINADO'),  label: 'FALTOS D.L. N° 1057 (Determinado)',          color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '1057-INDETERMINADO'),label: 'FALTOS D.L. N° 1057 (Indeterminado)',        color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '1057-OTRO'),         label: 'FALTOS D.L. N° 1057',                       color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === 'OS'),                label: 'FALTOS ORDEN DE SERVICIO',                  color: [0, 92, 187] }
  ];

  let currentY = 10;

  // Draw Main Report Header (Once)
  doc.setFillColor(38, 70, 83);
  doc.rect(margin, currentY, contentWidth, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SURCO', margin + 5, currentY + 11);

  doc.setFontSize(11);
  doc.text('REPORTE DE ASISTENCIA POR RÉGIMEN', margin + 35, currentY + 11);

  doc.setFontSize(8);
  doc.text(formatLongDate(date).toUpperCase(), pageWidth - margin - 5, currentY + 7, { align: 'right' });
  doc.text(`TURNO: ${shift.toUpperCase()}`, pageWidth - margin - 5, currentY + 13, { align: 'right' });

  currentY += 25;

  groupsToDraw.forEach((groupInfo) => {
    if (groupInfo.data.length === 0) return;

    // Check if we need a new page
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    // Header de grupo (Sub-title)
    doc.setFillColor(groupInfo.color[0], groupInfo.color[1], groupInfo.color[2]);
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(`${groupInfo.label}`, margin + 3, currentY + 4.8);
    doc.text(`TOTAL: ${groupInfo.data.length}`, margin + contentWidth - 3, currentY + 4.8, { align: 'right' });

    currentY += 7;

    const tableData = groupInfo.data.map(p => {
      const nameNorm = normalize(p.apellidos_nombres);
      return [
        p.apellidos_nombres?.toUpperCase() || '',
        (p.rol_operativo || '').toUpperCase() || '',
        shift.toUpperCase(), // MAÑANA, TARDE, NOCHE
        nameToSector.get(nameNorm) || '--',
        nameToUnitStatus.get(nameNorm) || '--'
      ];
    });

    (doc as any).autoTable({
      startY: currentY,
      head: [['APELLIDOS Y NOMBRES', 'CARGO', 'TURNO', 'SECTOR', 'MOTIVO']],
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
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 35, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        currentY = data.cursor.y;
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  // --- FOOTER ---
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`OPERADOR CCO: ${operatorName || '______________________'}`, pageWidth - margin, footerY, { align: 'right' });

  const now = new Date();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  doc.save(`REPORTE_ASISTENCIA_REGIMEN_${shift}_${date}.pdf`);
};


export const generateObservationsReport = (
  units: UnitData[],
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

  // Filter units with observations (mechanics)
  const unitsWithObservations = units.filter(u => u.mechanics && u.mechanics.trim() !== '');

  const rows: any[] = [];
  unitsWithObservations.forEach(u => {
    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    const dateFormatted = formatShortDate(date);

    // Each person gets a row with the same observation
    if (u.personnel1) {
      rows.push([
        dateFormatted,
        shift.toUpperCase(),
        sector,
        u.personnel1.toUpperCase(),
        u.mechanics.toUpperCase()
      ]);
    }
    if (u.personnel2) {
      rows.push([
        dateFormatted,
        shift.toUpperCase(),
        sector,
        u.personnel2.toUpperCase(),
        u.mechanics.toUpperCase()
      ]);
    }
  });

  // Sort by sector
  rows.sort((a, b) => a[2].localeCompare(b[2]));

  (doc as any).autoTable({
    startY: 15,
    head: [[
      { content: `REPORTE DE LOS PUESTOS DE COMANDOS - TURNO ${shift.toUpperCase()}`, colSpan: 5, styles: { halign: 'center', fillColor: [180, 180, 180], textColor: [0, 0, 0], fontSize: 11 } }
    ], [
      'FECHA', 'TURNO', 'SECTOR', 'NOMBRES Y APELLIDOS', 'OBSERVACIONES'
    ]],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, halign: 'center', textColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 25 },
      2: { cellWidth: 20 },
      3: { cellWidth: 80, halign: 'left' },
      4: { cellWidth: 'auto', halign: 'left' }
    },
    margin: { left: margin, right: margin }
  });

  // --- FOOTER ---
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`OPERADOR CCO: ${operatorName || '______________________'}`, pageWidth - margin, footerY, { align: 'right' });

  const now = new Date();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  doc.save(`REPORTE_OBSERVACIONES_${shift}_${date}.pdf`);
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
    const fuelExp = `${(u.fuel || '').toString() || '--'}\n${(u.expense || '').toString() || 'S/ 0.00'}`;

    rows.push({
      sector,
      unitType,
      unitId,
      plate,
      radioStr,
      cuadrante,
      personnel,
      status,
      kmStr,
      fuelExp,
      mechanics
    });
  });

  // Extract unique sectors and sort them
  const uniqueSectors = Array.from(new Set(rows.map(r => r.sector))).sort((a, b) => a.localeCompare(b));

  const firstSettings = Object.values(settingsMap)[0] || {} as AppSettings;
  const permanencia = firstSettings.permanencia || '--';
  const permanenciaLabel = shift === 'NOCHE' ? 'PERMANENCIA' : 'JEFE DE ÁREA';

  let currentY = 15;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`REPORTE GENERAL DE REGISTROS - TURNO ${shift.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`FECHA: ${formatShortDate(date)}   |   ${permanenciaLabel}: ${permanencia}`, pageWidth / 2, currentY + 5, { align: 'center' });

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
        r.kmStr,
        r.fuelExp,
        r.mechanics
      ]);

      // Add a total row
      tableData.push([
        { content: `TOTAL UNIDADES: ${totalEfectivos}`, colSpan: 5, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'right' } },
        { content: '', colSpan: 4, styles: { fillColor: [240, 240, 240] } }
      ]);

      if (currentY > doc.internal.pageSize.getHeight() - 25) {
        doc.addPage();
        currentY = 15;
      }

      (doc as any).autoTable({
        startY: currentY,
        head: [[
          { content: sec.label, colSpan: 9, styles: { halign: 'left', fillColor: [180, 180, 180], textColor: [0, 0, 0], fontSize: 8 } }
        ], [
          'UNIDAD', 'PLACA', 'RADIO', 'CUADRANTE', 'NOMBRES Y APELLIDOS / COPILOTO', 'ESTADO', 'KILOMETRAJE', 'COMBUSTIBLE / GASTO', 'OBSERVACIONES'
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
          4: { cellWidth: 60, halign: 'left' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 30 },
          7: { cellWidth: 20 },
          8: { cellWidth: 'auto', halign: 'left' }
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
  doc.text(`OPERADOR CCO: ${operatorName || '______________________'}`, pageWidth - margin, footerY, { align: 'right' });

  const now = new Date();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  doc.save(`REPORTE_GENERAL_${shift}_${date}.pdf`);
};

export const generateRetenReport = (
  replacements: any[],
  date: string,
  shift: string,
  operatorName?: string
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

  // --- FOOTER ---
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`OPERADOR CCO: ${operatorName || '______________________'}`, pageWidth - margin, footerY, { align: 'right' });

  const now = new Date();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  doc.save(`REPORTE_RETEN_${shift}_${date}.pdf`);
};

export const generateRetenExcel = (
  replacements: any[],
  date: string,
  shift: string
) => {
  const xlsxLib = (window as any).XLSX || (globalThis as any).XLSX || (typeof XLSX !== 'undefined' ? XLSX : null);
  
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
