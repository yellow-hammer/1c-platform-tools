# План настройки CI/CD для проекта 1C Platform Tools

## Обзор

Настроен автоматический процесс релиза и публикации расширения в VS Code Marketplace при создании тега в GitHub.

## Что нужно сделать

### Шаг 1: Получение Personal Access Token (PAT) для VS Code Marketplace

1. Перейдите на [Azure DevOps](https://dev.azure.com/)
2. Войдите в систему (используйте тот же аккаунт, что и для VS Code Marketplace)
3. Перейдите в **User Settings** → **Personal Access Tokens**
   - Или напрямую: [PAT](https://dev.azure.com/_usersSettings/tokens)
4. Нажмите **+ New Token**
5. Заполните форму:
   - **Name**: `VS Code Marketplace Publishing` (или любое другое имя)
   - **Organization**: выберите вашу организацию (или `All accessible organizations`)
   - **Expiration**: выберите срок действия (рекомендуется 1-2 года)
   - **Scopes**: выберите **Custom defined**
     - В разделе **Marketplace** выберите **Manage**
6. Нажмите **Create**
7. **ВАЖНО**: Скопируйте токен сразу, он больше не будет показан!

### Шаг 2: Добавление секрета в GitHub

1. Перейдите в ваш репозиторий на GitHub: `https://github.com/yellow-hammer/1c-platform-tools`
2. Откройте **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **New repository secret**
4. Заполните:
   - **Name**: `VSCE_PAT` (именно это имя используется в workflow)
   - **Secret**: вставьте скопированный токен из шага 1
5. Нажмите **Add secret**

### Шаг 3: Проверка workflow файла

Убедитесь, что файл `.github/workflows/release.yml` создан и содержит правильную конфигурацию.

### Шаг 4: Создание релиза

#### Вариант A: Через командную строку (рекомендуется)

```bash
# 1. Убедитесь, что все изменения закоммичены
git add .
git commit -m "feat: описание изменений"

# 2. Создайте тег с версией (например, v0.1.0)
git tag v0.1.0

# 3. Отправьте коммиты и тег в репозиторий
git push origin main
git push origin v0.1.0
```

**Важно**:

- Версия в `package.json` будет автоматически обновлена workflow при создании тега
- Используйте семантическое версионирование: `v0.1.0`, `v0.2.0`, `v1.0.0` и т.д.
- Тег должен начинаться с `v` (например, `v0.1.0`, а не `0.1.0`)

#### Вариант B: Через GitHub веб-интерфейс

1. Перейдите в раздел **Releases** вашего репозитория
2. Нажмите **Create a new release**
3. Заполните:
   - **Choose a tag**: создайте новый тег (например, `v0.1.0`)
   - **Release title**: `v0.1.0` (или описание)
   - **Description**: описание изменений (опционально, но будет перезаписано автоматически сгенерированным changelog)
4. Нажмите **Publish release**
5. GitHub Actions автоматически запустит workflow

**Примечание**: При создании релиза через веб-интерфейс описание будет автоматически заменено на сгенерированный changelog.

### Шаг 5: Мониторинг процесса

1. Перейдите в раздел **Actions** вашего репозитория
2. Найдите запущенный workflow **Release**
3. Откройте его для просмотра логов
4. Дождитесь завершения всех шагов

### Шаг 6: Проверка результата

1. **GitHub Release**: проверьте, что релиз создан в разделе **Releases**
2. **VS Code Marketplace**: через несколько минут проверьте страницу расширения:
   - [Страница](https://marketplace.visualstudio.com/manage/publishers/yellow-hammer)
   - Новая версия должна появиться автоматически

## Процесс публикации релиза

### Последовательность шагов

```txt
1. Создание тега (v0.1.0)
   ↓
2. Push тега в репозиторий
   ↓
3. Запуск GitHub Actions workflow
   ↓
4. Checkout кода (с полной историей)
   ↓
5. Установка Node.js 20 и зависимостей
   ↓
6. Проверка кода (lint) и компиляция
   ↓
7. Извлечение версии из тега
   ↓
8. Обновление версии в package.json
   ├─ Переключение на основную ветку (main/master)
   ├─ Обновление версии в package.json
   └─ Коммит изменений обратно в репозиторий
   ↓
9. ⭐ ГЕНЕРАЦИЯ CHANGELOG (git-cliff)
   ├─ Установка git-cliff (если нужно)
   ├─ Генерация CHANGELOG.md из коммитов
   └─ Сохранение в output переменную
   ↓
10. Упаковка расширения (.vsix)
   ↓
11. Создание GitHub Release
    ├─ Прикрепление .vsix файла
    └─ Использование changelog в описании
   ↓
12. Публикация в VS Code Marketplace
```

### Когда формируется changelog

**Changelog формируется на шаге 9**, после обновления версии в `package.json`, но **до** упаковки расширения.

**Детали процесса генерации:**

1. Workflow проверяет наличие `git-cliff` в системе
2. Если отсутствует, автоматически устанавливает через `cargo install git-cliff` (5-6 минут при первом запуске)
3. Запускает `git-cliff -o CHANGELOG.md` для генерации changelog на основе коммитов между тегами
4. Читает содержимое `CHANGELOG.md` и сохраняет в output переменную `changelog`
5. Использует этот changelog в описании GitHub Release (шаг 11)

**Важно**:

- Для правильной генерации changelog используйте [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/)
- Changelog генерируется на основе всех коммитов между тегами
- Файл `CHANGELOG.md` создается временно в процессе workflow и не коммитится в репозиторий
- Если генерация changelog не удалась (например, git-cliff не установился), используется fallback с ссылкой на историю коммитов

## Что делает workflow

1. **Checkout code** - получает код из репозитория (с полной историей для git-cliff)
2. **Setup Node.js** - настраивает Node.js 20
3. **Install dependencies** - устанавливает зависимости (`npm ci`)
4. **Run linter** - проверяет код линтером (`npm run lint`)
5. **Compile TypeScript** - компилирует TypeScript код (`npm run compile`)
6. **Get version from tag** - извлекает версию из тега (убирает префикс `v`, например `v0.1.0` → `0.1.0`)
7. **Switch to main branch and update version** - переключается на основную ветку, обновляет версию в `package.json` с помощью `npm version` и коммитит изменения обратно в репозиторий
8. **Generate changelog** - генерирует changelog через `git-cliff`:
   - Автоматически устанавливает `git-cliff` через `cargo install git-cliff` (если не установлен)
   - Генерирует `CHANGELOG.md` на основе коммитов в формате Conventional Commits
   - Сохраняет changelog в output для использования в GitHub Release
   - Если установка не удалась, используется fallback с ссылкой на историю коммитов
9. **Package extension** - упаковывает расширение в `.vsix` файл (`npm run package` → `vsce package`) с уже обновленной версией
10. **Create GitHub Release** - создает релиз на GitHub:
    - Прикрепляет `.vsix` файл
    - Использует сгенерированный changelog в описании релиза
    - Автоматически публикует (не draft)
11. **Publish to VS Code Marketplace** - публикует расширение в Marketplace через `vsce publish`

## Формат тегов

Используйте семантическое версионирование с префиксом `v`:

- `v0.0.1` - первый релиз
- `v0.1.0` - минорное обновление
- `v1.0.0` - мажорный релиз
- `v1.0.1` - патч

## Важные замечания

1. **Версия в package.json**: workflow автоматически обновляет версию в `package.json` на основе тега и коммитит изменения обратно в репозиторий, поэтому не нужно обновлять её вручную перед созданием тега
2. **Conventional Commits**: для правильной генерации changelog используйте [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/):
   - `feat:` - новая функциональность
   - `fix:` - исправление ошибок
   - `docs:` - изменения в документации
   - `refactor:` - рефакторинг кода
   - `test:` - добавление тестов
   - `chore:` - обновление зависимостей, конфигурации и т.д.
3. **Первый релиз**: для первого релиза может потребоваться ручная публикация в Marketplace через `vsce publish` (только один раз)
4. **Права доступа**: убедитесь, что у токена есть права на публикацию в Marketplace
5. **Установка git-cliff**: при первом запуске workflow автоматически установит `git-cliff` через cargo, что может занять 5-6 минут. Последующие запуски будут быстрее, так как git-cliff будет уже установлен
6. **Changelog**: changelog генерируется автоматически на основе коммитов между тегами и используется в описании GitHub Release

## Устранение проблем

### Ошибка "Invalid Personal Access Token"

- Проверьте, что токен скопирован полностью
- Убедитесь, что токен не истек
- Проверьте, что у токена есть права **Manage** в разделе **Marketplace**

### Ошибка "Extension not found"

- Убедитесь, что расширение уже опубликовано в Marketplace хотя бы один раз
- Для первого релиза может потребоваться ручная публикация

### Ошибка "Version already exists"

- Версия уже существует в Marketplace
- Используйте новую версию (увеличьте номер версии)

## Дополнительные улучшения (опционально)

### CI для Pull Requests

Можно добавить workflow для проверки кода на каждом PR:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run compile
      - run: npm test
```

### Автоматическое обновление версии

Автоматическое обновление версии в `package.json` при создании тега уже реализовано в workflow на шаге "Update package.json version". Версия извлекается из тега (убирается префикс `v`) и обновляется в `package.json` с помощью `npm version --no-git-tag-version`.

## Полезные ссылки

- [VS Code Extension Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI](https://github.com/microsoft/vscode-vsce)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/ru/v1.0.0/)
