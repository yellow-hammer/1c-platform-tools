/**
 * QuickPick списка проектов (по образцу Project Manager).
 * Объединяет избранное + автообнаруженные проекты.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { OneCLocator } from '../oneCLocator';
import type { ProjectStorage } from './storage';
import { sortProjects } from './sorter';
import type { ProjectsStack } from './stack';
import {
	CommandLocation,
	OpenInCurrentWindowIfEmptyMode,
	ConfirmSwitchOnActiveWindowMode,
} from './constants';
import { normalizePath } from './pathUtils';

export interface PickedProject {
	name: string;
	rootPath: string;
}

export interface PickedResult {
	item: PickedProject;
	openInNewWindow: boolean;
}

function canPickSelectedProject(item: vscode.QuickPickItem, storage: ProjectStorage | undefined): boolean {
	const desc = item.description;
	if (typeof desc !== 'string') return false;
	if (fs.existsSync(desc)) return true;
	if (storage) {
		const update = { title: 'Обновить путь' };
		const del = { title: 'Удалить' };
		void vscode.window
			.showErrorMessage('Путь проекта не существует. Что сделать?', update, del)
			.then((choice) => {
				if (choice?.title === 'Обновить путь') {
					void vscode.commands.executeCommand('1c-platform-tools.projects.editProjects');
				} else if (choice?.title === 'Удалить' && item.label) {
					storage.pop(item.label);
					storage.save();
				}
			});
	}
	return false;
}

export function shouldOpenInNewWindow(openInNewWindow: boolean, calledFrom: CommandLocation): boolean {
	if (!openInNewWindow) return false;
	const folders = vscode.workspace.workspaceFolders;
	const hasEditor = !!vscode.window.activeTextEditor;
	if (folders?.length || hasEditor) return openInNewWindow;

	const config = vscode.workspace.getConfiguration('1c-platform-tools').get<string>(
		'projects.openInCurrentWindowIfEmpty',
		'always'
	);
	if (config === OpenInCurrentWindowIfEmptyMode.always) return false;
	if (config === OpenInCurrentWindowIfEmptyMode.never) return openInNewWindow;
	if (config === OpenInCurrentWindowIfEmptyMode.onlyUsingCommandPalette) {
		return calledFrom !== CommandLocation.CommandPalette;
	}
	if (config === OpenInCurrentWindowIfEmptyMode.onlyUsingSideBar) {
		return calledFrom !== CommandLocation.SideBar;
	}
	return openInNewWindow;
}

function shouldConfirmSwitch(calledFrom: CommandLocation): boolean {
	const folders = vscode.workspace.workspaceFolders;
	const hasEditor = !!vscode.window.activeTextEditor;
	if (!folders?.length || !hasEditor) return false;

	const config = vscode.workspace.getConfiguration('1c-platform-tools').get<string>(
		'projects.confirmSwitchOnActiveWindow',
		ConfirmSwitchOnActiveWindowMode.never
	);
	if (config === ConfirmSwitchOnActiveWindowMode.never) return false;
	if (config === ConfirmSwitchOnActiveWindowMode.onlyUsingCommandPalette) return calledFrom === CommandLocation.CommandPalette;
	if (config === ConfirmSwitchOnActiveWindowMode.onlyUsingSideBar) return calledFrom === CommandLocation.SideBar;
	return config === ConfirmSwitchOnActiveWindowMode.always;
}

export async function canSwitchOnActiveWindow(calledFrom: CommandLocation): Promise<boolean> {
	if (!shouldConfirmSwitch(calledFrom)) return true;
	const choice = await vscode.window.showWarningMessage(
		'Открыть проект в активном окне?',
		{ modal: true },
		{ title: 'Открыть' }
	);
	return choice?.title === 'Открыть';
}

export async function pickProjects(
	storage: ProjectStorage | undefined,
	locator: OneCLocator,
	showOpenInNewWindowButton: boolean,
	calledFrom: CommandLocation,
	stack: ProjectsStack,
	context: vscode.ExtensionContext
): Promise<PickedResult | undefined> {
	const config = vscode.workspace.getConfiguration('1c-platform-tools');
	const groupList = config.get<boolean>('projects.groupList', false);
	const removeCurrent = config.get<boolean>('projects.removeCurrentProjectFromList', true);
	const filterOnFullPath = config.get<boolean>('projects.filterOnFullPath', false);
	const filterByTags = context.globalState.get<string[]>('1c-platform-tools.projects.filterByTags', []);

	let favorites: Array<{ label: string; description: string }> = [];
	if (storage) {
		favorites = filterByTags.length > 0 ? storage.getProjectsByTags(filterByTags) : storage.map();
		favorites = sortProjects(favorites, stack);
	}

	const autodetectPaths = await locator.locateProjects();
	const currentPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	let autodetect = autodetectPaths
		.filter((p) => !removeCurrent || path.normalize(p) !== path.normalize(currentPath ?? ''))
		.filter((p) => !favorites.some((f) => path.normalize(f.description) === path.normalize(p)))
		.map((p) => ({
			label: path.basename(p) || p,
			description: p,
		}));
	autodetect = sortProjects(autodetect, stack);

	let allItems: Array<vscode.QuickPickItem & { path: string }> = [];
	if (groupList && favorites.length > 0 && autodetect.length > 0) {
		allItems = [
			{ label: 'Избранное', kind: vscode.QuickPickItemKind.Separator, path: '' },
			...favorites.map((f) => ({ ...f, path: f.description })),
			{ label: 'Все проекты', kind: vscode.QuickPickItemKind.Separator, path: '' },
			...autodetect.map((a) => ({ ...a, path: a.description })),
		];
	} else {
		const combined = sortProjects(
			[...favorites.map((f) => ({ ...f, path: f.description })), ...autodetect.map((a) => ({ ...a, path: a.description }))],
			stack
		);
		allItems = combined.map((c) => ({ ...c, path: c.description }));
	}

	if (allItems.filter((i) => i.kind !== vscode.QuickPickItemKind.Separator).length === 0) {
		void vscode.window.showInformationMessage('Нет сохранённых проектов. Добавьте папки в настройку baseFolders или сохраните текущий проект.');
		return undefined;
	}

	const openInNewWindowBtn: vscode.QuickInputButton = {
		iconPath: new vscode.ThemeIcon('link-external'),
		tooltip: 'Открыть в новом окне',
	};

	return new Promise<PickedResult | undefined>((resolve) => {
		const input = vscode.window.createQuickPick();
		input.placeholder = 'Выберите проект...';
		input.matchOnDescription = filterOnFullPath;
		input.items = allItems.map((item) => ({
			...item,
			buttons: showOpenInNewWindowButton ? [openInNewWindowBtn] : [],
		}));

		input.onDidChangeSelection((items) => {
			const item = items[0];
			if (!item || item.kind === vscode.QuickPickItemKind.Separator) return;
			const pathVal = 'path' in item ? (item as { path: string }).path : (item.description as string);
			if (!canPickSelectedProject(item, storage)) {
				resolve(undefined);
				input.hide();
				return;
			}
			resolve({
				item: { name: item.label, rootPath: normalizePath(pathVal) },
				openInNewWindow: false,
			});
			input.hide();
		});

		input.onDidTriggerItemButton((ev) => {
			const item = ev.item;
			if (!item || item.kind === vscode.QuickPickItemKind.Separator) return;
			const pathVal = 'path' in item ? (item as { path: string }).path : (item.description as string);
			if (!canPickSelectedProject(item, storage)) {
				resolve(undefined);
				input.hide();
				return;
			}
			resolve({
				item: { name: item.label, rootPath: normalizePath(pathVal) },
				openInNewWindow: true,
			});
			input.hide();
		});

		input.onDidHide(() => {
			resolve(undefined);
			input.dispose();
		});

		void vscode.commands.executeCommand('setContext', 'in1cProjectsList', true);
		input.show();
	}).finally(() => {
		void vscode.commands.executeCommand('setContext', 'in1cProjectsList', false);
	});
}

export async function openPickedProject(
	picked: PickedResult | undefined,
	forceNewWindow: boolean,
	calledFrom: CommandLocation,
	stack: ProjectsStack,
	context: vscode.ExtensionContext
): Promise<void> {
	if (!picked) return;

	if (!picked.openInNewWindow && !forceNewWindow) {
		if (!(await canSwitchOnActiveWindow(calledFrom))) return;
	}

	stack.push(picked.item.name);

	const openInNew = shouldOpenInNewWindow(forceNewWindow || picked.openInNewWindow, calledFrom);
	const uri = vscode.Uri.file(picked.item.rootPath);
	await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: openInNew });
}
