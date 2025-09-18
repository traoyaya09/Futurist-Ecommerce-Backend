const Cart = require('../models/CartModel');
const Product = require('../models/ProductModel');

const cartHelper = {
  addToCart: async (userId, productId, quantity = 1) => {
    try {
      // Fetch product by ID
      const product = await Product.findById(productId);

      if (!product) {
        throw new Error('Product not found');
      }

      if (product.stock < quantity) {
        throw new Error('Insufficient stock');
      }

      // Find or create cart for the user
      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
        cart = new Cart({ user: userId, items: [] });
      }

      // Check if the product already exists in the cart
      const existingItemIndex = cart.items.findIndex(item => item.product.equals(productId));
      if (existingItemIndex !== -1) {
        // Update quantity if product is already in cart
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].total = cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].price;
      } else {
        // Add new product to the cart
        cart.items.push({
          product: productId,
          quantity,
          price: product.price,
          total: product.price * quantity
        });
      }

      // Recalculate total
      cart.total = cart.items.reduce((acc, item) => acc + item.total, 0);

      // Save the updated cart
      await cart.save();

      return cart;
    } catch (error) {
      console.error('Error adding product to cart:', error.message);
      throw new Error('Error adding product to cart');
    }
  },

  removeFromCart: async (userId, productId) => {
    try {
      // Find the cart for the user
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Check if the product exists in the cart
      const existingItemIndex = cart.items.findIndex(item => item.product.equals(productId));
      if (existingItemIndex === -1) {
        throw new Error('Product not found in cart');
      }

      // Remove the product from the cart
      cart.items.splice(existingItemIndex, 1);

      // Recalculate the total after removal
      cart.total = cart.items.reduce((acc, item) => acc + item.total, 0);

      // Save the updated cart
      await cart.save();

      return cart;
    } catch (error) {
      console.error('Error removing product from cart:', error.message);
      throw new Error('Error removing product from cart');
    }
  },

  updateCartItem: async (userId, productId, quantity) => {
    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      const existingItemIndex = cart.items.findIndex(item => item.product.equals(productId));
      if (existingItemIndex === -1) {
        throw new Error('Product not found in cart');
      }

      // Fetch the product to ensure enough stock
      const product = await Product.findById(productId);
      if (product.stock < quantity) {
        throw new Error('Insufficient stock');
      }

      // Update quantity and total
      cart.items[existingItemIndex].quantity = quantity;
      cart.items[existingItemIndex].total = product.price * quantity;

      // Recalculate cart total
      cart.total = cart.items.reduce((acc, item) => acc + item.total, 0);

      await cart.save();

      return cart;
    } catch (error) {
      console.error('Error updating cart item:', error.message);
      throw new Error('Error updating cart item');
    }
  },

  clearCart: async (userId) => {
    try {
      const cart = await Cart.findOneAndUpdate(
        { user: userId },
        { items: [], total: 0 },
        { new: true }
      );
      if (!cart) {
        throw new Error('Cart not found');
      }
      return cart;
    } catch (error) {
      console.error('Error clearing cart:', error.message);
      throw new Error('Error clearing cart');
    }
  },

  calculateTotal: async (userId) => {
    try {
      const cart = await Cart.findOne({ user: userId });
      if (!cart) {
        throw new Error('Cart not found');
      }

      // Calculate total from cart items
      cart.total = cart.items.reduce((acc, item) => acc + item.total, 0);
      await cart.save();

      return cart.total;
    } catch (error) {
      console.error('Error calculating total:', error.message);
      throw new Error('Error calculating total');
    }
  },

  mergeCarts: async (userId, guestCartId) => {
    try {
      const guestCart = await Cart.findOne({ user: guestCartId });
      if (!guestCart) {
        throw new Error('Guest cart not found');
      }

      const userCart = await Cart.findOne({ user: userId }) || new Cart({ user: userId });

      // Merge items from guest cart into user cart
      guestCart.items.forEach((guestItem) => {
        const existingItemIndex = userCart.items.findIndex(item => item.product.equals(guestItem.product));
        if (existingItemIndex !== -1) {
          // If product already exists in user cart, update quantity
          userCart.items[existingItemIndex].quantity += guestItem.quantity;
          userCart.items[existingItemIndex].total = userCart.items[existingItemIndex].quantity * userCart.items[existingItemIndex].price;
        } else {
          // Otherwise, add the guest item to user cart
          userCart.items.push(guestItem);
        }
      });

      // Recalculate total
      userCart.total = userCart.items.reduce((acc, item) => acc + item.total, 0);

      // Clear guest cart and save user cart
      await Cart.findOneAndUpdate({ user: guestCartId }, { items: [] });
      await userCart.save();

      return userCart;
    } catch (error) {
      console.error('Error merging carts:', error.message);
      throw new Error('Error merging carts');
    }
  },
};

module.exports = cartHelper;
