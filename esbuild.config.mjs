/**
 * Сборка расширения через esbuild: один бандл с встроенными зависимостями (minimatch, glob).
 * node_modules не нужен в VSIX.
 */
import * as esbuild from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const options = {
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

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	console.log('watching...');
} else {
	await esbuild.build(options);
}
