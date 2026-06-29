const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const moment = require('moment');
const axios = require('axios');
const Order = require('../models/Order');

const config = {
  app_id: process.env.ZALO_APP_ID,
  key1: process.env.ZALO_KEY1,
  key2: process.env.ZALO_KEY2,
  endpoint: process.env.ZALO_ENDPOINT
};

// Tạo đơn hàng ZaloPay
router.post('/create', async (req, res) => {
  try {
    const { orderId, amount, description } = req.body;

    // Tìm order trong database
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const embed_data = {
      redirecturl: 'http://localhost:3000/zalopay/callback'
    };

    const items = order.items.map(item => ({
      itemid: item.product._id,
      itemname: item.product.name,
      itemprice: item.product.price,
      itemquantity: item.quantity
    }));

    const transID = Math.floor(Math.random() * 1000000);
    const orderData = {
      app_id: config.app_id,
      app_trans_id: `${moment().format('YYMMDD')}_${transID}`,
      app_user: order.customerInfo.email,
      app_time: Date.now(),
      item: JSON.stringify(items),
      embed_data: JSON.stringify(embed_data),
      amount: Math.round(amount),
      description: description || `Thanh toán đơn hàng #${order.orderNumber}`,
      bank_code: '',
      callback_url: process.env.ZALO_CALLBACK_URL || 'http://localhost:5000/api/zalopay/callback'
    };

    // Tạo MAC
    const data = config.app_id + "|" + orderData.app_trans_id + "|" + orderData.app_user + "|" + orderData.amount + "|" + orderData.app_time + "|" + orderData.embed_data + "|" + orderData.item;
    orderData.mac = crypto.createHmac('sha256', config.key1).update(data).digest('hex');

    // Gọi API ZaloPay
    const response = await axios.post(config.endpoint, null, { params: orderData });

    // Lưu app_trans_id vào order
    order.paymentInfo = {
      ...order.paymentInfo,
      zalopayTransId: orderData.app_trans_id
    };
    await order.save();

    return res.json({
      success: true,
      order_url: response.data.order_url,
      app_trans_id: orderData.app_trans_id,
      zp_trans_token: response.data.zp_trans_token
    });

  } catch (error) {
    console.error('ZaloPay create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tạo đơn hàng ZaloPay',
      error: error.message
    });
  }
});

// Callback từ ZaloPay
router.post('/callback', async (req, res) => {
  let result = {};

  try {
    let dataStr = req.body.data;
    let reqMac = req.body.mac;

    let mac = crypto.createHmac('sha256', config.key2)
      .update(dataStr)
      .digest('hex');

    console.log('ZaloPay callback - MAC =', mac);

    // Kiểm tra callback hợp lệ
    if (reqMac !== mac) {
      result.return_code = -1;
      result.return_message = 'mac not equal';
    } else {
      // Thanh toán thành công
      let dataJson = JSON.parse(dataStr);
      console.log('ZaloPay callback - Payment success:', dataJson);

      // Cập nhật order status
      const order = await Order.findOne({ 
        'paymentInfo.zalopayTransId': dataJson.app_trans_id 
      });

      if (order) {
        order.paymentStatus = 'Paid';
        order.status = 'Processing';
        order.paymentInfo = {
          ...order.paymentInfo,
          zalopayTransId: dataJson.app_trans_id,
          zalopayTime: new Date(dataJson.server_time)
        };
        await order.save();
        console.log('Order updated:', order.orderNumber);
      }

      result.return_code = 1;
      result.return_message = 'success';
    }
  } catch (ex) {
    result.return_code = 0;
    result.return_message = ex.message;
    console.error('ZaloPay callback error:', ex);
  }

  res.json(result);
});

// Kiểm tra trạng thái thanh toán
router.post('/check-status', async (req, res) => {
  try {
    const { app_trans_id } = req.body;

    let postData = {
      app_id: config.app_id,
      app_trans_id: app_trans_id
    };

    let data = postData.app_id + "|" + postData.app_trans_id + "|" + config.key1;
    postData.mac = crypto.createHmac('sha256', config.key1).update(data).digest('hex');

    let postConfig = {
      method: 'post',
      url: 'https://sb-openapi.zalopay.vn/v2/query',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams(postData).toString()
    };

    const response = await axios(postConfig);

    return res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('ZaloPay check status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra trạng thái',
      error: error.message
    });
  }
});

module.exports = router;
