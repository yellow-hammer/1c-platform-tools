/**
 * Сборка расширения через esbuild: один бандл с встроенными зависимостями (minimatch, glob).
 * node_modules не нужен в VSIX.
 */
import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

/** Рекурсивный поиск *\.test\.ts в каталоге (без glob для избежания проблем с minimatch при сборке). */
function findTestFiles(dir, baseDir, result = []) {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) {
			findTestFiles(full, baseDir, result);
		} else if (e.name.endsWith('.test.ts')) {
			result.push(path.relative(baseDir, full).replaceAll(path.sep, '/'));
		}
	}
	return result;
}

const testEntryPoints = findTestFiles(path.join(__dirname, 'src', 'test'), __dirname).map((f) =>
	path.join(__dirname, f)
);

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
