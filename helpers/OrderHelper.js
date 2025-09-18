const Order = require('../models/OrderModel');
const Product = require('../models/ProductModel');
const User = require('../models/UserModel'); // Assuming there is a User model

const createOrder = async (orderData) => {
    try {
        const { userId, items, totalAmount, paymentMethod, shippingAddress } = orderData;

        // Check if the user exists
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check product availability and stock
        const productIds = items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds }, available: true });

        if (products.length !== productIds.length) {
            throw new Error('Some products are not available or out of stock');
        }

        // Validate product quantities and update stock
        for (const item of items) {
            const product = products.find(p => p._id.equals(item.productId));
            if (!product || product.quantity < item.quantity) {
                throw new Error(`Insufficient stock for product ${product.name}`);
            }
        }

        // Deduct product quantities
        await Promise.all(
            items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { quantity: -item.quantity } })
            )
        );

        // Create the new order
        const newOrder = new Order({
            userId,
            items,
            totalAmount,
            paymentMethod,
            shippingAddress,
            status: 'Pending',
        });

        await newOrder.save();
        return newOrder;
    } catch (error) {
        console.error('Error creating order:', error);
        throw new Error('Error creating order');
    }
};

const getAllOrders = async () => {
    try {
        const orders = await Order.find().populate('userId', 'name email').populate('items.productId', 'name price');
        return orders;
    } catch (error) {
        console.error('Error fetching all orders:', error);
        throw new Error('Error fetching all orders');
    }
};

const getOrderById = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('userId', 'name email').populate('items.productId', 'name price');
        if (!order) {
            throw new Error('Order not found');
        }
        return order;
    } catch (error) {
        console.error('Error fetching order by ID:', error);
        throw new Error('Error fetching order by ID');
    }
};

const cancelOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error('Order not found');
        }

        // Ensure the order is not already cancelled or delivered
        if (['Cancelled', 'Delivered'].includes(order.status)) {
            throw new Error(`Order cannot be cancelled as it is already ${order.status}`);
        }

        // Restore product stock
        await Promise.all(
            order.items.map(item =>
                Product.findByIdAndUpdate(item.productId, { $inc: { quantity: item.quantity } })
            )
        );

        // Update order status to 'Cancelled'
        order.status = 'Cancelled';
        await order.save();

        return order;
    } catch (error) {
        console.error('Error cancelling order:', error);
        throw new Error('Error cancelling order');
    }
};

const updateOrderStatus = async (orderId, status) => {
    try {
        const validStatuses = ['Pending', 'Shipped', 'Delivered', 'Cancelled'];

        // Validate the provided status
        if (!validStatuses.includes(status)) {
            throw new Error('Invalid order status');
        }

        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        if (!order) {
            throw new Error('Order not found');
        }

        return order;
    } catch (error) {
        console.error('Error updating order status:', error);
        throw new Error('Error updating order status');
    }
};

module.exports = {
    createOrder,
    getAllOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus
};
