const Transaction = require('../models/TransactionModel');

const createTransaction = async (userData, amount, description, type = 'debit') => {
    try {
        // Validate amount
        if (amount <= 0) {
            throw new Error('Amount must be greater than zero');
        }

        const newTransaction = new Transaction({
            user: userData._id,
            amount,
            description,
            type, // Default to 'debit' if not provided
        });

        await newTransaction.save();
        return newTransaction;
    } catch (error) {
        console.error('Error creating transaction:', error);
        throw new Error('Error creating transaction');
    }
};

const getTransactionsByUser = async (userId, page = 1, limit = 10, sortBy = 'createdAt', order = 'desc', type) => {
    try {
        const filter = { user: userId };

        // Optional filtering by transaction type (debit/credit)
        if (type) {
            filter.type = type;
        }

        // Sorting configuration
        const sortOptions = {};
        sortOptions[sortBy] = order === 'desc' ? -1 : 1;

        // Pagination and query execution
        const transactions = await Transaction.find(filter)
            .sort(sortOptions)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * limit);

        // Total number of transactions for pagination purposes
        const totalTransactions = await Transaction.countDocuments(filter);

        return {
            total: totalTransactions,
            page: parseInt(page),
            limit: parseInt(limit),
            transactions,
        };
    } catch (error) {
        console.error('Error fetching transactions:', error);
        throw new Error('Error fetching transactions');
    }
};

const getTransactionById = async (transactionId, userId) => {
    try {
        const transaction = await Transaction.findOne({ _id: transactionId, user: userId });
        if (!transaction) {
            throw new Error('Transaction not found');
        }
        return transaction;
    } catch (error) {
        console.error('Error fetching transaction:', error);
        throw new Error('Error fetching transaction');
    }
};

const updateTransaction = async (transactionId, userId, updatedData) => {
    try {
        const transaction = await Transaction.findOneAndUpdate(
            { _id: transactionId, user: userId },
            { $set: updatedData },
            { new: true, runValidators: true }
        );
        if (!transaction) {
            throw new Error('Transaction not found or unauthorized');
        }
        return transaction;
    } catch (error) {
        console.error('Error updating transaction:', error);
        throw new Error('Error updating transaction');
    }
};

const deleteTransaction = async (transactionId, userId) => {
    try {
        const transaction = await Transaction.findOneAndDelete({ _id: transactionId, user: userId });
        if (!transaction) {
            throw new Error('Transaction not found or unauthorized');
        }
        return transaction;
    } catch (error) {
        console.error('Error deleting transaction:', error);
        throw new Error('Error deleting transaction');
    }
};

module.exports = {
    createTransaction,
    getTransactionsByUser,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
};
