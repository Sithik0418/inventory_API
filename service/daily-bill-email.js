const emailDateFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kolkata'
});
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR'
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBillNumber(id) {
  return `BILL-${String(id).padStart(4, '0')}`;
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDateTime(value) {
  return emailDateFormatter.format(new Date(value));
}

function createDailyBillEmail({ date, bills }) {
  const summaryRows = bills.map((bill) => {
    const billNumber = formatBillNumber(bill.billId);
    return `<tr>
      <td>${escapeHtml(billNumber)}</td>
      <td>${escapeHtml(bill.customerName)}</td>
      <td>${escapeHtml(formatDateTime(bill.createdAt))}</td>
      <td class="amount">${escapeHtml(formatCurrency(bill.totalAmount))}</td>
    </tr>`;
  }).join('');

  const subject = `Daily bills — ${date}`;
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;color:#172033;line-height:1.5}
  h1{font-size:22px}h2{font-size:18px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse;margin:12px 0 20px}
  th,td{padding:10px;border-bottom:1px solid #e4e9f0;text-align:left}
  th{background:#f5f7fa;color:#43516a}
  a{color:#145ee8}.amount{text-align:right;white-space:nowrap}
  .number{text-align:center}
</style></head>
<body>
  <h1>Daily Bills — ${escapeHtml(date)}</h1>
  <p>${bills.length} bill${bills.length === 1 ? '' : 's'} recorded.</p>
  <h2>Bill Summary</h2>
  <table>
    <thead><tr><th>Bill No</th><th>Customer Name</th><th>Date &amp; Time</th><th class="amount">Total Amount</th></tr></thead>
    <tbody>${summaryRows || '<tr><td colspan="4">No bills found for this date.</td></tr>'}</tbody>
  </table>
</body>
</html>`;
  const text = bills.length
    ? bills.map((bill) =>
      `${formatBillNumber(bill.billId)} | ${bill.customerName} | ${formatDateTime(bill.createdAt)} | ${formatCurrency(bill.totalAmount)}`
    ).join('\n')
    : `No bills found for ${date}.`;

  return { subject, html, text };
}

module.exports = { createDailyBillEmail };
