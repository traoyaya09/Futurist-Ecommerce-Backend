// backend/controllers/CartController.js
const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');
const Promotion = require('../models/PromotionModel');
const Order = require('../models/OrderModel');

let socketUtils;
const getSocketUtils = () => {
  if (!socketUtils) socketUtils = require('../socket');
  return socketUtils;
};

const CartController = {};

/** -------------------------
 * Helpers
 * ------------------------- */

// Normalize cart for frontend (optimized batch product query)
const normalizeCartForClient = async (cart) => {
  if (!cart) return null;

  // --- Collect all product IDs from items + savedItems
  const productIds = [
    ...new Set([
      ...cart.items.map(i => i.productId?.toString()).filter(Boolean),
      ...cart.savedItems.map(i => i.productId?.toString()).filter(Boolean),
    ]),
  ];

  // --- Batch fetch all products
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id name price stock relatedProducts")
    .lean();

  const productMap = new Map(products.map(p => [p._id.toString(), p]));

  // --- Build items array efficiently
  const items = cart.items.map(i => {
    const product = productMap.get(i.productId?.toString());
    return {
      productId: i.productId,
      name: product?.name || "Unknown",
      price: i.price ?? product?.price ?? 0,
      quantity: i.quantity,
      total: i.total,
      stockStatus:
        product?.stock > 5 ? "in_stock" :
        product?.stock > 0 ? "low_stock" :
        "out_of_stock",
    };
  });

  // --- Saved items (for later)
  const savedItems = cart.savedItems.map(i => ({
    productId: i.productId,
    name: productMap.get(i.productId?.toString())?.name || "Unknown",
  }));

  // --- Promotion lookup
  let promotionDetails = null;
  if (cart.appliedPromotion) {
    const promo = await Promotion.findById(cart.appliedPromotion)
      .select("_id code discount active")
      .lean();
    if (promo) {
      promotionDetails = {
        _id: promo._id,
        code: promo.code,
        discount: promo.discount,
        active: promo.active,
      };
    }
  }

  // --- Return normalized structure
  return {
    user: cart.user,
    items,
    savedItems,
    appliedPromotion: promotionDetails,
    discount: cart.discount || promotionDetails?.discount || 0,
    updatedAt: cart.updatedAt,
  };
};

CartController.ensureActivePromotion = async (cart) => {
  if (!cart.appliedPromotion) {
    const activePromo = await Promotion.findOne({ active: true }).sort({ createdAt: -1 });
    if (activePromo) {
      cart.appliedPromotion = activePromo._id;
      cart.discount = activePromo.discount || 0;
      await cart.save();
    }
  }
  return cart;
};

/** -------------------------
 * Direct Methods
 * ------------------------- */

CartController.getCartSummaryDirect = async (userId) => {
  try {
    const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });
    return await normalizeCartForClient(cart);
  } catch (err) {
    throw { message: err.message, code: 'cart_error' };
  }
};

CartController.addOrUpdateProductDirect = async (userId, productId, delta = 1) => {
  if (!userId || !productId) throw { message: 'userId and productId are required', code: 'cart_error' };

  const product = await Product.findById(productId).lean();
  if (!product) throw { message: 'Product not found', code: 'cart_error' };

  let cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });
  cart = await CartController.ensureActivePromotion(cart);

  const index = cart.items.findIndex(i => i.productId && i.productId.toString() === productId.toString());

  if (index >= 0) {
    const newQuantity = cart.items[index].quantity + delta;
    if (newQuantity < 1) cart.items.splice(index, 1);
    else {
      cart.items[index].quantity = newQuantity;
      cart.items[index].price = Number(product.price);
      cart.items[index].total = Number((newQuantity * product.price).toFixed(2));
    }
  } else if (delta > 0) {
    cart.items.push({
      productId: product._id,
      quantity: delta,
      price: Number(product.price),
      total: Number((delta * product.price).toFixed(2)),
    });
  }

  await cart.save();
  getSocketUtils().emitCartUpdated(userId, cart);

  return normalizeCartForClient(cart);
};

CartController.removeFromCartDirect = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw { message: 'Cart not found', code: 'cart_error' };

  cart.items = cart.items.filter(i => i.productId && i.productId.toString() !== productId.toString());
  await cart.save();
  getSocketUtils().emitCartUpdated(userId, cart);

  return normalizeCartForClient(cart);
};

CartController.saveProductForLaterDirect = async (userId, productId) => {
  if (!productId) throw { message: 'productId is required', code: 'cart_error' };
  if (!userId) throw { message: 'userId is required', code: 'cart_error' };

  const pid = productId.toString();
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw { message: 'Cart not found', code: 'cart_error' };

  const index = cart.items.findIndex(i => i.productId && i.productId.toString() === pid);
  if (index === -1) throw { message: 'Product not in cart', code: 'cart_error' };

  cart.savedItems.push({ productId: pid });
  cart.items.splice(index, 1);

  await cart.save();
  getSocketUtils().emitCartUpdated(userId, cart);

  return normalizeCartForClient(cart);
};

CartController.applyPromotionDirect = async (userId, promoCode) => {
  const promotion = await Promotion.findValidPromotion(promoCode);
  if (!promotion) throw { message: 'Invalid promotion code', code: 'cart_error' };

  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });
  cart.appliedPromotion = promotion._id;
  cart.discount = promotion.discount || 0;

  await cart.save();
  getSocketUtils().emitCartUpdated(userId, cart);

  return normalizeCartForClient(cart);
};

CartController.applyDiscountDirect = async (userId, discountAmount) => {
  const discount = Number(discountAmount);
  if (isNaN(discount) || discount < 0) throw { message: 'Invalid discount', code: 'cart_error' };

  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });
  cart.discount = discount;

  await cart.save();
  getSocketUtils().emitCartUpdated(userId, cart);

  return normalizeCartForClient(cart);
};

CartController.mergeCartsDirect = async (userId, guestCartId) => {
  const guestCart = await Cart.findById(guestCartId);
  if (!guestCart) throw { message: 'Guest cart not found', code: 'cart_error' };

  const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });

  guestCart.items = guestCart.items.filter(i => i.productId);

  for (const item of guestCart.items) {
    const existing = cart.items.find(i => i.productId && i.productId.toString() === item.productId.toString());
    if (existing) {
      existing.quantity += item.quantity;
      existing.total = Number((existing.quantity * existing.price).toFixed(2));
    } else {
      cart.items.push(item);
    }
  }

  await cart.save();
  await Cart.findByIdAndDelete(guestCartId);

  getSocketUtils().emitCartUpdated(userId, cart);
  return normalizeCartForClient(cart);
};

CartController.checkoutCartDirect = async (userId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart || cart.items.length === 0) throw { message: 'Cart is empty', code: 'cart_error' };

  let totalAmount = 0;
  for (const item of cart.items) {
    if (!item.productId) continue;
    totalAmount += item.total;
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.quantity } });
  }

  const order = new Order({
    user: userId,
    items: cart.items,
    totalAmount,
    discount: cart.discount || 0,
    status: 'Pending',
  });
  await order.save();

  cart.items = [];
  await cart.save();
  getSocketUtils().emitCheckoutCompleted(userId, order);

  return { order, cart: await normalizeCartForClient(cart) };
};

/** -------------------------
 * Express Handlers
 * ------------------------- */

const handleError = (res, error) => {
  console.error(error);
  res.status(500).json({ success: false, message: error.message, code: error.code || 'cart_error' });
};

CartController.getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required', code: 'cart_error' });

    const cart = (await Cart.findOne({ user: userId })) || new Cart({ user: userId });
    res.status(200).json({ success: true, data: await normalizeCartForClient(cart) });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.addOrUpdateProduct = async (req, res) => {
  try {
    const { userId } = req.params;
    const { productId, delta } = req.body;
    const updatedCart = await CartController.addOrUpdateProductDirect(userId, productId, delta);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.removeProduct = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    const updatedCart = await CartController.removeFromCartDirect(userId, productId);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.saveProductForLater = async (req, res) => {
  try {
    const { userId, productId } = req.params;
    if (!productId) return res.status(400).json({ success: false, message: 'productId required', code: 'cart_error' });

    const updatedCart = await CartController.saveProductForLaterDirect(userId, productId.toString());
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.applyPromotion = async (req, res) => {
  try {
    const { userId } = req.params;
    const { promoCode } = req.body;
    const updatedCart = await CartController.applyPromotionDirect(userId, promoCode);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.applyDiscount = async (req, res) => {
  try {
    const { userId } = req.params;
    const { discountAmount } = req.body;
    const updatedCart = await CartController.applyDiscountDirect(userId, discountAmount);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.mergeCarts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { guestCartId } = req.body;
    const updatedCart = await CartController.mergeCartsDirect(userId, guestCartId);
    res.status(200).json({ success: true, data: updatedCart });
  } catch (error) {
    handleError(res, error);
  }
};

CartController.checkout = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await CartController.checkoutCartDirect(userId);
    res.status(200).json({ success: true, message: 'Checkout successful', data: result });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = CartController;
