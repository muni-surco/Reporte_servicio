
export enum UnitStatus {
  PATRULLANDO = 'PATRULLANDO',
  FALTO = 'FALTO',
  APOYO_OTRA_AREA = 'APOYO',
  MANTENIMIENTO = 'MANTENIMIENTO',
  DESPERFECTOS = 'DESPERFECTOS',
  SINIESTRO = 'SINIESTRO',
  SIN_CONDUCTOR = 'SIN CONDUCTOR',
  SIN_DOCUMENTOS = 'SIN DOCUMENTOS',
  SIN_VEHICULO = 'SIN VEHICULO',
  FIN_APOYO = 'FIN APOYO'
}

export type Sector =
  | '1A' | '1B'
  | '2A' | '2B'
  | '3' | '4'
  | '5' | '6'
  | '7' | '8'
  | '9A' | '9B'
  | 'RESCATE'
  | 'GIR'
  | 'C4'
  | 'COVV'
  | string;

export type ViewMode = 'DASHBOARD' | 'VISUALIZATION' | 'PERSONNEL' | 'STATISTICS' | 'REPORTS' | 'RETEN' | 'VEHICLE_SEARCH' | 'MAP' | 'WANTED';

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
  taser: string;
  bodycam: string;
  codigoBodycam: string;
  obsBodycam: string;
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

export interface WantedPerson {
  buscado_por: string;
  edad: string;
  nombre: string;
  dnice: string;
  sexo: string;
  fecha_hecho: string;
  hora_hecho: string;
  lugar_intervencion: string;
  habilitacion_urbana: string;
  nacionalidad: string;
  recompensa: string;
  fuente: string;
  estado: string;
  sade: string;
  dependencia_policial: string;
  caracteristicas: string;
  vestimenta: string;
  circunstancias: string;
  cumple_analitica: string;
  video: string;
  caso: string;
  reincidente: string;
  photoFileId?: string;
  photoUrl?: string;
}

// Configuration Constants
export const SECTORS: Sector[] = [
  '1A', '1B',
  '2A', '2B',
  '3', '4',
  '5', '6',
  '7', '8',
  '9A', '9B',
  'RESCATE',
  'GIR',
  'C4',
  'COVV'
];

export const FUEL_TYPES = ['GLP', 'GASOLINA', 'PETROLEO'];
export const RADIOS: string[] = [];
export const PERSONNEL_NAMES: string[] = [];
export const INITIAL_UNITS: UnitData[] = [];
export const SECTOR_DATA: Record<Sector, UnitData[]> = {} as any;
