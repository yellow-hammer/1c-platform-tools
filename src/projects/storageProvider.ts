/**
 * TreeDataProvider для «Избранное» (projects.json) — по образцу Project Manager.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { expandHomePath } from './pathUtils';
import { sortProjects } from './sorter';
import { NO_TAGS_DEFINED } from './constants';
import { ProjectStorage } from './storage';
import { ProjectsStack } from './stack';
import { NoTagNode, ProjectNode, TagNode } from './nodes';

interface ProjectInQuickPick {
	label: string;
	description: string;
}

function getDuplicateLabels(labels: string[]): Set<string> {
	const counts = new Map<string, number>();
	for (const lb of labels) {
		const key = lb.toLowerCase();
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const duplicates = new Set<string>();
	for (const [key, n] of counts) {
		if (n > 1) duplicates.add(key);
	}
	return duplicates;
}

export class StorageProvider implements vscode.TreeDataProvider<ProjectNode | TagNode> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private static readonly TAGS_EXPANSION_STATE_KEY = '1c-platform-tools.projects.favorites.tagsExpansionState';

	constructor(
		private readonly projectSource: ProjectStorage,
		private readonly context: vscode.ExtensionContext,
		private readonly stack: ProjectsStack
	) {}

	private static getTagExpansionState(context: vscode.ExtensionContext): Record<string, boolean> {
		return context.globalState.get<Record<string, boolean>>(StorageProvider.TAGS_EXPANSION_STATE_KEY, {});
	}

	static async resetTagExpansionState(context: vscode.ExtensionContext): Promise<void> {
		await context.globalState.update(StorageProvider.TAGS_EXPANSION_STATE_KEY, {});
	}

	static getTagCollapsibleState(
		context: vscode.ExtensionContext,
		tagId: string,
		behavior: string
	): vscode.TreeItemCollapsibleState {
		switch (behavior) {
			case 'alwaysExpanded':
				return vscode.TreeItemCollapsibleState.Expanded;
			case 'alwaysCollapsed':
				return vscode.TreeItemCollapsibleState.Collapsed;
			case 'startExpanded':
			case 'startCollapsed': {
				const state = StorageProvider.getTagExpansionState(context);
				const isExpanded = state[tagId];
				if (isExpanded === undefined) {
					return behavior === 'startExpanded'
						? vscode.TreeItemCollapsibleState.Expanded
						: vscode.TreeItemCollapsibleState.Collapsed;
				}
				return isExpanded ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed;
			}
			default:
				return vscode.TreeItemCollapsibleState.Expanded;
		}
	}

	static async setTagExpanded(
		context: vscode.ExtensionContext,
		tagId: string,
		expanded: boolean
	): Promise<void> {
		const state = StorageProvider.getTagExpansionState(context);
		await context.globalState.update(StorageProvider.TAGS_EXPANSION_STATE_KEY, { ...state, [tagId]: expanded });
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ProjectNode | TagNode): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: ProjectNode | TagNode): Promise<(ProjectNode | TagNode)[]> {
		if (element) {
			const projectsMapped = this.projectSource.getProjectsByTag(element.label as string);
			const sorted = sortProjects(projectsMapped, this.stack);
			const duplicateNames = getDuplicateLabels(sorted.map((p) => p.label));
			return sorted.map((prj) => {
				const fullPath = expandHomePath(prj.description);
				const project = this.projectSource.getProjectByName(prj.label);
				return new ProjectNode(prj.label, vscode.TreeItemCollapsibleState.None, 'favorites', {
					name: prj.label,
					path: fullPath,
					detail: duplicateNames.has(prj.label.toLowerCase())
				? path.basename(path.dirname(fullPath))
				: undefined,
				tags: project?.tags,
				}, {
					command: '1c-platform-tools.projects._open',
					title: '',
					arguments: [fullPath, prj.label],
				});
			});
		}

		if (this.projectSource.length() === 0) {
			return [];
		}

		const viewAsList = this.context.globalState.get<boolean>('1c-platform-tools.projects.viewAsList', true);
		const config = vscode.workspace.getConfiguration('1c-platform-tools');
		const tagsCollapseBehavior = config.get<string>('projects.tags.collapseItems', 'startExpanded');

		if (!viewAsList) {
			const tags = this.projectSource.getAvailableTags().sort();
			if (tags.length === 0 && this.projectSource.getProjectsByTag('').length === 0) {
				// Нет тегов — показываем как список
			} else {
				const nodes: TagNode[] = [];
				for (const tag of tags) {
					nodes.push(new TagNode(tag, StorageProvider.getTagCollapsibleState(this.context, tag, tagsCollapseBehavior)));
				}
				if (this.projectSource.getProjectsByTag('').length > 0) {
					nodes.push(
						new NoTagNode(
							NO_TAGS_DEFINED,
							StorageProvider.getTagCollapsibleState(this.context, NO_TAGS_DEFINED, tagsCollapseBehavior)
						)
					);
				}
				const filterByTags = this.context.globalState.get<string[]>('1c-platform-tools.projects.filterByTags', []);
				if (filterByTags.length > 0) {
					return nodes.filter((n) =>
						n instanceof NoTagNode
							? filterByTags.includes(NO_TAGS_DEFINED)
							: filterByTags.includes(n.label as string)
					);
				}
				return nodes;
			}
		}

		const filterByTags = this.context.globalState.get<string[]>('1c-platform-tools.projects.filterByTags', []);
		let projectsMapped: ProjectInQuickPick[];
		if (filterByTags.length > 0) {
			projectsMapped = this.projectSource.getProjectsByTags(filterByTags);
		} else {
			projectsMapped = this.projectSource.map();
		}
		const sorted = sortProjects(projectsMapped, this.stack);
		const duplicateNames = getDuplicateLabels(sorted.map((p) => p.label));
		return sorted.map((prj) => {
			const fullPath = expandHomePath(prj.description);
			const project = this.projectSource.getProjectByName(prj.label);
				return new ProjectNode(prj.label, vscode.TreeItemCollapsibleState.None, 'favorites', {
					name: prj.label,
					path: fullPath,
					detail: duplicateNames.has(prj.label.toLowerCase())
						? path.basename(path.dirname(fullPath))
						: undefined,
					tags: project?.tags,
				}, {
				command: '1c-platform-tools.projects._open',
				title: '',
				arguments: [fullPath, prj.label],
			});
		});
	}
}
