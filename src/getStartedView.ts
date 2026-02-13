/**
 * «Начало работы» — открывает встроенное пошаговое руководство (Welcome: Open Walkthrough).
 */

import * as vscode from 'vscode';

const WELCOMED_KEY = '1c-platform-tools.getStarted.welcomed';

const WALKTHROUGH_ID = 'yellow-hammer.1c-platform-tools#1c-platform-tools.getStarted';

/**
 * Открывает пошаговое руководство «Начало работы с 1C Platform Tools» в панели приветствия.
 */
export function openGetStartedWalkthrough(): void {
	void vscode.commands.executeCommand('workbench.action.openWalkthrough', WALKTHROUGH_ID);
}

export function registerGetStarted(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('1c-platform-tools.getStarted.open', () => {
			openGetStartedWalkthrough();
		})
	);
}

/** Открыть «Начало работы» (walkthrough) при первом запуске после установки расширения */
export function showGetStartedOnFirstRun(context: vscode.ExtensionContext): void {
	if (context.globalState.get(WELCOMED_KEY)) {
		return;
	}
	void context.globalState.update(WELCOMED_KEY, true);
	setImmediate(() => openGetStartedWalkthrough());
}

export const GET_STARTED_OPEN_COMMAND = '1c-platform-tools.getStarted.open';
