const { timingSafeEqual } = require('node:crypto');

function authenticateDailyReport(req, res, next) {
  const configuredToken = process.env.DAILY_REPORT_TOKEN;

  if (!configuredToken) {
    return res.status(503).json({
      success: false,
      message: 'Daily report endpoint is not configured'
    });
  }

  const providedToken = req.get('x-daily-report-token') || '';
  const expected = Buffer.from(configuredToken);
  const provided = Buffer.from(providedToken);

  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    });
  }

  return next();
}

module.exports = {
  authenticateDailyReport
};
