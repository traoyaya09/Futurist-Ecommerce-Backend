// backend/socket.js
const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

const initSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    }
  });

  // Middleware to authenticate the socket connection using the query token
  io.use((socket, next) => {
    // Get token from query parameters
    const token = socket.handshake.query.token;
    if (!token) {
      return next(new Error("Authentication error"));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error("Authentication error"));
      }
      // Attach decoded token to socket for future use
      socket.decoded = decoded;
      next();
    });
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });

    // Function to emit events with logging
    function emitEvent(eventName, data) {
      io.emit(eventName, data);
      console.log(`${eventName}: ${JSON.stringify(data)}`);
    }

    // ----------------------------
    // User events
    // ----------------------------
    socket.on('user:registered', (userData) => {
      emitEvent('user:registered', userData);
    });
    socket.on('user:loggedIn', (userData) => {
      emitEvent('user:loggedIn', userData);
    });
    // New event: when user updates their profile
    socket.on('user:profileUpdated', (updatedProfile) => {
      emitEvent('user:profileUpdated', updatedProfile);
    });
    socket.on('user:deleted', (userId) => {
      emitEvent('user:deleted', userId);
    });
    // Emitted when a user's email is verified
    socket.on('user:emailVerified', (userId) => {
      emitEvent('user:emailVerified', userId);
    });
    // Emitted when a verification email is resent
    socket.on('user:verificationEmailResent', (userData) => {
      emitEvent('user:verificationEmailResent', userData);
    });
    // Emitted when a user resets their password
    socket.on('user:passwordReset', (userId) => {
      emitEvent('user:passwordReset', userId);
    });

    // ----------------------------
    // Auth events
    // ----------------------------
    socket.on('user:loggedOut', (userId) => {
      emitEvent('user:loggedOut', userId);
    });

    // ----------------------------
    // Product events
    // ----------------------------
    socket.on('product:created', (newProduct) => {
      emitEvent('product:created', newProduct);
    });
    socket.on('product:updated', (updatedProduct) => {
      emitEvent('product:updated', updatedProduct);
    });
    socket.on('product:deleted', (productId) => {
      emitEvent('product:deleted', productId);
    });

    // ----------------------------
    // Order events
    // ----------------------------
    socket.on('orderCreated', (order) => {
      emitEvent('orderCreated', order);
    });
    socket.on('orderUpdated', (updatedOrder) => {
      emitEvent('orderUpdated', updatedOrder);
    });
    socket.on('orderDeleted', (orderId) => {
      emitEvent('orderDeleted', orderId);
    });
    socket.on('orderCanceled', (canceledOrder) => {
      emitEvent('orderCanceled', canceledOrder);
    });

    // ----------------------------
    // Payment events
    // ----------------------------
    socket.on('payment:processed', (paymentData) => {
      emitEvent('payment:processed', paymentData);
    });
    socket.on('payment:captured', (paymentData) => {
      emitEvent('payment:captured', paymentData);
    });
    socket.on('payment:refunded', (refundData) => {
      emitEvent('payment:refunded', refundData);
    });
    socket.on('payment:split', (splitData) => {
      emitEvent('payment:split', splitData);
    });
    socket.on('refund:initiated', (orderData) => {
      emitEvent('refund:initiated', orderData);
    });

    // ----------------------------
    // Inventory events
    // ----------------------------
    socket.on('inventoryCreated', (newInventory) => {
      emitEvent('inventoryCreated', newInventory);
    });
    socket.on('inventoryUpdated', (updatedInventory) => {
      emitEvent('inventoryUpdated', updatedInventory);
    });
    socket.on('inventoryAdjusted', (adjustedInventory) => {
      emitEvent('inventoryAdjusted', adjustedInventory);
    });
    socket.on('inventoryDeleted', (data) => {
      emitEvent('inventoryDeleted', data);
    });

    // ----------------------------
    // Dashboard events
    // ----------------------------
    socket.on('dashboard:updated', (dashboardData) => {
      emitEvent('dashboard:updated', dashboardData);
    });

    // ----------------------------
    // Password reset events
    // ----------------------------
    socket.on('passwordReset:requested', (emailOrPhone) => {
      emitEvent('passwordReset:requested', emailOrPhone);
    });

    // ----------------------------
    // Analytics events
    // ----------------------------
    socket.on('analytics:pageViewTracked', (data) => {
      emitEvent('analytics:pageViewTracked', data);
    });
    socket.on('analytics:reportGenerated', (reportData) => {
      emitEvent('analytics:reportGenerated', reportData);
    });
    socket.on('analytics:predictiveExecuted', (result) => {
      emitEvent('analytics:predictiveExecuted', result);
    });
    socket.on('analytics:cohortAnalysis', (cohortData) => {
      emitEvent('analytics:cohortAnalysis', cohortData);
    });
    socket.on('analytics:abTestRecorded', (abTestResult) => {
      emitEvent('analytics:abTestRecorded', abTestResult);
    });
    socket.on('analytics:userSegmented', (segments) => {
      emitEvent('analytics:userSegmented', segments);
    });

    // ----------------------------
    // Brand events
    // ----------------------------
    socket.on('brand:created', (newBrand) => {
      emitEvent('brand:created', newBrand);
    });
    socket.on('brand:updated', (updatedBrand) => {
      emitEvent('brand:updated', updatedBrand);
    });
    socket.on('brand:deleted', (brandId) => {
      emitEvent('brand:deleted', brandId);
    });

    // ----------------------------
    // Cart events
    // ----------------------------
    socket.on('cart:itemAdded', (cartData) => {
      emitEvent('cart:itemAdded', cartData);
    });
    socket.on('cart:itemRemoved', (cartData) => {
      emitEvent('cart:itemRemoved', cartData);
    });
    socket.on('cart:itemUpdated', (cartData) => {
      emitEvent('cart:itemUpdated', cartData);
    });
    socket.on('cart:checkoutCompleted', (orderData) => {
      emitEvent('cart:checkoutCompleted', orderData);
    });
    socket.on('cart:promotionApplied', (cartData) => {
      emitEvent('cart:promotionApplied', cartData);
    });
    socket.on('cart:itemSavedForLater', (cartData) => {
      emitEvent('cart:itemSavedForLater', cartData);
    });
    socket.on('cart:cartsMerged', (cartData) => {
      emitEvent('cart:cartsMerged', cartData);
    });
    socket.on('cart:discountApplied', (result) => {
      emitEvent('cart:discountApplied', result);
    });

    // ----------------------------
    // Category events
    // ----------------------------
    socket.on('category:created', (newCategory) => {
      emitEvent('category:created', newCategory);
    });
    socket.on('category:updated', (updatedCategory) => {
      emitEvent('category:updated', updatedCategory);
    });
    socket.on('category:deleted', (categoryId) => {
      emitEvent('category:deleted', categoryId);
    });

    // ----------------------------
    // Chat events
    // ----------------------------
    socket.on('chat:sendMessage', (data) => {
      emitEvent('chat:newMessage', data);
    });
    socket.on('chat:markAsRead', (messageId) => {
      emitEvent('chat:messageRead', messageId);
    });
    socket.on('chat:applyStatus', (data) => {
      emitEvent('chat:messageStatusUpdated', data);
    });
    socket.on('chat:updateMessage', (data) => {
      emitEvent('chat:messageUpdated', data);
    });
    socket.on('chat:deleteMessage', (messageId) => {
      emitEvent('chat:messageDeleted', messageId);
    });
    socket.on('chat:softDelete', (data) => {
      emitEvent('chat:messageSoftDeleted', data);
    });
    socket.on('chat:typingIndicator', (data) => {
      emitEvent('chat:typingIndicator', data);
    });
    socket.on('chat:sendNotification', (data) => {
      emitEvent('chat:notification', data);
    });
    socket.on('chat:sendFile', (data) => {
      emitEvent('chat:fileSent', data);
    });
    socket.on('chat:createGroupChat', (data) => {
      emitEvent('chat:groupChatCreated', data);
    });

    // ----------------------------
    // Content events
    // ----------------------------
    socket.on('content:added', (newContent) => {
      emitEvent('content:added', newContent);
    });
    socket.on('content:updated', (updatedContent) => {
      emitEvent('content:updated', updatedContent);
    });
    socket.on('content:deleted', (contentId) => {
      emitEvent('content:deleted', contentId);
    });

    // ----------------------------
    // Info events
    // ----------------------------
    socket.on('info:created', (newInfo) => {
      emitEvent('info:created', newInfo);
    });
    socket.on('info:updated', (updatedInfo) => {
      emitEvent('info:updated', updatedInfo);
    });
    socket.on('info:deleted', (infoId) => {
      emitEvent('info:deleted', infoId);
    });

    // ----------------------------
    // Marketing events
    // ----------------------------
    socket.on('campaign:created', (newCampaign) => {
      emitEvent('campaign:created', newCampaign);
    });
    socket.on('campaign:updated', (updatedCampaign) => {
      emitEvent('campaign:updated', updatedCampaign);
    });
    socket.on('campaign:deleted', (campaignId) => {
      emitEvent('campaign:deleted', campaignId);
    });

    // ----------------------------
    // Promotion events
    // ----------------------------
    socket.on('promotion:created', (newPromotion) => {
      emitEvent('promotion:created', newPromotion);
    });
    socket.on('promotion:updated', (updatedPromotion) => {
      emitEvent('promotion:updated', updatedPromotion);
    });
    socket.on('promotion:deleted', (promotionId) => {
      emitEvent('promotion:deleted', promotionId);
    });

    // ----------------------------
    // Notification events
    // ----------------------------
    socket.on('notification:sent', (notificationData) => {
      emitEvent('notification:sent', notificationData);
    });
    socket.on('notification:read', (notificationId) => {
      emitEvent('notification:read', notificationId);
    });

    // ----------------------------
    // Review events
    // ----------------------------
    socket.on('review:added', (reviewData) => {
      emitEvent('review:added', reviewData);
    });
    socket.on('review:updated', (reviewData) => {
      emitEvent('review:updated', reviewData);
    });
    socket.on('review:deleted', (reviewId) => {
      emitEvent('review:deleted', reviewId);
    });

    // ----------------------------
    // Return events
    // ----------------------------
    socket.on('return:requested', (returnData) => {
      emitEvent('return:requested', returnData);
    });
    socket.on('return:processed', (processedReturnData) => {
      emitEvent('return:processed', processedReturnData);
    });
    socket.on('return:automatedProcessed', (automatedReturnData) => {
      emitEvent('return:automatedProcessed', automatedReturnData);
    });

    // ----------------------------
    // Settings events
    // ----------------------------
    socket.on('settings:updated', (updatedSetting) => {
      emitEvent('settings:updated', updatedSetting);
    });
    socket.on('settings:deleted', (settingKey) => {
      emitEvent('settings:deleted', settingKey);
    });
    socket.on('settings:dynamic', (dynamicSetting) => {
      emitEvent('settings:dynamic', dynamicSetting);
    });
    socket.on('settings:multiLanguage', (languageSetting) => {
      emitEvent('settings:multiLanguage', languageSetting);
    });

    // ----------------------------
    // Shipping events
    // ----------------------------
    socket.on('shipping:created', (newShipping) => {
      emitEvent('shipping:created', newShipping);
    });
    socket.on('shipping:statusUpdated', (updatedShipping) => {
      emitEvent('shipping:statusUpdated', updatedShipping);
    });
    socket.on('shipping:deleted', (shippingId) => {
      emitEvent('shipping:deleted', shippingId);
    });

    // ----------------------------
    // Support Ticket events
    // ----------------------------
    socket.on('support:ticketCreated', (ticketData) => {
      emitEvent('support:ticketCreated', ticketData);
    });
    socket.on('support:ticketUpdated', (ticketData) => {
      emitEvent('support:ticketUpdated', ticketData);
    });
    socket.on('support:ticketClosed', (ticketData) => {
      emitEvent('support:ticketClosed', ticketData);
    });

    // ----------------------------
    // Transaction events
    // ----------------------------
    socket.on('transaction:created', (transactionData) => {
      emitEvent('transaction:created', transactionData);
    });
    socket.on('transaction:updated', (transactionData) => {
      emitEvent('transaction:updated', transactionData);
    });
    socket.on('transaction:deleted', (transactionId) => {
      emitEvent('transaction:deleted', transactionId);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};

const getSocketInstance = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initSocket, getSocketInstance };
