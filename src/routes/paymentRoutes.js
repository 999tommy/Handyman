const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate } = require('../middleware/auth');
const { requireCustomer } = require('../middleware/roleCheck');

/**
 * Payment Routes
 */

// Paystack webhook (no auth)
router.post('/webhook', paymentController.handleWebhook);

// Initiate payment
router.post(
  '/initiate',
  authenticate,
  requireCustomer,
  paymentController.initiatePayment
);

// Verify payment
router.post('/verify', authenticate, paymentController.verifyPayment);

// Release payment
router.post(
  '/:id/release',
  authenticate,
  requireCustomer,
  paymentController.releasePayment
);

// Request refund
router.post(
  '/:id/refund',
  authenticate,
  requireCustomer,
  paymentController.requestRefund
);

// Get payment history
router.get('/history', authenticate, paymentController.getPaymentHistory);

module.exports = router;
