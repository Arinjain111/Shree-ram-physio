import type { InvoiceData } from '@/schemas/validation.schema.ts';
import type { LayoutConfig } from '@/types/layout.types';
import { calculateDiscountAmount } from './calculationUtils';

// Normalize a local filesystem path or return data URL as-is
const toFileUrl = (p: string): string => {
  try {
    if (!p) return '';
    // If it's already a data URL, return as-is
    if (p.startsWith('data:')) return p;
    // If it's a file URL, return as-is
    if (p.startsWith('file://')) return p;
    // Otherwise, convert filesystem path to file URL
    const normalized = p.replace(/\\/g, '/'); // Windows backslashes -> forward slashes
    return 'file:///' + encodeURI(normalized);
  } catch {
    return p;
  }
};

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const generateInvoiceHTML = (
  invoiceData: InvoiceData,
  layout: LayoutConfig,
): string => {
  // ─── Paper size configuration ──────────────────────────────────────────
  const paperSize = layout.paperSize || 'A4';
  const paperOrientation = layout.paperOrientation || 'portrait';

  // Dimensions in px at 96dpi
  const PAPER_DIMS: Record<string, { portrait: [number, number]; landscape: [number, number] }> = {
    A4: { portrait: [794, 1123], landscape: [1123, 794] },
    A5: { portrait: [559, 794],  landscape: [794, 559] },
  };
  const dims = PAPER_DIMS[paperSize]?.[paperOrientation] ?? PAPER_DIMS.A4.portrait;
  const pageW = dims[0];
  const pageH = dims[1];

  // CSS @page size string
  const pageSizeCSS = `${paperSize} ${paperOrientation}`;

  // Scale factor relative to A4 portrait (the original design baseline)
  const scale = Math.min(pageW / 794, pageH / 1123);
  const isCompact = scale < 0.95; // A5 or small formats

  // Extract dynamic styling values with fallbacks
  const {
    headerBgColor = '#ffffff',
    headerTextColor = '#000000',
    titleBgColor = '#8764b6',
    titleTextColor = '#ffffff',
    sectionBgColor = '#f8f3ff',
    fontSizeValue = 20,
    metaFontSize = 10,
    logoMaxWidth = 150,
    logoMaxHeight = 100,
    headerRightAlign = 'right',
    footerBgColor = '#f3f4f6',
    footerTextColor = '#000000',
  } = layout;

  // Scaled values for compact paper sizes to fit 5-6+ treatments per page
  const s = (v: number) => Math.round(v * scale);
  const tableFontSize = isCompact ? 9 : 12; // reduced to fit more rows
  const cellPad = isCompact ? 4 : 6; // tighter cells
  const headerPad = isCompact ? 8 : 12;
  const infoPad = isCompact ? 8 : 10;
  const gapSize = isCompact ? 6 : 10;
  const summaryBoxHeight = isCompact ? 35 : 45;
  const footerPad = isCompact ? 8 : 12;
  const titleHeight = isCompact ? 24 : 30;
  const titleFontSize = isCompact ? 14 : 16;

  const titleText = (layout.title || 'PHYSIOTHERAPY RECEIPT').trim();
  const clinicTagline = (layout.clinicTagline || '').trim();
  const footerNoteTitle = (layout.footerNoteTitle || 'Note:').trim();
  const footerNotesLines = (layout.footerNotes || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
    
  const signatureName = (layout.signatureName || '').trim() || (layout.doctorName || '').trim();
  const signatureQualification = (layout.signatureQualification || '').trim() || (layout.doctorQualification || '').trim();
  const signatureImage = (layout.signatureImagePath || '').trim();
  
  // Helper function to convert yyyy-mm-dd to dd-mm-yy for treatments
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0].slice(-2)}`;
    }
    return dateStr;
  };

  // Helper function to convert yyyy-mm-dd to dd-mm-yyyy for bill date
  const formatBillDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  };

  const treatmentsHTML = invoiceData.treatments
    .map((item, index) => {
      const sessions = Number(item.sessions || 0);
      const perSession = Number(item.amount || 0);
      const total = sessions * perSession;
      return `
      <tr>
        <td class="text-center">${index + 1}</td>
        <td>${item.name}</td>
        <td class="text-center">${sessions}</td>
        <td class="text-center">${formatDate(item.startDate)}</td>
        <td class="text-center">${formatDate(item.endDate)}</td>
        <td class="text-right">${perSession.toFixed(2)}</td>
        <td class="text-right">${total.toFixed(2)}</td>
      </tr>`;
    })
    .join('');

  const subTotal = invoiceData.treatments.reduce((s, t) => {
    const sessions = Number(t.sessions || 0);
    const perSession = Number(t.amount || 0);
    return s + sessions * perSession;
  }, 0);
  const discountValue = Number(invoiceData.discount || 0);
  const discountType = invoiceData.discountType || 'amount';
  const discountAmount = calculateDiscountAmount(subTotal, discountValue, discountType);
  const hasDiscount = discountAmount > 0;
  const discountLabel = discountType === 'percentage'
    ? `Discount (${discountValue}%)`
    : 'Discount';

  // Determine gender-based title prefix
  const rawGender = (invoiceData.patient.gender || '').toLowerCase().trim();
  // Compute full name from firstName/lastName
  const patientName = `${invoiceData.patient.firstName || ''} ${invoiceData.patient.lastName || ''}`.trim();
  let titlePrefix = '';
  if (rawGender.includes('male') && !rawGender.includes('female')) titlePrefix = 'Mr.';
  else if (rawGender.includes('female')) titlePrefix = 'Mrs.';
  // Avoid double title if user already entered one
  const nameHasTitle = /^(mr\.?|mrs\.?|ms\.?|dr\.?)\s/i.test(patientName);
  const displayPatientName = !patientName ? '' : (nameHasTitle ? patientName : `${titlePrefix ? titlePrefix + ' ' : ''}${patientName}`);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        body { font-family: 'Inter', Arial, sans-serif; margin: 0; color: #000; }
        * { box-sizing: border-box; }
        .invoice-container { 
          max-width: ${pageW}px; 
          min-height: ${pageH}px; 
          margin: 0 auto; 
          padding: ${headerPad}px; 
          background: white; 
          box-sizing: border-box;
        }
        .layout-table {
          width: 100%;
          border-collapse: collapse;
          height: calc(${pageH}px - ${headerPad * 2}px);
        }
        .layout-table > thead > tr > td,
        .layout-table > tbody > tr > td,
        .layout-table > tfoot > tr > td {
          padding: 0;
          border: none;
        }
        .layout-table > tbody > tr > td {
          height: 100%;
          vertical-align: top;
        }
        .layout-table > tfoot > tr > td {
          vertical-align: bottom;
        }
        .content-wrapper {
          display: block;
          padding-top: ${gapSize}px;
          padding-bottom: ${gapSize}px;
        }
        .content-wrapper > * {
          margin-bottom: ${isCompact ? 6 : 10}px;
        }
        .content-wrapper > *:last-child {
          margin-bottom: 0;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        /* Header */
        .header { 
          padding: ${headerPad}px; 
          border: 1px solid #8764b6; 
          background: ${headerBgColor};
          color: ${headerTextColor};
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: ${isCompact ? 12 : 20}px;
        }
        .header-top img { 
          width: ${s(logoMaxWidth)}px; 
          height: ${s(logoMaxHeight)}px; 
          object-fit: contain;
        }
        .header-right { 
          text-align: ${headerRightAlign}; 
          font-size: ${isCompact ? 9 : 11}px; 
          font-weight: 600; 
          line-height: ${isCompact ? 12 : 18}px;
          white-space: nowrap;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: ${isCompact ? 2 : 6}px;
          flex: 0 0 auto;
        }
        .header-right p {
          margin: 0;
        }
        .header-bottom {
          margin-top: ${isCompact ? 4 : 8}px;
        }
        .clinic-name { 
          font-size: ${s(fontSizeValue)}px; 
          font-weight: 700; 
          line-height: 1.2;
          color: #000;
          white-space: nowrap;
        }
        .clinic-tagline {
          font-size: ${Math.max(s(metaFontSize), 9)}px;
          font-weight: 600;
          opacity: 0.85;
          line-height: 1.2;
          margin-top: ${isCompact ? 2 : 4}px;
        }

        /* Title Bar */
        .title-bar { 
          background-color: ${titleBgColor}; 
          color: ${titleTextColor}; 
          padding: ${isCompact ? 6 : 10}px; 
          text-align: center; 
          font-size: ${titleFontSize}px; 
          font-weight: 600; 
          height: ${titleHeight}px;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: 1px;
        }

        /* Patient Details Container */
        .patient-details-container {
          background-color: ${sectionBgColor};
          border-top: 1px solid #8764b6;
          border-bottom: 1px solid #8764b6;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Info Sections */
        .info-section { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: ${isCompact ? 8 : 12}px; 
          padding: 0 ${infoPad}px ${isCompact ? 10 : 15}px ${infoPad}px;
        }
        .info-box { 
          background-color: white; 
          border: ${isCompact ? 1 : 2}px solid #8764b6; 
          border-radius: ${isCompact ? 6 : 8}px; 
          padding: ${isCompact ? 6 : 10}px; 
          font-size: ${isCompact ? 11 : 13}px; 
          line-height: 1;
        }
        .info-box p { 
          margin: 0 0 6px 0; 
          line-height: normal;
          display: flex;
        }
        .info-box p:last-child { 
          margin-bottom: 0; 
        }
        .info-box strong { 
          font-weight: 700; 
          min-width: ${isCompact ? 100 : 150}px;
          display: inline-block;
        }
        .info-box span { 
          font-weight: 400; 
          margin-left: 8px;
        }

        /* Summary Boxes */
        .summary-section { 
          display: flex; 
          gap: ${isCompact ? 6 : 12}px; 
          padding: ${isCompact ? 6 : 10}px ${infoPad}px;
          align-items: center;
        }
        .summary-box { 
          background: white;
          border: ${isCompact ? 1 : 2}px solid #8764b6; 
          padding: ${isCompact ? 6 : 10}px; 
          text-align: center; 
          flex: 1; 
          border-radius: ${isCompact ? 6 : 10}px; 
          display: flex;
          flex-direction: column;
          gap: ${isCompact ? 2 : 5}px;
          justify-content: center;
          min-height: ${summaryBoxHeight}px;
        }
        .summary-box .label { 
          font-weight: 700; 
          font-size: ${isCompact ? 11 : 14}px;
          line-height: normal;
        }
        .summary-box .value { 
          font-size: ${isCompact ? 10 : 12}px; 
          font-weight: 400;
          line-height: normal;
        }

        /* Diagnosis */
        .diagnosis { 
          display: flex; 
          gap: ${isCompact ? 2 : 10}px; 
          align-items: flex-end; 
          padding-bottom: ${isCompact ? 4 : 8}px;
          padding-top: ${isCompact ? 8 : 12}px;
          font-size: ${isCompact ? 11 : 14}px; 
        }
        .diagnosis strong { 
          font-weight: 700;
          white-space: nowrap;
        }
        .diagnosis-line {
          flex: 1;
          height: 1px;
          background: #000;
        }

        /* Treatment Provided */
        .treatment-provided { 
          padding-bottom: ${isCompact ? 4 : 8}px;
          font-size: ${isCompact ? 11 : 14}px; 
          font-weight: 700;
          margin-bottom: 0;
        }

        /* Treatments Table */
        .treatments-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: ${tableFontSize}px;
          table-layout: fixed;
        }
        .treatments-table thead { 
          background-color: ${sectionBgColor}; 
          border-top: 1px solid #8764b6;
          border-bottom: 1px solid #8764b6;
          height: ${isCompact ? 40 : 50}px;
        }
        .treatments-table th { 
          color: #000; 
          font-weight: 700;
          padding: 5px;
          border-left: 1px solid #8764b6;
          line-height: normal;
        }
        
        /* Additional Information */
        .additional-information { 
          padding-top: 10px;
          display: flex; 
          gap: 10px; 
          align-items: flex-end; 
          padding-bottom: 5px;
          padding-top: 5px;
          font-size: ${isCompact ? 11 : 14}px; 
        }
        .additional-information strong { 
          font-weight: 700;
          white-space: nowrap;
        }
        .additional-information-line {
          flex: 1;
          height: 1px;
          background: #000;
        }


        .treatments-table th:first-child {
          border-left: 1px solid #8764b6;
        }
        .treatments-table th:last-child {
          border-right: 1px solid #8764b6;
        }
        .treatments-table thead tr:nth-child(2) th {
          border-top: 1px solid #8764b6;
          white-space: nowrap;
        }
        .treatments-table tbody tr {
          min-height: ${isCompact ? 24 : 32}px;
          height: ${isCompact ? 24 : 32}px;
        }
        .treatments-table td { 
          padding: ${cellPad}px; 
          border-left: 1px solid #8764b6;
          font-weight: 400;
        }
        .treatments-table td:nth-child(2) {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .treatments-table td:nth-child(4), .treatments-table td:nth-child(5) {
          white-space: nowrap;
        }
        .treatments-table td:first-child {
          border-left: 1px solid #8764b6;
        }
        .treatments-table td:last-child {
          border-right: 1px solid #8764b6;
        }
        .treatments-table .subtotal-row { 
          font-weight: 500; 
          background-color: #f8f3ff;
          height: ${isCompact ? 26 : 34}px;
        }
        .treatments-table .discount-row { 
          font-weight: 600; 
          background-color: #ffffff;
          height: ${isCompact ? 26 : 34}px;
        }
        .treatments-table .discount-row th {
          color: #b91c1c;
          border-top: 1px dashed #d1c4e9;
        }
        .treatments-table .discount-row th:last-child {
          border-left: 1px dashed #d1c4e9;
          border-right: 1px solid #8764b6;
        }
        .treatments-table .total-row { 
          font-weight: 700; 
          background-color: #f8f3ff;
          border-top: 1px solid #8764b6;
          border-bottom: 1px solid #8764b6;
          height: ${isCompact ? 30 : 40}px;
        }
        .treatments-table .total-row th,
        .treatments-table .subtotal-row th,
        .treatments-table .discount-row th {
          padding: 10px;
          vertical-align: middle;
        }
        .treatments-table tfoot th:first-child {
          border-left: 1px solid #8764b6;
        }
        .treatments-table tfoot th:last-child {
          border-left: 1px solid #8764b6;
          border-right: 1px solid #8764b6;
        }
        .treatments-table .subtotal-row th {
          border-top: 1px solid #8764b6;
        }

        /* Footer */
        .footer { 
          display: grid; 
          grid-template-columns: 2fr 1fr; 
          padding: 1px; 
          background-color: ${footerBgColor};
          color: ${footerTextColor};
          border: 1px solid #8764b6;
          font-size: ${isCompact ? 10 : 14}px;
          margin-top: auto;
          line-height: normal;
        }
        .footer-left {
          padding: ${footerPad}px;
          display: flex;
          flex-direction: column;
          gap: ${isCompact ? 4 : 8}px;
        }
        .footer-left p { 
          margin: 0;
          line-height: normal;
        }
        .footer strong { font-weight: 700; }
        .footer-notes { 
          margin-top: ${isCompact ? 5 : 10}px;
        }
        .signature { 
          background: #ffffff;
          border-left: 1px solid #8764b6;
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: flex-end;
          padding: ${isCompact ? 10 : 15}px 0;
        }
        .signature img {
          width: ${isCompact ? 90 : 138}px;
          height: ${isCompact ? 40 : 64}px;
          object-fit: contain;
          margin-bottom: ${isCompact ? 5 : 10}px;
        }
        .signature-text {
          font-weight: 700;
          font-size: ${isCompact ? 10 : 15}px;
          line-height: ${isCompact ? 16 : 23}px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .signature-text p {
          margin: 0;
        }
        .signature-space {
          height: ${isCompact ? 30 : 50}px;
        }

        /* Print Styles */
        @media print {
          html, body { 
            margin: 0 !important; 
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page { 
            size: ${pageSizeCSS}; 
            margin: 0;
          }
          .invoice-container {
            width: ${pageW}px !important;
            max-width: ${pageW}px !important;
            min-height: ${pageH}px !important;
            margin: 0 auto !important;
            padding: ${headerPad}px !important;
            background: #ffffff !important;
          }
          .layout-table { page-break-inside: auto; }
          .treatments-table { page-break-inside: auto; }
          .treatments-table tr { page-break-inside: avoid; page-break-after: auto; }
          .footer { page-break-inside: avoid; }
          table { width: 100% !important; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Layout Table for Repeating Header/Footer on Print -->
        <table class="layout-table">
          <thead>
            <tr>
              <td>
                <!-- Header -->
                <div class="header">
                  <div class="header-top">
                    ${layout.logoPath ? `<img src="${toFileUrl(layout.logoPath)}" alt="Clinic Logo">` : ''}
                    <div class="header-right">
                      <p>UAN : ${layout.uan}</p>
                      <p>Reg No. : ${layout.regNo}</p>
                    </div>
                  </div>
                  <div class="header-bottom">
                    <div class="clinic-name">${layout.clinicName}</div>
                    ${clinicTagline ? `<div class="clinic-tagline">${clinicTagline}</div>` : ''}
                  </div>
                </div>
              </td>
            </tr>
          </thead>
          
          <tbody>
            <tr>
              <td>
                <div class="content-wrapper">
                  <!-- Patient Details Container -->
                  <div class="patient-details-container">
                    <div class="title-bar">${titleText}</div>
                    
                    <div class="info-section">
                      <div class="info-box">
                        <p><strong>Patient Name</strong> : <span>${escapeHtml(displayPatientName)}</span></p>
                        <p><strong>Age </strong> : <span>${invoiceData.patient.age} Y</span></p>
                        <p><strong>Sex </strong> : <span>${invoiceData.patient.gender}</span></p>
                      </div>
                      <div class="info-box">
                          <p><strong>Contact Number</strong> : <span>${escapeHtml(invoiceData.patient.phone)}</span></p>
                          ${(invoiceData.TransactionId || '').trim() ? `<p><strong>Transaction ID</strong> : <span>${escapeHtml(invoiceData.TransactionId)}</span></p>` : ''}
                          ${(invoiceData.patient.uhid || '').trim() ? `<p><strong>UHID No.</strong> : <span>${escapeHtml(invoiceData.patient.uhid)}</span></p>` : ''}
                        </div>
                    </div>

                    <div class="summary-section">
                      <div class="summary-box">
                        <div class="label">RECEIPT NUMBER</div>
                        <div class="value">${invoiceData.invoiceNumber}</div>
                      </div>
                      <div class="summary-box">
                        <div class="label">PAYMENT MODE</div>
                        <div class="value">${(invoiceData.paymentMethod || 'CASH').toUpperCase()}</div>
                      </div>
                      <div class="summary-box">
                        <div class="label">BILL DATE</div>
                        <div class="value">${formatBillDate(invoiceData.date)}</div>
                      </div>
                      <div class="summary-box">
                        <div class="label">BILL AMOUNT</div>
                        <div class="value">${invoiceData.total}</div>
                      </div>
                    </div>
                  </div>

                  <!-- Diagnosis -->
                  <div class="diagnosis">
                    <strong>Diagnosis / Complaint:</strong>
                    <span style="margin-left: 10px; font-weight: 400;">${escapeHtml(invoiceData.diagnosis || '')}</span>
                  </div>

                  <!-- Treatment Provided -->
                  <p class="treatment-provided">Treatment Provided:</p>

                  <!-- Treatments Table -->
                  <table class="treatments-table">
                    <colgroup>
                      <col style="width: 6%;" />
                      <col style="width: 32%;" />
                      <col style="width: 10%;" />
                      <col style="width: 15%;" />
                      <col style="width: 15%;" />
                      <col style="width: 11%;" />
                      <col style="width: 11%;" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th class="text-center" rowspan="2">Sr No.</th>
                        <th rowspan="2">Type of Service</th>
                        <th class="text-center" rowspan="2">Sessions<br/>(Number)</th>
                        <th class="text-center" colspan="2">Date</th>
                        <th class="text-center" rowspan="2">Amount<br/>(per session)</th>
                        <th class="text-center" rowspan="2">Amount<br/>(Total)</th>
                      </tr>
                      <tr>
                        <th class="text-center">From</th>
                        <th class="text-center">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${treatmentsHTML}
                    </tbody>
                    <tfoot>
                      ${hasDiscount ? `
                      <tr class="subtotal-row">
                        <th colspan="6" class="text-right">SUBTOTAL :</th>
                        <th class="text-right">${subTotal.toFixed(2)}</th>
                      </tr>
                      <tr class="discount-row">
                        <th colspan="6" class="text-right">${discountLabel} :</th>
                        <th class="text-right">- ${discountAmount.toFixed(2)}</th>
                      </tr>
                      ` : ''}
                      <tr class="total-row">
                        <th colspan="6" class="text-right">TOTAL AMOUNT :</th>
                        <th class="text-right">${invoiceData.total}</th>
                      </tr>
                    </tfoot>
                  </table>

                  <!-- Additional Notes / Prescription -->
                  ${invoiceData.notes ? `
                  <div class="additional-information">
                    <strong>Additional Notes / Prescription:</strong>
                    <span style="margin-left: 10px; font-weight: 400;">${invoiceData.notes}</span>
                  </div>
                  ` : ''}
                </div>
              </td>
            </tr>
          </tbody>

          <tfoot>
            <tr>
              <td>
                <!-- Footer -->
                <div class="footer">
                  <div class="footer-left">
                    <p><strong>Address :</strong> ${layout.address}</p>
                    <p><strong>Contact No :</strong> ${layout.clinicPhone}</p>
                    <p><strong>Email :</strong> ${layout.clinicEmail}</p>
                    <div class="footer-notes">
                      ${footerNotesLines.length > 0
                        ? footerNotesLines
                            .map((line, idx) => {
                              if (idx === 0) {
                                return `<p><strong>${footerNoteTitle}</strong> ${line}</p>`;
                              }
                              return `<p>${line}</p>`;
                            })
                            .join('')
                        : ''}
                    </div>
                  </div>
                  <div class="signature">
                    ${signatureImage ? `<img src="${toFileUrl(signatureImage)}" alt="Signature" />` : ''}
                    <div class="signature-text">
                      ${!signatureImage ? `<div class="signature-space"></div>` : ''}
                      <p>${signatureName}</p>
                      ${signatureQualification ? `<p>(${signatureQualification})</p>` : ''}
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>

      </div>
    </body>
    </html>
  `;
};

