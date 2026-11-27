import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'@':resolve(__dirname,'.')}},oxc:{jsx:{runtime:'automatic'}},test:{include:['tests/unit/tavus.test.ts'],environment:'jsdom'}});
