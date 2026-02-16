/**
 * Команды добавления навыков для AI-агентов.
 * Копируют шаблоны навыков (SKILL.md с инструкциями по вызову команд расширения) в папку проекта.
 */

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { logger } from '../logger';

/** Идентификатор единственного навыка (папка в resources/skills) */
const SKILL_ID = '1c-platform-tools';

/** Вариант папки назначения для установки навыка (Cursor, Copilot, Claude и др.) */
const DESTINATION_OPTIONS = [
	{ id: 'cursor', label: 'Для Cursor', folder: '.cursor/skills/1c-platform-tools' },
	{ id: 'copilot', label: 'Для GitHub Copilot', folder: '.github/copilot/skills/1c-platform-tools' },
	{ id: 'claude', label: 'Для Claude Code', folder: '.claude/skills/1c-platform-tools' },
	{ id: 'custom', label: 'Указать папку…', folder: '' }
] as const;

export class SkillsCommands {
	/**
	 * Добавляет навык в проект. Показывает QuickPick выбора агента (Cursor / Copilot / Claude или папка), копирует файлы из resources/skills.
	 *
	 * @param context — контекст расширения (для extensionPath)
	 */
	async addSkill(context: vscode.ExtensionContext): Promise<void> {
		const extensionPath = context.extensionPath;
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

		const destChoice = await vscode.window.showQuickPick(
			DESTINATION_OPTIONS.map((o) => ({
				id: o.id,
				folder: o.folder,
				label: o.label,
				description: workspaceRoot ? path.join(workspaceRoot, o.folder) : undefined
			})),
			{
				title: 'Куда установить навык?',
				placeHolder: workspaceRoot
					? 'Выберите папку (относительно корня проекта)'
					: 'Нет открытой папки — выберите «Указать папку»',
				ignoreFocusOut: true
			}
		);
		if (!destChoice) {
			return;
		}

		let targetDir: string;
		if (destChoice.id === 'custom') {
			const selected = await vscode.window.showOpenDialog({
				canSelectFolders: true,
				canSelectMany: false,
				title: 'Выберите папку для навыка',
				openLabel: 'Выбрать папку'
			});
			if (!selected?.length) {
				return;
			}
			targetDir = path.join(selected[0].fsPath, SKILL_ID);
		} else if (workspaceRoot) {
			targetDir = path.join(workspaceRoot, destChoice.folder);
		} else {
			vscode.window.showWarningMessage('Откройте папку проекта или выберите «Указать папку»');
			return;
		}

		const sourceDir = path.join(extensionPath, 'resources', 'skills', SKILL_ID);
		try {
			await fs.access(sourceDir);
		} catch (error) {
			const errMsg = (error as Error).message;
			logger.error(`Папка шаблона навыка не найдена: ${sourceDir}. ${errMsg}`);
			vscode.window.showErrorMessage(`Шаблон навыка не найден: ${sourceDir}`);
			return;
		}

		try {
			await fs.access(path.join(targetDir, 'SKILL.md'));
			const overwrite = await vscode.window.showWarningMessage(
				`В папке уже есть навык (SKILL.md). Перезаписать?`,
				'Да',
				'Нет'
			);
			if (overwrite !== 'Да') {
				return;
			}
		} catch {
			// SKILL.md нет — создаём папку и копируем
		}

		try {
			await fs.mkdir(targetDir, { recursive: true });
			await fs.cp(sourceDir, targetDir, { recursive: true });
			logger.info(`Навык ${SKILL_ID} установлен в ${targetDir}`);
			vscode.window.showInformationMessage(
				'Навык установлен. Агент будет использовать инструкции из SKILL.md и предлагать выполнять команды расширения.'
			);
		} catch (error) {
			const errMsg = (error as Error).message;
			logger.error(`Не удалось скопировать навык: ${errMsg}. Источник: ${sourceDir}, назначение: ${targetDir}`);
			vscode.window.showErrorMessage(`Не удалось установить навык: ${errMsg}`);
		}
	}
}
