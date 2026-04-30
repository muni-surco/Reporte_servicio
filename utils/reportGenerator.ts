// We use the global jspdf and jspdf-autotable from the CDN in index.html
declare const jspdf: any;

import { UnitData, AppSettings, Sector } from '../types';

export const generateMotoReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string,
  modelFilter: string = 'XTZ150',
  titleSuffix: string = 'YAMAHA XTZ150'
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
  const motoUnits = units.filter(u => u.type === 'MOTO' && (u.model || '').toUpperCase().includes(modelFilter.toUpperCase()));

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

  const inoperativeStatuses = ['MAESTRANZA', 'TALLER PARTICULAR', 'EN PC x DESPERFECTOS', 'TALLER'];

  const summaryRows = sectors.map(s => {
    const sectorCode = s.replace('SECTOR ', '');
    const sectorUnits = motoUnits.filter(u => (u.sector || '').toUpperCase().includes(sectorCode));
    const efectivo = sectorUnits.length;
    const inoperativos = sectorUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const patrullando = sectorUnits.filter(u => u.status === 'PATRULLANDO').length;
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

  // --- PERMANENCIA ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0);
  doc.rect(margin, finalY, pageWidth - (margin * 2), 10);
  doc.text('PERMANENCIA :', margin + 5, finalY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(firstSectorSettings.permanencia || '--', margin + 45, finalY + 6.5);

  finalY += 15;

  // --- DETAILS ---
  const inopData = motoUnits
    .filter(u => u.status !== 'PATRULLANDO' && inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.indicative || u.id, u.reason || u.status]);

  while (inopData.length < 15) inopData.push(['', '']);

  const sinPatrullarData = motoUnits
    .filter(u => u.status !== 'PATRULLANDO' && !inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.indicative || u.id, u.reason || u.status]);

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
  doc.text(firstSectorSettings.operador || '______________________', pageWidth - margin - 40, footerY + 10, { align: 'center' });

  // Timestamp
  const now = new Date();
  doc.setFontSize(7);
  doc.text(`Generado el: ${now.toLocaleString()}`, margin, pageHeight - 5);

  const fileName = `REPORTE_MOTOS_${modelFilter.toUpperCase()}_${shift}_${date}.pdf`;
  doc.save(fileName);
};

export const generateVehicleReport = (
  units: UnitData[],
  settingsMap: Record<string, AppSettings>,
  date: string,
  shift: string
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

  const inoperativeStatuses = ['MAESTRANZA', 'TALLER PARTICULAR', 'EN PC x DESPERFECTOS', 'TALLER'];

  const summaryRows = sectors.map(s => {
    const sectorUnits = vehicleUnits.filter(u => (u.sector || '').toUpperCase().includes(s));

    // Count Reten based on ID starting with AR- (replacement vehicles AR-1 to AR-12)
    const countReten = sectorUnits.filter(u => (u.id || '').startsWith('AR-')).length;

    // Regular statuses only for non-AR units
    const regularUnits = sectorUnits.filter(u => !(u.id || '').startsWith('AR-'));

    const countInoperativos = regularUnits.filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase())).length;
    const countPatrullando = regularUnits.filter(u => u.status === 'PATRULLANDO').length;
    const countSinPatrullar = regularUnits.filter(u =>
      u.status !== 'PATRULLANDO' &&
      !inoperativeStatuses.includes((u.status || '').toUpperCase()) &&
      u.status !== 'CHOFER SIN MOVIL'
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
  const choferesSinCarro = vehicleUnits.filter(u => u.status === 'CHOFER SIN MOVIL').length;
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

  // --- PERMANENCIA ---
  const firstSectorSettings = (Object.values(settingsMap)[0] || { permanencia: '', supervisor: '', operador: '' }) as any;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(38, 70, 83);
  doc.rect(margin, finalY, 40, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(' P E R M A N E N C I A :', margin + 2, finalY + 4.8);

  doc.setDrawColor(0);
  doc.rect(margin + 40, finalY, pageWidth - (margin * 2) - 40, 7);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(firstSectorSettings.permanencia || '--', margin + 45, finalY + 4.8);

  finalY += 9;

  // --- DETAILS TABLES ---
  const inopData = vehicleUnits
    .filter(u => inoperativeStatuses.includes((u.status || '').toUpperCase()))
    .map(u => [u.id, u.plate || '', u.reason || u.status]);

  while (inopData.length < 15) inopData.push(['', '', '']);

  const sinPatrullarData = vehicleUnits
    .filter(u =>
      u.status !== 'PATRULLANDO' &&
      u.status !== 'RETEN' &&
      !inoperativeStatuses.includes((u.status || '').toUpperCase()) &&
      u.status !== 'CHOFER SIN MOVIL'
    )
    .map(u => [u.id, u.plate || '', u.reason || u.status]);

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
  doc.text(`OPERADOR CCO: ${firstSectorSettings.operador || '--'}`, pageWidth - margin, footerY + 3, { align: 'right' });

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
  shift: string
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
      .replace(/\s+/g, ' '); // Normalize spaces
  };

  // 1. Identify present vs explicitly absent personnel names
  const presentNames = new Set<string>();
  const explicitAbsentInUnits = new Set<string>();
  const nameToSector = new Map<string, string>();

  const absenceStatuses = [
    'FALTO',
    'DESCANSO MEDICO',
    'DESCANSO MÉDICO'
  ];

  units.forEach(u => {
    const names = [];
    if (u.personnel1) names.push(normalize(u.personnel1));
    if (u.personnel2) names.push(normalize(u.personnel2));

    // Store assigned sector for each person found in units
    const sector = (u.sector || '').toString().trim().toUpperCase().replace(/^SECTOR\s+/, '');
    names.forEach(name => nameToSector.set(name, sector));

    // Check status robustly
    const status = (u.status || '').toString().trim().toUpperCase();

    if (absenceStatuses.includes(status)) {
      names.forEach(name => explicitAbsentInUnits.add(name));
    } else {
      names.forEach(name => presentNames.add(name));
    }
  });

  // 2. Filter personnel for "ABSENT"
  const absents = personnel.filter(p => {
    const name = normalize(p.apellidos_nombres);

    // Check spreadsheet status robustly
    const statusSS = (p.estado || '').toString().trim().toUpperCase();
    const isExplicitFaltoSS = absenceStatuses.includes(statusSS);
    const isExplicitFaltoUnit = explicitAbsentInUnits.has(name);

    // Avoid including people who are actually marked as present in another unit row
    if (presentNames.has(name)) return false;

    return isExplicitFaltoSS || isExplicitFaltoUnit;
  });

  // 3. Group by regime
  const getRegime = (p: any) => {
    const reg = (p.regimen_laboral || '').toString().toUpperCase();
    if (/276/.test(reg)) return '276';
    if (/728/.test(reg)) return '728';
    if (/1057|CAS|CONTRATO/i.test(reg)) return 'CAS';
    // Todo lo demás se considera Orden de Servicio (OS)
    return 'OS';
  };

  const groupsToDraw = [
    { data: absents.filter(p => getRegime(p) === '276'), label: 'PLANILLA D.L. 276', color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === '728'), label: 'PLANILLA D.L. 728', color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === 'CAS'), label: 'D.L. 1057 (CAS)', color: [0, 92, 187] },
    { data: absents.filter(p => getRegime(p) === 'OS'), label: 'ORDEN DE SERVICIO', color: [0, 92, 187] }
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
        shift.charAt(0), // M, T, N
        nameToSector.get(nameNorm) || '--'
      ];
    });

    (doc as any).autoTable({
      startY: currentY,
      head: [['APELLIDOS Y NOMBRES', 'ROL / CARGO', 'T', 'SECTOR / GRUPO']],
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
        1: { cellWidth: 45, halign: 'center' },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        currentY = data.cursor.y;
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 8;
  });

  doc.save(`REPORTE_ASISTENCIA_REGIMEN_${shift}_${date}.pdf`);
};

