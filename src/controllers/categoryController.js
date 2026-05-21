const categoryService = require('../services/categoryService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get all categories
 * GET /api/categories
 */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategories();

  res.status(200).json({
    success: true,
    data: categories,
  });
});

module.exports = {
  getCategories,
};
