#!/usr/bin/env node
/**
 * Минимальный MCP-сервер для 1C: Platform tools.
 * При вызове tool записывает идентификатор команды в .cursor/1c-platform-tools-run-command;
 * расширение (наблюдатель) выполняет команду.
 *
 * Запуск: node index.mjs [путь_к_workspace]
 * Или: WORKSPACE_FOLDER=/path node index.mjs
 * В Cursor mcp.json: "command": "node", "args": ["<path-to-extension>/resources/mcp-server/index.mjs", "${workspaceFolder}"]
 */

import { createInterface } from 'node:readline';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const TRIGGER_FILE = '1c-platform-tools-run-command';
const PREFIX = '1c-platform-tools.';

const workspaceRoot = process.env.WORKSPACE_FOLDER || process.argv[2] || process.cwd();

const tools = [
	{
		name: 'run_command',
		description: 'Выполнить команду расширения 1C: Platform tools по идентификатору (например 1c-platform-tools.run.designer)',
		inputSchema: {
			type: 'object',
			properties: {
				commandId: {
					type: 'string',
					description: 'Идентификатор команды (1c-platform-tools.*)',
				},
			},
			required: ['commandId'],
		},
	},
	{
		name: 'run_designer',
		description: 'Запустить Конфигуратор 1С',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'run_enterprise',
		description: 'Запустить Предприятие 1С',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'load_configuration',
		description: 'Загрузить конфигурацию из src/cf в базу',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'dump_configuration',
		description: 'Выгрузить конфигурацию из базы в src/cf',
		inputSchema: { type: 'object', properties: {} },
	},
];

const nameToCommandId = {
	run_designer: '1c-platform-tools.run.designer',
	run_enterprise: '1c-platform-tools.run.enterprise',
	load_configuration: '1c-platform-tools.configuration.loadFromSrc',
	dump_configuration: '1c-platform-tools.configuration.dumpToSrc',
};

function send(msg) {
	process.stdout.write(JSON.stringify(msg) + '\n');
}

function triggerCommand(commandId) {
	if (!commandId.startsWith(PREFIX)) {
		throw new Error(`Разрешены только команды ${PREFIX}*`);
	}
	const dir = join(workspaceRoot, '.cursor');
	mkdirSync(dir, { recursive: true });
	const file = join(dir, TRIGGER_FILE);
	writeFileSync(file, commandId, 'utf8');
}

function handleToolsCall(name, args) {
	let commandId;
	if (name === 'run_command') {
		commandId = args?.commandId;
		if (!commandId || typeof commandId !== 'string') {
			throw new Error('Требуется аргумент commandId');
		}
	} else {
		commandId = nameToCommandId[name];
		if (!commandId) {
			throw new Error(`Неизвестный tool: ${name}`);
		}
	}
	triggerCommand(commandId);
	return { content: [{ type: 'text', text: 'Команда отправлена в расширение.' }] };
}

function handleMessage(msg) {
	if (!msg?.id && !msg?.method) return;
	const id = msg.id;
	const method = msg.method;
	const params = msg.params || {};

	if (method === 'initialize') {
		send({
			jsonrpc: '2.0',
			id,
			result: {
				protocolVersion: '2024-11-05',
				capabilities: { tools: {} },
				serverInfo: { name: '1c-platform-tools-mcp', version: '0.1.0' },
			},
		});
		return;
	}

	if (method === 'tools/list') {
		send({
			jsonrpc: '2.0',
			id,
			result: { tools },
		});
		return;
	}

	if (method === 'tools/call') {
		const name = params.name;
		const args = params.arguments || {};
		try {
			const result = handleToolsCall(name, args);
			send({ jsonrpc: '2.0', id, result });
		} catch (err) {
			send({
				jsonrpc: '2.0',
				id,
				error: { code: -32603, message: err.message || 'Internal error' },
			});
		}
		return;
	}

	if (id !== undefined) {
		send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
	}
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
	try {
		const msg = JSON.parse(line);
		handleMessage(msg);
	} catch (_) {
		// ignore parse errors
	}
});
