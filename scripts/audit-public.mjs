import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {auditDirectory, inspectBytes} from './public-artifact.mjs';

try {
  const count = await auditDirectory(fileURLToPath(new URL('../dist/', import.meta.url)));
  const findings = inspectBytes(await readFile(new URL('../Polytype-Demo.html', import.meta.url)));
  if (findings.length) throw new Error(`Standalone privacy audit failed: ${findings.join(', ')}`);
  console.log(`Privacy checks passed: ${count} Pages files and standalone (including nested payloads).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
