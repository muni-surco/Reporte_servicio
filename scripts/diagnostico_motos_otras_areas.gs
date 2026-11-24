/**
 * Diagnóstico puntual del reporte Yamaha - sector OTRAS AREAS.
 *
 * Uso:
 *   1. Pegar este archivo como uno nuevo en el editor de Google Apps Script.
 *   2. Ejecutar diagnosticoMotosOtrasAreas('2026-11-23', 'MAÑANA').
 *   3. Revisar la salida en la consola / transcripción de ejecución.
 *
 * Muestra cuántas motos de DATA suma el reporte, cuántas se contabilizaron
 * y, para cada diferencia, si no fue registrada o quedó en otro sector/estado.
 */
function diagnosticoMotosOtrasAreas(dateStr, shift) {
  const norm = function (v) { return String(v == null ? '' : v).trim().toUpperCase(); };
  const nmodel = function (v) { return norm(v).replace(/[\s.\-_]+/g, ''); };
  const keys = ['YAMAHAXTZ150'];
  const allowed = [
    'OTRAS AREAS', 'FISCA', 'FISCALIZACION', 'FISCALIZACIÓN',
    'ADM', 'ADMINISTRACION', 'ADMINISTRACIÓN',
    'TRANSITO', 'TRÁNSITO', 'TRANSPORTE'
  ];
  const inSector = function (v) { return allowed.indexOf(norm(v)) !== -1; };
  const isFleet = function (m) {
    const mdl = nmodel(m && m.model);
    return !!mdl && keys.some(function (k) { return mdl.indexOf(k) !== -1 || k.indexOf(mdl) !== -1; });
  };
  const isFinApoyo = function (s) {
    const x = norm(s);
    return x.indexOf('FIN') !== -1 && x.indexOf('APOYO') !== -1;
  };

  const mobiles = (getMobileData().mobiles || []);
  const dataRows = mobiles.filter(function (m) { return isFleet(m) && inSector(m.sector); });
  const dataSectorById = {};
  mobiles.forEach(function (m) {
    const id = norm(m.id);
    if (id && m.sector) dataSectorById[id] = norm(m.sector);
  });

  const units = (getShiftData(dateStr, shift, 'OTRAS AREAS').units || []);
  const getSector = function (u) { return norm(u.sector) || dataSectorById[norm(u.id)] || ''; };

  // Mismo criterio de deduplicación del reporte: una copia por unidad,
  // priorizando la que coincide con el sector de DATA.
  const best = {};
  units.forEach(function (u) {
    const id = norm(u.id);
    const key = id ? 'ID|' + id + '|' + norm(u.type)
      : (norm(u.plate) ? 'PLATE|' + norm(u.plate) + '|' + norm(u.type)
        : ('UID|' + String(u.unit_id || '')));
    const cur = best[key];
    if (!cur) { best[key] = u; return; }
    const ds = dataSectorById[id];
    if (!ds) return;
    if (norm(u.sector) === ds && norm(cur.sector) !== ds) best[key] = u;
  });

  const motoUnits = Object.keys(best).map(function (k) { return best[k]; }).filter(function (u) {
    if (norm(u.type) !== 'MOTO') return false;
    const mdl = nmodel(u.model);
    if (!mdl || !keys.some(function (k) { return mdl.indexOf(k) !== -1 || k.indexOf(mdl) !== -1; })) return false;
    if (isFinApoyo(u.status)) return true;
    return !(norm(u.status).indexOf('APOYO') !== -1 && norm(u.id) === '');
  });

  const counted = motoUnits.filter(function (u) { return inSector(getSector(u)); });
  const countedIds = {};
  counted.forEach(function (u) { countedIds[norm(u.id)] = true; });
  const missing = dataRows.filter(function (m) { return !countedIds[norm(m.id)]; });

  const lines = [];
  lines.push('Turno: ' + dateStr + ' ' + shift + ' | Reporte Yamaha | OTRAS AREAS');
  lines.push('EFECTIVO (filas DATA Yamaha en OTRAS AREAS) = ' + dataRows.length);
  lines.push('CONTADOS (registros del turno) = ' + counted.length);
  lines.push('DIFERENCIA = ' + (dataRows.length - counted.length));
  lines.push('');
  lines.push('--- Motos de DATA NO contabilizadas ---');
  if (!missing.length) {
    lines.push('(ninguna)');
  } else {
    missing.forEach(function (m) {
      const regs = motoUnits.filter(function (u) { return norm(u.id) === norm(m.id); });
      const detalle = regs.length
        ? regs.map(function (u) {
            return getSector(u) + ' / estado=' + (norm(u.status) || 'VACIO') +
              ' / modelo=' + (norm(u.model) || 'VACIO') + ' / tipo=' + (norm(u.type) || 'VACIO');
          }).join(' ; ')
        : 'NO REGISTRADA EN EL TURNO';
      lines.push('- ' + (m.id || '(sin ID)') + ' | DATA sector=' + (m.sector || 'VACIO') +
        ' | DATA modelo=' + (m.model || 'VACIO') + ' | ' + detalle);
    });
  }
  lines.push('');
  lines.push('--- Registros del turno dentro de OTRAS AREAS ---');
  counted.forEach(function (u) {
    lines.push('- ' + (u.id || '(sin ID)') + ' | sector=' + getSector(u) + ' | estado=' + (norm(u.status) || 'VACIO'));
  });

  const out = lines.join('\n');
  console.log(out);
  return out;
}

/**
 * Lista TODOS los registros guardados para una fecha/turno, agrupados por
 * tipo y sector. Sirve para detectar si las motos se guardaron con otro tipo,
 * en otro sector o si simplemente no se registró nada en ese turno.
 */
function diagnosticoTurnoResumen(dateStr, shift) {
  const norm = function (v) { return String(v == null ? '' : v).trim().toUpperCase(); };
  const data = getShiftData(dateStr, shift, 'OTRAS AREAS');
  const units = data.units || [];
  const groups = {};
  units.forEach(function (u) {
    const key = (norm(u.type) || '(SIN TIPO)') + ' | ' + (norm(u.sector) || '(SIN SECTOR)');
    if (!groups[key]) groups[key] = [];
    groups[key].push((u.id || '(sin ID)') + ' / ' + (norm(u.status) || 'sin estado'));
  });
  const lines = [];
  lines.push('Turno: ' + dateStr + ' ' + shift + ' | registros totales = ' + units.length);
  Object.keys(groups).sort().forEach(function (key) {
    lines.push('[' + key + '] ' + groups[key].length + ': ' + groups[key].join(', '));
  });
  if (!units.length) lines.push('NO HAY REGISTROS guardados para esta fecha/turno.');
  const out = lines.join('\n');
  console.log(out);
  return out;
}
