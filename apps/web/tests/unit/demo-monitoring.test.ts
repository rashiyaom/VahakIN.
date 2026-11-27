import {describe,it,expect} from 'vitest';
import {monitoringScenarios,illustrativeCharge} from '../../lib/demo/monitoring-scenarios';
const vehicles=Array.from({length:10},(_,i)=>({id:`v-${i}`,registration:`DEMO-${i}`,lat:22.3+i*.002,lng:70.8,monitoring:'Current',gpsAt:null}));
describe('government seeded monitoring',()=>{
 it('keeps all scoped cars and covers eight distinct cases',()=>{const rows=monitoringScenarios(vehicles);expect(rows).toHaveLength(10);expect(new Set(rows.map(v=>v.scenario)).size).toBe(8);expect(monitoringScenarios([])).toEqual([]);});
 it('makes breach, boundary and return geometrically consistent',()=>{const rows=monitoringScenarios(vehicles);expect(rows[2].distanceM).toBeGreaterThan(175);expect(rows[7].distanceM).toBeGreaterThan(125);expect(rows[7].distanceM).toBeLessThan(175);expect(rows[6].distanceM).toBe(0);expect(rows[6].distanceKm).toBeGreaterThan(1);expect(rows[3].locationStatus).toBe('Stale');});
 it('only illustrates eligible journeys and rejects invalid rates',()=>{expect(illustrativeCharge(2.5,12,true)).toBe(30);expect(illustrativeCharge(2.5,12,false)).toBe(0);expect(illustrativeCharge(2.5,-1,true)).toBe(0);expect(illustrativeCharge(2.5,NaN,true)).toBe(0);});
});
