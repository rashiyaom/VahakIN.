import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react';
import {PhoneLocationSharing} from '../../components/dashboard/PhoneLocationSharing';
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it('retries failed uploads without blocking on wake lock and resumes on return',async()=>{
 vi.useFakeTimers();let visibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});Object.defineProperty(window,'isSecureContext',{configurable:true,value:true});
 Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:()=>new Promise(()=>{})}});
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(ok:any)=>ok({timestamp:Date.now(),coords:{latitude:23,longitude:72,accuracy:5}})}});
 let samples=0;const actions:string[]=[];vi.stubGlobal('fetch',vi.fn(async(_url:any,init:any)=>{const b=JSON.parse(init.body);actions.push(b.action);if(b.action==='sample'&&samples++===0)throw new Error('offline');return {ok:true,json:async()=>({sessionId:'session',status:'Phone location received'})};}));
 render(<PhoneLocationSharing vehicleId="vehicle"/>);fireEvent.click(screen.getByRole('checkbox'));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Share phone location'}));});expect(screen.getByRole('status').textContent).toContain('Retrying automatically');
 await act(async()=>{await vi.advanceTimersByTimeAsync(3000);});expect(screen.getByRole('status').textContent).toContain('Phone location received');
 await act(async()=>{visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));});expect(screen.getByRole('status').textContent).toContain('Paused');expect(actions).not.toContain('stop');
 await act(async()=>{visibility='visible';document.dispatchEvent(new Event('visibilitychange'));});expect(screen.getByRole('status').textContent).toContain('Phone location received');
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Stop sharing phone location'}));});expect(actions).toContain('stop');
});
