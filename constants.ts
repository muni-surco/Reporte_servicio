
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

export const FUEL_TYPES = ['GLP', 'GASOLINA', 'PETROLEO'];

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
  'SECTOR 1A': [
    { id: 'M-13A', type: 'CHOFER', quadrant: '13A', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-15', type: 'CHOFER', quadrant: '15', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-16', type: 'CHOFER', quadrant: '16', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-17', type: 'CHOFER', quadrant: '17', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-18', type: 'CHOFER', quadrant: '18', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-19', type: 'CHOFER', quadrant: '19', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-98', type: 'CHOFER', quadrant: '98', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
    { id: 'M-S1A', type: 'CHOFER', quadrant: 'S1A', status: UnitStatus.PATRULLANDO, mechanics: 'Operativo', km: '0 / 0 / 0', hours: '--:-- - --:--', fuel: '-- / --', expense: 'S/ 0.00', parts: '0', personnel1: '', personnel2: '', plate: '', indicative: '', radio: '', reason: '', sector: 'SECTOR 1A' },
  ],

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

