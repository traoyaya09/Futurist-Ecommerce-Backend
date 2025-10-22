const Return = require('../models/ReturnModel');
const Product = require('../models/ProductModel');
const Order = require('../models/OrderModel');

const initiateReturn = async (returnData) => {
  try {
      // Ensure the order and product exist before initiating return
      const { userId, orderId, productId } = returnData;
      
      const order = await Order.findById(orderId);
      if (!order || !order.items.some(item => item.product.equals(productId))) {
          throw new Error('Order not found or product is not part of the order');
      }

      const product = await Product.findById(productId);
      if (!product) {
          throw new Error('Product not found');
      }

      // Check if a return request for the same order and product already exists
      const existingReturn = await Return.findOne({ userId, orderId, productId });
      if (existingReturn) {
          throw new Error('Return request already exists for this product');
      }

      // Create and save the return
      const newReturn = new Return(returnData);
      await newReturn.save();
      return newReturn;
  } catch (error) {
      console.error('Error initiating return:', error);
      throw new Error(error.message || 'Error initiating return');
  }
};

const getAllReturns = async (page = 1, limit = 10) => {
  try {
      // Fetch returns with pagination
      const returns = await Return.find()
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('userId', 'name email')   // Populating user details
          .populate('productId', 'name price') // Populating product details
          .populate('orderId', 'status');     // Populating order details
      
      const totalReturns = await Return.countDocuments(); // Total return count for pagination

      return { totalReturns, page, limit, returns };
  } catch (error) {
      console.error('Error fetching all returns:', error);
      throw new Error('Error fetching all returns');
  }
};

const getReturnById = async (returnId) => {
  try {
      const returnRequest = await Return.findById(returnId)
          .populate('userId', 'name email')
          .populate('productId', 'name price')
          .populate('orderId', 'status');
      
      if (!returnRequest) {
          throw new Error('Return request not found');
      }
      return returnRequest;
  } catch (error) {
      console.error('Error fetching return by ID:', error);
      throw new Error('Error fetching return by ID');
  }
};

const updateReturnStatus = async (returnId, status) => {
  try {
      const updatedReturn = await Return.findByIdAndUpdate(
          returnId,
          { status },
          { new: true }
      ).populate('userId', 'name email')
       .populate('productId', 'name price')
       .populate('orderId', 'status');
      
      if (!updatedReturn) {
          throw new Error('Return request not found');
      }

      // Additional logic based on status (e.g., issuing refund or restocking product)
      if (status === 'Processed') {
          await Product.findByIdAndUpdate(updatedReturn.productId, { $inc: { stock: 1 } });
      }

      return updatedReturn;
  } catch (error) {
      console.error('Error updating return status:', error);
      throw new Error('Error updating return status');
  }
};

const deleteReturn = async (returnId) => {
  try {
      const deletedReturn = await Return.findByIdAndDelete(returnId);
      if (!deletedReturn) {
          throw new Error('Return request not found');
      }
      return deletedReturn;
  } catch (error) {
      console.error('Error deleting return:', error);
      throw new Error('Error deleting return');
  }
};

module.exports = {
  initiateReturn,
  getAllReturns,
  getReturnById,
  updateReturnStatus,
  deleteReturn,
};
