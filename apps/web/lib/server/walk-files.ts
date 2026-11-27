import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {WalkConfig,WalkState} from '../walk/engine';
export const walkDir=path.join(process.cwd(),'.provisioned','walk');
export function readWalk<T>(name:string):T|null{try{return JSON.parse(readFileSync(path.join(walkDir,name+'.json'),'utf8'));}catch{return null;}}
export function writeWalk(name:string,value:unknown){mkdirSync(walkDir,{recursive:true,mode:0o700});const dest=path.join(walkDir,name+'.json'),temp=dest+'.'+randomUUID()+'.tmp';writeFileSync(temp,JSON.stringify(value),{mode:0o600});renameSync(temp,dest);}
export const walkConfig=()=>readWalk<WalkConfig>('config');
export const walkState=()=>readWalk<WalkState>('state');
