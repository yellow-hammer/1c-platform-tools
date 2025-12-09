import * as vscode from 'vscode';

/**
 * Типы элементов дерева
 */
export enum TreeItemType {
	Task = 'task',
	Dependency = 'dependency',
	Config = 'config',
	File = 'file',
	Info = 'info',
}

/**
 * Элемент дерева для 1C Platform Tools
 */
export class PlatformTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly type: TreeItemType,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command,
		public readonly children?: PlatformTreeItem[]
	) {
		super(label, collapsibleState);

		// Устанавливаем иконку в зависимости от типа
		this.iconPath = this.getIconPath(type);
		this.contextValue = type;
	}

	private getIconPath(type: TreeItemType): vscode.ThemeIcon | undefined {
		switch (type) {
			case TreeItemType.Task:
				return new vscode.ThemeIcon('play');
			case TreeItemType.Dependency:
				return new vscode.ThemeIcon('package');
			case TreeItemType.Config:
				return new vscode.ThemeIcon('gear');
			case TreeItemType.File:
				return new vscode.ThemeIcon('file');
			case TreeItemType.Info:
				return new vscode.ThemeIcon('info');
			default:
				return new vscode.ThemeIcon('circle-outline');
		}
	}
}

/**
 * Провайдер данных для дерева 1C Platform Tools
 */
export class PlatformTreeDataProvider implements vscode.TreeDataProvider<PlatformTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PlatformTreeItem | undefined | null | void> =
		new vscode.EventEmitter<PlatformTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PlatformTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PlatformTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: PlatformTreeItem): Thenable<PlatformTreeItem[]> {
		if (!element) {
			// Корневые элементы
			return Promise.resolve(this.getRootItems());
		}

		// Дочерние элементы
		return Promise.resolve(element.children || []);
	}

	private getRootItems(): PlatformTreeItem[] {
		return [
			// Задачи
			new PlatformTreeItem(
				'Задачи',
				TreeItemType.Task,
				vscode.TreeItemCollapsibleState.Expanded,
				undefined,
				[
					new PlatformTreeItem(
						'Разбор внешних обработок',
						TreeItemType.Task,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.task.parseExternalProcessors',
							title: 'Разбор внешних обработок',
						}
					),
					new PlatformTreeItem(
						'Разбор отчетов',
						TreeItemType.Task,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.task.parseReports',
							title: 'Разбор отчетов',
						}
					),
					new PlatformTreeItem(
						'Разбор конфигурации',
						TreeItemType.Task,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.task.parseConfiguration',
							title: 'Разбор конфигурации',
						}
					),
					new PlatformTreeItem(
						'Разбор расширений',
						TreeItemType.Task,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.task.parseExtensions',
							title: 'Разбор расширений',
						}
					),
				]
			),
			// Зависимости
			new PlatformTreeItem(
				'Зависимости',
				TreeItemType.Dependency,
				vscode.TreeItemCollapsibleState.Collapsed,
				undefined,
				[
					new PlatformTreeItem(
						'Нет зависимостей',
						TreeItemType.Info,
						vscode.TreeItemCollapsibleState.None
					),
				]
			),
			// Конфигурации запуска
			new PlatformTreeItem(
				'Конфигурации запуска',
				TreeItemType.Config,
				vscode.TreeItemCollapsibleState.Collapsed,
				undefined,
				[
					new PlatformTreeItem(
						'Нет конфигураций',
						TreeItemType.Info,
						vscode.TreeItemCollapsibleState.None
					),
				]
			),
			// Файлы конфигурации
			new PlatformTreeItem(
				'Файлы конфигурации',
				TreeItemType.File,
				vscode.TreeItemCollapsibleState.Expanded,
				undefined,
				[
					new PlatformTreeItem(
						'bsl.json',
						TreeItemType.File,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.file.open',
							title: 'Открыть файл',
							arguments: ['bsl.json'],
						}
					),
					new PlatformTreeItem(
						'bsl-project.json',
						TreeItemType.File,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.file.open',
							title: 'Открыть файл',
							arguments: ['bsl-project.json'],
						}
					),
					new PlatformTreeItem(
						'build.gradle.kts',
						TreeItemType.File,
						vscode.TreeItemCollapsibleState.None,
						{
							command: '1c-platform-tools.file.open',
							title: 'Открыть файл',
							arguments: ['build.gradle.kts'],
						}
					),
				]
			),
		];
	}
}

