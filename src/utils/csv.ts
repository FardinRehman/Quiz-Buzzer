/**
 * Robust RFC-4180 compliant CSV Parser for Question Bank Import
 * Handles UTF-8 BOM, quoted fields with internal commas/quotes, whitespace, and custom line breaks.
 */

export interface ParsedQuestionRow {
  rowNumber: number;
  question: string;
  correctAnswer: string;
}

export interface CSVParseResult {
  valid: boolean;
  totalRows: number;
  validQuestions: ParsedQuestionRow[];
  errors: string[];
}

/**
 * Splits CSV string into 2D array of cells according to RFC-4180
 */
export function parseCSVToRows(csvContent: string): string[][] {
  // Strip UTF-8 BOM if present
  let cleanContent = csvContent.replace(/^\uFEFF/, '');

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;
  let i = 0;

  while (i < cleanContent.length) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentCell += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentCell += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++;
        continue;
      } else {
        currentCell += char;
        i++;
        continue;
      }
    }
  }

  // Push last cell & row if any
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Validates and extracts questions and correct_answers from parsed CSV rows
 */
export function validateAndParseQuestionsCSV(csvContent: string): CSVParseResult {
  const errors: string[] = [];
  const validQuestions: ParsedQuestionRow[] = [];

  if (!csvContent || !csvContent.trim()) {
    return {
      valid: false,
      totalRows: 0,
      validQuestions: [],
      errors: ['CSV file is empty. Please provide a valid CSV with question and correct_answer columns.'],
    };
  }

  const rawRows = parseCSVToRows(csvContent);

  if (rawRows.length === 0) {
    return {
      valid: false,
      totalRows: 0,
      validQuestions: [],
      errors: ['No data rows found in the CSV file.'],
    };
  }

  // Validate Header Row
  const header = rawRows[0].map(h => h.toLowerCase().trim().replace(/^["']|["']$/g, ''));
  const questionIdx = header.findIndex(h => h === 'question' || h === 'question_text' || h.includes('question'));
  const answerIdx = header.findIndex(
    h => h === 'correct_answer' || h === 'correctanswer' || h === 'answer' || h.includes('answer')
  );

  if (questionIdx === -1) {
    errors.push('Missing required column "question" in CSV header.');
  }
  if (answerIdx === -1) {
    errors.push('Missing required column "correct_answer" in CSV header.');
  }

  if (errors.length > 0) {
    return {
      valid: false,
      totalRows: rawRows.length - 1,
      validQuestions: [],
      errors: [
        ...errors,
        'Expected CSV header format: question,correct_answer (e.g. "What is 2+2?","4")',
      ],
    };
  }

  const dataRows = rawRows.slice(1);
  let totalDataRows = 0;

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed including header
    if (row.length === 0 || row.every(cell => !cell.trim())) {
      return; // Skip blank lines
    }

    totalDataRows++;
    const questionText = row[questionIdx]?.trim() || '';
    const answerText = row[answerIdx]?.trim() || '';

    if (!questionText && !answerText) {
      errors.push(`Row ${rowNum}: Both question and correct answer are empty.`);
      return;
    }

    if (!questionText) {
      errors.push(`Row ${rowNum}: Question text is missing.`);
      return;
    }

    if (!answerText) {
      errors.push(`Row ${rowNum}: Correct answer is missing.`);
      return;
    }

    validQuestions.push({
      rowNumber: rowNum,
      question: questionText,
      correctAnswer: answerText,
    });
  });

  if (totalDataRows === 0) {
    errors.push('The CSV file contains a header but no question data rows.');
  }

  return {
    valid: errors.length === 0 && validQuestions.length > 0,
    totalRows: totalDataRows,
    validQuestions,
    errors,
  };
}
