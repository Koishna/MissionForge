export const G0 = 9.80665;                
export const SECONDS_PER_MONTH = 30 * 24 * 3600;
export const K_DB = -228.6;                
export const EARTH_MOON_KM = 384400;       

export function val(x) { return x && typeof x === 'object' && 'value' in x ? x.value : x; }
export const kmToM = (km) => km * 1000;
export const hToS = (h) => h * 3600;
export const dB = (x) => 10 * Math.log10(x);        
export const fromDB = (d) => Math.pow(10, d / 10);  
export const clamp01 = (x) => Math.max(0, Math.min(1, x));