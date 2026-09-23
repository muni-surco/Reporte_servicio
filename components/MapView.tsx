import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UnitData, AppSettings, UnitStatus } from '@/types';

interface MapViewProps {
  allSectorsData: Record<string, { units: UnitData[]; settings: AppSettings }>;
  settings: AppSettings;
}

interface QuadrantDetail {
  total: number;
  choferes: number;
  motos: number;
  serenos: number;
  units: { id: string; personnel1: string; type: string; plate: string; radio: string; indicative: string; taser: string }[];
  sectorName: string;
}

function normalizeQuadrant(val: string): string {
  return val.trim().toUpperCase();
}

function parseQuadrants(val: string): string[] {
  if (!val || !val.trim()) return [];
  return val.split(',').map(v => normalizeQuadrant(v)).filter(Boolean);
}

function getFillOpacity(total: number | undefined): number {
  if (!total || total === 0) return 0.2;
  return Math.min(0.85, 0.2 + (total * 0.15));
}

const TYPE_ICONS: Record<string, string> = {
  CHOFER: 'directions_car',
  MOTO: 'motorcycle',
  SERENO: 'hail',
};

const TYPE_LABELS: Record<string, string> = {
  CHOFER: 'CHOFER',
  MOTO: 'MOTO',
  SERENO: 'SERENO',
};

function extractSectorFromDescription(desc: any): string | null {
  if (!desc) return null;
  const descStr = typeof desc === 'string' ? desc : (desc.value || '');
  if (typeof descStr !== 'string') return null;
  const match = descStr.match(/SECTOR<\/td>\s*<td>([^<]+)<\/td>/);
  return match ? match[1].trim().toUpperCase() : null;
}

function buildPopupContent(quadrantName: string, detail: QuadrantDetail | undefined): string {
  if (!detail || detail.total === 0) {
    return `
      <div class="min-w-[240px] font-sans pb-1">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-[16px] font-bold text-slate-900 tracking-tight">Cuadrante ${quadrantName}</h3>
          ${detail && detail.sectorName ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Sector ${detail.sectorName}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-slate-200 flex shrink-0 items-center justify-center text-slate-500 font-bold text-lg">
            0
          </div>
          <div>
            <div class="font-bold text-slate-700 text-[14px] leading-tight">Sin asignación</div>
            <div class="text-slate-500 text-[12px] mt-0.5">Sin personal activo</div>
          </div>
        </div>
        <div class="text-slate-500 text-[13px] flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px]">info</span>
          No hay unidades en este cuadrante
        </div>
      </div>`;
  }

  var typeOrder = { CHOFER: 0, MOTO: 1, SERENO: 2 };
  var sortedUnits = detail.units.slice().sort(function(a, b) {
    return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
  });
  const unitsListHtml = sortedUnits.map(u => {
    const icon = TYPE_ICONS[u.type] || 'radio';
    const label = u.personnel1 || u.id || 'Desconocido';
    const colorClass = u.type === 'CHOFER' ? 'text-blue-500' :
                       u.type === 'MOTO' ? 'text-violet-500' :
                       u.type === 'SERENO' ? 'text-teal-500' : 'text-slate-400';
    const idBadge = u.id ? `<span class="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.25 rounded leading-none mr-1.5">${u.id}</span>` : '';
    const radioText = u.radio ? `<span class="text-slate-400 text-[11px] leading-none">Radio ${u.radio}</span>` : '';
    const indicativeText = u.indicative ? `<span class="bg-green-100 text-green-700 border border-green-300 text-[10px] font-bold px-1.5 py-0.25 rounded leading-none">${u.indicative}</span>` : '';
    const taserBadge = u.taser === 'SI' ? `<span class="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.25 rounded leading-none uppercase ml-1">taser</span>` : '';

    return `
      <div class="flex items-start gap-2.5 mb-2.5">
        <span class="material-symbols-outlined ${colorClass} text-[16px] mt-0.5">${icon}</span>
        <div class="flex flex-col">
          <span class="text-slate-500 text-[13px] font-medium leading-snug">${label}${taserBadge}</span>
          <div class="flex items-center gap-1 mt-0.5"><span>${idBadge}</span><span>${indicativeText}</span><span>${radioText}</span></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="min-w-[260px] font-sans pb-1">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[16px] font-bold text-slate-900 tracking-tight">Cuadrante ${quadrantName}</h3>
        ${detail.sectorName ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Sector ${detail.sectorName}</span>` : ''}
      </div>
      
      <div class="flex items-center gap-3 mb-5">
        <div class="w-10 h-10 rounded-full bg-[#00c9a7] flex shrink-0 items-center justify-center text-white font-bold text-lg shadow-sm">
          ${detail.total}
        </div>
        <div>
          <div class="font-bold text-slate-700 text-[14px] leading-tight">Unidades Activas</div>
          <div class="text-slate-500 text-[12px] mt-0.5">
             ${detail.choferes} Autos - ${detail.motos} Motos - ${detail.serenos} Serenos
          </div>
        </div>
      </div>

      <div class="pr-1">
        ${unitsListHtml}
      </div>
    </div>
  `;
}

const MapView: React.FC<MapViewProps> = ({ allSectorsData, settings }) => {
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lReady, setLReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  const [showChoferes, setShowChoferes] = useState(true);
  const [showMotos, setShowMotos] = useState(true);
  const [showSerenos, setShowSerenos] = useState(true);
  const [showTaserOnly, setShowTaserOnly] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [quadrantSearchQuery, setQuadrantSearchQuery] = useState('');
  const [showQuadrantResults, setShowQuadrantResults] = useState(false);
  const [mapDark, setMapDark] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string[]>([]);
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const sectorDropdownRef = useRef<HTMLDivElement>(null);
  const lightLayerRef = useRef<any>(null);
  const darkLayerRef = useRef<any>(null);
  const quadrantLayersRef = useRef<Map<string, any>>(new Map());

  const allQuadrantNames = useMemo(() => {
    if (!geoJsonData?.features) return [];
    const names = new Set<string>();
    geoJsonData.features.forEach((f: any) => {
      const n = f.properties?.name;
      if (n) names.add(normalizeQuadrant(n));
    });
    return Array.from(names).sort();
  }, [geoJsonData]);

  const sectorQuadrants = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!geoJsonData?.features) return map;
    geoJsonData.features.forEach((f: any) => {
      const qName = normalizeQuadrant(f.properties?.name || '');
      if (!qName) return;
      const sector = extractSectorFromDescription(f.properties?.description || '');
      if (!sector) return;
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector)!.push(qName);
    });
    return map;
  }, [geoJsonData]);

  const availableSectors = useMemo(() => {
    return Array.from(sectorQuadrants.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [sectorQuadrants]);

  const filteredGeoJsonData = useMemo(() => {
    if (!geoJsonData?.features) return geoJsonData;
    if (sectorFilter.length === 0) return geoJsonData;
    const selectedSet = new Set(sectorFilter);
    const filtered = geoJsonData.features.filter((f: any) => {
      const sector = extractSectorFromDescription(f.properties?.description || '');
      return selectedSet.has(sector);
    });
    return { ...geoJsonData, features: filtered };
  }, [geoJsonData, sectorFilter]);

  const quadrantDetailMap = useMemo(() => {
    const map = new Map<string, QuadrantDetail>();

    Object.entries(allSectorsData).forEach(([sectorName, sd]) => {
      // Excluir sectores técnicos/administrativos que no patrullan cuadrantes
      if (sectorName === 'C4' || sectorName === 'COVV') return;

      sd.units.forEach(u => {
        if (u.type === 'CHOFER' && !showChoferes) return;
        if (u.type === 'MOTO' && !showMotos) return;
        if (u.type === 'SERENO' && !showSerenos) return;

        const quadrants = parseQuadrants(u.quadrant || '');
        if (quadrants.length === 0) return;

        // TT (Todas) = cubre todos los cuadrantes del sector
        const isTT = quadrants.some(q => q === 'TT');
        const expandedQuadrants = isTT
          ? (sectorQuadrants.get(sectorName.toUpperCase()) || [])
          : quadrants;

        if (expandedQuadrants.length === 0) return;

        const isActive = u.status === UnitStatus.PATRULLANDO || u.status === UnitStatus.SIN_VEHICULO || u.status === UnitStatus.SIN_OPERADOR;
        if (!isActive) return;

        if (showTaserOnly && u.taser !== 'SI') return;

        const entry = {
          id: u.id || '',
          personnel1: u.personnel1 || '',
          type: u.type,
          plate: u.plate || '',
          radio: u.radio || '',
          indicative: u.indicative || '',
          taser: u.taser || ''
        };

        expandedQuadrants.forEach(q => {
          if (!map.has(q)) {
            map.set(q, { total: 0, choferes: 0, motos: 0, serenos: 0, units: [], sectorName });
          }
          const d = map.get(q)!;
          d.total++;
          if (u.type === 'CHOFER') d.choferes++;
          else if (u.type === 'MOTO') d.motos++;
          else if (u.type === 'SERENO') d.serenos++;
          d.units.push(entry);
        });
      });
    });

    return map;
  }, [allSectorsData, showChoferes, showMotos, showSerenos, showTaserOnly, sectorQuadrants]);

  const quadrantDetailMapRef = useRef(quadrantDetailMap);
  useEffect(() => {
    quadrantDetailMapRef.current = quadrantDetailMap;
  }, [quadrantDetailMap]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    const results: UnitData[] = [];
    
    Object.entries(allSectorsData).forEach(([sectorName, sd]) => {
      // Excluir sectores técnicos del buscador del mapa
      if (sectorName === 'C4' || sectorName === 'COVV') return;
      if (sectorFilter.length > 0 && !sectorFilter.includes(sectorName.toUpperCase())) return;

      sd.units.forEach(u => {
        const quadrants = parseQuadrants(u.quadrant || '');
        if (quadrants.length === 0) return;
        
        const matchId = u.id?.toLowerCase().includes(query);
        const matchRadio = u.radio?.toLowerCase().includes(query);
        const matchName = u.personnel1?.toLowerCase().includes(query);
        
        if (matchId || matchRadio || matchName) {
           results.push(u);
        }
      });
    });
    return results.slice(0, 8); // top 8 matches
  }, [allSectorsData, searchQuery, sectorFilter]);

  const filteredQuadrants = useMemo(() => {
    if (!quadrantSearchQuery.trim()) {
      if (sectorFilter.length === 0) return [];
      // Sin query pero con sectores filtrados: mostrar todos los cuadrantes de esos sectores
      const allQs = new Set<string>();
      sectorFilter.forEach(s => {
        (sectorQuadrants.get(s) || []).forEach(q => allQs.add(q));
      });
      return Array.from(allQs).sort();
    }
    const query = quadrantSearchQuery.toLowerCase().trim();
    let candidates = allQuadrantNames;
    if (sectorFilter.length > 0) {
      const sectorQs = new Set<string>();
      sectorFilter.forEach(s => {
        (sectorQuadrants.get(s) || []).forEach(q => sectorQs.add(q));
      });
      candidates = candidates.filter(n => sectorQs.has(n));
    }
    return candidates.filter(n => n.includes(query));
  }, [allQuadrantNames, quadrantSearchQuery, sectorFilter, sectorQuadrants]);

  const handleSelectSearchResult = (u: UnitData) => {
    setSearchQuery('');
    setShowSearchResults(false);
    
    const quadrants = parseQuadrants(u.quadrant || '');
    if (quadrants.length === 0) return;
    
    const qName = quadrants[0];
    const layer = quadrantLayersRef.current.get(qName);
    if (layer && mapRef.current) {
      mapRef.current.flyToBounds(layer.getBounds(), { maxZoom: 16, duration: 1.5 });
      setTimeout(() => {
        layer.openPopup();
      }, 800);
    }
  };

  const handleSelectQuadrant = (name: string) => {
    setQuadrantSearchQuery('');
    setShowQuadrantResults(false);
    const layer = quadrantLayersRef.current.get(name);
    if (layer && mapRef.current) {
      mapRef.current.flyToBounds(layer.getBounds(), { maxZoom: 16, duration: 1.5 });
      setTimeout(() => {
        layer.openPopup();
      }, 800);
    }
  };

  const getQuadrantStyle = (quadrantName: string) => {
    const name = normalizeQuadrant(quadrantName);
    const hasUnits = quadrantDetailMap.has(name) && quadrantDetailMap.get(name)!.total > 0;
    return {
      color: hasUnits ? '#00c9a7' : '#ff0000',
      weight: 3,
      fillColor: hasUnits ? '#00c9a7' : '#ff0000',
      fillOpacity: 0.5
    };
  };

  useEffect(() => {
    const checkL = setInterval(() => {
      if ((window as any).L) {
        setLReady(true);
        clearInterval(checkL);
      }
    }, 200);
    return () => clearInterval(checkL);
  }, []);

  useEffect(() => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      setLoadingData(true);
      google.script.run
        .withSuccessHandler((dataStr: string) => {
          try {
            if (!dataStr) {
              console.error('MAP: Empty response from GAS');
              return;
            }
            const data = JSON.parse(dataStr);
            setGeoJsonData(data);
          } catch (e) {
            console.error('MAP: Parse error:', e);
          } finally {
            setLoadingData(false);
          }
        })
        .withFailureHandler((err: any) => {
          console.error('MAP: GAS Error:', err);
          setLoadingData(false);
        })
        .getQuadrantsData();
    }
  }, []);

  useEffect(() => {
    if (!lReady || !containerRef.current || mapRef.current) return;

    try {
      const L = (window as any).L;
      const map = L.map(containerRef.current).setView([-12.128, -76.995], 14);
      mapRef.current = map;

      lightLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abc',
        maxZoom: 19,
        crossOrigin: true
      }).addTo(map);
      darkLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: 'abc',
        maxZoom: 19,
        crossOrigin: true,
        className: 'dark-tiles'
      });

      setTimeout(() => map.invalidateSize(), 500);

      // Suprimir el outline negro de focus en polígonos de Leaflet y aplicar fuente del webapp + filtro oscuro
      const styleTag = document.createElement('style');
      styleTag.textContent = '.leaflet-interactive:focus, .leaflet-interactive:focus-visible { outline: none !important; } .leaflet-popup-content-wrapper, .leaflet-popup-tip, .leaflet-popup-content { font-family: \'Chivo\', sans-serif !important; } .dark-tiles { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }';
      document.head.appendChild(styleTag);
    } catch (e) {
      console.error('MAP: Init error:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lightLayerRef.current || !darkLayerRef.current) return;
    if (mapDark) {
      map.removeLayer(lightLayerRef.current);
      map.addLayer(darkLayerRef.current);
    } else {
      map.removeLayer(darkLayerRef.current);
      map.addLayer(lightLayerRef.current);
    }
  }, [mapDark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filteredGeoJsonData) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    if (filteredGeoJsonData.features && filteredGeoJsonData.features.length > 0) {
      const L = (window as any).L;
      quadrantLayersRef.current.clear();

      const geoLayer = L.geoJson(filteredGeoJsonData, {
        style: (feature: any) => {
          const name = feature?.properties?.name || '';
          const detail = quadrantDetailMapRef.current.get(name);
          const hasUnits = detail && detail.total > 0;
          return {
            color: '#ffffff',
            weight: 2,
            fillColor: hasUnits ? '#00c9a7' : '#ff0000',
            fillOpacity: getFillOpacity(detail?.total)
          };
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = normalizeQuadrant(feature.properties?.name || '');
          quadrantLayersRef.current.set(name, layer);

          const detail = quadrantDetailMapRef.current.get(name);
          layer.bindPopup(buildPopupContent(name, detail));
          
          layer.bindTooltip(`<div class="font-bold text-slate-700 text-xs">${name} &bull; ${detail?.total || 0} unds</div>`, {
            sticky: true,
            direction: 'auto',
            opacity: 0.95
          });
          
          layer.on('mouseover', () => {
            layer.setStyle({ weight: 4, fillOpacity: 0.7 });
          });
          layer.on('mouseout', () => {
            // Usamos la referencia para no capturar datos viejos y evitar reasignar eventos
            const currentDetail = quadrantDetailMapRef.current.get(name);
            const hasUnits = currentDetail && currentDetail.total > 0;
            layer.setStyle({
              color: '#ffffff',
              weight: 2,
              fillColor: hasUnits ? '#00c9a7' : '#ff0000',
              fillOpacity: getFillOpacity(currentDetail?.total)
            });
          });
        }
      });

      const labelsLayer = L.layerGroup();
      geoLayer.eachLayer((layer: any) => {
        if (layer.getBounds && layer.feature) {
          const name = normalizeQuadrant(layer.feature.properties?.name || '');
          const center = layer.getBounds().getCenter();
          const marker = L.marker(center, {
            icon: L.divIcon({
              className: '',
              html: `<div class="bg-white/90 border-[2px] border-[#002d5a] text-[#002d5a] rounded-full w-6 h-6 flex items-center justify-center font-bold text-[9px] shadow-sm pointer-events-none">${name}</div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            }),
            interactive: false
          });
          labelsLayer.addLayer(marker);
        }
      });

      const combinedGroup = L.featureGroup([geoLayer, labelsLayer]).addTo(map);
      geoLayerRef.current = combinedGroup;
      // Ajustar vista al sector filtrado
      try { map.fitBounds(combinedGroup.getBounds(), { padding: [20, 20], maxZoom: 15 }); } catch {}
    }
  }, [filteredGeoJsonData]);

  // Efecto separado para actualizar estilos y popups sin destruir la capa
  useEffect(() => {
    if (!geoLayerRef.current || quadrantLayersRef.current.size === 0) return;
    
    quadrantLayersRef.current.forEach((layer, name) => {
      const detail = quadrantDetailMap.get(name);
      const hasUnits = detail && detail.total > 0;
      
      // Actualizar estilo
      layer.setStyle({
        color: '#ffffff',
        weight: 2,
        fillColor: hasUnits ? '#00c9a7' : '#ff0000',
        fillOpacity: getFillOpacity(detail?.total)
      });
      
      // Actualizar popup
      layer.bindPopup(buildPopupContent(name, detail));
      
      // Actualizar tooltip
      if (layer.getTooltip()) {
        layer.setTooltipContent(`<div class="font-bold text-slate-700 text-xs">${name} &bull; ${detail?.total || 0} unds</div>`);
      }
      
      // No necesitamos actualizar 'mouseout' porque ahora usa quadrantDetailMapRef
    });
  }, [quadrantDetailMap]);

  const totalQuadrants = filteredGeoJsonData?.features?.length || 0;
  const occupiedCount = filteredGeoJsonData?.features
    ? filteredGeoJsonData.features.filter((f: any) => {
        const d = quadrantDetailMap.get(normalizeQuadrant(f.properties?.name || ''));
        return d && d.total > 0;
      }).length
    : 0;

  const totalAssignedResources = useMemo(() => {
    if (!filteredGeoJsonData?.features) return 0;
    const visibleSet = new Set(filteredGeoJsonData.features.map((f: any) => normalizeQuadrant(f.properties?.name || '')));
    let sum = 0;
    quadrantDetailMap.forEach((detail, qName) => {
      if (visibleSet.has(qName)) sum += detail.total;
    });
    return sum;
  }, [filteredGeoJsonData, quadrantDetailMap]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sectorDropdownRef.current && !sectorDropdownRef.current.contains(e.target as Node)) {
        setShowSectorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const taserCount = useMemo(() => {
    const countedUnits = new Set<string>();
    Object.entries(allSectorsData).forEach(([sectorName, sd]) => {
      if (sectorName === 'C4' || sectorName === 'COVV') return;
      if (sectorFilter.length > 0 && !sectorFilter.includes(sectorName.toUpperCase())) return;
      sd.units.forEach(u => {
        if (u.type === 'CHOFER' && !showChoferes) return;
        if (u.type === 'MOTO' && !showMotos) return;
        if (u.type === 'SERENO' && !showSerenos) return;
        const quadrants = parseQuadrants(u.quadrant || '');
        if (quadrants.length === 0) return;
        const isTT = quadrants.some(q => q === 'TT');
        const expandedQuadrants = isTT
          ? (sectorQuadrants.get(sectorName.toUpperCase()) || [])
          : quadrants;
        if (expandedQuadrants.length === 0) return;
        const isActive = u.status === UnitStatus.PATRULLANDO || u.status === UnitStatus.SIN_VEHICULO || u.status === UnitStatus.SIN_OPERADOR;
        if (!isActive) return;
        if (u.taser !== 'SI') return;
        if (u.id) countedUnits.add(u.id);
      });
    });
    return countedUnits.size;
  }, [allSectorsData, showChoferes, showMotos, showSerenos, sectorQuadrants, sectorFilter]);

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
      <div className="relative z-0 flex-1" style={{ minHeight: '750px', width: '100%' }}>
        {(loadingData || !lReady) && (
          <div className="absolute inset-0 z-[2000] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-4 border-[#002d5a] border-t-transparent rounded-full animate-spin mb-4"></div>
            <span className="text-[#002d5a] font-bold tracking-wider">CARGANDO MAPA...</span>
          </div>
        )}

        {/* Filtro sector + Buscadores */}
        <div className="absolute top-4 left-14 z-[1000] flex gap-3 pointer-events-auto">
          {/* Filtro por Sector - multiselect, texto sin negrita */}
          <div className="relative w-48" ref={sectorDropdownRef}>
            <button
              onClick={() => setShowSectorDropdown(!showSectorDropdown)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-normal rounded-xl pl-9 pr-8 py-2.5 shadow-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-left truncate flex items-center"
            >
              <span className="truncate">
                {sectorFilter.length === 0 ? 'Todos los sectores' : sectorFilter.length === 1 ? `Sector ${sectorFilter[0]}` : `${sectorFilter.length} sectores`}
              </span>
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px] pointer-events-none">filter_list</span>
              <span className="material-symbols-outlined absolute right-2.5 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
            </button>
            {showSectorDropdown && (
              <div className="absolute top-full left-0 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-20 max-h-64 overflow-y-auto">
                <label className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={sectorFilter.length === 0}
                    onChange={() => setSectorFilter([])}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-normal text-slate-700">Todos</span>
                </label>
                {availableSectors.map(s => (
                  <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sectorFilter.includes(s)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSectorFilter(prev => [...prev, s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
                        } else {
                          setSectorFilter(prev => prev.filter(v => v !== s));
                        }
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-normal text-slate-700">Sector {s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Buscador Inteligente */}
          <div className="relative w-72">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 shadow-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                placeholder="Buscar unidad, apellido o radio"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
              />
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px] pointer-events-none z-10">search</span>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            
            {showSearchResults && searchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500 font-medium">No se encontraron unidades</div>
                ) : (
                  <div className="flex flex-col">
                    {searchResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleSelectSearchResult(u)}
                        className="flex items-center gap-3 w-full p-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 text-left"
                      >
                        <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-white ${u.type === 'CHOFER' ? 'bg-blue-500' : u.type === 'MOTO' ? 'bg-violet-500' : 'bg-teal-500'}`}>
                          <span className="material-symbols-outlined text-[14px]">
                            {TYPE_ICONS[u.type] || 'radio'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-800 truncate">{u.personnel1 || 'Desconocido'}</span>
                          <span className="text-[10px] text-slate-500 truncate mt-0.5 uppercase">
                            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.25 rounded leading-none mr-1.5"> {u.id} </span>- {u.radio ? 'Radio ' + u.radio + ' - ' : ''} - Cuad {u.quadrant}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Buscador de Cuadrantes */}
          <div className="relative w-60">
            <div className="relative flex items-center">
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl pl-10 pr-10 py-2.5 shadow-lg focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                placeholder="Buscar cuadrante..."
                value={quadrantSearchQuery}
                onChange={(e) => {
                  setQuadrantSearchQuery(e.target.value);
                  setShowQuadrantResults(true);
                }}
                onFocus={() => setShowQuadrantResults(true)}
              />
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px] pointer-events-none z-10">grid_on</span>
              {quadrantSearchQuery && (
                <button 
                  onClick={() => setQuadrantSearchQuery('')}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors z-10"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
            
            {showQuadrantResults && quadrantSearchQuery.trim() !== '' && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto custom-scrollbar">
                {filteredQuadrants.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-500 font-medium">No se encontraron cuadrantes</div>
                ) : (
                  <div className="flex flex-col">
                    {filteredQuadrants.map(name => (
                      <button
                        key={name}
                        onClick={() => handleSelectQuadrant(name)}
                        className="flex items-center gap-3 w-full p-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex shrink-0 items-center justify-center text-slate-500">
                          <span className="material-symbols-outlined text-[14px]">hexagon</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-800">Cuadrante {name}</span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            {quadrantDetailMap.get(name)?.total || 0} unidades activas
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-slate-200 flex flex-col gap-1.5 pointer-events-auto">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 mb-1">Capas de Unidades</h4>
            <button 
              onClick={() => setShowChoferes(!showChoferes)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showChoferes ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-100'} border`}
            >
              <span className="material-symbols-outlined text-[16px]">directions_car</span>
              Autos
            </button>
            <button 
              onClick={() => setShowMotos(!showMotos)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showMotos ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-slate-50 text-slate-400 border-slate-100'} border`}
            >
              <span className="material-symbols-outlined text-[16px]">moped</span>
              Motos
            </button>
            <button 
              onClick={() => setShowSerenos(!showSerenos)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showSerenos ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-400 border-slate-100'} border`}
            >
              <span className="material-symbols-outlined text-[16px]">hail</span>
              Serenos
            </button>
            <div className="h-px bg-slate-100 my-1"></div>
            <button 
              onClick={() => setShowTaserOnly(!showTaserOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showTaserOnly ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-100'} border`}
            >
              <span className="material-symbols-outlined text-[16px]">offline_bolt</span>
              {showTaserOnly ? `Taser: Activo (${taserCount})` : `Taser (${taserCount})`}
            </button>
            <div className="h-px bg-slate-100 my-1"></div>
            <button 
              onClick={() => setMapDark(!mapDark)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[16px]">{mapDark ? 'light_mode' : 'dark_mode'}</span>
              {mapDark ? 'Claro' : 'Oscuro'}
            </button>
          </div>
        </div>

        <div 
          ref={containerRef} 
          style={{ height: '100%', width: '100%', background: mapDark ? '#2d2d2d' : '#f8fafc' }}
          className="absolute inset-0 z-0"
        ></div>
        
        {totalQuadrants > 0 && (
          <div className="absolute bottom-6 right-6 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-xl p-4 min-w-[220px]">
            <h3 className="text-xs font-bold text-[#002d5a] uppercase tracking-wider mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">map</span>
              Cuadrantes
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-[#00c9a7] opacity-60 border-2 border-[#00c9a7]"></span>
                  <span className="font-medium text-slate-700">Con Personal</span>
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{occupiedCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-[#ff0000] opacity-60 border-2 border-[#ff0000]"></span>
                  <span className="font-medium text-slate-700">Sin Personal</span>
                </span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{totalQuadrants - occupiedCount}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-[#002d5a] flex items-center justify-center"><span className="material-symbols-outlined text-[10px] text-white">groups</span></span>
                  <span className="font-medium text-slate-700">Recursos Asignados</span>
                </span>
                <span className="font-bold text-slate-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">{totalAssignedResources}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500 uppercase tracking-wider">Total Cuadrantes</span>
                <span className="font-bold text-[#002d5a]">{totalQuadrants}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
