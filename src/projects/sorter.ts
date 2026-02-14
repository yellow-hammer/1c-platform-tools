/**
 * Сортировка проектов (по образцу Project Manager).
 */

import * as vscode from 'vscode';
import type { ProjectsStack } from './stack';

interface QuickPickItemLike {
	label: string;
	description: string;
}

function sortByName(items: QuickPickItemLike[]): QuickPickItemLike[] {
	return [...items].sort((a, b) =>
		a.label.toLowerCase().localeCompare(b.label.toLowerCase(), undefined, { sensitivity: 'base' })
	);
}

function sortByPath(items: QuickPickItemLike[]): QuickPickItemLike[] {
	return [...items].sort((a, b) =>
		(a.description ?? '').toLowerCase().localeCompare((b.description ?? '').toLowerCase(), undefined, {
			sensitivity: 'base',
		})
	);
}

function sortByRecent(items: QuickPickItemLike[], stack: ProjectsStack): QuickPickItemLike[] {
	if (stack.length() === 0) {
		return items;
	}
	const result = [...items];
	for (let i = 0; i < stack.length(); i++) {
		const name = stack.getItem(i);
		const found = result.findIndex((item) => item.label === name);
		if (found >= 0) {
			const [removed] = result.splice(found, 1);
			result.unshift(removed);
		}
	}
	return result;
}

export function sortProjects(items: QuickPickItemLike[], stack: ProjectsStack): QuickPickItemLike[] {
	const config = vscode.workspace.getConfiguration('1c-platform-tools');
	const criteria = config.get<'Saved' | 'Name' | 'Path' | 'Recent'>('projects.sortList', 'Name');
	switch (criteria) {
		case 'Path':
			return sortByPath(items);
		case 'Saved':
			return items;
		case 'Recent':
			return sortByRecent(items, stack);
		default:
			return sortByName(items);
	}
}
