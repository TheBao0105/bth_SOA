const { Op, ValidationError } = require('sequelize');
const { Product } = require('./models');

function handleError(res, err) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: err.errors.map((e) => e.message) });
  }
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
}

const pick = (body) => {
  const data = {};
  for (const k of ['name', 'description', 'price', 'quantity']) if (body[k] !== undefined) data[k] = body[k];
  return data;
};

// GET /products  (?search=tên)
exports.getAll = async (req, res) => {
  try {
    const where = req.query.search ? { name: { [Op.like]: `%${req.query.search}%` } } : {};
    res.json(await Product.findAll({ where, order: [['id', 'ASC']] }));
  } catch (err) {
    handleError(res, err);
  }
};

// GET /products/:id  -> { id, name, description, price, quantity, ... }
exports.getById = async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json(p);
  } catch (err) {
    handleError(res, err);
  }
};

// POST /products  { name, description?, price, quantity }
exports.create = async (req, res) => {
  try {
    res.status(201).json(await Product.create(pick(req.body)));
  } catch (err) {
    handleError(res, err);
  }
};

// PUT /products/:id  (gửi trường nào sửa trường đó)
exports.update = async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    await p.update(pick(req.body));
    res.json(p);
  } catch (err) {
    handleError(res, err);
  }
};

// DELETE /products/:id
exports.remove = async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    await p.destroy();
    res.json({ message: 'Xóa sản phẩm thành công', id: p.id });
  } catch (err) {
    handleError(res, err);
  }
};
