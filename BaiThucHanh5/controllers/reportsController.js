const pool = require('../db');
const { getOrder, listOrders, getProduct } = require('../services/clients');

const COST_RATIO = Number(process.env.COST_RATIO ?? 0.7);
const money = (n) => Math.round(n * 100) / 100;
const badRequest = (msg) => Object.assign(new Error(msg), { status: 400 });
const notFound = (msg) => Object.assign(new Error(msg), { status: 404 });
const conflict = (msg) => Object.assign(new Error(msg), { status: 409 });
const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function fetchOrderReport(id) {
  const [rows] = await pool.query('SELECT * FROM orders_reports WHERE id = ?', [id]);
  if (!rows.length) return null;
  const [items] = await pool.query(
    'SELECT * FROM product_reports WHERE order_report_id = ? ORDER BY id',
    [id]
  );
  return { ...rows[0], items };
}

// Tạo báo cáo cho một đơn nếu chưa có, trả về id báo cáo đơn.
async function ensureOrderReport(order, auth) {
  const [existing] = await pool.query(
    'SELECT id FROM orders_reports WHERE order_id = ?',
    [order.id]
  );
  if (existing.length) return existing[0].id;

  const lines = [];
  for (const item of order.items ?? []) {
    const product = await getProduct(item.product_id, auth);
    if (!product) throw badRequest(`Sản phẩm ${item.product_id} không tồn tại`);

    const quantity = Number(item.quantity);
    const revenue = money(Number(item.unit_price) * quantity);
    const cost = money(Number(product.price) * COST_RATIO * quantity);
    lines.push({
      product_id: item.product_id,
      total_sold: quantity,
      revenue,
      cost,
      profit: money(revenue - cost),
    });
  }

  const totalRevenue = money(Number(order.total_amount));
  const totalCost = money(lines.reduce((sum, l) => sum + l.cost, 0));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO orders_reports (order_id, total_revenue, total_cost, total_profit) VALUES (?, ?, ?, ?)',
      [order.id, totalRevenue, totalCost, money(totalRevenue - totalCost)]
    );
    for (const l of lines) {
      await conn.query(
        'INSERT INTO product_reports (order_report_id, product_id, total_sold, revenue, cost, profit) VALUES (?, ?, ?, ?, ?, ?)',
        [r.insertId, l.product_id, l.total_sold, l.revenue, l.cost, l.profit]
      );
    }
    await conn.commit();
    return r.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ----- Báo cáo sản phẩm -----

exports.listProductReports = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM product_reports ORDER BY id');
  res.json(rows);
};

exports.getProductReport = async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw badRequest('ID không hợp lệ');
  const [rows] = await pool.query('SELECT * FROM product_reports WHERE id = ?', [id]);
  if (!rows.length) throw notFound('Không tìm thấy báo cáo sản phẩm');
  res.json(rows[0]);
};

exports.createProductReport = async (req, res) => {
  const productId = toId(req.body?.product_id);
  if (!productId) throw badRequest('product_id không hợp lệ');

  const auth = req.headers.authorization;
  const product = await getProduct(productId, auth);
  if (!product) throw notFound('Không tìm thấy sản phẩm');

  const orders = ((await listOrders(auth)) ?? []).filter((o) => o.status === 'completed');
  for (const summary of orders) {
    const order = await getOrder(summary.id, auth);
    if (order?.items?.some((i) => Number(i.product_id) === productId)) {
      await ensureOrderReport(order, auth);
    }
  }

  const [rows] = await pool.query(
    `SELECT COUNT(*) AS orders,
            COALESCE(SUM(total_sold), 0) AS total_sold,
            COALESCE(SUM(revenue), 0) AS revenue,
            COALESCE(SUM(cost), 0) AS cost,
            COALESCE(SUM(profit), 0) AS profit
       FROM product_reports WHERE product_id = ?`,
    [productId]
  );
  const s = rows[0];
  if (!Number(s.orders)) throw badRequest('Chưa có đơn hoàn thành nào chứa sản phẩm này');

  res.status(201).json({
    product_id: productId,
    name: product.name,
    stock: product.quantity,
    orders: Number(s.orders),
    total_sold: Number(s.total_sold),
    revenue: Number(s.revenue),
    cost: Number(s.cost),
    profit: Number(s.profit),
  });
};

exports.deleteProductReport = async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw badRequest('ID không hợp lệ');
  const [r] = await pool.query('DELETE FROM product_reports WHERE id = ?', [id]);
  if (!r.affectedRows) throw notFound('Không tìm thấy báo cáo sản phẩm');
  res.json({ deleted: true, id });
};

// ----- Báo cáo đơn hàng -----

exports.listOrderReports = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM orders_reports ORDER BY id');
  res.json(rows);
};

exports.getOrderReport = async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw badRequest('ID không hợp lệ');
  const report = await fetchOrderReport(id);
  if (!report) throw notFound('Không tìm thấy báo cáo đơn hàng');
  res.json(report);
};

exports.createOrderReport = async (req, res) => {
  const orderId = toId(req.body?.order_id);
  if (!orderId) throw badRequest('order_id không hợp lệ');

  const [dup] = await pool.query('SELECT id FROM orders_reports WHERE order_id = ?', [orderId]);
  if (dup.length) throw conflict('Đã có báo cáo cho đơn hàng này');

  const auth = req.headers.authorization;
  const order = await getOrder(orderId, auth);
  if (!order) throw notFound('Không tìm thấy đơn hàng');
  if (order.status !== 'completed') throw badRequest('Chỉ tạo báo cáo cho đơn đã hoàn thành');

  const id = await ensureOrderReport(order, auth);
  res.status(201).json(await fetchOrderReport(id));
};

exports.deleteOrderReport = async (req, res) => {
  const id = toId(req.params.id);
  if (!id) throw badRequest('ID không hợp lệ');
  // product_reports bị xóa theo nhờ ON DELETE CASCADE
  const [r] = await pool.query('DELETE FROM orders_reports WHERE id = ?', [id]);
  if (!r.affectedRows) throw notFound('Không tìm thấy báo cáo đơn hàng');
  res.json({ deleted: true, id });
};