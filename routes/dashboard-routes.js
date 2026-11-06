
const express = require("express");
const router = express.Router();

const APIController = require("../common/api-handler");
const apiController = new APIController();
const { authenticateToken } = require("../common/jwt-ops");
const { validate, salesReportSchema } = require("../validation/api-validation");

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
  '/inventory',
    authenticateToken,
  apiController.getProductsForInventory.bind(apiController)
);

module.exports = router;
