
export enum UnitStatus {
  APOYO_OTRA_AREA = 'APOYO A OTRA AREA',
  MAESTRANZA = 'MAESTRANZA',
  EN_PC_X_DESPERFECTOS = 'EN PC x DESPERFECTOS',
  EXPLANADA = 'EXPLANADA',
  CHOFER_SIN_MOVIL = 'CHOFER SIN MOVIL',
  OPERATIVA_SIN_DOCUMENTOS = 'OPERATIVA SIN DOCUMENTOS',
  PATRULLANDO = 'PATRULLANDO',
  OPERATIVA_SIN_CHOFER = 'OPERATIVA SIN CHOFER',
  TALLER_PARTICULAR = 'TALLER PARTICULAR'
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

export type ViewMode = 'DASHBOARD' | 'VISUALIZATION' | 'PERSONNEL' | 'STATISTICS';

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
}

export interface UnitData {
  id: string;
  sector?: Sector;
  type: 'CHOFER' | 'MOTO' | 'SERENO';
  personnel1: string;
  personnel2?: string;
  plate: string;
  indicative: string;
  radio: string;
  status: UnitStatus;
  reason: string;
  km: string;
  hours: string;
  fuel: string;
  expense: string;
  parts: string;
  quadrant: string;
  mechanics: string;
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
  radio?: string;
  quadrant?: string;
  sector?: string;
}
