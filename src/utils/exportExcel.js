import * as XLSX from 'xlsx';

/**
 * 엑셀 다운로드 공통 유틸
 * @param {Array<Object>} data - 행 배열
 * @param {Array<{key: string, header: string, width?: number}>} columns - 컬럼 정의
 * @param {string} fileName - 파일명 (.xlsx 포함)
 * @param {string} [sheetName] - 시트명 (기본: 'Sheet1')
 */
export function exportToExcel(data, columns, fileName, sheetName = 'Sheet1') {
  const headers = columns.map(c => c.header);
  const rows = data.map(row => columns.map(c => row[c.key] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // 컬럼 너비
  ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/**
 * 여러 시트를 하나의 엑셀 파일로 다운로드
 * @param {Array<{name: string, data: Array, columns: Array}>} sheets
 * @param {string} fileName
 */
export function exportMultiSheet(sheets, fileName) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data, columns }) => {
    const headers = columns.map(c => c.header);
    const rows = data.map(row => columns.map(c => row[c.key] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = columns.map(c => ({ wch: c.width || 15 }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, fileName);
}
