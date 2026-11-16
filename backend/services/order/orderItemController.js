const { sequelize, Order, OrderItem } = require('./models');
const config = require('../../config');
const productService = require('./productClient');
const { recalcOrderTotal, round2, handleError } = require('./helpers');

const stockSync = () => config.order.updateProductStock;

async function getPendingOrder(orderId, res) {
  const order = await Order.findByPk(orderId);
  if (!order) {
    res.status(404).json({ message: `Không tìm thấy đơn hàng id=${orderId}` });
    return null;
  }
  if (order.status !== 'pending') {
    res.status(400).json({ message: `Đơn hàng đang "${order.status}", chỉ sửa được đơn "pending"` });
    return null;
  }
  return order;
}

// GET /order_items  (lọc tùy chọn: ?order_id=1)
exports.getAll = async (req, res) => {
  try {
    const where = {};
    if (req.query.order_id) where.order_id = req.query.order_id;
    const items = await OrderItem.findAll({ where, order: [['id', 'ASC']] });
    res.json({ count: items.length, data: items });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /order_items/:id
exports.getById = async (req, res) => {
  try {
    const item = await OrderItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy mặt hàng' });
    res.json({ data: item });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * POST /order_items
 * Body: { order_id, product_id, quantity }
 * Tên & đơn giá lấy từ Product Service; total_price = quantity * unit_price.
 */
exports.create = async (req, res) => {
  try {
    const order_id = Number(req.body.order_id);
    const product_id = Number(req.body.product_id);
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(order_id) || !Number.isInteger(product_id) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Cần order_id, product_id và quantity (số nguyên > 0)' });
    }

    const order = await getPendingOrder(order_id, res);
    if (!order) return;

    const auth = req.headers.authorization;
    const p = await productService.checkStock(product_id, quantity, auth);

    const item = await sequelize.transaction(async (t) => {
      const created = await OrderItem.create(
        {
          order_id,
          product_id,
          product_name: p.name,
          quantity,
          unit_price: round2(p.price),
          total_price: round2(p.price * quantity),
        },
        { transaction: t }
      );
      await recalcOrderTotal(order_id, t);
      return created;
    });
    await productService.adjustStock(product_id, -quantity, auth);

    res.status(201).json({ message: 'Thêm mặt hàng thành công', data: item });
  } catch (err) {
    handleError(res, err);
  }
};

/**
 * PUT /order_items/:id
 * Body: { quantity }
 * Giữ nguyên unit_price (giá lúc đặt), tính lại total_price và total_amount.
 */
exports.update = async (req, res) => {
  try {
    const item = await OrderItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy mặt hàng' });

    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'quantity phải là số nguyên > 0' });
    }

    const order = await getPendingOrder(item.order_id, res);
    if (!order) return;

    const auth = req.headers.authorization;
    const delta = quantity - item.quantity;
    if (delta > 0) {
      // Nếu đã trừ kho khi đặt thì chỉ cần kiểm tra phần tăng thêm
      await productService.checkStock(item.product_id, stockSync() ? delta : quantity, auth);
    }

    await sequelize.transaction(async (t) => {
      item.quantity = quantity;
      item.total_price = round2(item.unit_price * quantity);
      await item.save({ transaction: t });
      await recalcOrderTotal(item.order_id, t);
    });
    await productService.adjustStock(item.product_id, -delta, auth);

    res.json({ message: 'Cập nhật mặt hàng thành công', data: item });
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /order_items/:id
exports.remove = async (req, res) => {
  try {
    const item = await OrderItem.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy mặt hàng' });

    const order = await getPendingOrder(item.order_id, res);
    if (!order) return;

    await sequelize.transaction(async (t) => {
      await item.destroy({ transaction: t });
      await recalcOrderTotal(item.order_id, t);
    });
    await productService.adjustStock(item.product_id, item.quantity, req.headers.authorization);

    res.json({ message: 'Xóa mặt hàng thành công', id: item.id });
  } catch (err) {
    handleError(res, err);
  }
};
