const chatService = require('../services/chatService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Chat Controller
 */

/**
 * Get user conversations
 * GET /api/chat/conversations
 */
const getConversations = asyncHandler(async (req, res) => {
  const result = await chatService.getUserConversations(req.user.id, req.query);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Create or get conversation (Direct enquiry / message from artisan profile)
 * POST /api/chat/conversations
 * Body: { artisan_id, job_id? }
 */
const createConversation = asyncHandler(async (req, res) => {
  const { artisan_id, job_id } = req.body;
  const conversation = await chatService.createConversation({
    customerId: req.user.id,
    artisanId: artisan_id,
    jobId: job_id || null,
  });

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

/**
 * Get single conversation by ID
 * GET /api/chat/conversations/:id
 */
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await chatService.getConversationById(req.params.id, req.user.id);

  res.status(200).json({
    success: true,
    data: conversation,
  });
});

/**
 * Get conversation messages
 * GET /api/chat/conversations/:id/messages
 */
const getMessages = asyncHandler(async (req, res) => {
  const result = await chatService.getConversationMessages(
    req.params.id,
    req.user.id,
    req.query
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Send message
 * POST /api/chat/conversations/:id/messages
 */
const sendMessage = asyncHandler(async (req, res) => {
  // Return empty response for empty content instead of letting it hit the DB
  if (!req.body.content || req.body.content.trim() === '') {
    return res.status(200).json({
      success: true,
      data: null,
    });
  }

  const message = await chatService.sendMessage(req.params.id, req.user.id, req.body);

  res.status(201).json({
    success: true,
    data: message,
  });
});

/**
 * Mark messages as read
 * POST /api/chat/conversations/:id/read
 */
const markAsRead = asyncHandler(async (req, res) => {
  const result = await chatService.markMessagesAsRead(
    req.params.id,
    req.user.id,
    req.body.message_ids
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Reschedule job
 * POST /api/chat/conversations/:id/reschedule
 */
const rescheduleJob = asyncHandler(async (req, res) => {
  const result = await chatService.rescheduleJob(req.params.id, req.user.id, req.body);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Increase budget
 * POST /api/chat/conversations/:id/increase-price
 */
const increaseBudget = asyncHandler(async (req, res) => {
  const result = await chatService.increaseBudget(
    req.params.id,
    req.user.id,
    req.body.new_budget
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  getMessages,
  sendMessage,
  markAsRead,
  rescheduleJob,
  increaseBudget,
};
