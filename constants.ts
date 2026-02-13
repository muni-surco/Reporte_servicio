
import { UnitData, UnitStatus, Sector } from './types';

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

export const FUEL_TYPES = ['GLP', 'GASOLINA'];

export const INDICATIVES = [
  'CHOFER', 'JEFE AREA', 'MOTORIZADO', 'PNP', 'SERENO', 'SUPERVISOR', 'FISCALIZACION', 'TRANSITO', 'RESCATE', 'DESCANSO COMPENSATORIO', 'FALTO', 'DESCANSO MEDICO', 'ONOMASTICO', 'PERMISO'
];

export const VEHICLES = [
  { id: 'M-13', plate: 'EUJ-821' },
  { id: 'M-14', plate: 'FGH-102' },
  { id: 'M-15', plate: 'ABC-123' },
  { id: 'M-16', plate: 'XYZ-987' },
  { id: 'M-17', plate: 'PLQ-456' },
  { id: 'M-18', plate: 'TRX-112' },
  { id: 'M-19', plate: 'VBN-334' },
  { id: 'M-20', plate: 'KJH-556' },
  { id: 'M-21', plate: 'LKO-998' },
  { id: 'L-15', plate: 'HON-452' },
  { id: 'L-16', plate: 'YAM-789' },
  { id: 'L-17', plate: 'KWA-001' },
  { id: 'L-18', plate: 'SUZ-222' },
  { id: 'L-19', plate: 'YAM-554' },
  { id: 'L-20', plate: 'HON-112' },
  { id: 'L-21', plate: 'KWA-223' },
  { id: 'P-01', plate: 'PE-1001' },
  { id: 'P-02', plate: 'PE-1093' },
  { id: 'P-03', plate: 'PE-2022' },
  { id: 'P-04', plate: 'PE-3033' },
  { id: 'P-05', plate: 'PE-4044' },
  { id: 'P-06', plate: 'PE-5055' },
  { id: 'P-07', plate: 'PE-6066' },
  { id: 'P-08', plate: 'PE-7077' }
];

export const RADIOS: string[] = [];

export const PERSONNEL_NAMES = [
  'Villanueva Villafani, Joe',
  'Insp. Mendoza, Ricardo',
  'SOT. Garcia, Juan',
  'Caja Quiroz, Carlos',
  'Ramos L., Hugo',
  'Torres Ruiz, Manuel',
  'Soto Mayor, Luis',
  'López Vega, Ricardo',
  'Castro P., Elena',
  'García Salas, Pedro',
  'Vargas J., Mario',
  'Vidal Hipolito, J.',
  'Paredes C., Alberto',
  'Mendoza T., Franco',
  'Huamaní R., S.',
  'Quispe M., Jhon',
  'Gomez Chavez, R.',
  'Salazar F., Ana',
  'Beltrán O., Jorge',
  'Villalobos K., M.',
  'Cárdenas H., Raúl',
  'Sánchez M., Lucía',
  'SOT. Ramirez, Victor',
  'Cap. Espinoza, Maria',
  'Alvarez P., Roberto',
  'Caceres G., Fernando',
  'Dávila M., Sonia',
  'Espichán R., Luis'
];

export const INITIAL_UNITS: UnitData[] = [];

export const SECTOR_DATA: Record<Sector, UnitData[]> = {
  'SECTOR 1A': [],

  'SECTOR 1B': [],
  'SECTOR 2A': [],
  'SECTOR 2B': [],
  'SECTOR 3': [],
  'SECTOR 4': [],
  'SECTOR 5': [],
  'SECTOR 6': [],
  'SECTOR 7': [],
  'SECTOR 8': [],
  'SECTOR 9A': [],
  'SECTOR 9B': [],
  'RESCATE': [],
  'GIR': [],
};

