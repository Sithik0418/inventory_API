# inventory_API

## Development

Run the API in watch mode during development:

```sh
npm run dev
```

The server restarts when `index.js` or one of its required JavaScript files changes. Use `npm start` to run the server without watch mode.

## Daily bill email

The daily report scheduler calls `GET /api/daily-bill-report?date=YYYY-MM-DD` and emails the previous day's bill summary table to `test` at 9:00 AM in `Asia/Kolkata`. Bill numbers are plain text; the email does not include bill detail sections or links.

1. Copy `.env.example` settings into `.env`.
2. Set `SMTP_USER` to your Gmail address and `SMTP_PASS` to a Google App Password. Do not use your regular Gmail password.
3. Set `DAILY_REPORT_TOKEN` to a long random value. The endpoint and scheduler use this shared secret.
4. Start the API with `npm start`.
5. Run `npm run daily-report:send-now` to send a one-time report, or keep `npm run daily-report` running to schedule the daily email.

The scheduler is a separate long-running process; configure your host or Windows Task Scheduler to start it after reboot. Email sending requires working Gmail SMTP credentials and network access.