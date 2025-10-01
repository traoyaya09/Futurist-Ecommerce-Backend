// socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { getOrigins } = require("./utils/cspDirectives");
const config = require("./config/config");
const { normalizeCart } = require("./utils/normalizeCart");

let io;

/**
 * Initialize socket.io server
 */
const initSocket = (server) => {
  const { frontends } = getOrigins(config.app.environment);

  io = new Server(server, {
    cors: {
      origin: frontends,
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io",
  });

  // ✅ JWT Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication error: missing token"));

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) return next(new Error("Authentication error: invalid token"));
      socket.user = decoded;
      next();
    });
  });

  io.on("connection", (socket) => {
    console.log("⚡ User connected:", socket.id, socket.user?.id);

    // Join private room for user-specific events
    if (socket.user?.id) {
      const userRoom = `user:${socket.user.id}`;
      socket.join(userRoom);
      console.log(`User ${socket.user.id} joined room ${userRoom}`);
    }

    // Example global events
    socket.on("chat:sendMessage", (msg) => {
      io.emit("chat:newMessage", msg);
    });

    socket.on("disconnect", () => {
      console.log("❌ User disconnected:", socket.id);
    });
  });
};

/**
 * Get socket.io instance
 */
const getSocketInstance = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

/**
 * Emit updated cart to frontend
 */
const emitCartUpdated = (cartDoc) => {
  const normalized = normalizeCart(cartDoc);
  io.emit("cart:updated", normalized);
  return normalized;
};

/**
 * Emit checkout completed (order created) to user
 */
const emitCheckoutCompleted = (orderDoc) => {
  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  const normalized = {
    ...order,
    items: (order.items || []).map((i) => ({
      ...i,
      product: i.product
        ? {
            _id: i.product._id || i.product.id || null,
            name: i.product.name || "Unnamed Product",
            price: i.product.price ?? 0,
            imageUrl: i.product.imageUrl || "/placeholder.png",
          }
        : { _id: null, name: "Unnamed Product", price: 0, imageUrl: "/placeholder.png" },
    })),
  };

  // Emit to the specific user who placed the order
  if (order.user) {
    const userRoom = `user:${order.user}`;
    io.to(userRoom).emit("order:created", normalized);
  }

  return normalized;
};

/**
 * Emit order updates (status changes like Shipped / Delivered)
 */
const emitOrderUpdated = (orderDoc) => {
  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  if (order.user) {
    const userRoom = `user:${order.user}`;
    io.to(userRoom).emit("order:updated", order);
  }
  return order;
};

module.exports = {
  initSocket,
  getSocketInstance,
  emitCartUpdated,
  emitCheckoutCompleted,
  emitOrderUpdated,
};
