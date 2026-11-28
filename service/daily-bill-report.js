require('dotenv').config();

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { createDailyBillEmail } = require('./daily-bill-email');

const timeZone = process.env.REPORT_TIMEZONE || 'Asia/Kolkata';
const reportEmail = process.env.REPORT_EMAIL_TO || 'sithik651@gmail.com';
const apiUrl = process.env.DAILY_REPORT_API_URL
  || `http://localhost:${process.env.PORT || 3000}/api/daily-bill-report`;

function getPreviousDateInTimeZone(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const previousDate = new Date(Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day) - 1
  ));

  return previousDate.toISOString().slice(0, 10);
}

function createTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : (Number(process.env.SMTP_PORT) || 465) === 465,
    auth: { user, pass }
  });
}

async function sendDailyReport() {
  const reportToken = process.env.DAILY_REPORT_TOKEN;
  if (!reportToken) {
    throw new Error('DAILY_REPORT_TOKEN must be configured');
  }

  const date = getPreviousDateInTimeZone();
  const url = new URL(apiUrl);
  url.searchParams.set('date', date);
  const response = await fetch(url, {
    headers: { 'x-daily-report-token': reportToken }
  });

  if (!response.ok) {
    throw new Error(`Daily report API returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.success || !Array.isArray(payload.data?.bills)) {
    throw new Error('Daily report API returned an invalid response');
  }

  const message = createDailyBillEmail(payload.data);
  const transporter = createTransport();
  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: reportEmail,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  console.log(`Sent report for ${date} to ${reportEmail} (${result.messageId})`);
}

async function main() {
  if (process.argv.includes('--once')) {
    await sendDailyReport();
    return;
  }

  const task = cron.schedule('0 9 * * *', () => {
    sendDailyReport().catch((error) => {
      console.error('Daily bill report failed:', error);
    });
  }, { timezone: timeZone });

  console.log(`Daily bill report scheduled for 9:00 AM (${timeZone})`);

  const stop = () => {
    task.stop();
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error('Unable to run daily bill report:', error);
  process.exitCode = 1;
});
