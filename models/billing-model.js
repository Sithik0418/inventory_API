
const pool = require('../common/connect-database');
const ProductModel = require('../models/product-model');

class BillingModel {

    constructor() {
        this.productModel = new ProductModel();
    }

async createBill(userId, products, isTaxApplied, taxAppliedPercent, paidStatus = 1, customer_name, customer_mobile, payment_mode, is_partial = 0) {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    if (!products?.length) {
      throw new Error("At least one product is required");
    }



    await connection.beginTransaction();
    transactionStarted = true;

    // 1. Validate products before changing stock
    let subtotal = 0;

     const items = products.map((product) => {
      const count = Number(product.count);
      const unitPrice = Number(product.unitPrice);

      if (
        !Number.isInteger(count) ||
        count <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        throw new Error("Invalid product quantity or price");
      }

      const itemTotal = Number((count * unitPrice).toFixed(2));
      subtotal += itemTotal;

      return {
        product_id: product.id,
        count,
        unit_price: unitPrice,
        total_cost: itemTotal,
      };
    });

    for (const item of items) {
      const result = await this.productModel.updateProductCount(
        item.product_id,
        item.count,
        connection
      );

      if (!result.updated) {
        throw new Error(
          `Product ID ${item.product_id} not found or insufficient stock`
        );
      }
    }

   

    subtotal = Number(subtotal.toFixed(2));

    // 2. Update stock using the same transaction connection

    // 3. Calculate bill-level tax
    const taxPercent = Number(taxAppliedPercent ?? 0);

    if (
      !Number.isFinite(taxPercent) ||
      taxPercent < 0 ||
      taxPercent > 100
    ) {
      throw new Error("Invalid tax percentage");
    }

    const taxAmount = isTaxApplied
      ? Number((subtotal * taxPercent / 100).toFixed(2))
      : 0;

    const grandTotal = Number((subtotal + taxAmount).toFixed(2));
    const paidAmount = Number(is_partial) === 0 ? grandTotal : 0;

    // 4. Insert billing record
    const [billResult] = await connection.execute(
      `INSERT INTO billing
       (user_id, subtotal, tax_applied_percent, paid_amount,
        is_tax_applied, tax_amount, total_cost, paid_status, customer_name, customer_mobile, payment_mode, is_partial)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        subtotal,
        isTaxApplied ? taxPercent : 0,
        paidAmount,
        Boolean(isTaxApplied),
        taxAmount,
        grandTotal,
        paidStatus,
        customer_name,
        customer_mobile,
        payment_mode ?? null,
        String(is_partial)
      ]
    );

    const billingId = billResult.insertId;

    // 5. Insert billing items
    for (const item of items) {
      await connection.execute(
        `INSERT INTO billing_items
         (billing_id, product_id, count, unit_price, total_cost)
         VALUES (?, ?, ?, ?, ?)`,
        [
          billingId,
          item.product_id,
          item.count,
          item.unit_price,
          item.total_cost,
        ]
      );
    }

    // 6. Commit all changes
    await connection.commit();
    transactionStarted = false;

    return {
      billing_id: billingId,
      subtotal,
      is_tax_applied: Boolean(isTaxApplied),
      tax_applied_percent: isTaxApplied ? taxPercent : 0,
      tax_amount: taxAmount,
      total_cost: grandTotal,
      paid_amount: paidAmount,
      paid_status: paidStatus,
      is_partial: Number(is_partial),
      items,
    };
  } catch (error) {
    // Roll back stock updates and billing inserts
    if (transactionStarted) {
      await connection.rollback();
    }

    throw error;
  } finally {
    // Always release the connection
    connection.release();
  }
}

async getAllBills() {
  const [rows] = await pool.execute(
    `SELECT
       id, total_cost AS totalCost, customer_name AS customerName, customer_mobile AS customerMobile, payment_mode AS paymentMode, is_partial AS isPartial, created_at as createdAt, paid_status AS paidStatus
     FROM billing 
     ORDER BY created_at DESC`
  );

  return rows;
}

async getBillById(id) {
  const [rows] = await pool.execute(
    `SELECT
       b.*,
       u.name AS user_name,
       bi.id AS billing_item_id,
       bi.product_id,
       p.name AS product_name,
       bi.count,
       bi.unit_price,
       bi.total_cost AS item_total
     FROM billing b
     JOIN users u ON b.user_id = u.id
     JOIN billing_items bi ON b.id = bi.billing_id
     JOIN products p ON bi.product_id = p.id
     WHERE b.id = ?
     ORDER BY bi.id ASC`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  // Return one bill containing multiple products
  const bill = {
    id: rows[0].id,
    userId: rows[0].user_id,
    userName: rows[0].user_name,
    subtotal: rows[0].subtotal,
    isTaxApplied: rows[0].is_tax_applied,
    taxAppliedPercent: rows[0].tax_applied_percent,
    taxAmount: rows[0].tax_amount,
    totalCost: rows[0].total_cost,
    paidStatus: rows[0].paid_status,
    isPartial: rows[0].is_partial,
    createdAt: rows[0].created_at,
    products: rows.map((row) => ({
      billingitemId: row.billing_item_id,
      productId: row.product_id,
      productName: row.product_name,
      count: row.count,
      unitPrice: row.unit_price,
      totalCost: row.item_total,
    })),
  };

  return bill;
}

async updatePaidStatus(id, paid_status) {
  if (![1, 2].includes(Number(paid_status))) {
    throw new Error("Invalid paid status. Use 1 for Pending or 2 for Paid.");
  }

  const [result] = await pool.execute(
    `UPDATE billing
     SET paid_status = ?
     WHERE id = ?`,
    [Number(paid_status), id]
  );

  return result.affectedRows > 0;
}

async addPartialPayment(billingId, paymentDetails) {
  const connection = await pool.getConnection();
  let transactionStarted = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [billRows] = await connection.execute(
      `SELECT total_cost, COALESCE(paid_amount, 0) AS paid_amount
       FROM billing
       WHERE id = ?
       FOR UPDATE`,
      [billingId]
    );

    if (billRows.length === 0) {
      await connection.rollback();
      transactionStarted = false;
      return null;
    }

    const paidAmount = paymentDetails.reduce(
      (total, payment) =>
        total +
        (Number(payment.is_paid ?? payment.isPaid) === 1
          ? Number(payment.amount)
          : 0),
      0
    );
    const newPaidAmount = Number(billRows[0].paid_amount) + paidAmount;
    const totalCost = Number(billRows[0].total_cost);

    if (newPaidAmount > totalCost) {
      throw new Error("Partial payment exceeds the remaining bill amount");
    }

    for (const payment of paymentDetails) {
      await connection.execute(
        `INSERT INTO partial_billing (billing_id, amount, is_paid, pay_type)
         VALUES (?, ?, ?, ?)`,
        [
          billingId,
          payment.amount,
          payment.is_paid ?? payment.isPaid,
          payment.payType,
        ]
      );
    }

    await connection.execute(
      `UPDATE billing
       SET paid_amount = ?,
           paid_status = ?
       WHERE id = ?`,
      [newPaidAmount, newPaidAmount >= totalCost ? 2 : 1, billingId]
    );

    await connection.commit();
    transactionStarted = false;

    return await this.getBillById(billingId);
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }
}

async getPartialPaymentHistory() {
  const [rows] = await pool.execute(
    `SELECT
       partial_billing.*,
       billing.customer_name,
       billing.customer_mobile
     FROM partial_billing
     JOIN billing ON billing.id = partial_billing.billing_id`
  );

  return rows;
}

async getPaymentGroupedByCustomer() {
  const [rows] = await pool.execute(
    `SELECT
       customer_name AS customerName,
       SUM(total_cost - COALESCE(paid_amount, 0)) AS remainingAmount
     FROM billing
     GROUP BY customer_name
     HAVING remainingAmount > 0`
  );

  return rows;
}

async totalSalesToday() {
  const [rows] = await pool.execute(
    `SELECT SUM(total_cost) AS totalSales, COUNT(*) AS totalBills
     FROM billing
     WHERE DATE(created_at) = CURDATE()`
  );
  return {
    totalSales: rows[0].totalSales || 0,
    totalBills: rows[0].totalBills || 0,
  };
   
}

async getSalesReport(startDate, endDate) {
  const dateFilter = `created_at >= ?
    AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
  const dateParams = [startDate, endDate];

  const [[summaryRows], [productRows], [trendRows]] = await Promise.all([
    pool.execute(
      `SELECT
         COALESCE(SUM(total_cost), 0) AS totalSalesAmount,
         COUNT(*) AS totalBills,
         COALESCE(AVG(total_cost), 0) AS averageBillValue
       FROM billing
       WHERE ${dateFilter}`,
      dateParams
    ),
    pool.execute(
      `SELECT
         p.name AS product_name,
         SUM(bi.count) AS qty_sold
       FROM billing b
       JOIN billing_items bi ON bi.billing_id = b.id
       JOIN products p ON p.id = bi.product_id
       WHERE b.created_at >= ?
         AND b.created_at < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY p.id, p.name
       ORDER BY qty_sold DESC, p.name ASC`,
      dateParams
    ),
    pool.execute(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m-%d') AS date,
         SUM(total_cost) AS amountSold
       FROM billing
       WHERE ${dateFilter}
       GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
       ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
      dateParams
    )
  ]);

  const salesByDate = new Map(
    trendRows.map((row) => [row.date, Number(row.amountSold)])
  );
  const salesTrend = [];
  const currentDate = new Date(`${startDate}T00:00:00.000Z`);
  const lastDate = new Date(`${endDate}T00:00:00.000Z`);

  while (currentDate <= lastDate) {
    const date = currentDate.toISOString().slice(0, 10);
    salesTrend.push({
      date,
      amountSold: salesByDate.get(date) || 0
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  const summary = summaryRows[0];

  return {
    startDate,
    endDate,
    totalSalesAmount: Number(summary.totalSalesAmount),
    totalBills: Number(summary.totalBills),
    averageBillValue: Number(summary.averageBillValue),
    topSellingProducts: productRows.map((row) => ({
      product_name: row.product_name,
      qty_sold: Number(row.qty_sold)
    })),
    salesTrend
  };
}

async getProfitSummary(period) {
  const periodFilters = {
    today: `b.created_at >= CURRENT_DATE
      AND b.created_at < DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY)`,
    month: `b.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
      AND b.created_at < DATE_ADD(
        DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'),
        INTERVAL 1 MONTH
      )`,
    year: `b.created_at >= MAKEDATE(YEAR(CURRENT_DATE), 1)
      AND b.created_at < MAKEDATE(YEAR(CURRENT_DATE) + 1, 1)`
  };
  const periodFilter = periodFilters[period];

  if (!periodFilter) {
    throw new Error("Invalid profit summary period");
  }

  const [rows] = await pool.execute(
    `SELECT
       COALESCE(SUM(bi.unit_price * bi.count), 0) AS totalSales,
       COALESCE(SUM(p.buy_price * bi.count), 0) AS totalPurchaseCost,
       COALESCE(
         SUM((bi.unit_price - p.buy_price) * bi.count),
         0
       ) AS totalProfit
     FROM billing b
     JOIN billing_items bi ON bi.billing_id = b.id
     JOIN products p ON p.id = bi.product_id
     WHERE b.paid_status = 2
       AND ${periodFilter}`
  );

  const totalSales = Number(rows[0].totalSales);
  const totalPurchaseCost = Number(rows[0].totalPurchaseCost);
  const totalProfit = Number(rows[0].totalProfit);

  return {
    period,
    totalSales,
    totalPurchaseCost,
    totalProfit,
    marginPercent: totalSales > 0
      ? Number(((totalProfit / totalSales) * 100).toFixed(2))
      : 0
  };
}
}

module.exports = BillingModel;
