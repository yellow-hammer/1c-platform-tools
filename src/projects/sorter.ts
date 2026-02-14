/**
 * Сортировка списка проектов для отображения.
 */

import * as vscode from 'vscode';
import type { ProjectsStack } from './stack';

type ListItem = { label: string; description: string };

function byLabel(a: ListItem, b: ListItem): number {
	return (a.label ?? '').toLowerCase().localeCompare((b.label ?? '').toLowerCase(), undefined, {
		sensitivity: 'base',
	});
}

function byPath(a: ListItem, b: ListItem): number {
	return (a.description ?? '').toLowerCase().localeCompare((b.description ?? '').toLowerCase(), undefined, {
		sensitivity: 'base',
	});
}

/** Сортировка по «недавним»: элементы из recent-списка выводятся впереди в его порядке. */
function byRecentOrder(items: ListItem[], recent: ProjectsStack): ListItem[] {
	const order = new Map<string, number>();
	let idx = 0;
	for (let i = 0; i < recent.size(); i++) {
		const name = recent.at(i);
		if (name && !order.has(name)) {order.set(name, idx++);}
	}
	const head: ListItem[] = [];
	const tail: ListItem[] = [];
	for (const it of items) {
		const pos = order.get(it.label);
		if (pos !== undefined) {head.push(it);}
		else {tail.push(it);}
	}
	head.sort((a, b) => (order.get(a.label) ?? 0) - (order.get(b.label) ?? 0));
	return [...head, ...tail];
}

export function sortProjects(items: ListItem[], recent: ProjectsStack): ListItem[] {
	const cfg = vscode.workspace.getConfiguration('1c-platform-tools');
	const mode = cfg.get<string>('projects.sortList', 'Name');
	const copy = [...items];
	if (mode === 'Path') {return copy.sort(byPath);}
	if (mode === 'Saved') {return copy;}
	if (mode === 'Recent') {return byRecentOrder(copy, recent);}
	return copy.sort(byLabel);
}
