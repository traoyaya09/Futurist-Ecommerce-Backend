const Promotion = require('../models/PromotionModel');
const asyncHandler = require('express-async-handler');
const Joi = require('joi');
const { getSocketInstance } = require('../socket');

// Validation schema for promotion creation/update
const validatePromotion = (data) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    image: Joi.string().uri().required(),
    alt: Joi.string().default('Promotion image'),
    startDate: Joi.date().required(),
    endDate: Joi.date().required(),
    isActive: Joi.boolean().default(true),
    priority: Joi.number().default(0),
  });
  return schema.validate(data);
};

// @desc Get all promotions with filtering, sorting, and pagination
// @route GET /api/promotions
// @access Public
const getPromotions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort = 'priority', isActive } = req.query;

  const filters = {};
  if (isActive !== undefined) filters.isActive = isActive === 'true';

  const promotions = await Promotion.find(filters)
    .sort({ [sort]: -1 }) // Descending order by default
    .skip((page - 1) * limit)
    .limit(Number(limit));

  const total = await Promotion.countDocuments(filters);

  res.status(200).json({ promotions, total, page: Number(page), pages: Math.ceil(total / limit) });
});

// @desc Create a new promotion
// @route POST /api/promotions
// @access Admin
const createPromotion = asyncHandler(async (req, res) => {
  const { error } = validatePromotion(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const promotion = new Promotion(req.body);
  const createdPromotion = await promotion.save();

  // Emit socket event for promotion creation
  const io = getSocketInstance();
  io.emit('promotion:created', createdPromotion);

  res.status(201).json(createdPromotion);
});

// @desc Update an existing promotion
// @route PUT /api/promotions/:id
// @access Admin
const updatePromotion = asyncHandler(async (req, res) => {
  const { error } = validatePromotion(req.body);
  if (error) {
    res.status(400);
    throw new Error(error.details[0].message);
  }

  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    res.status(404);
    throw new Error('Promotion not found');
  }

  Object.assign(promotion, req.body);
  const updatedPromotion = await promotion.save();

  // Emit socket event for promotion update
  const io = getSocketInstance();
  io.emit('promotion:updated', updatedPromotion);

  res.status(200).json(updatedPromotion);
});

// @desc Delete a promotion
// @route DELETE /api/promotions/:id
// @access Admin
const deletePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    res.status(404);
    throw new Error('Promotion not found');
  }

  await promotion.remove();

  // Emit socket event for promotion deletion
  const io = getSocketInstance();
  io.emit('promotion:deleted', req.params.id);

  res.status(200).json({ message: 'Promotion deleted successfully' });
});

module.exports = {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion
};
