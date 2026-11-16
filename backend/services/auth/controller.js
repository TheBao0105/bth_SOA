const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, ValidationError, UniqueConstraintError } = require('sequelize');
const { User } = require('./models');
const config = require('../../config');

const publicUser = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role });

function handleError(res, err) {
  if (err instanceof UniqueConstraintError) return res.status(409).json({ message: 'Username hoặc email đã tồn tại' });
  if (err instanceof ValidationError) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: err.errors.map((e) => e.message) });
  }
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
}

/** Middleware nội bộ: giải mã JWT (chỉ Auth Service giữ JWT_SECRET) */
exports.requireToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return res.status(401).json({ valid: false, message: 'Thiếu token' });
  try {
    req.tokenPayload = jwt.verify(header.slice(7), config.auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ valid: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// POST /auth/register  { username, email, password }
exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email, password là bắt buộc' });
    }
    if (String(password).length < 6) return res.status(400).json({ message: 'Mật khẩu tối thiểu 6 ký tự' });

    const user = await User.create({ username, email, password: await bcrypt.hash(password, 10) });
    res.status(201).json({ message: 'Đăng ký thành công', user: publicUser(user) });
  } catch (err) {
    handleError(res, err);
  }
};

// POST /auth/login  { username | email, password }
exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const login = username || email;
    if (!login || !password) return res.status(400).json({ message: 'Cần username (hoặc email) và password' });

    const user = await User.scope('withPassword').findOne({
      where: { [Op.or]: [{ username: login }, { email: login }] },
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.auth.jwtSecret, {
      expiresIn: config.auth.jwtExpiresIn,
    });
    res.json({
      message: 'Đăng nhập thành công',
      token,
      token_type: 'Bearer',
      expires_in: config.auth.jwtExpiresIn,
      user: publicUser(user),
    });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /auth/verify - các service khác gọi để kiểm tra token (200 hợp lệ / 401 không)
exports.verify = async (req, res) => {
  try {
    const user = await User.findByPk(req.tokenPayload.id);
    if (!user) return res.status(401).json({ valid: false, message: 'Tài khoản không còn tồn tại' });
    res.json({ valid: true, user: publicUser(user) });
  } catch (err) {
    handleError(res, err);
  }
};

// GET /auth/me
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.tokenPayload.id);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    handleError(res, err);
  }
};
