import * as reportGenerators from './utils/reportGenerator';

(window as typeof window & { reportGenerators?: typeof reportGenerators }).reportGenerators = reportGenerators;
