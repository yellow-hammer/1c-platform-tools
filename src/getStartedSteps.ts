/**
 * Шаги панели «Начало работы» — порядок из раздела «Зависимости», без «Удалить зависимости».
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { VRunnerManager } from './vrunnerManager';
import { PROJECT_STRUCTURE } from './projectStructure';

export interface GetStartedStep {
	id: string;
	command: string;
	label: string;
	/** Краткое описание для отображения под заголовком шага */
	description: string;
}

/** Шаги в порядке выполнения для нового проекта */
export const GET_STARTED_STEPS: GetStartedStep[] = [
	{ id: 'init-packagedef', command: '1c-platform-tools.dependencies.initializePackagedef', label: 'Инициализировать проект', description: 'Создаёт файл packagedef в корне проекта — список зависимостей и настройки окружения (OneScript и др.).' },
	{ id: 'init-structure', command: '1c-platform-tools.dependencies.initializeProjectStructure', label: 'Инициализировать структуру проекта', description: 'Создаёт каталоги по шаблону vanessa-bootstrap: doc, src/cf, src/cfe, features, tests и др. с README в каждом.' },
	{ id: 'setup-git', command: '1c-platform-tools.dependencies.setupGit', label: 'Настроить Git', description: 'Задаёт имя и email для коммитов в репозитории проекта.' },
	{ id: 'install-oscript', command: '1c-platform-tools.dependencies.installOscript', label: 'Установить OneScript', description: 'Устанавливает OneScript (oscript) через OVM — нужен для vrunner, opm и скриптов.' },
	{ id: 'install-opm', command: '1c-platform-tools.dependencies.updateOpm', label: 'Установить OPM', description: 'Устанавливает менеджер пакетов OPM для загрузки зависимостей из packagedef.' },
	{ id: 'install-deps', command: '1c-platform-tools.dependencies.install', label: 'Установить зависимости', description: 'Выполняет opm install -l — ставит все зависимости, перечисленные в packagedef (в т.ч. vanessa-runner).' },
];

/**
 * Проверяет, выполнены ли шаги (есть ли packagedef, структура, .git, oscript, opm, зависимости).
 * @param workspaceRoot — корень workspace
 * @param vrunner — менеджер vrunner для проверки oscript/opm
 * @returns массив boolean в порядке GET_STARTED_STEPS
 */
export async function getStepCompletion(
	workspaceRoot: string,
	vrunner: VRunnerManager
): Promise<boolean[]> {
	const hasPackagedef = await fs.access(path.join(workspaceRoot, 'packagedef')).then(() => true, () => false);

	let hasStructure = false;
	try {
		await fs.access(path.join(workspaceRoot, 'src', 'cf'));
		hasStructure = true;
	} catch {
		for (const item of PROJECT_STRUCTURE) {
			try {
				await fs.access(path.join(workspaceRoot, item.path));
				hasStructure = true;
				break;
			} catch {
				// continue
			}
		}
	}

	const hasGit = await fs.access(path.join(workspaceRoot, '.git')).then(() => true, () => false);
	const hasOscript = await vrunner.checkOscriptAvailable();
	const hasOpm = await vrunner.checkOpmAvailable();

	let hasDeps = false;
	try {
		const entries = await fs.readdir(path.join(workspaceRoot, 'oscript_modules'));
		hasDeps = entries.length > 0;
	} catch {
		// ignore
	}

	return [hasPackagedef, hasStructure, hasGit, hasOscript, hasOpm, hasDeps];
}
