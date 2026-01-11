import type { InvoiceData } from '@/schemas/validation.schema.ts';
import { LayoutConfig } from '@/hooks/useInvoiceLayout';

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

export const generateInvoiceHTML = (
  invoiceData: InvoiceData,
  layout: LayoutConfig,
): string => {
  // Extract dynamic styling values with fallbacks
  const {
    headerBgColor = '#ffffff',
    headerTextColor = '#000000',
    titleBgColor = '#8764b6',
    titleTextColor = '#ffffff',
    sectionBgColor = '#f8f3ff',
    fontSizeValue = 20,
    metaFontSize = 12,
    logoMaxWidth = 150,
    logoMaxHeight = 100,
    headerLeftAlign = 'left',
    headerRightAlign = 'right',
  } = layout;
  
  // Helper function to convert yyyy-mm-dd to dd-mm-yyyy
  const formatDate = (dateStr: string): string => {
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
          max-width: 800px; 
          min-height: 1123px; 
          margin: 0 auto; 
          padding: 15px; 
          background: white; 
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        /* Header */
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          padding: 15px; 
          border: 1px solid #8764b6; 
          gap: 40px;
          background: ${headerBgColor};
          color: ${headerTextColor};
        }
        .header-left { 
          display: flex; 
          flex-direction: column; 
          gap: 20px; 
          text-align: ${headerLeftAlign};
        }
        .header-left img { 
          width: ${logoMaxWidth}px; 
          height: ${logoMaxHeight}px; 
          object-fit: contain;
        }
        .clinic-name { 
          font-size: ${fontSizeValue}px; 
          font-weight: 700; 
          line-height: 26px;
          max-width: 300px;
          color: #000;
        }
        .header-right { 
          text-align: ${headerRightAlign}; 
          font-size: ${metaFontSize}px; 
          font-weight: 700; 
          line-height: 26px;
          white-space: nowrap;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        /* Title Bar */
        .title-bar { 
          background-color: ${titleBgColor}; 
          color: ${titleTextColor}; 
          padding: 10px; 
          text-align: center; 
          font-size: 22px; 
          font-weight: 600; 
          height: 40px;
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
          gap: 10px;
        }

        /* Info Sections */
        .info-section { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 15px; 
          padding: 0 15px 30px 15px;
        }
        .info-box { 
          background-color: white; 
          border: 2px solid #8764b6; 
          border-radius: 10px; 
          padding: 15px; 
          font-size: 15px; 
          line-height: 1;
        }
        .info-box p { 
          margin: 0 0 10px 0; 
          line-height: normal;
          display: flex;
        }
        .info-box p:last-child { 
          margin-bottom: 0; 
        }
        .info-box strong { 
          font-weight: 700; 
          min-width: 150px;
          display: inline-block;
        }
        .info-box span { 
          font-weight: 400; 
          margin-left: 8px;
        }

        /* Summary Boxes */
        .summary-section { 
          display: flex; 
          gap: 16px; 
          padding: 0 15px 0 15px;
          height: 15px;
          align-items: center;
        }
        .summary-box { 
          background: white;
          border: 2px solid #8764b6; 
          padding: 10px; 
          text-align: center; 
          flex: 1; 
          border-radius: 10px; 
          display: flex;
          flex-direction: column;
          gap: 5px;
          justify-content: center;
          min-height: 70px;
        }
        .summary-box .label { 
          font-weight: 700; 
          font-size: 14px;
          line-height: normal;
        }
        .summary-box .value { 
          font-size: 12px; 
          font-weight: 400;
          line-height: normal;
        }

        /* Diagnosis */
        .diagnosis { 
          display: flex; 
          gap: 10px; 
          align-items: flex-end; 
          padding-bottom: 10px;
          padding-top: 30px;
        }
        .diagnosis strong { 
          font-size: 14px; 
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
          font-size: 14px; 
          font-weight: 700;
          margin-bottom: 0;
        }

        /* Treatments Table */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 14px;
          table-layout: fixed;
        }
        thead { 
          background-color: ${sectionBgColor}; 
          border-top: 1px solid #8764b6;
          border-bottom: 1px solid #8764b6;
          height: 66px;
        }
        th { 
          color: #000; 
          font-weight: 700;
          padding: 10px;
          border-left: 1px solid #8764b6;
          line-height: normal;
        }
        
        /* Additional Information */
        .additional-information { 
          display: flex; 
          gap: 10px; 
          align-items: flex-end; 
          padding-bottom: 5px;
          padding-top: 5px;
        }
        .additional-information strong { 
          font-size: 14px; 
          font-weight: 700;
          white-space: nowrap;
        }
        .additional-information-line {
          flex: 1;
          height: 1px;
          background: #000;
        }

        th:nth-child(1) { width: 8%; }
        th:nth-child(2) { width: 28%; }
        th:nth-child(3) { width: 12%; }
        th:nth-child(4) { width: 17%; white-space: nowrap; }
        th:nth-child(5) { width: 17%; white-space: nowrap; }
        th:nth-child(6) { width: 11%; }
        th:nth-child(7) { width: 11%; }
        th:first-child {
          border-left: 1px solid #8764b6;
        }
        th:last-child {
          border-right: 1px solid #8764b6;
        }
        thead tr:nth-child(2) th {
          border-top: 1px solid #8764b6;
        }
        tbody tr {
          min-height: 42px;
        }
        td { 
          padding: 10px; 
          border-left: 1px solid #8764b6;
          font-weight: 400;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        td:nth-child(2) {
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        td:nth-child(4), td:nth-child(5) {
          white-space: normal;
          word-wrap: break-word;
          font-size: 13px;
        }
        td:first-child {
          border-left: 1px solid #8764b6;
        }
        td:last-child {
          border-right: 1px solid #8764b6;
        }
        .total-row { 
          font-weight: 700; 
          background-color: #f8f3ff;
          border-top: 1px solid #8764b6;
          border-bottom: 1px solid #8764b6;
          height: 42px;
        }
        .total-row th {
          padding: 10px;
          vertical-align: middle;
        }

        /* Footer */
        .footer { 
          display: grid; 
          grid-template-columns: 2fr 1fr; 
          padding: 1px; 
          background-color: #f8f3ff; 
          border: 1px solid #8764b6;
          font-size: 15px;
          margin-top: auto;
          line-height: normal;
        }
        .footer-left {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .footer-left p { 
          margin: 0;
          line-height: normal;
        }
        .footer strong { font-weight: 700; }
        .footer-notes { 
          margin-top: 10px;
        }
        .signature { 
          background: white;
          border-left: 1px solid #8764b6;
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          justify-content: flex-end;
          padding: 15px 0;
        }
        .signature img {
          width: 138px;
          height: 64px;
          object-fit: contain;
          margin-bottom: 10px;
        }
        .signature-text {
          font-weight: 700;
          font-size: 15px;
          line-height: 23px;
          text-align: center;
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
            size: A4; 
            margin: 0;
          }
          .invoice-container {
            width: 800px !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 15px !important;
            background: #ffffff !important;
          }
          .header { padding: 15px !important; }
          .patient-details-container { padding: 0 !important; }
          .info-section { padding: 0 15px 30px 15px !important; }
          .summary-section { padding: 0 15px !important; }
          .summary-box { padding: 10px !important; }
          table { width: 100% !important; }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            ${layout.logoPath ? `<img src="${toFileUrl(layout.logoPath)}" alt="Clinic Logo">` : ''}
            <div class="clinic-name">${layout.clinicName}</div>
          </div>
          <div class="header-right">
            <p>UAN : ${layout.uan}</p>
            <p>Reg No. : ${layout.regNo}</p>
          </div>
        </div>

        <!-- Patient Details Container -->
        <div class="patient-details-container">
          <div class="title-bar">PHYSIOTHERAPY RECIEPT</div>
          
          <div class="info-section">
            <div class="info-box">
              <p><strong>Patient Name</strong> : <span>${displayPatientName}</span></p>
              <p><strong>Age </strong> : <span>${invoiceData.patient.age} Y</span></p>
              <p><strong>Sex </strong> : <span>${invoiceData.patient.gender}</span></p>
            </div>
            <div class="info-box">
              <p><strong>Contact Number</strong> : <span>${invoiceData.patient.phone}</span></p>
              ${(invoiceData.patient.uhid || '').trim() ? `<p><strong>UHID No.</strong> : <span>${invoiceData.patient.uhid}</span></p>` : ''}
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
              <div class="value">${formatDate(invoiceData.date)}</div>
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
          <span style="margin-left: 10px; font-weight: 400;">${invoiceData.diagnosis || ''}</span>
        </div>

        <!-- Treatment Provided -->
        <p class="treatment-provided">Treatment Provided:</p>

        <!-- Treatments Table -->
        <table>
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

        <!-- Footer -->
        <div class="footer">
          <div class="footer-left">
            <p><strong>Address :</strong> ${layout.address}</p>
            <p><strong>Contact No :</strong> ${layout.clinicPhone}</p>
            <p><strong>Email :</strong> ${layout.clinicEmail}</p>
            <div class="footer-notes">
              <p><strong>Note:</strong> This is a professional physiotherapy treatment receipt for medical reimbursement.</p>
              <p><strong>No refund after treatment taken.</strong></p>
            </div>
          </div>
          <div class="signature">
            <img src="${toFileUrl(layout.logoPath)}" alt="Signature" style="display: none;" />
            <div class="signature-text">
              <p>Dr. ${layout.doctorName}</p>
              <p>(${layout.doctorQualification})</p>
            </div>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
};

