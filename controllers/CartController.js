// backend/controllers/CartController.js
const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');
const Promotion = require('../models/PromotionModel');
const Order = require('../models/OrderModel');
const User = require('../models/UserModel');
const { normalizeCartItems, normalizeCart } = require('../utils/normalizeCart');
const { adaptProduct } = require('../utils/adaptProduct');
const { emitCartUpdated, emitCheckoutCompleted } = require('../socket');

const CartController = {};

/** -------------------------
 * Programmatic Direct Methods (for AIService)
 * ------------------------- */

// Add or update product in cart
CartController.addOrUpdateProductDirect = async (userId, productId, delta = 1) => {
  if (!userId || !productId) throw new Error('userId and productId are required');

  let product = await Product.findById(productId).lean();
  if (!product) throw new Error('Product not found');
  product = adaptProduct(product);

  const productPrice = Number(product.price ?? 0);
  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });

  const existingIndex = cart.items.findIndex(
    i => (i.product?._id?.toString() === productId.toString()) || (i.product_id?.toString() === productId.toString())
  );

  if (existingIndex >= 0) {
    const newQuantity = (cart.items[existingIndex].quantity ?? 0) + Number(delta);
    if (newQuantity < 1) {
      cart.items.splice(existingIndex, 1);
    } else {
      cart.items[existingIndex].quantity = newQuantity;
      cart.items[existingIndex].price = productPrice;
      cart.items[existingIndex].total = Number((newQuantity * productPrice).toFixed(2));
    }
  } else if (delta > 0) {
    cart.items.push({
      product: product._id,
      product_id: product.id ?? product._id,
      quantity: delta,
      price: productPrice,
      total: Number((delta * productPrice).toFixed(2)),
    });
  }

  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate('items.product savedItems.product');
  populatedCart.items = normalizeCartItems(populatedCart.items);
  populatedCart.savedItems = normalizeCartItems(populatedCart.savedItems);

  emitCartUpdated(populatedCart);
  return normalizeCart(populatedCart);
};

// Remove product from cart
CartController.removeFromCartDirect = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new Error('Cart not found');

  cart.items = cart.items.filter(i => i.product.toString() !== productId.toString());
  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate('items.product savedItems.product');
  populatedCart.items = normalizeCartItems(populatedCart.items);
  populatedCart.savedItems = normalizeCartItems(populatedCart.savedItems);

  emitCartUpdated(populatedCart);
  return normalizeCart(populatedCart);
};

// Save product for later
CartController.saveProductForLaterDirect = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new Error('Cart not found');

  const item = cart.items.find(i => i.product.toString() === productId.toString());
  if (!item) throw new Error('Product not in cart');

  cart.savedItems.push({ product: item.product });
  cart.items = cart.items.filter(i => i.product.toString() !== productId.toString());
  await cart.save();

  const populatedCart = await Cart.findById(cart._id).populate('items.product savedItems.product');
  populatedCart.items = normalizeCartItems(populatedCart.items);
  populatedCart.savedItems = normalizeCartItems(populatedCart.savedItems);

  emitCartUpdated(populatedCart);
  return normalizeCart(populatedCart);
};

// Apply promotion code
CartController.applyPromotionDirect = async (userId, promoCode) => {
  const promotion = await Promotion.findValidPromotion(promoCode);
  if (!promotion) throw new Error('Invalid promotion code');

  const cart = await Cart.findOne({ user: userId }).populate('items.product savedItems.product');
  if (!cart) throw new Error('Cart not found');

  cart.appliedPromotion = promotion._id;
  await cart.save();

  cart.items = normalizeCartItems(cart.items);
  cart.savedItems = normalizeCartItems(cart.savedItems);

  emitCartUpdated(cart);
  return normalizeCart(cart);
};

// Apply discount directly
CartController.applyDiscountDirect = async (userId, discountAmount) => {
  const discount = Number(discountAmount);
  if (isNaN(discount) || discount < 0) throw new Error('Invalid discount amount');

  const cart = await Cart.findOne({ user: userId }).populate('items.product savedItems.product');
  if (!cart) throw new Error('Cart not found');

  if (typeof cart.applyDiscount === 'function') {
    cart.applyDiscount(discount);
  } else {
    cart.discount = discount;
  }
  await cart.save();

  cart.items = normalizeCartItems(cart.items);
  cart.savedItems = normalizeCartItems(cart.savedItems);

  emitCartUpdated(cart);
  return normalizeCart(cart);
};

// Merge guest cart into user's cart
CartController.mergeCartsDirect = async (userId, guestCartId) => {
  const guestCart = await Cart.findById(guestCartId);
  if (!guestCart) throw new Error('Guest cart not found');

  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });

  for (const item of guestCart.items) {
    const existingItem = cart.items.find(i => i.product.toString() === item.product.toString());
    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.total = Number((existingItem.quantity * existingItem.price).toFixed(2));
    } else {
      cart.items.push(item);
    }
  }

  await cart.save();
  await Cart.findByIdAndDelete(guestCartId);

  const populatedCart = await Cart.findById(cart._id).populate('items.product savedItems.product');
  populatedCart.items = normalizeCartItems(populatedCart.items);
  populatedCart.savedItems = normalizeCartItems(populatedCart.savedItems);

  emitCartUpdated(populatedCart);
  return normalizeCart(populatedCart);
};

// Checkout cart
CartController.checkoutCartDirect = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

  cart.items = normalizeCartItems(cart.items);
  const totalAmount = cart.items.reduce((sum, i) => sum + (i.total ?? 0), 0);
  const finalAmount = totalAmount - (cart.discount ?? 0);

  const order = new Order({
    user: userId,
    items: cart.items,
    totalAmount,
    discount: cart.discount ?? 0,
    status: 'Pending',
  });
  await order.save();

  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -item.quantity } });
  }

  cart.items = [];
  await cart.save();

  emitCheckoutCompleted(order);
  return { order, cart: normalizeCart(cart) };
};

/** -------------------------
 * Express Handlers
 * ------------------------- */

// Get user's cart
CartController.getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    let cart = await Cart.findOne({ user: userId }).populate('items.product savedItems.product');
    if (!cart) cart = new Cart({ user: userId });

    cart.items = normalizeCartItems(cart.items);
    cart.savedItems = normalizeCartItems(cart.savedItems);

    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, message: 'Error fetching cart' });
  }
};

// Add/update product
CartController.addOrUpdateProduct = async (req, res) => {
  try {
    const { userId } = req.params;
    const { id, delta } = req.body;
    const updatedCart = await CartController.addOrUpdateProductDirect(userId, id, delta);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove product
CartController.removeProduct = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const updatedCart = await CartController.removeFromCartDirect(userId, id);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Save for later
CartController.saveProductForLater = async (req, res) => {
  try {
    const { userId, id } = req.params;
    const updatedCart = await CartController.saveProductForLaterDirect(userId, id);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Apply promotion
CartController.applyPromotion = async (req, res) => {
  try {
    const { userId } = req.params;
    const { promoCode } = req.body;
    const updatedCart = await CartController.applyPromotionDirect(userId, promoCode);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Apply discount
CartController.applyDiscount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { discountAmount } = req.body;
    const updatedCart = await CartController.applyDiscountDirect(userId, discountAmount);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Merge guest cart
CartController.mergeCarts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { guestCartId } = req.body;
    const updatedCart = await CartController.mergeCartsDirect(userId, guestCartId);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Checkout
CartController.checkout = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await CartController.checkoutCartDirect(userId);
    res.status(200).json({ success: true, message: 'Checkout successful', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
 
  }
};

module.exports = CartController;
