import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UnitData, AppSettings } from '@/types';

interface MapViewProps {
  allSectorsData: Record<string, { units: UnitData[]; settings: AppSettings }>;
  settings: AppSettings;
}

interface QuadrantDetail {
  total: number;
  choferes: number;
  motos: number;
  serenos: number;
  units: { id: string; personnel1: string; type: string; plate: string }[];
}

function normalizeQuadrant(val: string): string {
  return val.trim().toUpperCase();
}

function parseQuadrants(val: string): string[] {
  if (!val || !val.trim()) return [];
  return val.split(',').map(v => normalizeQuadrant(v)).filter(Boolean);
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

function buildPopupContent(quadrantName: string, detail: QuadrantDetail | undefined): string {
  if (!detail || detail.total === 0) {
    return `
      <div style="font-family:Arial,sans-serif;min-width:160px">
        <div style="font-weight:700;font-size:14px;color:#002d5a;border-bottom:2px solid #002d5a;padding-bottom:4px;margin-bottom:6px">
          🗺 CUADRANTE ${quadrantName}
        </div>
        <div style="color:#999;font-size:12px">✘ Sin unidades asignadas</div>
      </div>`;
  }

  const rows = detail.units.map(u => {
    const icon = TYPE_ICONS[u.type] || 'radio';
    const label = u.personnel1 || u.id || '--';
    const plate = u.plate ? ` | ${u.plate}` : '';
    return `<tr><td style="padding:1px 4px;font-size:11px"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">${icon}</span></td><td style="padding:1px 4px;font-size:11px">${label}${plate}</td></tr>`;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;min-width:200px">
      <div style="font-weight:700;font-size:14px;color:#002d5a;border-bottom:2px solid #002d5a;padding-bottom:4px;margin-bottom:6px">
        🗺 CUADRANTE ${quadrantName}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:6px">
        <span style="font-size:11px"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">directions_car</span> ${detail.choferes}</span>
        <span style="font-size:11px"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">motorcycle</span> ${detail.motos}</span>
        <span style="font-size:11px"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">hail</span> ${detail.serenos}</span>
        <span style="font-size:11px;font-weight:700">Total: ${detail.total}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
    </div>`;
}

const MapView: React.FC<MapViewProps> = ({ allSectorsData, settings }) => {
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lReady, setLReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  const quadrantDetailMap = useMemo(() => {
    const map = new Map<string, QuadrantDetail>();

    Object.values(allSectorsData).forEach(sd => {
      sd.units.forEach(u => {
        const quadrants = parseQuadrants(u.quadrant || '');
        if (quadrants.length === 0) return;

        const entry: { id: string; personnel1: string; type: string; plate: string } = {
          id: u.id || '',
          personnel1: u.personnel1 || '',
          type: u.type,
          plate: u.plate || '',
        };

        quadrants.forEach(q => {
          if (!map.has(q)) {
            map.set(q, { total: 0, choferes: 0, motos: 0, serenos: 0, units: [] });
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
  }, [allSectorsData]);

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
      const map = L.map(containerRef.current).setView([-12.128, -76.995], 13);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      setTimeout(() => map.invalidateSize(), 500);
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
    if (!map || !geoJsonData) return;

    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current);
      geoLayerRef.current = null;
    }

    if (geoJsonData.features && geoJsonData.features.length > 0) {
      const L = (window as any).L;
      const geoLayer = L.geoJson(geoJsonData, {
        style: (feature: any) => {
          const name = feature?.properties?.name || '';
          return getQuadrantStyle(name);
        },
        onEachFeature: (feature: any, layer: any) => {
          const name = normalizeQuadrant(feature.properties?.name || '');
          const detail = quadrantDetailMap.get(name);
          layer.bindPopup(buildPopupContent(name, detail));
          layer.on('mouseover', () => layer.setStyle({ weight: 4, fillOpacity: 0.7 }));
          layer.on('mouseout', () => {
            const hasUnits = detail && detail.total > 0;
            layer.setStyle({
              color: hasUnits ? '#00c9a7' : '#ff0000',
              weight: 3,
              fillColor: hasUnits ? '#00c9a7' : '#ff0000',
              fillOpacity: 0.5
            });
          });
        }
      }).addTo(map);
      geoLayerRef.current = geoLayer;

      try {
        const bounds = geoLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds);
        }
      } catch (e) {
        console.warn('MAP: FitBounds failed');
      }
    }
  }, [geoJsonData, quadrantDetailMap]);

  const totalQuadrants = geoJsonData?.features?.length || 0;
  const occupiedCount = geoJsonData?.features
    ? geoJsonData.features.filter((f: any) => {
        const d = quadrantDetailMap.get(normalizeQuadrant(f.properties?.name || ''));
        return d && d.total > 0;
      }).length
    : 0;

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
      <div className="p-4 bg-[#002d5a] text-white flex justify-between items-center">
        <div>
          <h2 className="font-bold uppercase text-lg leading-none">Mapa de Cuadrantes</h2>
          <p className="text-[10px] text-blue-200 mt-1 uppercase tracking-widest">
            {settings.nombrePuesto} — {settings.turno}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          {totalQuadrants > 0 && (
            <>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-green-500"></span>
                {occupiedCount} con unidades
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-red-500"></span>
                {totalQuadrants - occupiedCount} sin unidades
              </span>
            </>
          )}
          {(loadingData || !lReady) && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>CARGANDO...</span>
            </div>
          )}
        </div>
      </div>
      
      <div 
        ref={containerRef} 
        style={{ height: '750px', width: '100%', background: '#f8fafc' }}
        className="z-0"
      ></div>
    </div>
  );
};

export default MapView;
