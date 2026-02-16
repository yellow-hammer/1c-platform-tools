/**
 * Наблюдатель за файлом в .cursor/: при появлении файла с идентификатором команды расширения
 * выполняет команду (vscode.commands.executeCommand). Позволяет агенту или MCP-серверу
 * запускать команды, создавая файл (write или echo в терминале).
 */

import * as vscode from 'vscode';
import { logger } from './logger';

/** Имя файла в .cursor/ — одна строка с command ID (например 1c-platform-tools.run.designer). */
const RUN_COMMAND_FILE = '1c-platform-tools-run-command';

/** Префикс разрешённых команд (безопасность: не выполнять произвольные команды). */
const COMMAND_PREFIX = '1c-platform-tools.';

/**
 * Обрабатывает файл с идентификатором команды: читает, выполняет команду, удаляет файл.
 */
async function handleRunCommandFile(uri: vscode.Uri): Promise<void> {
	try {
		const doc = await vscode.workspace.openTextDocument(uri);
		const line = doc.getText().split(/\r?\n/)[0]?.trim() ?? '';
		if (!line?.startsWith(COMMAND_PREFIX)) {
			logger.warn(
				`runCommandFromFile: неверный идентификатор в ${uri.fsPath} (ожидается строка, начинающаяся с ${COMMAND_PREFIX})`
			);
			await vscode.workspace.fs.delete(uri, { useTrash: false });
			return;
		}
		await vscode.workspace.fs.delete(uri, { useTrash: false });
		await vscode.commands.executeCommand(line);
		logger.info(`runCommandFromFile: выполнена команда ${line}`);
	} catch (error) {
		const errMsg = (error as Error).message;
		logger.error(`runCommandFromFile: ошибка при обработке ${uri.fsPath}: ${errMsg}`);
	}
}

/**
 * Регистрирует наблюдатель за файлом `.cursor/1c-platform-tools-run-command` в workspace.
 * При создании/изменении файла выполняется команда, указанная в первой строке (только 1c-platform-tools.*).
 *
 * @param context — контекст расширения (subscriptions)
 */
export function registerRunCommandFileWatcher(context: vscode.ExtensionContext): void {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return;
	}
	const pattern = new vscode.RelativePattern(folder, `.cursor/${RUN_COMMAND_FILE}`);
	const watcher = vscode.workspace.createFileSystemWatcher(pattern);
	const run = (uri: vscode.Uri) => void handleRunCommandFile(uri);
	watcher.onDidCreate(run);
	watcher.onDidChange(run);
	context.subscriptions.push(watcher);
}
