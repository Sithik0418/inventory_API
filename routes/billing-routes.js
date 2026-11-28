
const express = require("express");
const router = express.Router();

const APIController = require("../common/api-handler");
const apiController = new APIController();
var {
  validate,
  createBillSchema,
  getBillByIdSchema,
  updatePaidStatusSchema,
  partialPaymentSchema,
} = require("../validation/api-validation");

router.get(
  "/remaining-payments",
  apiController.getPaymentGroupedByCustomer.bind(apiController)
);

router.get(
  "/paartial-payment-history",
  apiController.getPartialPaymentHistory.bind(apiController)
);

router.get(
  "/partial-payment-history",
  apiController.getPartialPaymentHistory.bind(apiController)
);

router.post("/", validate(createBillSchema), apiController.createBill.bind(apiController));

router.post(
  "/partial-payment/:id",
  validate(getBillByIdSchema, "params"),
  validate(partialPaymentSchema),
  apiController.addPartialPayment.bind(apiController)
);

router.get("/", apiController.getAllBills.bind(apiController));

router.get(
  "/:id",
  validate(getBillByIdSchema, "params"),
  apiController.getBillById.bind(apiController)
);

router.patch(
  "/:id/paid-status",
  validate(getBillByIdSchema, "params"),
  validate(updatePaidStatusSchema),
  apiController.updatePaidStatus.bind(apiController)
);

module.exports = router;
