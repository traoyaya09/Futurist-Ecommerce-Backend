const Order = require('../models/OrderModel');
const Product = require('../models/ProductModel');
const User = require('../models/UserModel'); // Assuming there's a User model
const { sendOrderConfirmationEmail } = require('../services/EmailService');
const { sendOrderStatusUpdateEmail } = require('../services/EmailService');
const { getSocketInstance } = require('../socket');

const orderController = {
    // Create a new order with product availability checks and stock updates
    createOrder: async (req, res) => {
        try {
            const { userId, items, totalAmount, paymentMethod, shippingAddress } = req.body;

            // Validate if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Validate product availability
            const productIds = items.map(item => item.productId);
            const products = await Product.find({ _id: { $in: productIds }, available: true });

            if (products.length !== productIds.length) {
                return res.status(400).json({ message: 'Some products are not available or out of stock' });
            }

            // Check stock levels
            for (const item of items) {
                const product = products.find(p => p._id.equals(item.productId));
                if (!product || product.quantity < item.quantity) {
                    return res.status(400).json({ message: `Insufficient stock for product ${product.name}` });
                }
            }

            // Deduct stock
            await Promise.all(
                items.map(item => 
                    Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } })
                )
            );

            // Create the order
            const order = new Order({
                userId,
                items,
                totalAmount,
                paymentMethod,
                shippingAddress,
                status: 'Pending',
            });

            await order.save();

            // Emit socket event for new order creation
            const io = getSocketInstance();
            io.emit('order:created', order);

            // ✅ Send Order Confirmation Email
            await sendOrderConfirmationEmail(user, order);

            res.status(201).json({ message: 'Order created successfully', order });
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update the status of an order (e.g., from 'Pending' to 'Shipped')
    updateOrderStatus: async (req, res) => {
        try {
            const { orderId } = req.params;
            const { status } = req.body;

            // Validate order status
            const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: 'Invalid order status' });
            }

            const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            // ✅ Send Order Status Update Email
            const user = await User.findById(order.userId);
            await sendOrderStatusUpdateEmail(user, order);

            // Emit socket event for order status update
            const io = getSocketInstance();
            io.emit('order:statusUpdated', order);

            res.status(200).json({ message: 'Order status updated successfully', order });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Cancel an order and restore product availability
    cancelOrder: async (req, res) => {
        try {
            const { orderId } = req.params;
            const order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }

            // Ensure the order is not already cancelled or delivered
            if (['Cancelled', 'Delivered'].includes(order.status)) {
                return res.status(400).json({ message: `Order cannot be cancelled as it is already ${order.status}` });
            }

            // Restore product stock
            await Promise.all(
                order.items.map(item => 
                    Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } })
                )
            );

            // Cancel the order
            order.status = 'Cancelled';
            await order.save();

            // Emit socket event for order cancellation
            const io = getSocketInstance();
            io.emit('order:canceled', order);

            res.status(200).json({ message: 'Order cancelled successfully', order });
        } catch (error) {
            console.error('Error cancelling order:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get all orders for a specific user
    getUserOrders: async (req, res) => {
        try {
            const { userId } = req.params;
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            const orders = await Order.find({ userId }).populate('items.product', 'name price');
            if (orders.length === 0) {
                return res.status(404).json({ message: 'No orders found for this user' });
            }

            res.status(200).json({ success: true, orders });
        } catch (error) {
            console.error('Error fetching user orders:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get all orders (for admin purposes)
    getAllOrders: async (req, res) => {
        try {
            const orders = await Order.find()
                .populate('userId', 'name email')
                .populate('items.product', 'name price');
            res.status(200).json({ success: true, orders });
        } catch (error) {
            console.error('Error fetching all orders:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
};

module.exports = orderController;
