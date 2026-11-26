import {copyFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
const root=path.dirname(require.resolve('maplibre-gl/package.json'));
const destination=new URL('../public/vendor/maplibre/',import.meta.url);
await mkdir(destination,{recursive:true});
await copyFile(path.join(root,'dist/maplibre-gl-worker.mjs'),new URL('worker.mjs',destination));
