const Return = require('../models/ReturnModel');
const Order = require('../models/OrderModel');
const Product = require('../models/ProductModel');
const User = require('../models/UserModel');
const { getSocketInstance } = require('../socket');

const returnController = {
    // Request a product return
    requestReturn: async (req, res) => {
        try {
            const { userId, orderId, productId, reason } = req.body;

            // Validate required fields
            if (!userId || !orderId || !productId || !reason) {
                return res.status(400).json({ message: 'All fields (userId, orderId, productId, reason) are required.' });
            }

            // Check if the user, order, and product exist
            const user = await User.findById(userId);
            const order = await Order.findById(orderId);
            const product = await Product.findById(productId);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            if (!order || !order.items.some(item => item.product.equals(productId))) {
                return res.status(404).json({ message: 'Order not found or product is not part of the order' });
            }

            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Check if return request already exists
            const existingReturn = await Return.findOne({ userId, orderId, productId });
            if (existingReturn) {
                return res.status(400).json({ message: 'Return request already exists for this product' });
            }

            // Create a new return request
            const newReturn = await new Return({
                userId,
                orderId,
                productId,
                reason,
                status: 'Pending'
            }).save();

            // Emit socket event for new return request
            const io = getSocketInstance();
            io.emit('return:requested', newReturn);

            res.status(201).json({ message: 'Return request submitted successfully', return: newReturn });
        } catch (error) {
            console.error('Error requesting return:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Process a return (admin only)
    processReturn: async (req, res) => {
        try {
            const { returnId, status } = req.body;

            if (!['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status provided' });
            }

            // Find the return request by ID
            const existingReturn = await Return.findById(returnId);
            if (!existingReturn) {
                return res.status(404).json({ message: 'Return request not found' });
            }

            if (existingReturn.status === 'Processed') {
                return res.status(400).json({ message: 'Return request has already been processed' });
            }

            // Update return status
            existingReturn.status = status;
            const updatedReturn = await existingReturn.save();

            // Additional logic based on status (e.g., issue refunds, restock product)
            if (status === 'Processed') {
                await Product.findByIdAndUpdate(existingReturn.productId, { $inc: { stock: 1 } }); // Restock product
            }

            // Emit socket event for processed return
            const io = getSocketInstance();
            io.emit('return:processed', updatedReturn);

            res.status(200).json({ message: `Return ${status} successfully`, return: updatedReturn });
        } catch (error) {
            console.error('Error processing return:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Track the status of a return request
    trackReturnStatus: async (req, res) => {
        try {
            const { returnId } = req.params;

            // Find the return request by ID
            const returnRequest = await Return.findById(returnId).select('status');
            if (!returnRequest) {
                return res.status(404).json({ message: 'Return request not found' });
            }

            res.status(200).json({ status: returnRequest.status });
        } catch (error) {
            console.error('Error tracking return status:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get the return history for a user
    returnHistory: async (req, res) => {
        try {
            const { userId } = req.params;

            // Check if the user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Get return history for the user, populated with order and product details
            const returns = await Return.find({ userId })
                .populate('orderId productId', 'name price status');

            res.status(200).json({ returns });
        } catch (error) {
            console.error('Error fetching return history:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Automated processing of pending returns (process pending returns older than 30 days)
    automatedReturnProcessing: async (req, res) => {
        try {
            // Automatically process returns that meet certain conditions (e.g., pending for over 30 days)
            const returnsToProcess = await Return.find({
                status: 'Pending',
                createdAt: { $lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            });

            for (const returnItem of returnsToProcess) {
                // Update status and perform additional logic (e.g., refund, restock)
                await Return.findByIdAndUpdate(returnItem._id, { status: 'Processed' });
                await Product.findByIdAndUpdate(returnItem.productId, { $inc: { stock: 1 } }); // Restock product
            }

            // Emit event for automated processing
            const io = getSocketInstance();
            io.emit('return:automatedProcessed', { processedCount: returnsToProcess.length });

            res.status(200).json({ message: 'Automated return processing completed', returnsProcessed: returnsToProcess.length });
        } catch (error) {
            console.error('Error during automated return processing:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get all return requests (admin only)
    getAllReturns: async (req, res) => {
        try {
            const returns = await Return.find()
                .populate('userId orderId productId', 'name email orderDate productName price');
            res.status(200).json({ returns });
        } catch (error) {
            console.error('Error fetching all return requests:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Get a specific return request by ID (admin or user)
    getReturnById: async (req, res) => {
        try {
            const { returnId } = req.params;
            const returnRequest = await Return.findById(returnId)
                .populate('userId orderId productId', 'name email orderDate productName price');

            if (!returnRequest) {
                return res.status(404).json({ message: 'Return request not found' });
            }

            // Admin can see all return requests; User can only see their own return requests
            if (req.user.role !== 'admin' && returnRequest.userId.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'You do not have permission to access this return request' });
            }

            res.status(200).json({ return: returnRequest });
        } catch (error) {
            console.error('Error fetching return request by ID:', error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },
};

module.exports = returnController;
