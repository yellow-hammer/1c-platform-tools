import * as vscode from 'vscode';
import { exec } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as os from 'node:os';
import { escapeCommandArgs, buildCommand, detectShellType, ShellType, normalizeArgForShell } from './utils/commandUtils';

/**
 * Результат выполнения команды vrunner
 * 
 * Используется для синхронного выполнения команд через executeVRunner()
 */
export interface VRunnerExecutionResult {
	/** Успешность выполнения команды (true, если exitCode === 0) */
	success: boolean;
	/** Стандартный вывод команды */
	stdout: string;
	/** Поток ошибок команды */
	stderr: string;
	/** Код возврата команды (0 - успех, иначе - ошибка) */
	exitCode: number;
}

/**
 * Менеджер для работы с vrunner (vanessa-runner)
 * 
 * Синглтон, который управляет:
 * - Путями к vrunner, OneScript, OPM, Allure
 * - Настройками из конфигурации VS Code
 * - Выполнением команд в терминале и синхронно
 * - Работой с env.json для параметров подключения к ИБ
 * 
 * Все команды расширения используют этот менеджер для доступа к vrunner.
 * 
 * @example
 * ```typescript
 * const vrunner = VRunnerManager.getInstance();
 * vrunner.executeVRunnerInTerminal(['init-dev', '--ibconnection', '/F./build/ib']);
 * ```
 */
export class VRunnerManager {
	private static instance: VRunnerManager;
	private readonly workspaceRoot: string | undefined;
	private extensionPath: string | undefined;

	private constructor(context?: vscode.ExtensionContext) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders && workspaceFolders.length > 0) {
			this.workspaceRoot = workspaceFolders[0].uri.fsPath;
		}
		if (context) {
			this.extensionPath = context.extensionPath;
		}
	}

	/**
	 * Получает экземпляр VRunnerManager (синглтон)
	 * 
	 * При первом вызове создает экземпляр, при последующих возвращает существующий.
	 * Если передан context и путь к расширению еще не установлен, обновляет его.
	 * 
	 * @param context - Контекст расширения VS Code (опционально, используется для установки пути к расширению)
	 * @returns Экземпляр VRunnerManager
	 * 
	 * @example
	 * ```typescript
	 * // При активации расширения
	 * const vrunner = VRunnerManager.getInstance(context);
	 * 
	 * // В командах (context уже не нужен)
	 * const vrunner = VRunnerManager.getInstance();
	 * ```
	 */
	public static getInstance(context?: vscode.ExtensionContext): VRunnerManager {
		if (!VRunnerManager.instance) {
			VRunnerManager.instance = new VRunnerManager(context);
		} else if (context && !VRunnerManager.instance.extensionPath) {
			VRunnerManager.instance.extensionPath = context.extensionPath;
		}
		return VRunnerManager.instance;
	}

	/**
	 * Получает путь к vrunner
	 * 
	 * Ищет vrunner.bat в oscript_modules/bin/ в workspace.
	 * Если не найден, возвращает 'vrunner' для поиска в PATH.
	 * 
	 * @returns Относительный путь к vrunner.bat (например, 'oscript_modules/bin/vrunner.bat')
	 *          или 'vrunner' для поиска в PATH
	 * 
	 * @example
	 * ```typescript
	 * const vrunnerPath = vrunner.getVRunnerPath();
	 * // Если найден в workspace: 'oscript_modules/bin/vrunner.bat'
	 * // Если не найден: 'vrunner'
	 * ```
	 */
	public getVRunnerPath(): string {
		if (this.workspaceRoot) {
			const vrunnerPath = path.join(this.workspaceRoot, 'oscript_modules', 'bin', 'vrunner.bat');
			if (fsSync.existsSync(vrunnerPath)) {
				return path.join('oscript_modules', 'bin', 'vrunner.bat');
			}
		}
		
		return 'vrunner';
	}

	/**
	 * Получает путь к файлу настроек инициализации vrunner
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.vrunner.initSettingsPath).
	 * По умолчанию: './tools/vrunner.init.json'
	 * 
	 * @returns Путь к файлу настроек инициализации (относительно workspace)
	 */
	public getVRunnerInitSettingsPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('vrunner.initSettingsPath', './tools/vrunner.init.json');
	}

	/**
	 * Получает путь к opm (OneScript Package Manager)
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.opm.path).
	 * По умолчанию: 'opm'
	 * 
	 * @returns Путь к opm (для поиска в PATH или абсолютный путь)
	 */
	private getOpmPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('opm.path', 'opm');
	}

	/**
	 * Получает путь к allure
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.allure.path).
	 * По умолчанию: 'allure'
	 * 
	 * @returns Путь к allure (для поиска в PATH или абсолютный путь)
	 */
	public getAllurePath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('allure.path', 'allure');
	}

	/**
	 * Получает путь к исходникам конфигурации
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.paths.src).
	 * По умолчанию: 'src/cf'
	 * 
	 * @returns Путь к исходникам конфигурации (относительно workspace)
	 */
	public getSrcPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('paths.src', 'src/cf');
	}

	/**
	 * Получает путь к папке сборки
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.paths.build).
	 * По умолчанию: 'build/out'
	 * 
	 * @returns Путь к папке сборки (относительно workspace)
	 */
	public getBuildPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('paths.build', 'build/out');
	}

	/**
	 * Получает путь к исходникам внешних обработок
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.paths.epf).
	 * По умолчанию: 'src/epf'
	 * 
	 * @returns Путь к исходникам внешних обработок (относительно workspace)
	 */
	public getEpfPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('paths.epf', 'src/epf');
	}

	/**
	 * Получает путь к исходникам внешних отчетов
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.paths.erf).
	 * По умолчанию: 'src/erf'
	 * 
	 * @returns Путь к исходникам внешних отчетов (относительно workspace)
	 */
	public getErfPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('paths.erf', 'src/erf');
	}

	/**
	 * Получает путь к исходникам расширений
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.paths.cfe).
	 * По умолчанию: 'src/cfe'
	 * 
	 * @returns Путь к исходникам расширений (относительно workspace)
	 */
	public getCfePath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('paths.cfe', 'src/cfe');
	}

	/**
	 * Проверяет, установлен ли vrunner и доступен ли он для выполнения
	 * 
	 * Выполняет команду `vrunner version` для проверки доступности.
	 * 
	 * @returns Промис, который разрешается true, если vrunner установлен и доступен, иначе false
	 */
	public async checkVRunnerInstalled(): Promise<boolean> {
		try {
			const result = await this.executeVRunner(['version']);
			return result.success && result.exitCode === 0;
		} catch {
			return false;
		}
	}

	/**
	 * Обрабатывает аргументы команды: преобразует абсолютные пути в относительные
	 * и нормализует пути для указанной оболочки
	 * 
	 * Выполняет следующие преобразования:
	 * 1. Преобразует абсолютные пути внутри workspace в относительные
	 * 2. Нормализует пути для bash оболочек на Windows (обратные слэши → прямые)
	 * 3. Сохраняет параметры команд без изменений
	 * 
	 * @param args - Массив аргументов команды
	 * @param cwd - Текущая рабочая директория для вычисления относительных путей
	 * @param shellType - Тип оболочки терминала
	 * @returns Массив обработанных аргументов с нормализованными путями
	 */
	private processCommandArgs(args: string[], cwd: string, shellType: ShellType): string[] {
		return args.map((arg) => {
			// Преобразуем абсолютные пути в относительные, если они внутри workspace
			if (this.workspaceRoot && path.isAbsolute(arg)) {
				if (fsSync.existsSync(arg) && arg.startsWith(this.workspaceRoot)) {
					let relativeArg = path.relative(cwd, arg);
					// Нормализуем путь для bash оболочек на Windows
					relativeArg = normalizeArgForShell(relativeArg, shellType);
					if (!relativeArg.startsWith('..')) {
						return relativeArg;
					}
				}
			}
			// Нормализуем аргумент для указанной оболочки
			return normalizeArgForShell(arg, shellType);
		});
	}

	/**
	 * Выполняет скрипт OneScript в терминале VS Code
	 * 
	 * Загружает скрипт из папки scripts расширения и выполняет его через OneScript.
	 * Автоматически нормализует пути для указанной оболочки.
	 * 
	 * @param scriptName - Имя скрипта в папке scripts расширения (например, 'myscript.os')
	 * @param args - Аргументы команды для передачи в скрипт
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @param options.env - Дополнительные переменные окружения
	 * @param options.name - Имя терминала (по умолчанию '1C Platform Tools')
	 * @param options.shellType - Тип оболочки (опционально, определяется автоматически)
	 * @throws {Error} Если путь к расширению не установлен (расширение не активировано)
	 */
	public executeOneScriptInTerminal(
		scriptName: string,
		args: string[],
		options?: { cwd?: string; env?: NodeJS.ProcessEnv; name?: string; shellType?: ShellType }
	): void {
		if (!this.extensionPath) {
			throw new Error('Путь к расширению не установлен. Убедитесь, что расширение активировано.');
		}

		const cwd = options?.cwd || this.workspaceRoot || process.cwd();
		const shellType = options?.shellType || detectShellType();
		const scriptPath = path.join(this.extensionPath, 'scripts', scriptName);
		const onescriptPath = this.getOnescriptPath();
		
		const processedArgs = this.processCommandArgs(args, cwd, shellType);
		const normalizedScriptPath = normalizeArgForShell(scriptPath, shellType);
		const fullArgs = [normalizedScriptPath, ...processedArgs];
		const command = buildCommand(onescriptPath, fullArgs, shellType);

		const terminal = vscode.window.createTerminal({
			name: options?.name || '1C Platform Tools',
			cwd: cwd,
			env: options?.env ? { ...process.env, ...options.env } : undefined
		});

		terminal.sendText(command);
		terminal.show();
	}

	/**
	 * Получает путь к OneScript
	 * 
	 * Путь берется из настроек VS Code (1c-platform-tools.onescriptPath).
	 * По умолчанию: 'oscript'
	 * 
	 * @returns Путь к OneScript (для поиска в PATH или абсолютный путь)
	 */
	private getOnescriptPath(): string {
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		return config.get<string>('onescriptPath', 'oscript');
	}

	/**
	 * Выполняет команду vrunner в терминале VS Code
	 * 
	 * Создает новый терминал или использует существующий, отправляет команду
	 * и показывает терминал пользователю. Автоматически обрабатывает пути
	 * и нормализует их для указанной оболочки.
	 * 
	 * @param args - Аргументы команды vrunner (например, ['init-dev', '--ibconnection', '/F./build/ib'])
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @param options.env - Дополнительные переменные окружения
	 * @param options.name - Имя терминала (по умолчанию '1C Platform Tools')
	 * @param options.shellType - Тип оболочки (опционально, определяется автоматически)
	 * 
	 * @example
	 * ```typescript
	 * vrunner.executeVRunnerInTerminal(['init-dev', ...ibConnectionParam], {
	 *   cwd: workspaceRoot,
	 *   name: 'Создание ИБ'
	 * });
	 * ```
	 */
	public executeVRunnerInTerminal(
		args: string[],
		options?: { cwd?: string; env?: NodeJS.ProcessEnv; name?: string; shellType?: ShellType }
	): void {
		const vrunnerPath = this.getVRunnerPath();
		const cwd = options?.cwd || this.workspaceRoot || os.homedir();
		const shellType = options?.shellType || detectShellType();
		
		const processedArgs = this.processCommandArgs(args, cwd, shellType);
		const command = buildCommand(vrunnerPath, processedArgs, shellType);

		const terminal = vscode.window.createTerminal({
			name: options?.name || '1C Platform Tools',
			cwd: cwd,
			env: options?.env ? { ...process.env, ...options.env } : undefined
		});

		terminal.sendText(command);
		terminal.show();
	}

	/**
	 * Выполняет команду vrunner синхронно (для проверок)
	 * 
	 * Используется для проверок и валидации, а не для выполнения команд пользователю.
	 * Для выполнения команд пользователю используйте executeVRunnerInTerminal().
	 * 
	 * @param args - Аргументы команды vrunner
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @param options.env - Дополнительные переменные окружения
	 * @returns Промис, который разрешается результатом выполнения команды
	 * 
	 * @example
	 * ```typescript
	 * const result = await vrunner.executeVRunner(['version']);
	 * if (result.success) {
	 *   // vrunner установлен и доступен
	 *   const version = result.stdout.trim();
	 * }
	 * ```
	 */
	public async executeVRunner(
		args: string[],
		options?: { cwd?: string; env?: NodeJS.ProcessEnv }
	): Promise<VRunnerExecutionResult> {
		return new Promise((resolve) => {
			const vrunnerPath = this.getVRunnerPath();
			const argsString = escapeCommandArgs(args);
			const quotedPath = vrunnerPath.includes(' ') ? `"${vrunnerPath}"` : vrunnerPath;
			const command = `${quotedPath} ${argsString}`;

			const execOptions = {
				cwd: options?.cwd || this.workspaceRoot,
				env: { ...process.env, ...options?.env },
				maxBuffer: 10 * 1024 * 1024,
				encoding: 'utf8' as BufferEncoding
			};

			exec(command, execOptions, (error, stdout, stderr) => {
				const result: VRunnerExecutionResult = {
					success: !error,
					stdout: stdout.toString(),
					stderr: stderr.toString(),
					exitCode: error ? (error.code || 1) : 0
				};

				resolve(result);
			});
		});
	}

	/**
	 * Выполняет команду opm в терминале VS Code
	 * 
	 * Создает терминал и выполняет команду opm (OneScript Package Manager).
	 * Используется для установки и управления зависимостями проекта.
	 * 
	 * @param args - Аргументы команды opm (например, ['install', '-l'])
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @param options.name - Имя терминала (по умолчанию '1C Platform Tools')
	 * @param options.shellType - Тип оболочки (опционально, определяется автоматически)
	 */
	public executeOpmInTerminal(
		args: string[],
		options?: { cwd?: string; name?: string; shellType?: ShellType }
	): void {
		const opmPath = this.getOpmPath();
		const shellType = options?.shellType || detectShellType();
		const cwd = options?.cwd || this.workspaceRoot || os.homedir();
		const processedArgs = this.processCommandArgs(args, cwd, shellType);
		const command = buildCommand(opmPath, processedArgs, shellType);

		const terminal = vscode.window.createTerminal({
			name: options?.name || '1C Platform Tools',
			cwd: cwd
		});

		terminal.sendText(command);
		terminal.show();
	}

	/**
	 * Выполняет команду opm синхронно (для проверок)
	 * 
	 * Используется для проверок и валидации, а не для выполнения команд пользователю.
	 * Для выполнения команд пользователю используйте executeOpmInTerminal().
	 * 
	 * @param args - Аргументы команды opm
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @returns Промис, который разрешается результатом выполнения команды
	 */
	public async executeOpm(
		args: string[],
		options?: { cwd?: string }
	): Promise<VRunnerExecutionResult> {
		return new Promise((resolve) => {
			const opmPath = this.getOpmPath();
			const argsString = escapeCommandArgs(args);
			const quotedPath = opmPath.includes(' ') ? `"${opmPath}"` : opmPath;
			const command = `${quotedPath} ${argsString}`;

			const execOptions = {
				cwd: options?.cwd || this.workspaceRoot,
				maxBuffer: 10 * 1024 * 1024,
				encoding: 'utf8' as BufferEncoding
			};

			exec(command, execOptions, (error, stdout, stderr) => {
				const result: VRunnerExecutionResult = {
					success: !error,
					stdout: stdout.toString(),
					stderr: stderr.toString(),
					exitCode: error ? (error.code || 1) : 0
				};

				resolve(result);
			});
		});
	}

	/**
	 * Выполняет команду allure в терминале VS Code
	 * 
	 * Создает терминал и выполняет команду allure для генерации и просмотра отчетов.
	 * Автоматически обрабатывает пути и нормализует их для указанной оболочки.
	 * 
	 * @param args - Аргументы команды allure (например, ['generate', '-c', '-o', 'build/allure-report'])
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @param options.name - Имя терминала (по умолчанию '1C Platform Tools')
	 * @param options.shellType - Тип оболочки (опционально, определяется автоматически)
	 */
	public executeAllureInTerminal(
		args: string[],
		options?: { cwd?: string; name?: string; shellType?: ShellType }
	): void {
		const allurePath = this.getAllurePath();
		const shellType = options?.shellType || detectShellType();
		const processedArgs = this.processCommandArgs(args, options?.cwd || this.workspaceRoot || os.homedir(), shellType);
		const command = buildCommand(allurePath, processedArgs, shellType);
		const cwd = options?.cwd || this.workspaceRoot || os.homedir();

		const terminal = vscode.window.createTerminal({
			name: options?.name || '1C Platform Tools',
			cwd: cwd
		});

		terminal.sendText(command);
		terminal.show();
	}

	/**
	 * Выполняет команду allure синхронно (для проверок)
	 * 
	 * Используется для проверок и валидации, а не для выполнения команд пользователю.
	 * Для выполнения команд пользователю используйте executeAllureInTerminal().
	 * 
	 * @param args - Аргументы команды allure
	 * @param options - Опции выполнения
	 * @param options.cwd - Рабочая директория (по умолчанию workspace root)
	 * @returns Промис, который разрешается результатом выполнения команды
	 */
	public async executeAllure(
		args: string[],
		options?: { cwd?: string }
	): Promise<VRunnerExecutionResult> {
		return new Promise((resolve) => {
			const allurePath = this.getAllurePath();
			const argsString = escapeCommandArgs(args);
			const quotedPath = allurePath.includes(' ') ? `"${allurePath}"` : allurePath;
			const command = `${quotedPath} ${argsString}`;

			const execOptions = {
				cwd: options?.cwd || this.workspaceRoot,
				maxBuffer: 10 * 1024 * 1024,
				encoding: 'utf8' as BufferEncoding
			};

			exec(command, execOptions, (error, stdout, stderr) => {
				const result: VRunnerExecutionResult = {
					success: !error,
					stdout: stdout.toString(),
					stderr: stderr.toString(),
					exitCode: error ? (error.code || 1) : 0
				};

				resolve(result);
			});
		});
	}

	/**
	 * Читает и парсит env.json из корня workspace
	 * 
	 * Файл env.json используется для хранения параметров подключения к ИБ
	 * и других настроек проекта.
	 * 
	 * @returns Промис, который разрешается содержимым env.json или пустым объектом при ошибке
	 * @throws {Error} Если рабочая область не открыта
	 * 
	 * @example
	 * ```typescript
	 * const env = await vrunner.readEnvJson();
	 * const ibConnection = env.default?.['--ibconnection'];
	 * ```
	 */
	public async readEnvJson(): Promise<any> {
		if (!this.workspaceRoot) {
			throw new Error('Рабочая область не открыта');
		}

		const envPath = path.join(this.workspaceRoot, 'env.json');
		try {
			const content = await fs.readFile(envPath, 'utf8');
			return JSON.parse(content);
		} catch {
			return {};
		}
	}

	/**
	 * Записывает данные в файл env.json в корне workspace
	 * 
	 * Данные записываются в формате JSON с отступами (2 пробела).
	 * Существующий файл будет перезаписан.
	 * 
	 * @param data - Данные для записи (объект, который будет сериализован в JSON)
	 * @returns Промис, который разрешается после записи файла
	 * @throws {Error} Если рабочая область не открыта
	 */
	public async writeEnvJson(data: any): Promise<void> {
		if (!this.workspaceRoot) {
			throw new Error('Рабочая область не открыта');
		}

		const envPath = path.join(this.workspaceRoot, 'env.json');
		const content = JSON.stringify(data, null, 2);
		await fs.writeFile(envPath, content, 'utf8');
	}

	/**
	 * Получает параметр --settings для команды vrunner
	 * 
	 * Используется для указания файла настроек при выполнении команд vrunner.
	 * 
	 * @param settingsFile - Путь к файлу настроек (относительно workspace). По умолчанию 'env.json'
	 * @returns Массив параметров ['--settings', 'путь_к_файлу']
	 * 
	 * @example
	 * ```typescript
	 * const settingsParam = vrunner.getSettingsParam('env.json');
	 * // Вернет: ['--settings', 'env.json']
	 * ```
	 */
	public getSettingsParam(settingsFile: string = 'env.json'): string[] {
		return ['--settings', settingsFile];
	}

	/**
	 * Получает параметр --ibconnection для команды vrunner
	 * 
	 * Порядок определения значения:
	 * 1. Если передан ibConnection, используется он
	 * 2. Ищет в env.json в секции default['--ibconnection']
	 * 3. Использует значение по умолчанию '/F./build/ib'
	 * 
	 * @param ibConnection - Строка подключения к ИБ. Если указана, используется напрямую
	 * @param settingsFile - Путь к файлу настроек (относительно workspace). По умолчанию 'env.json'
	 * @returns Промис, который разрешается массивом параметров ['--ibconnection', 'строка_подключения']
	 * 
	 * @example
	 * ```typescript
	 * const ibParam = await vrunner.getIbConnectionParam();
	 * // Вернет: ['--ibconnection', '/F./build/ib']
	 * 
	 * // Использование с spread оператором
	 * const args = ['init-dev', ...ibParam];
	 * ```
	 */
	public async getIbConnectionParam(ibConnection?: string, settingsFile: string = 'env.json'): Promise<string[]> {
		if (ibConnection) {
			return ['--ibconnection', ibConnection];
		}

		if (this.workspaceRoot) {
			const absoluteSettingsPath = path.isAbsolute(settingsFile)
				? settingsFile
				: path.join(this.workspaceRoot, settingsFile);

			try {
				const content = await fs.readFile(absoluteSettingsPath, 'utf8');
				const env = JSON.parse(content);
				
				if (env.default && typeof env.default['--ibconnection'] === 'string') {
					return ['--ibconnection', env.default['--ibconnection']];
				}
			} catch {
			}
		}

		return ['--ibconnection', '/F./build/ib'];
	}

	/**
	 * Получает путь к корню workspace
	 * 
	 * @returns Путь к workspace или undefined, если workspace не открыт
	 */
	public getWorkspaceRoot(): string | undefined {
		return this.workspaceRoot;
	}

	/**
	 * Получает путь к директории расширения
	 * 
	 * Используется для доступа к ресурсам расширения (скрипты, шаблоны, иконки).
	 * 
	 * @returns Путь к расширению или undefined, если расширение не активировано
	 */
	public getExtensionPath(): string | undefined {
		return this.extensionPath;
	}
}
