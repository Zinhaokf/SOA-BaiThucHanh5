const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const verifyToken = require('./middleware/verifyToken');
const reportsRouter = require('./routes/reports');

const app = express();
app.use(express.json());

app.use('/reports', verifyToken, reportsRouter);

app.use((req, res) => res.status(404).json({ error: 'Không tìm thấy' }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Lỗi máy chủ' });
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Report service chạy tại http://localhost:${PORT}`));