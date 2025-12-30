import * as assert from 'node:assert';
import { formatDateForDtFileName } from '../../utils/dateUtils';

suite('dateUtils', () => {
	test('formatDateForDtFileName форматирует дату правильно', () => {
		const date = new Date('2024-01-15T14:30:22');
		const result = formatDateForDtFileName(date);
		assert.strictEqual(result, '20240115_143022', 'Дата должна быть отформатирована в формат YYYYMMDD_HHMMSS');
	});

	test('formatDateForDtFileName форматирует дату с нулями в начале', () => {
		const date = new Date('2024-01-05T09:05:03');
		const result = formatDateForDtFileName(date);
		assert.strictEqual(result, '20240105_090503', 'Месяц, день, часы, минуты и секунды должны быть с ведущими нулями');
	});

	test('formatDateForDtFileName использует текущую дату по умолчанию', () => {
		const result = formatDateForDtFileName();
		const pattern = /^\d{8}_\d{6}$/;
		assert.ok(pattern.test(result), 'Результат должен соответствовать формату YYYYMMDD_HHMMSS');
	});

	test('formatDateForDtFileName форматирует дату в конце месяца', () => {
		const date = new Date('2024-12-31T23:59:59');
		const result = formatDateForDtFileName(date);
		assert.strictEqual(result, '20241231_235959', 'Дата в конце месяца должна форматироваться правильно');
	});

	test('formatDateForDtFileName форматирует дату в начале года', () => {
		const date = new Date('2024-01-01T00:00:00');
		const result = formatDateForDtFileName(date);
		assert.strictEqual(result, '20240101_000000', 'Дата в начале года должна форматироваться правильно');
	});
});

