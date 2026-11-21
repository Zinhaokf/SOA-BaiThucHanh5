async function call(baseUrl, path, auth, name) {
  let res;
  try {
    res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: auth } });
  } catch {
    throw Object.assign(new Error(`Không kết nối được dịch vụ ${name}`), { status: 503 });
  }
  if (res.status === 404) return null;
  if (!res.ok) throw Object.assign(new Error(`Dịch vụ ${name} trả về lỗi`), { status: 502 });
  return res.json();
}

const getOrder = (id, auth) =>
  call(process.env.ORDER_SERVICE_URL, `/orders/${id}`, auth, 'đơn hàng');

const listOrders = (auth) =>
  call(process.env.ORDER_SERVICE_URL, '/orders', auth, 'đơn hàng');

const getProduct = (id, auth) =>
  call(process.env.PRODUCT_SERVICE_URL, `/products/${id}`, auth, 'sản phẩm');

module.exports = { getOrder, listOrders, getProduct };