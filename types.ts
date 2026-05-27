
export enum UnitStatus {
  PATRULLANDO = 'PATRULLANDO',
  FALTO = 'FALTO',
  APOYO_OTRA_AREA = 'APOYO OTRA AREA',
  MANTENIMIENTO = 'MANTENIMIENTO',
  DESPERFECTOS = 'DESPERFECTOS',
  SINIESTRO = 'SINIESTRO',
  SIN_CONDUCTOR = 'SIN CONDUCTOR',
  SIN_DOCUMENTOS = 'SIN DOCUMENTOS',
  SIN_VEHICULO = 'SIN VEHICULO',
  FIN_APOYO = 'FIN APOYO'
}

export type Sector =
  | 'SECTOR 1A' | 'SECTOR 1B'
  | 'SECTOR 2A' | 'SECTOR 2B'
  | 'SECTOR 3' | 'SECTOR 4'
  | 'SECTOR 5' | 'SECTOR 6'
  | 'SECTOR 7' | 'SECTOR 8'
  | 'SECTOR 9A' | 'SECTOR 9B'
  | 'RESCATE'
  | 'GIR'
  | string;

export type ViewMode = 'DASHBOARD' | 'VISUALIZATION' | 'PERSONNEL' | 'STATISTICS' | 'REPORTS' | 'RETEN' | 'VEHICLE_SEARCH';

export interface VehicleRQ {
  sade: string;
  fecha: string;
  tipo: string;
  marca: string;
  modelo: string;
  color: string;
  placa: string;
  estado: string;
  relato: string;
  tipoDelito: string;
  subtipoDelito: string;
  sector: string;
  cuadrante: string;
}

export interface PersonnelData {
  n: string;
  dni: string;
  apellidos_nombres: string;
  regimen_laboral: string;
  codigo_interno: string;
  sector_id: string;
  rol_operativo: string;
  estado: string;
  correo: string;
  telefono: string;
  rol_sistema: string;
  persona_id: string;
  pin_operativo: string;
  fecha_alta: string;
  fecha_baja: string;
  foto_url: string;
}

export interface UnitData {
  id: string;
  unit_id?: string;
  tempId?: string;
  sector?: Sector;
  type: 'CHOFER' | 'MOTO' | 'SERENO';
  model?: string;
  personnel1: string;
  personnel2?: string;
  plate: string;
  indicative: string;
  radio: string;
  status: UnitStatus;
  reason: string;
  km: string;
  kmStart: string;
  kmEnd: string;
  totalKm: string;
  kmRecarga: string;
  hours: string;
  fuel: string;
  expense: string;
  quadrant: string;
  mechanics: string;
  lugarEstado?: string;
  motivoEstado?: string;
}

export interface AppSettings {
  nombrePuesto: string;
  operador: string;
  supervisor: string;
  permanencia: string;
  turno: string;
  ipServidor: string;
  version: string;
}

export interface AppData {
  units: UnitData[];
  settings: AppSettings;
}

export interface MobileReference {
  id: string;
  plate: string;
  model?: string;
  radio?: string;
  quadrant?: string;
  sector?: string;
  status?: string;
}

// Configuration Constants
export const SECTORS: Sector[] = [
  'SECTOR 1A', 'SECTOR 1B',
  'SECTOR 2A', 'SECTOR 2B',
  'SECTOR 3', 'SECTOR 4',
  'SECTOR 5', 'SECTOR 6',
  'SECTOR 7', 'SECTOR 8',
  'SECTOR 9A', 'SECTOR 9B',
  'RESCATE',
  'GIR'
];

export const FUEL_TYPES = ['GLP', 'GASOLINA', 'PETROLEO'];
export const RADIOS: string[] = [];
export const PERSONNEL_NAMES: string[] = [];
export const INITIAL_UNITS: UnitData[] = [];
export const SECTOR_DATA: Record<Sector, UnitData[]> = {} as any;
