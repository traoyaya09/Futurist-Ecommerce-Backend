/**
 * backend/socket.js
 * Unified socket server for user carts, orders, AI orchestration, live chat, and admin dashboard.
 */

const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const config = require("./config/config");
const { getOrigins } = require("./utils/cspDirectives");
const { normalizeCart } = require("./utils/normalizeCart");
const { ensureActivePromotion } = require("./controllers/CartController");

let io;

/**
 * 🔹 Initialize socket.io server
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

  // 🔐 JWT middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Authentication error: missing token"));

      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Authentication error: invalid token"));
        socket.user = decoded;
        next();
      });
    } catch (err) {
      next(new Error("Internal socket auth error"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.userId || socket.user?.id;
    const isAdmin = socket.user?.role === "admin";

    console.log(`⚡ Connected socket ${socket.id}${userId ? ` (user:${userId})` : ""}`);

    // Join user room
    if (userId) socket.join(`user:${userId}`);

    // Join admin dashboard room
    if (isAdmin) {
      socket.join("admin:dashboard");
      console.log(`🟢 Admin joined room admin:dashboard`);
    }

    // Dynamic room join/leave
    socket.on("joinRoom", (room) => {
      socket.join(room);
      console.log(`🟢 Socket ${socket.id} joined room ${room}`);
    });

    socket.on("leaveRoom", (room) => {
      socket.leave(room);
      console.log(`❌ Socket ${socket.id} left room ${room}`);
    });

    // Admin broadcast test event
    socket.on("admin:event", (data) => {
      io.to("admin:dashboard").emit("admin:event", data);
      console.log(`📡 Broadcasted admin:event to admin:dashboard`, data);
    });

    // Chat test
    socket.on("chat:sendMessage", (msg) => {
      emitWithConfirm("global", "chat:newMessage", msg);
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Disconnected ${socket.id} (${reason})`);
    });
  });
};

/**
 * 🧩 Get socket.io instance
 */
const getSocketInstance = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

/**
 * 🧠 Emit event with confirmation logging
 */
const emitWithConfirm = (room, event, payload, confirm = true) => {
  if (!io) return console.error("[emitWithConfirm] Socket.io not initialized");
  if (!room || !event) return console.warn("[emitWithConfirm] Missing room or event name");

  const target = room === "global" ? io : io.to(room);
  const socketsInRoom = room === "global"
    ? io.sockets.sockets.size
    : io.sockets.adapter.rooms.get(room)?.size || 0;

  if (socketsInRoom === 0) console.warn(`⚠️ No connected clients in ${room} for event ${event}`);
  else console.log(`📡 Emitting ${event} to ${room} (${socketsInRoom} client${socketsInRoom > 1 ? "s" : ""})`);

  target.emit(event, payload, (ack) => {
    if (confirm) console.log(`🟢 Emit confirmation for '${event}' → ${room}:`, ack || "(no client ack sent)");
  });
};

/**
 * 🛒 Emit cart updates (promotion-synced)
 */
const emitCartUpdated = async (userId, cartDoc) => {
  if (!io) return console.error("[emitCartUpdated] Socket.io not initialized");

  try {
    const updatedCart = await ensureActivePromotion(userId, cartDoc);
    const normalized = normalizeCart(updatedCart);

    const payload = {
      ...normalized,
      emittedAt: new Date().toISOString(),
    };

    const userRoom = userId ? `user:${userId}` : "global";
    emitWithConfirm(userRoom, "cart:updated", payload);
    return payload;
  } catch (err) {
    console.error("[emitCartUpdated] Failed:", err);
  }
};

/**
 * ✅ Emit checkout completed (order created)
 */
const emitCheckoutCompleted = (userId, orderDoc) => {
  if (!io) return console.error("[emitCheckoutCompleted] Socket.io not initialized");

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

  const userRoom = userId ? `user:${userId}` : "global";
  emitWithConfirm(userRoom, "order:created", normalized);
  return normalized;
};

/**
 * 📦 Emit order update (e.g. shipped, delivered)
 */
const emitOrderUpdated = (orderDoc) => {
  if (!io) return console.error("[emitOrderUpdated] Socket.io not initialized");

  const order = orderDoc.toObject ? orderDoc.toObject() : orderDoc;
  const userRoom = order.user ? `user:${order.user}` : "global";
  emitWithConfirm(userRoom, "order:updated", order);
  return order;
};

/**
 * 🧠 Emit custom event to a user or global
 */
const emitToUser = (userId, event, data) => {
  if (!io) return console.error("[emitToUser] Socket.io not initialized");

  const userRoom = userId ? `user:${userId}` : "global";
  emitWithConfirm(userRoom, event, data);
};

module.exports = {
  initSocket,
  getSocketInstance,
  emitWithConfirm,
  emitCartUpdated,
  emitCheckoutCompleted,
  emitOrderUpdated,
  emitToUser,
};
