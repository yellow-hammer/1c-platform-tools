/**
 * Сборка расширения через esbuild: один бандл с встроенными зависимостями (minimatch, glob).
 * node_modules не нужен в VSIX.
 */
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const extensionOptions = {
	entryPoints: [path.join(__dirname, 'src', 'extension.ts')],
	bundle: true,
	outfile: path.join(__dirname, 'out', 'extension.js'),
	platform: 'node',
	format: 'cjs',
	target: 'node20',
	external: ['vscode'],
	sourcemap: true,
	mainFields: ['module', 'main'],
};

const testEntryPoints = globSync('src/test/**/*.test.ts', { cwd: __dirname }).map((f) =>
	path.join(__dirname, f)
);

const testOptions = {
	entryPoints: testEntryPoints,
	bundle: true,
	outbase: path.join(__dirname, 'src'),
	outdir: path.join(__dirname, 'out'),
	platform: 'node',
	format: 'cjs',
	target: 'node20',
	external: ['vscode'],
	sourcemap: true,
	mainFields: ['module', 'main'],
};

if (watch) {
	const extCtx = await esbuild.context(extensionOptions);
	const testCtx = await esbuild.context(testOptions);
	await extCtx.watch();
	await testCtx.watch();
	console.log('watching...');
} else {
	await esbuild.build(extensionOptions);
	await esbuild.build(testOptions);
}
