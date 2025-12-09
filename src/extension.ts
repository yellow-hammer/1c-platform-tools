// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PlatformTreeDataProvider } from './treeViewProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "1c-platform-tools" is now active!');

	// Создаем провайдер данных для дерева
	const treeDataProvider = new PlatformTreeDataProvider();

	// Регистрируем TreeView
	const treeView = vscode.window.createTreeView('1c-platform-tools', {
		treeDataProvider: treeDataProvider,
		showCollapseAll: true,
	});

	context.subscriptions.push(treeView);

	// Регистрируем команду обновления дерева
	const refreshCommand = vscode.commands.registerCommand('1c-platform-tools.refresh', () => {
		treeDataProvider.refresh();
		vscode.window.showInformationMessage('Дерево обновлено');
	});
	context.subscriptions.push(refreshCommand);

	// Регистрируем команду настроек
	const settingsCommand = vscode.commands.registerCommand('1c-platform-tools.settings', () => {
		vscode.window.showInformationMessage('Открыть настройки 1C Platform Tools');
	});
	context.subscriptions.push(settingsCommand);

	// Регистрируем команды для задач
	const parseExternalProcessorsCommand = vscode.commands.registerCommand(
		'1c-platform-tools.task.parseExternalProcessors',
		() => {
			vscode.window.showInformationMessage('Разбор внешних обработок');
		}
	);
	context.subscriptions.push(parseExternalProcessorsCommand);

	const parseReportsCommand = vscode.commands.registerCommand(
		'1c-platform-tools.task.parseReports',
		() => {
			vscode.window.showInformationMessage('Разбор отчетов');
		}
	);
	context.subscriptions.push(parseReportsCommand);

	const parseConfigurationCommand = vscode.commands.registerCommand(
		'1c-platform-tools.task.parseConfiguration',
		() => {
			vscode.window.showInformationMessage('Разбор конфигурации');
		}
	);
	context.subscriptions.push(parseConfigurationCommand);

	const parseExtensionsCommand = vscode.commands.registerCommand(
		'1c-platform-tools.task.parseExtensions',
		() => {
			vscode.window.showInformationMessage('Разбор расширений');
		}
	);
	context.subscriptions.push(parseExtensionsCommand);

	// Регистрируем команду открытия файла
	const openFileCommand = vscode.commands.registerCommand(
		'1c-platform-tools.file.open',
		(fileName: string) => {
			vscode.window.showInformationMessage(`Открыть файл: ${fileName}`);
		}
	);
	context.subscriptions.push(openFileCommand);

	// Старая команда для совместимости
	const helloWorldCommand = vscode.commands.registerCommand('1c-platform-tools.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from 1C Platform Tools!');
	});
	context.subscriptions.push(helloWorldCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}
