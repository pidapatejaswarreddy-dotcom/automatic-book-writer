import { exportPdf, pdfLayout } from './pdf.js';
import { exportDocx } from './docx.js';
import { exportTxt } from './txt.js';
import { safeFilename } from './model.js';

// Add a format (EPUB, Markdown, HTML...) by registering another entry here.
export const EXPORTERS = {
  pdf: { mime: 'application/pdf', run: exportPdf },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', run: exportDocx },
  txt: { mime: 'text/plain; charset=utf-8', run: async (b) => exportTxt(b) },
};
export { pdfLayout, safeFilename };
