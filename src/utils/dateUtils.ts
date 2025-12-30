/**
 * Утилиты для работы с датами
 */

/**
 * Форматирует дату в формат для имени файла dt: YYYYMMDD_HHMMSS
 * 
 * Используется для генерации уникальных имен файлов выгрузки информационной базы.
 * 
 * @param date - Дата для форматирования (по умолчанию текущая дата)
 * @returns Отформатированная строка даты в формате YYYYMMDD_HHMMSS
 */
export function formatDateForDtFileName(date: Date = new Date()): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');
	
	return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

