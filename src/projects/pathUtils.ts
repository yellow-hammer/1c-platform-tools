/**
 * Утилиты путей для projects.json (по образцу Project Manager).
 */

import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const homeDir = os.homedir();
const HOME_VAR = '$home';
const HOME_TILDE = '~';

/**
 * Путь к projects.json. projectsLocation — папка (как в PM); при пустом — globalStorage расширения.
 */
export function getProjectsFilePath(projectsLocation: string, context: vscode.ExtensionContext): string {
	if (projectsLocation && projectsLocation.trim() !== '') {
		return path.join(expandHomePath(projectsLocation.trim()), 'projects.json');
	}
	return path.join(context.globalStoragePath, 'projects.json');
}

export function expandHomePath(inputPath: string): string {
	if (inputPath.startsWith(HOME_VAR)) {
		return path.normalize(path.join(homeDir, inputPath.slice(HOME_VAR.length)));
	}
	if (inputPath.startsWith(HOME_TILDE)) {
		return path.normalize(path.join(homeDir, inputPath.slice(HOME_TILDE.length)));
	}
	return inputPath;
}

export function updateWithPathSeparatorStr(item: string): string {
	return path.sep === '\\' ? item.replaceAll('/', '\\') : item.replaceAll('\\', '/');
}

export function normalizePath(p: string): string {
	return path.normalize(p);
}
