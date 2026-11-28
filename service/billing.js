
const BillingModel = require("../models/billing-model");

class BillingService {
  constructor() {
    this.billingModel = new BillingModel();
  }
  async createBill(userId, products, isTaxApplied, taxAppliedPercent, paidStatus = 1, customer_name, customer_mobile, payment_mode, is_partial = 0) {
    return await this.billingModel.createBill(
      userId,
      products,
      isTaxApplied,
      taxAppliedPercent,
      paidStatus,
      customer_name,
      customer_mobile,
      payment_mode,
      is_partial
    );
  }

  async getAllBills() {
    return await this.billingModel.getAllBills();
  }

  async getBillById(id) {
    return await this.billingModel.getBillById(id);
  }

  async updatePaidStatus(id, paidStatus) {
    return await this.billingModel.updatePaidStatus(id, paidStatus);
  }

  async totalSalesToday() {
    return await this.billingModel.totalSalesToday();
  }

  async getSalesReport(startDate, endDate) {
    return await this.billingModel.getSalesReport(startDate, endDate);
  }

  async addPartialPayment(billId, paymentDetails) {
    return await this.billingModel.addPartialPayment(billId, paymentDetails);
  }

  async getPartialPaymentHistory() {
    return await this.billingModel.getPartialPaymentHistory();
  }

  async getPaymentGroupedByCustomer() {
    return await this.billingModel.getPaymentGroupedByCustomer();
  }
}

module.exports = BillingService;
