import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ESBUILD_VERSION = '0.25.9';
const DEV_ENTRY = path.join(ROOT, 'app.html');
const WORKER_ENTRY = path.join(ROOT, 'vendor', 'pdfjs', 'pdf.worker.mjs');
const OUTPUT = path.join(ROOT, 'index.html');

function extractModuleSource(html) {
  const match = html.match(/<script type="module">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error(`No module entry found in ${DEV_ENTRY}`);
  return match[1]
    .replaceAll("from '/src/", "from './src/")
    .replaceAll("from '/vendor/", "from './vendor/");
}

function inlineWorkerSource(appSource, workerSource) {
  const oldWorkerAssignment = "pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.mjs';";
  if (!appSource.includes(oldWorkerAssignment)) {
    throw new Error('The app entry no longer contains the expected PDF.js worker assignment');
  }
  const workerLiteral = JSON.stringify(workerSource);
  const replacement = [
    `const pdfjsWorkerSource = ${workerLiteral};`,
    "const pdfjsWorkerUrl = URL.createObjectURL(new Blob([pdfjsWorkerSource], { type: 'text/javascript' }));",
    'pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;',
  ].join('\n');
  return appSource.replace(oldWorkerAssignment, () => replacement);
}

function runEsbuild(entryPath, outputPath) {
  return new Promise((resolve, reject) => {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const args = [
      'exec', '--yes', `--package=esbuild@${ESBUILD_VERSION}`, '--', 'esbuild',
      '--bundle', '--format=iife', '--platform=browser', '--target=es2020',
      '--minify', '--log-level=warning', `--outfile=${outputPath}`, entryPath,
    ];
    const child = spawn(npmCommand, args, {
      cwd: ROOT,
      shell: process.platform === 'win32',
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stderr = [];
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const errorText = Buffer.concat(stderr).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(`esbuild exited with ${code}${errorText ? `: ${errorText}` : ''}`));
        return;
      }
      readFile(outputPath, 'utf8').then(resolve, reject);
    });
    child.stdin.end();
  });
}

function createReleaseHtml(devHtml, bundle) {
  // Unlike the old dev/print-aids.html entry (a dev harness with a
  // Phase-10-specific <title>/<h1>), app.html already carries the real
  // product's own <title>拼版設計工具</title> — nothing to overwrite here.
  const shell = devHtml;
  const safeBundle = bundle.replaceAll('</script', '<\\/script');
  const modulePattern = /<script type="module">[\s\S]*?<\/script>/i;
  if (!modulePattern.test(shell)) throw new Error('Release shell lost its module script placeholder');
  return shell.replace(modulePattern, () => `<script>${safeBundle}</script>`);
}

async function main() {
  const [devHtml, workerSource] = await Promise.all([
    readFile(DEV_ENTRY, 'utf8'),
    readFile(WORKER_ENTRY, 'utf8'),
  ]);
  const appSource = inlineWorkerSource(extractModuleSource(devHtml), workerSource);
  const tempEntry = path.join(ROOT, `.phase11-entry-${process.pid}.mjs`);
  const tempBundle = path.join(ROOT, `.phase11-bundle-${process.pid}.js`);
  await writeFile(tempEntry, appSource, 'utf8');
  let bundle;
  try {
    bundle = await runEsbuild(tempEntry, tempBundle);
  } finally {
    await rm(tempEntry, { force: true });
    await rm(tempBundle, { force: true });
  }
  const output = createReleaseHtml(devHtml, bundle);

  if (output.includes('<script type="module">')) throw new Error('Build output still contains an ES module script');
  if (output.includes("from './src/") || output.includes("from './vendor/")) {
    throw new Error('Build output still contains source import specifiers');
  }
  if (!output.includes('Blob') || !output.includes('5.4.149')) {
    throw new Error('Build output is missing the inlined PDF.js worker');
  }
  if (/<(?:script|link)[^>]+(?:src|href)=["'](?:https?:|\/\/)/i.test(output)) {
    throw new Error('Build output contains an external script or stylesheet URL');
  }

  await writeFile(OUTPUT, output, 'utf8');
  console.log(`Built ${path.relative(ROOT, OUTPUT)} (${Buffer.byteLength(output, 'utf8').toLocaleString()} bytes)`);
  console.log(`Bundled with esbuild ${ESBUILD_VERSION}; PDF.js worker inlined as a Blob URL`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
