const config = require('../config');

/**
 * Middleware dùng chung cho Product & Order Service:
 * chuyển token sang Auth Service (TH2) kiểm tra qua HTTP, không tự giải mã.
 */
module.exports = async function authenticate(req, res, next) {
  if (!config.authEnabled) return next();

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Thiếu token. Gửi header Authorization: Bearer <token>' });
  }

  try {
    const r = await fetch(config.urls.authVerify, {
      headers: { Authorization: header },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    req.user = (await r.json()).user;
    next();
  } catch (err) {
    res.status(503).json({ message: 'Không kết nối được Auth Service', error: err.message });
  }
};
