module.exports = async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Thiếu token' });

  let r;
  try {
    r = await fetch(`${process.env.AUTH_SERVICE_URL}/auth`, {
      headers: { Authorization: auth },
    });
  } catch {
    return res.status(503).json({ error: 'Không kết nối được dịch vụ xác thực' });
  }

  if (!r.ok) return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  next();
};