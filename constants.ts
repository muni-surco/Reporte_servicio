
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

// INDICATIVES and VEHICLES removed per user request
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

