
export enum UnitStatus {
  ACTIVE = 'ACTIVO',
  OFF = 'FUERA',
  CHECKIN = 'CHECK-IN'
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

export type ViewMode = 'DASHBOARD' | 'VISUALIZATION';

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
