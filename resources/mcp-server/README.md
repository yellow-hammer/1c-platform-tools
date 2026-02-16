# MCP-сервер 1C: Platform tools

Позволяет агенту (Cursor и др.) вызывать команды расширения через MCP. Сервер записывает идентификатор команды в файл `.cursor/1c-platform-tools-run-command`, расширение подхватывает и выполняет команду.

## Требования

- Расширение **1C: Platform tools** установлено и открыт проект 1С (workspace).
- Node.js 18+.

## Настройка в Cursor

1. Открой настройки MCP (или файл `%APPDATA%\Cursor\User\globalStorage\cursor.mcp\mcp.json`).
2. Добавь сервер, указав путь к `index.mjs` в папке расширения, например:

```json
{
  "mcpServers": {
    "1c-platform-tools": {
      "command": "node",
      "args": [
        "C:/Users/<user>/.vscode/extensions/yellow-hammer.1c-platform-tools-<version>/resources/mcp-server/index.mjs",
        "${workspaceFolder}"
      ]
    }
  }
}
```

Либо через переменную окружения (если Cursor подставляет workspace):

```json
{
  "mcpServers": {
    "1c-platform-tools": {
      "command": "node",
      "args": ["<путь к index.mjs>"],
      "env": {
        "WORKSPACE_FOLDER": "${workspaceFolder}"
      }
    }
  }
}
```

Путь к расширению: в VS Code/Cursor «О расширении» → 1C: Platform tools → путь к расширению (или скопировать из списка расширений).

## Инструменты (tools)

| Tool | Описание |
|------|----------|
| `run_command` | Выполнить любую команду по ID (аргумент `commandId`, например `1c-platform-tools.run.designer`). |
| `run_designer` | Запустить Конфигуратор. |
| `run_enterprise` | Запустить Предприятие. |
| `load_configuration` | Загрузить конфигурацию из src/cf. |
| `dump_configuration` | Выгрузить конфигурацию в src/cf. |

Для остальных команд используй `run_command` с нужным `commandId` из таблицы в навыке (SKILL.md).
