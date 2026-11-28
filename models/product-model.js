
const pool = require('../common/connect-database');

 class Product {
  // Get all products
  async getAllProducts() {
    const [rows] = await pool.execute(
      'SELECT id, name, count, sell_price as sellPrice, buy_price as buyPrice, category, unit FROM products'
    );

    return rows;
  }

  async getProductsForInventory() {
    const [rows] = await pool.execute(
      `SELECT
    id AS productId,
    name AS productName,
    count,
    CASE
        WHEN count = 0 THEN 'Out of Stock'
        WHEN count < 15 THEN 'Low Stock'
        ELSE 'In Stock'
    END AS stockStatus
FROM products;`,
    );  

    return rows;
  }

  async getDeadStockProducts(days) {
    const [rows] = await pool.execute(
      `SELECT
         p.id AS productId,
         p.name AS productName,
         p.category,
         p.count AS stockCount,
         sales.last_sold_at AS lastSoldAt,
         CASE
           WHEN sales.last_sold_at IS NULL THEN NULL
           ELSE DATEDIFF(CURRENT_DATE, DATE(sales.last_sold_at))
         END AS daysSinceLastSale
       FROM products p
       LEFT JOIN (
         SELECT bi.product_id, MAX(b.created_at) AS last_sold_at
         FROM billing_items bi
         JOIN billing b ON b.id = bi.billing_id
         WHERE b.paid_status = 2
         GROUP BY bi.product_id
       ) sales ON sales.product_id = p.id
       WHERE p.count > 0
         AND (
           sales.last_sold_at IS NULL
           OR sales.last_sold_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)
         )
       ORDER BY sales.last_sold_at ASC, p.name ASC`,
      [days]
    );

    return rows;
  }

  async lowStockProducts() {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS lowStockItems
       FROM products
      WHERE count > 0 AND count < 15;`)  ;

      return rows[0].lowStockItems || 0; 
    }

  async totalProducts() {   
    const [rows] = await pool.execute(`SELECT COUNT(*) AS totalProducts FROM products;`);
    return rows[0].totalProducts || 0; 
  }

  // Add a new product
  async addProduct({ name, count, sellPrice, buyPrice, category, unit }) {
    const [result] = await pool.execute(
      `INSERT INTO products (name, count, sell_price, buy_price, category, unit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, count, sellPrice, buyPrice, category, unit]
    );

    return {
      id: result.insertId,
      name,
      count,
      sellPrice,
      buyPrice,
      category,
      unit
    };
  }

  // Get product by ID
  async getProductById(id) {
    const [rows] = await pool.execute(
      'SELECT id, name, count, sell_price as sellPrice, buy_price as buyPrice FROM products WHERE id = ?',
      [id]
    );

    return rows[0] || null;
  }

  
async updateProduct(id, { name, count, sellPrice, buyPrice }) {
  const [result] = await pool.execute(
    `UPDATE products
     SET name = ?, count = ?, sell_price = ?, buy_price = ?
     WHERE id = ?`,
    [name, count, sellPrice, buyPrice, id]
  );

  if (result.affectedRows === 0) {
    // Check whether the product exists but values were unchanged
    const existing = await this.getProductById(id);

    if (!existing) {
      return null;
    }
  }

  return this.getProductById(id);
}

 async deleteProduct(id) {
  const [result] = await pool.execute(
    'DELETE FROM products WHERE id = ?',
    [id]
  );

  return result.affectedRows > 0;
}

 async updateProductCount(id, updatedCount, conection) {
  const poolToUse = conection || pool;
  const [result] = await poolToUse.execute(
    `UPDATE products
     SET count = count - ?
     WHERE id = ? AND count >= ?`,
    [updatedCount, id, updatedCount]
  );

  return { productId: id, updated: result.affectedRows > 0 };
}

}

module.exports = Product;
