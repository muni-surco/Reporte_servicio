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
    didParseCell: function(data: any) {
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
