const express = require('express');
const c = require('../controllers/reportsController');

const router = express.Router();

router.get('/products', c.listProductReports);
router.post('/products', c.createProductReport);
router.get('/products/:id', c.getProductReport);
router.delete('/products/:id', c.deleteProductReport);

router.get('/orders', c.listOrderReports);
router.post('/orders', c.createOrderReport);
router.get('/orders/:id', c.getOrderReport);
router.delete('/orders/:id', c.deleteOrderReport);

module.exports = router;