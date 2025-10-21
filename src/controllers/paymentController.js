const paymentService = require('../services/paymentService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Payment Controller
 */

/**
 * Initiate payment
 * POST /api/payments/initiate
 */
const initiatePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.initiatePayment(req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Verify payment
 * POST /api/payments/verify
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { reference } = req.body;
  const result = await paymentService.verifyPayment(reference);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Release payment
 * POST /api/payments/:id/release
 */
const releasePayment = asyncHandler(async (req, res) => {
  const result = await paymentService.releasePayment(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Request refund
 * POST /api/payments/:id/refund
 */
const requestRefund = asyncHandler(async (req, res) => {
  const result = await paymentService.requestRefund(
    req.params.id,
    req.user.id,
    req.body.reason
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get payment history
 * GET /api/payments/history
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
  const result = await paymentService.getPaymentHistory(req.user.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  initiatePayment,
  verifyPayment,
  releasePayment,
  requestRefund,
  getPaymentHistory,
};
