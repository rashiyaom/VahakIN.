// @vitest-environment jsdom
import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,act,cleanup} from '@testing-library/react';
const mock=vi.hoisted(()=>({handlers:new Map<string,Function>(),send:vi.fn(),off:vi.fn()}));
vi.mock('@tavus/embed',()=>({TavusIntegration:class {on(n:string,f:Function){mock.handlers.set(n,f)}off(n:string,f:Function){mock.off(n,f);mock.handlers.delete(n)}sendMessage=mock.send}}));
vi.mock('../../components/ai/ChartVisualizer',()=>({ChartVisualizer:()=>null}));
import {VahanAiWorkspace} from '../../components/ai/VahanAiWorkspace';
import type {Account} from '../../lib/permissions/access';
import type {WorkspaceData} from '../../lib/server/workspace';
const account={id:'test',role:'vehicle_owner',name:'Test',mode:'demo'} as Account;
const data={summary:{current:0,stale:0,unavailable:0,review:0},vehicles:[],refreshedAt:'2026-11-27T00:00:00Z'} as unknown as WorkspaceData;
describe('Tavus lifecycle',()=>{it('gates prompts on a live call, rejects page-action wiring, and cleans listeners',()=>{
 const result=render(React.createElement(VahanAiWorkspace,{account,data}));
 const button=screen.getByRole('button',{name:'Explain my monitoring overview'}) as HTMLButtonElement;
 expect(button.disabled).toBe(true);fireEvent.click(button);expect(mock.send).not.toHaveBeenCalled();
 expect(mock.handlers.has('tavus:tool-call')).toBe(false);
 act(()=>mock.handlers.get('tavus:conversation-started')!());expect(button.disabled).toBe(false);
 fireEvent.click(button);expect(mock.send).toHaveBeenCalledWith('Explain my monitoring overview');
 act(()=>mock.handlers.get('tavus:conversation-ended')!());expect(button.disabled).toBe(true);
 result.unmount();expect(mock.handlers.size).toBe(0);expect(mock.off).toHaveBeenCalledTimes(4);cleanup();
 });});
