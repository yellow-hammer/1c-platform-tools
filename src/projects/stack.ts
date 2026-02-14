/**
 * Стек недавно открытых проектов (по образцу Project Manager).
 */

export class ProjectsStack {
	private items: string[] = [];
	private readonly maxSize = 10;
	private readonly key = '1c-platform-tools.projects.recent';

	constructor(
		private readonly getStored: (key: string) => string | undefined,
		private readonly setStored: (key: string, value: string) => Thenable<void>
	) {
		const raw = getStored(this.key);
		if (raw) {
			try {
				this.items = JSON.parse(raw);
				if (!Array.isArray(this.items)) {
					this.items = [];
				}
			} catch {
				this.items = [];
			}
		}
	}

	push(name: string): void {
		const idx = this.items.indexOf(name);
		if (idx >= 0) {
			this.items.splice(idx, 1);
		}
		this.items.unshift(name);
		if (this.items.length > this.maxSize) {
			this.items = this.items.slice(0, this.maxSize);
		}
		void this.setStored(this.key, JSON.stringify(this.items));
	}

	pop(name: string): void {
		const idx = this.items.indexOf(name);
		if (idx >= 0) {
			this.items.splice(idx, 1);
			void this.setStored(this.key, JSON.stringify(this.items));
		}
	}

	rename(oldName: string, newName: string): void {
		const idx = this.items.indexOf(oldName);
		if (idx >= 0) {
			this.items[idx] = newName;
			void this.setStored(this.key, JSON.stringify(this.items));
		}
	}

	length(): number {
		return this.items.length;
	}

	getItem(index: number): string {
		return this.items[index] ?? '';
	}
}
