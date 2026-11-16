const { ValidationError } = require('sequelize');
const { Order, OrderItem } = require('./models');
const { ServiceError } = require('./productClient');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Tính lại total_amount của đơn = tổng total_price các dòng */
async function recalcOrderTotal(orderId, transaction) {
  const sum = await OrderItem.sum('total_price', { where: { order_id: orderId }, transaction });
  await Order.update({ total_amount: round2(sum || 0) }, { where: { id: orderId }, transaction });
}

function handleError(res, err) {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: err.errors.map((e) => e.message) });
  }
  console.error(err);
  return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
}

module.exports = { round2, recalcOrderTotal, handleError };
