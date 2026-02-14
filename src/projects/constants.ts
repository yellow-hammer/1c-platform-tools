/**
 * Константы модуля «Проекты 1С» (по образцу Project Manager).
 */

export const PROJECTS_FILE = 'projects.json';

export enum CommandLocation {
	CommandPalette = 0,
	SideBar = 1,
	StatusBar = 2,
}

export enum OpenInCurrentWindowIfEmptyMode {
	always = 'always',
	onlyUsingCommandPalette = 'onlyUsingCommandPalette',
	onlyUsingSideBar = 'onlyUsingSideBar',
	never = 'never',
}

export enum ConfirmSwitchOnActiveWindowMode {
	never = 'never',
	onlyUsingCommandPalette = 'onlyUsingCommandPalette',
	onlyUsingSideBar = 'onlyUsingSideBar',
	always = 'always',
}

/** Специальный тег для проектов без тегов. */
export const NO_TAGS_DEFINED = '(без тегов)';
