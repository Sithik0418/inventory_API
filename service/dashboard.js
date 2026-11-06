
const Billing = require('./billing');
const Product = require('./product');


class ProductService {
  constructor() {
    this.product = new Product();
    this.billing = new Billing();
  }

  // Get all products
  async getOverall() {
    const totalProducts = await this.product.totalProducts();
    const lowStockProducts = await this.product.lowStockProducts();
    const totalRevenue = await this.billing.totalSalesToday();

    return {
      totalProducts,
      lowStockProducts,
      ...totalRevenue
    };
  }

  async getSalesReport(startDate, endDate) {
    return await this.billing.getSalesReport(startDate, endDate);
  }
}

module.exports = ProductService;
