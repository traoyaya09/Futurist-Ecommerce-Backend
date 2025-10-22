const Payment = require('../models/PaymentModel');
const Order = require('../models/OrderModel');
const { processPayPalPayment, capturePayPalPayment, refundPayPalPayment } = require('../services/PaymentService');

/**
 * ✅ Process payment for an order
 */
const processPayment = async (paymentData) => {
    const { userId, orderId, amount, paymentMethod, currency, cardInfo } = paymentData;

    try {
        // Find the order
        const order = await Order.findById(orderId);
        if (!order) throw new Error('Order not found');

        // Ensure payment amount matches order total
        if (amount !== order.totalAmount) {
            throw new Error('Payment amount does not match order total');
        }

        let paymentResult;

        // Process payment based on method
        switch (paymentMethod) {
            case 'PayPal':
                paymentResult = await processPayPalPayment({ orderId, amount, currency });
                break;
            case 'Credit Card':
                paymentResult = await processPayPalPayment({ orderId, amount, currency, cardInfo });
                break;
            case 'Bank Transfer':
                paymentResult = { success: true, transactionId: `BANK-${Date.now()}` }; // Mocking Bank Transaction
                break;
            case 'Cash on Delivery':
                paymentResult = { success: true, transactionId: `COD-${Date.now()}` }; // Mocking Cash Payment
                break;
            default:
                throw new Error('Invalid payment method');
        }

        if (!paymentResult.success) throw new Error('Payment processing failed');

        // Record payment in the database
        const payment = await Payment.create({
            userId,
            orderId,
            amount,
            method: paymentMethod,
            status: 'Processed',
            transactionId: paymentResult.transactionId,
            currency,
            paymentDate: new Date()
        });

        // Update order status
        order.status = 'Paid';
        await order.save();

        return { success: true, payment };
    } catch (error) {
        console.error('Payment Processing Error:', error.message);

        // Record failed payment attempt
        await Payment.create({
            userId,
            orderId,
            amount,
            method: paymentMethod,
            status: 'Failed',
            failureReason: error.message,
            paymentDate: new Date()
        });

        return { success: false, message: error.message };
    }
};

/**
 * ✅ Capture a PayPal Payment (After Approval)
 */
const capturePayment = async (paymentId) => {
    try {
        const result = await capturePayPalPayment(paymentId);
        if (!result.success) throw new Error('Payment capture failed');

        // Update payment record
        await Payment.findOneAndUpdate(
            { transactionId: paymentId },
            { status: 'Processed' }
        );

        return { success: true, message: 'Payment captured successfully' };
    } catch (error) {
        console.error('Capture Payment Error:', error.message);
        return { success: false, message: error.message };
    }
};

/**
 * ✅ Refund a Payment
 */
const refundPayment = async (paymentId) => {
    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) throw new Error('Payment not found');

        if (payment.status !== 'Processed') {
            throw new Error('Only processed payments can be refunded');
        }

        // Call PayPal refund API
        const result = await refundPayPalPayment(payment.transactionId);
        if (!result.success) throw new Error('Refund processing failed');

        // Update payment status
        payment.status = 'Refunded';
        payment.refundDate = new Date();
        await payment.save();

        // Update order status
        await Order.findByIdAndUpdate(payment.order, { status: 'Refund Issued' });

        return { success: true, message: 'Payment refunded successfully' };
    } catch (error) {
        console.error('Refund Payment Error:', error.message);
        return { success: false, message: error.message };
    }
};

/**
 * ✅ Get Payment Status for an Order
 */
const getPaymentStatus = async (orderId) => {
    try {
        const payment = await Payment.findOne({ order: orderId });

        if (!payment) throw new Error('Payment not found for this order');

        return {
            success: true,
            status: payment.status,
            method: payment.method,
            amount: payment.amount,
            transactionId: payment.transactionId,
            paymentDate: payment.paymentDate,
            failureReason: payment.failureReason || null
        };
    } catch (error) {
        console.error('Error fetching payment status:', error.message);
        return { success: false, message: 'Error fetching payment status' };
    }
};

module.exports = {
    processPayment,
    capturePayment,
    refundPayment,
    getPaymentStatus
};
