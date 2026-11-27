import {describe,it,expect} from 'vitest';
import {watchView} from '../../lib/server/watch-view';
import type {Vehicle} from '../../lib/server/demo-store';
const now=1800000000000;
const vehicle={deviceTier:'PLUS',registration:'TEST',declarationStatus:'Submitted',geofence:'Inside',lat:22.3,lng:70.8,accuracy:10,gpsAt:new Date(now-1000).toISOString(),gpsStatus:'Phone-provided location',locationSource:'PHONE_BROWSER',phoneLocationSession:{expiresAt:now+60000},geofenceConfig:{enabled:true,radiusM:150}} as Vehicle;
describe('authenticated watch projection',()=>{
 it('returns fresh phone coordinates without owner identity or credentials',()=>{
  const view=watchView(vehicle,now)!;expect(view.location?.source).toBe('PHONE_BROWSER');
  expect(Object.keys(view).sort()).toEqual(['declaration','geofence','location','radiusM','registration']);
 });
 it.each([
  {gpsAt:new Date(now-16000).toISOString()},
  {phoneLocationSession:undefined},
  {phoneLocationSession:{expiresAt:now-1}},
  {accuracy:31}, {gpsStatus:'Unavailable'}, {locationSource:'DEVICE_GPS'},
  {gpsAt:new Date(now+3000).toISOString()},
 ])('withholds invalid or stopped phone data: %o',change=>{
  expect(watchView({...vehicle,...change} as Vehicle,now)?.location).toBeNull();
 });
 it('does not provide a view for Basic or unassigned devices',()=>{
  expect(watchView({...vehicle,deviceTier:'BASIC'},now)).toBeNull();expect(watchView(null,now)).toBeNull();
 });
});
