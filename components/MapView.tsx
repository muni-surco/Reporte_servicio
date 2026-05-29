import React, { useEffect, useRef, useState } from 'react';

const MapView: React.FC = () => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lReady, setLReady] = useState(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

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
              console.error('MAP_DEBUG: Empty response from GAS');
              return;
            }
            const data = JSON.parse(dataStr);
            console.log('MAP_DEBUG: Features count:', data?.features?.length);
            
            // Log coordinates of first feature to check for inversion
            if (data.features && data.features.length > 0) {
              const firstCoords = data.features[0].geometry?.coordinates[0][0];
              console.log('MAP_DEBUG: First point coords (Lng, Lat):', firstCoords);
            }

            setGeoJsonData(data);
          } catch (e) {
            console.error('MAP_DEBUG: Parse error:', e);
          } finally {
            setLoadingData(false);
          }
        })
        .withFailureHandler((err: any) => {
          console.error('MAP_DEBUG: GAS Error:', err);
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

      if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
        console.log('MAP_DEBUG: Drawing with RED SOLID STYLE');
        const geoLayer = L.geoJson(geoJsonData, {
          style: {
            color: '#ff0000', // Rojo fuerte para verlos sí o sí
            weight: 3,
            fillColor: '#ff0000',
            fillOpacity: 0.5
          },
          onEachFeature: (feature: any, layer: any) => {
            const name = feature.properties?.name || 'S/N';
            layer.bindPopup('CUADRANTE: ' + name);
          }
        }).addTo(map);

        try {
          const bounds = geoLayer.getBounds();
          if (bounds.isValid()) {
            console.log('MAP_DEBUG: Zooming to bounds:', bounds.toBBoxString());
            map.fitBounds(bounds);
          }
        } catch (e) {
          console.warn('MAP_DEBUG: FitBounds failed');
        }
      }

      setTimeout(() => map.invalidateSize(), 500);
    } catch (e) {
      console.error('MAP_DEBUG: Init error:', e);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lReady, geoJsonData]);

  return (
    <div className="h-full w-full flex flex-col bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200">
      <div className="p-4 bg-[#002d5a] text-white flex justify-between items-center">
        <div>
          <h2 className="font-bold uppercase text-lg leading-none">Depuración de Mapa</h2>
          <p className="text-[10px] text-blue-200 mt-1 uppercase tracking-widest">Aislando problema de polígonos</p>
        </div>
        {(loadingData || !lReady) && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px]">VERIFICANDO...</span>
          </div>
        )}
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
