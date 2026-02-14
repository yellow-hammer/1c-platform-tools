/**
 * Хранилище проектов в projects.json (по образцу Project Manager).
 */

import * as fs from 'node:fs';
import { createProject, type Project } from './project';
import { NO_TAGS_DEFINED } from './constants';
import { expandHomePath, updateWithPathSeparatorStr } from './pathUtils';

export class ProjectStorage {
	private projects: Project[] = [];

	constructor(private readonly filename: string) {}

	push(name: string, rootPath: string): void {
		this.projects.push(createProject(name, rootPath));
	}

	pop(name: string): Project | undefined {
		const idx = this.projects.findIndex((p) => p.name.toLowerCase() === name.toLowerCase());
		if (idx >= 0) {
			return this.projects.splice(idx, 1)[0];
		}
		return undefined;
	}

	rename(oldName: string, newName: string): void {
		const p = this.projects.find((e) => e.name.toLowerCase() === oldName.toLowerCase());
		if (p) {
			p.name = newName;
		}
	}

	editTags(name: string, tags: string[]): void {
		const p = this.projects.find((e) => e.name.toLowerCase() === name.toLowerCase());
		if (p) {
			p.tags = tags;
		}
	}

	toggleEnabled(name: string): boolean | undefined {
		const p = this.projects.find((e) => e.name.toLowerCase() === name.toLowerCase());
		if (p) {
			p.enabled = !p.enabled;
			return p.enabled;
		}
		return undefined;
	}

	disabled(): Project[] {
		return this.projects.filter((p) => !p.enabled);
	}

	updateRootPath(name: string, newPath: string): void {
		const p = this.projects.find((e) => e.name.toLowerCase() === name.toLowerCase());
		if (p) {
			p.rootPath = newPath;
		}
	}

	exists(name: string): boolean {
		return this.projects.some((p) => p.name.toLowerCase() === name.toLowerCase());
	}

	getProjectByName(name: string): Project | undefined {
		return this.projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
	}

	existsWithRootPath(rootPath: string, returnExpandedPath = false): Project | undefined {
		const norm = rootPath.toLowerCase();
		for (const p of this.projects) {
			const expanded = expandHomePath(p.rootPath);
			if (expanded.toLowerCase() === norm || expanded === rootPath) {
				return returnExpandedPath ? { ...p, rootPath: expanded } : p;
			}
		}
		return undefined;
	}

	length(): number {
		return this.projects.length;
	}

	load(): string {
		if (!fs.existsSync(this.filename)) {
			return '';
		}
		try {
			const raw = fs.readFileSync(this.filename, 'utf8');
			const items = JSON.parse(raw) as unknown[];
			if (!Array.isArray(items) || items.length === 0) {
				return '';
			}
			// Старый формат v1: { label, description }
			if (typeof items[0] === 'object' && items[0] !== null && 'label' in (items[0] as object)) {
				for (const el of items as Array<{ label: string; description: string }>) {
					this.projects.push(createProject(el.label, el.description));
				}
				this.save();
			} else {
				this.projects = (items as Array<Partial<Project>>).map((item) => ({
					name: item.name ?? '',
					rootPath: item.rootPath ?? '',
					paths: item.paths ?? [],
					tags: item.tags ?? [],
					enabled: item.enabled ?? true,
				}));
				for (const p of this.projects) {
					p.rootPath = updateWithPathSeparatorStr(p.rootPath);
				}
			}
			return '';
		} catch (err) {
			return err instanceof Error ? err.message : String(err);
		}
	}

	save(): void {
		const dir = this.filename.substring(0, this.filename.lastIndexOf('/') || this.filename.lastIndexOf('\\'));
		if (dir && !fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(this.filename, JSON.stringify(this.projects, null, '\t'), 'utf8');
	}

	/** Для QuickPick: label, description. */
	map(): Array<{ label: string; description: string }> {
		return this.projects
			.filter((p) => p.enabled)
			.map((p) => ({
				label: p.name,
				description: expandHomePath(p.rootPath),
			}));
	}

	getAvailableTags(): string[] {
		const tags = new Set<string>();
		for (const p of this.projects) {
			for (const t of p.tags) {
				tags.add(t);
			}
		}
		return [...tags].sort();
	}

	getProjectsByTag(tag: string): Array<{ label: string; description: string }> {
		const filtered = this.projects.filter(
			(p) =>
				p.enabled &&
				(tag === '' ? p.tags.length === 0 : p.tags.includes(tag))
		);
		return filtered.map((p) => ({
			label: p.name,
			description: expandHomePath(p.rootPath),
		}));
	}

	getProjectsByTags(tags: string[]): Array<{ label: string; description: string }> {
		const filtered = this.projects.filter(
			(p) =>
				p.enabled &&
				(tags.length === 0 ||
					p.tags.some((t) => tags.includes(t)) ||
					(tags.includes(NO_TAGS_DEFINED) && p.tags.length === 0))
		);
		return filtered.map((p) => ({
			label: p.name,
			description: expandHomePath(p.rootPath),
		}));
	}
}
