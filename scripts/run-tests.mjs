import { spawnSync } from 'node:child_process';
import { testFiles } from './test-files.mjs';
const files = await testFiles(process.cwd());
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
