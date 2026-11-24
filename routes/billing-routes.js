
const express = require("express");
const router = express.Router();

const APIController = require("../common/api-handler");
const apiController = new APIController();
var { validate, createBillSchema, getBillByIdSchema, updatePaidStatusSchema, partialPaymentSchema } = require("../validation/api-validation");

router.get("/remaining-payments", apiController.getPaymentGroupedByCustomer.bind(apiController));

router.post("/", validate(createBillSchema), apiController.createBill.bind(apiController));

router.get("/", validate(getBillByIdSchema), apiController.getAllBills.bind(apiController));

router.get("/:id", validate(getBillByIdSchema), apiController.getBillById.bind(apiController));

router.patch("/:id/paid-status", validate(updatePaidStatusSchema), apiController.updatePaidStatus.bind(apiController));

router.post("/partial-payment/:id", validate(partialPaymentSchema), apiController.addPartialPayment.bind(apiController));



module.exports = router;
