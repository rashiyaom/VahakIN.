import {it,expect} from 'vitest';
import {routeOffice} from '../../lib/enrollment/policy';
it('routes Gandhinagar independently and rejects mixed district/area',()=>{
 expect(routeOffice({district:'Gandhinagar',area:'Gandhinagar city'})?.code).toBe('GJ-21');
 expect(routeOffice({district:'Rajkot',area:'Rajkot city'})?.code).toBe('GJ-03');
 expect(routeOffice({district:'Rajkot',area:'Gandhinagar city'})).toBeNull();
});
