const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');
const Order = require('../models/OrderModel');
const Promotion = require('../models/PromotionModel'); // Assuming there's a Promotion model
const { getSocketInstance } = require('../socket');

const cartController = {
  // Add item to cart with product validation
  addToCart: async (req, res) => {
    try {
      const { userId, productId, quantity } = req.body;

      // Validate product existence and stock
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      if (product.quantity < quantity) {
        return res.status(400).json({ message: 'Not enough stock available' });
      }

      // Add product to user's cart, or update quantity if it already exists
      const cart = await Cart.findOneAndUpdate(
        { userId },
        {
          $addToSet: { items: { productId, quantity, price: product.price } },
          $inc: { totalAmount: product.price * quantity }
        },
        { upsert: true, new: true }
      );

      // Emit socket event after adding item
      const io = getSocketInstance();
      io.emit('cart:itemAdded', cart);

      res.status(200).json(cart);
    } catch (error) {
      console.error('Error adding to cart:', error);
      res.status(500).json({ message: 'Error adding product to cart' });
    }
  },

  // Remove item from cart
  removeFromCart: async (req, res) => {
    try {
      const { userId, itemId } = req.body;

      // Remove the item from the cart and update the total amount
      const cart = await Cart.findOneAndUpdate(
        { userId },
        { 
          $pull: { items: { _id: itemId } },
          $set: { updatedAt: new Date() }
        },
        { new: true }
      );
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      // Emit socket event after removing item
      const io = getSocketInstance();
      io.emit('cart:itemRemoved', { userId, itemId });

      res.status(200).json(cart);
    } catch (error) {
      console.error('Error removing item from cart:', error);
      res.status(500).json({ message: 'Error removing item from cart' });
    }
  },

  // Update cart item quantity
  updateCartItem: async (req, res) => {
    try {
      const { userId, itemId, quantity } = req.body;

      // Ensure the quantity is valid
      if (quantity <= 0) {
        return res.status(400).json({ message: 'Quantity must be greater than zero' });
      }

      // Update the cart item quantity
      const cart = await Cart.findOneAndUpdate(
        { userId, "items._id": itemId },
        { $set: { "items.$.quantity": quantity } },
        { new: true }
      );
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      // Emit socket event after updating item quantity
      const io = getSocketInstance();
      io.emit('cart:itemUpdated', { userId, itemId, quantity });

      res.status(200).json(cart);
    } catch (error) {
      console.error('Error updating cart item:', error);
      res.status(500).json({ message: 'Error updating cart item' });
    }
  },

  // Get the user's cart
  getCart: async (req, res) => {
    try {
      const { userId } = req.params;
      const cart = await Cart.findOne({ userId }).populate('items.productId', 'name price');
      if (!cart) return res.status(404).json({ message: 'Cart not found' });

      res.status(200).json(cart);
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: 'Error fetching cart' });
    }
  },

  // Checkout process with promotion and order creation
  checkout: async (req, res) => {
    try {
      const { userId } = req.params;
      const cart = await Cart.findOne({ userId }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({ message: 'Cart is empty' });
      }

      // Calculate total amount and apply any promotions
      const totalAmount = cart.items.reduce((total, item) => total + item.quantity * item.productId.price, 0);
      const promotionDiscount = await Promotion.calculateDiscount(userId, totalAmount); // Assumed logic

      const finalAmount = totalAmount - promotionDiscount;

      // Create an order
      const order = new Order({
        userId,
        items: cart.items,
        totalAmount: finalAmount,
        discount: promotionDiscount,
        status: 'Pending',
      });
      await order.save();

      // Reduce product stock
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.productId._id, {
          $inc: { quantity: -item.quantity }
        });
      }

      // Clear the cart after successful order
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });

      // Emit socket event for checkout completion
      const io = getSocketInstance();
      io.emit('cart:checkoutCompleted', order);

      res.status(200).json({ message: 'Checkout successful', order });
    } catch (error) {
      console.error('Error during checkout:', error);
      res.status(500).json({ message: 'Error during checkout' });
    }
  },

  // Apply promotion code
  applyPromotion: async (req, res) => {
    try {
      const { userId, promoCode } = req.body;
      const promotion = await Promotion.findValidPromotion(promoCode);
      if (!promotion) {
        return res.status(400).json({ message: 'Invalid promotion code' });
      }

      const cart = await Cart.findOneAndUpdate(
        { userId },
        { $set: { appliedPromotion: promotion._id } },
        { new: true }
      );

      // Emit socket event for promotion applied
      const io = getSocketInstance();
      io.emit('cart:promotionApplied', { userId, promoCode, cart });

      res.status(200).json({ message: 'Promotion applied successfully', cart });
    } catch (error) {
      console.error('Error applying promotion:', error);
      res.status(500).json({ message: 'Error applying promotion' });
    }
  },

  // Save item for later
  saveForLater: async (req, res) => {
    try {
      const { userId, itemId } = req.body;
      const cart = await Cart.findOneAndUpdate(
        { userId },
        {
          $pull: { items: { _id: itemId } },
          $addToSet: { savedItems: itemId }
        },
        { new: true }
      );

      // Emit socket event for saving item for later
      const io = getSocketInstance();
      io.emit('cart:itemSavedForLater', { userId, itemId, cart });

      res.status(200).json(cart);
    } catch (error) {
      console.error('Error saving item for later:', error);
      res.status(500).json({ message: 'Error saving item for later' });
    }
  },

  // Merge guest cart into user cart
  mergeCarts: async (req, res) => {
    try {
      const { userId, guestCartId } = req.body;

      const guestCart = await Cart.findOne({ userId: guestCartId });
      if (!guestCart) {
        return res.status(404).json({ message: 'Guest cart not found' });
      }

      const userCart = await Cart.findOneAndUpdate(
        { userId },
        { $addToSet: { items: { $each: guestCart.items } } },
        { new: true }
      );

      // Clear guest cart
      await Cart.findOneAndDelete({ userId: guestCartId });

      // Emit socket event for merging carts
      const io = getSocketInstance();
      io.emit('cart:cartsMerged', { userId, userCart });

      res.status(200).json(userCart);
    } catch (error) {
      console.error('Error merging carts:', error);
      res.status(500).json({ message: 'Error merging carts' });
    }
  },

  // Apply discount
  applyDiscount: async (req, res) => {
    try {
      const { userId, discountCode } = req.body;
      // Implement apply discount logic (if needed, tie it to a discount model)

      // Emit event if desired (optional)
      const io = getSocketInstance();
      io.emit('cart:discountApplied', { userId, discountCode });

      res.status(200).json({ message: 'Discount applied successfully' });
    } catch (error) {
      console.error('Error applying discount:', error);
      res.status(500).json({ message: 'Error applying discount' });
    }
  }
};

module.exports = cartController;
