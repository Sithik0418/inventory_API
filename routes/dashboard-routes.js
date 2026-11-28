
const express = require("express");
const router = express.Router();

const APIController = require("../common/api-handler");
const apiController = new APIController();
const { authenticateToken } = require("../common/jwt-ops");
const { authenticateDailyReport } = require("../common/daily-report-auth");
const {
  validate,
  salesReportSchema,
  deadStockQuerySchema,
  profitSummaryQuerySchema,
  dailyBillReportQuerySchema
} = require("../validation/api-validation");

router.get("/overall",
    authenticateToken,
     apiController.getOverall.bind(apiController));

router.get(
  "/sales-report",
  authenticateToken,
  validate(salesReportSchema, "query"),
  apiController.getSalesReport.bind(apiController)
);
router.get(
  "/sales-report/profit-summary",
  authenticateToken,
  validate(profitSummaryQuerySchema, "query"),
  apiController.getProfitSummary.bind(apiController)
);
router.get(
  "/daily-bill-report",
  authenticateDailyReport,
  validate(dailyBillReportQuerySchema, "query"),
  apiController.getDailyBillReport.bind(apiController)
);
router.get(
  '/inventory',
    authenticateToken,
  apiController.getProductsForInventory.bind(apiController)
);

router.get(
  '/inventory/dead-stock',
  authenticateToken,
  validate(deadStockQuerySchema, "query"),
  apiController.getDeadStockProducts.bind(apiController)
);

module.exports = router;
