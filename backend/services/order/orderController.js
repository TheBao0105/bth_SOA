const { sequelize, Order, OrderItem, ORDER_STATUSES } = require('./models');
const productService = require('./productClient');
const { round2, handleError } = require('./helpers');

// GET /orders  (lọc tùy chọn: ?status=pending&customer_email=...)
exports.getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.customer_email) where.customer_email = req.query.customer_email;

    const orders = await Order.findAll({
      where,
      include: [{ model: OrderItem, as: 'items' }],
      order: [['id', 'DESC']],
    });
    res.json({ count: orders.length, data: orders });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /orders/:id
exports.getById = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'items' }] });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    res.json({ data: order });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * POST /orders
 * Body: { customer_name, customer_email, items: [{ product_id, quantity }] }
 * - Kiểm tra tồn kho từng sản phẩm qua Product Service
 * - Lấy tên + giá tại thời điểm đặt hàng
 * - Tính total_price từng dòng và total_amount của đơn
 */
exports.create = async (req, res) => {
  const { customer_name, customer_email, items } = req.body;
  if (!customer_name || !customer_email) {
    return res.status(400).json({ message: 'customer_name và customer_email là bắt buộc' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items phải là mảng có ít nhất 1 sản phẩm' });
  }

  // Gộp các dòng trùng product_id
  const merged = new Map();
  for (const it of items) {
    const pid = Number(it.product_id);
    const qty = Number(it.quantity);
    if (!Number.isInteger(pid) || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Mỗi item cần product_id và quantity (số nguyên > 0)' });
    }
    merged.set(pid, (merged.get(pid) || 0) + qty);
  }

  const auth = req.headers.authorization;
  const deducted = []; // để hoàn kho nếu có lỗi giữa chừng
  const t = await sequelize.transaction();
  try {
    // 1. Kiểm tra tồn kho & lấy thông tin sản phẩm
    const lines = [];
    for (const [product_id, quantity] of merged) {
      const p = await productService.checkStock(product_id, quantity, auth);
      lines.push({
        product_id,
        product_name: p.name,
        quantity,
        unit_price: round2(p.price),
        total_price: round2(p.price * quantity),
      });
    }
    const total_amount = round2(lines.reduce((s, l) => s + l.total_price, 0));

    // 2. Lưu đơn hàng + chi tiết
    const order = await Order.create(
      { customer_name, customer_email, total_amount, status: 'pending' },
      { transaction: t }
    );
    await OrderItem.bulkCreate(
      lines.map((l) => ({ ...l, order_id: order.id })),
      { transaction: t, validate: true }
    );

    // 3. Trừ tồn kho bên Product Service
    for (const l of lines) {
      await productService.adjustStock(l.product_id, -l.quantity, auth);
      deducted.push(l);
    }

    await t.commit();
    const created = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: 'items' }] });
    res.status(201).json({ message: 'Tạo đơn hàng thành công', data: created });
  } catch (err) {
    await t.rollback();
    for (const l of deducted) {
      await productService.adjustStock(l.product_id, l.quantity, auth).catch(() => {});
    }
    handleError(res, err);
  }
};

/**
 * PUT /orders/:id
 * Body: { status, customer_name?, customer_email? }
 * Chỉ cho phép chuyển trạng thái từ pending -> completed | cancelled.
 * Hủy đơn => hoàn lại tồn kho.
 */
exports.update = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'items' }] });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    const { status, customer_name, customer_email } = req.body;

    if (status !== undefined && status !== order.status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status phải là một trong: ${ORDER_STATUSES.join(', ')}` });
      }
      if (order.status !== 'pending') {
        return res
          .status(400)
          .json({ message: `Đơn hàng đã ở trạng thái "${order.status}", không thể chuyển sang "${status}"` });
      }
      if (status === 'cancelled') {
        for (const it of order.items) {
          await productService.adjustStock(it.product_id, it.quantity, req.headers.authorization);
        }
      }
      order.status = status;
    }
    if (customer_name !== undefined) order.customer_name = customer_name;
    if (customer_email !== undefined) order.customer_email = customer_email;

    await order.save();
    res.json({ message: 'Cập nhật đơn hàng thành công', data: order });
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /orders/:id  (đơn đang pending => hoàn kho trước khi xóa)
exports.remove = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, { include: [{ model: OrderItem, as: 'items' }] });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

    if (order.status === 'pending') {
      for (const it of order.items) {
        await productService.adjustStock(it.product_id, it.quantity, req.headers.authorization);
      }
    }
    await sequelize.transaction(async (t) => {
      await OrderItem.destroy({ where: { order_id: order.id }, transaction: t });
      await order.destroy({ transaction: t });
    });
    res.json({ message: 'Xóa đơn hàng thành công', id: order.id });
  } catch (err) {
    handleError(res, err);
  }
};
