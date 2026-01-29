import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { BaseCommand } from './baseCommand';
import {
	getLoadConfigurationFromSrcCommandName,
	getLoadConfigurationFromCfCommandName,
	getDumpConfigurationToSrcCommandName,
	getDumpConfigurationIncrementToSrcCommandName,
	getDumpConfigurationToCfCommandName,
	getDumpConfigurationToDistCommandName,
	getBuildConfigurationCommandName,
	getDecompileConfigurationCommandName,
	getLoadConfigurationIncrementFromSrcCommandName,
	getLoadConfigurationFromFilesByListCommandName
} from '../commandNames';

/**
 * Команды для работы с конфигурацией
 */
export class ConfigurationCommands extends BaseCommand {

	/**
	 * Загружает конфигурацию из исходников в информационную базу
	 * @param mode - Режим загрузки: 'init' для инициализации, 'update' для обновления
	 * @returns Промис, который разрешается после запуска команды
	 */
	async loadFromSrc(mode: 'init' | 'update' = 'update'): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const command = mode === 'init' ? 'init-dev' : 'update-dev';
		const srcPath = this.vrunner.getCfPath();
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = this.addIbcmdIfNeeded([command, '--src', srcPath, ...ibConnectionParam]);
		const commandName = getLoadConfigurationFromSrcCommandName(mode);

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Загружает конфигурацию из .cf файла в информационную базу
	 * @returns Промис, который разрешается после запуска команды
	 */
	async loadFromCf(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const buildPath = this.vrunner.getOutPath();
		const cfFilePath = path.join(buildPath, '1Cv8.cf');
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = this.addIbcmdIfNeeded(['load', '--src', cfFilePath, ...ibConnectionParam]);
		const commandName = getLoadConfigurationFromCfCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Выгружает конфигурацию из информационной базы в исходники
	 * @returns Промис, который разрешается после запуска команды
	 */
	async dumpToSrc(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const srcPath = this.vrunner.getCfPath();
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = this.addIbcmdIfNeeded(['decompile', '--current', '--out', srcPath, ...ibConnectionParam]);
		const commandName = getDumpConfigurationToSrcCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Выгружает только изменения конфигурации из информационной базы в исходники
	 * Использует файл ConfigDumpInfo.xml для определения измененных объектов
	 * Если файл версии отсутствует, выполняется полная выгрузка
	 * @returns Промис, который разрешается после запуска команды
	 */
	async dumpIncrementToSrc(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const srcPath = this.vrunner.getCfPath();
		const srcFullPath = path.join(workspaceRoot, srcPath);
		const configDumpInfoPath = path.join(srcFullPath, 'ConfigDumpInfo.xml');
		
		const versionFileExists = await this.checkVersionFileExists(configDumpInfoPath);
		
		if (!versionFileExists && !(await this.handleMissingVersionFile(srcFullPath, srcPath))) {
			return;
		}

		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args: string[] = ['decompile', '--current', '--out', srcPath, ...ibConnectionParam];
		
		if (versionFileExists) {
			const versionFileRelativePath = path.join(srcPath, 'ConfigDumpInfo.xml');
			args.push('--versions', versionFileRelativePath);
		}

		const finalArgs = this.addIbcmdIfNeeded(args);
		const commandName = getDumpConfigurationIncrementToSrcCommandName();

		this.vrunner.executeVRunnerInTerminal(finalArgs, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Проверяет существование файла версии ConfigDumpInfo.xml
	 * @param configDumpInfoPath - Полный путь к файлу ConfigDumpInfo.xml
	 * @returns Промис, который разрешается true, если файл существует, иначе false
	 */
	private async checkVersionFileExists(configDumpInfoPath: string): Promise<boolean> {
		try {
			await fs.access(configDumpInfoPath);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Обрабатывает ситуацию, когда файл версии отсутствует
	 * Если каталог не пуст, предлагает пользователю очистить его или отменить операцию
	 * @param srcFullPath - Полный путь к каталогу исходников
	 * @param srcPath - Относительный путь к каталогу исходников
	 * @returns Промис, который разрешается true, если операция может быть продолжена, иначе false
	 */
	private async handleMissingVersionFile(srcFullPath: string, srcPath: string): Promise<boolean> {
		try {
			const entries = await fs.readdir(srcFullPath);
			const hasFiles = entries.some(entry => entry !== 'ConfigDumpInfo.xml');
			
			if (!hasFiles) {
				return true;
			}

			const action = await vscode.window.showWarningMessage(
				`Файл ConfigDumpInfo.xml не найден в каталоге ${srcPath}. Для инкрементальной выгрузки необходим файл версии. Выполните сначала полную выгрузку через "Выгрузить конфигурацию в src/cf".`,
				'Выполнить полную выгрузку (очистить каталог)',
				'Отмена'
			);

			if (action === 'Отмена' || action === undefined) {
				return false;
			}

			if (action === 'Выполнить полную выгрузку (очистить каталог)') {
				await this.clearDirectory(srcFullPath, entries);
				return true;
			}

			return false;
		} catch {
			return true;
		}
	}

	/**
	 * Очищает каталог от всех файлов и подкаталогов
	 * @param dirPath - Путь к каталогу
	 * @param entries - Список записей в каталоге
	 */
	private async clearDirectory(dirPath: string, entries: string[]): Promise<void> {
		for (const entry of entries) {
			const entryPath = path.join(dirPath, entry);
			const stat = await fs.stat(entryPath);
			if (stat.isDirectory()) {
				await fs.rm(entryPath, { recursive: true, force: true });
			} else {
				await fs.unlink(entryPath);
			}
		}
	}

	/**
	 * Выгружает конфигурацию из информационной базы в .cf файл
	 * @returns Промис, который разрешается после запуска команды
	 */
	async dumpToCf(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const buildPath = this.vrunner.getOutPath();
		const buildFullPath = path.join(workspaceRoot, buildPath);
		if (!(await this.ensureDirectoryExists(buildFullPath, `Ошибка при создании папки ${buildPath}`))) {
			return;
		}

		const outputPath = path.join(buildPath, '1Cv8.cf');
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = this.addIbcmdIfNeeded(['unload', outputPath, ...ibConnectionParam]);
		const commandName = getDumpConfigurationToCfCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Выгружает файл поставки в 1Cv8dist.cf
	 * @returns Промис, который разрешается после запуска команды
	 */
	async dumpToDist(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const buildPath = this.vrunner.getOutPath();
		const buildFullPath = path.join(workspaceRoot, buildPath);
		if (!(await this.ensureDirectoryExists(buildFullPath, `Ошибка при создании папки ${buildPath}`))) {
			return;
		}

		const outputPath = path.join(buildPath, '1Cv8dist.cf');
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = ['make-dist', outputPath, ...ibConnectionParam];
		const commandName = getDumpConfigurationToDistCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Собирает .cf файл из исходников
	 * @returns Промис, который разрешается после запуска команды
	 */
	async compile(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const srcPath = this.vrunner.getCfPath();
		const buildPath = this.vrunner.getOutPath();
		const buildFullPath = path.join(workspaceRoot, buildPath);
		if (!(await this.ensureDirectoryExists(buildFullPath, `Ошибка при создании папки ${buildPath}`))) {
			return;
		}

		const outputPath = path.join(buildPath, '1Cv8.cf');
		const args = this.addIbcmdIfNeeded(['compile', '--src', srcPath, '--out', outputPath]);
		const commandName = getBuildConfigurationCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Разбирает .cf файл в исходники
	 * @returns Промис, который разрешается после запуска команды
	 */
	async decompile(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const buildPath = this.vrunner.getOutPath();
		const inputPath = path.join(buildPath, '1Cv8.cf');
		const srcPath = this.vrunner.getCfPath();
		const args = this.addIbcmdIfNeeded(['decompile', '--in', inputPath, '--out', srcPath]);
		const commandName = getDecompileConfigurationCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Загружает конфигурацию инкрементально из исходников с использованием git diff
	 * Перед выполнением запрашивает SHA коммита для записи в lastUploadedCommit.txt
	 * @returns Промис, который разрешается после запуска команды
	 */
	async loadIncrementFromSrc(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const srcPath = this.vrunner.getCfPath();
		const lastUploadedCommitPath = path.join(workspaceRoot, srcPath, 'lastUploadedCommit.txt');

		let currentSha = '';
		try {
			const content = await fs.readFile(lastUploadedCommitPath, 'utf-8');
			currentSha = content.trim();
		} catch {
			// Файл не существует, это нормально - будет полная загрузка
		}

		const shaInput = await vscode.window.showInputBox({
			prompt: 'Введите SHA коммита для инкрементальной загрузки',
			placeHolder: 'Оставьте пустым для полной загрузки',
			value: currentSha,
			ignoreFocusOut: true
		});

		if (shaInput === undefined) {
			return;
		}

		try {
			const srcFullPath = path.join(workspaceRoot, srcPath);
			if (!(await this.ensureDirectoryExists(srcFullPath, `Ошибка при создании папки ${srcPath}`))) {
				return;
			}

			await fs.writeFile(lastUploadedCommitPath, shaInput.trim(), 'utf-8');
		} catch (error) {
			vscode.window.showErrorMessage(
				`Не удалось записать SHA в файл ${lastUploadedCommitPath}: ${(error as Error).message}`
			);
			return;
		}

		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const args = this.addIbcmdIfNeeded([
			'update-dev',
			'--src',
			srcPath,
			'--git-increment',
			...ibConnectionParam
		]);
		const commandName = getLoadConfigurationIncrementFromSrcCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}

	/**
	 * Загружает объекты конфигурации из файлов по списку объектов в objlist.txt
	 * Использует пакетный режим конфигуратора для загрузки объектов из исходников
	 * @returns Промис, который разрешается после запуска команды
	 */
	async loadFromFilesByList(): Promise<void> {
		const workspaceRoot = this.ensureWorkspace();
		if (!workspaceRoot) {
			return;
		}

		const objlistPath = path.join(workspaceRoot, 'objlist.txt');
		
		try {
			await fs.access(objlistPath);
		} catch {
			vscode.window.showErrorMessage(
				'Файл objlist.txt не найден в корне проекта. Создайте файл со списком полных путей к объектам для загрузки.'
			);
			return;
		}

		const srcPath = this.vrunner.getCfPath();
		const ibConnectionParam = await this.vrunner.getIbConnectionParam();
		const additionalParam = `/LoadConfigFromFiles ${srcPath} -listFile objlist.txt`;
		const args = ['designer', '--additional', additionalParam, ...ibConnectionParam];
		const commandName = getLoadConfigurationFromFilesByListCommandName();

		this.vrunner.executeVRunnerInTerminal(args, {
			cwd: workspaceRoot,
			name: commandName.title
		});
	}
}
