const { DataTypes } = require('sequelize');
const { createDatabase } = require('../../shared/database');
const config = require('../../config');

const sequelize = createDatabase(config.order.dbName);

// DECIMAL trả về string với mysql -> chuyển sang number khi xuất JSON
const money = (field) => ({
  type: DataTypes.DECIMAL(10, 2),
  allowNull: false,
  defaultValue: 0,
  get() {
    const v = this.getDataValue(field);
    return v === null || v === undefined ? v : Number(v);
  },
});

const ORDER_STATUSES = ['pending', 'completed', 'cancelled'];

const Order = sequelize.define(
  'Order',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_name: { type: DataTypes.STRING(255), allowNull: false },
    customer_email: { type: DataTypes.STRING(255), allowNull: false, validate: { isEmail: true } },
    total_amount: money('total_amount'),
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pending',
      validate: { isIn: [ORDER_STATUSES] },
    },
  },
  { tableName: 'orders', underscored: true, timestamps: true }
);

const OrderItem = sequelize.define(
  'OrderItem',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    product_name: { type: DataTypes.STRING(255), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
    unit_price: money('unit_price'),
    total_price: money('total_price'),
  },
  { tableName: 'order_items', underscored: true, timestamps: true }
);

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE', hooks: true });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

module.exports = { sequelize, Order, OrderItem, ORDER_STATUSES };
