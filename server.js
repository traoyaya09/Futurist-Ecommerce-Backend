require('dotenv').config();
const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const connectDB = require('./config/db.js');
const { authenticate } = require('./middleware/authentication.js');
const { authorize } = require('./middleware/authorization.js');
const AuthRoute = require('./routes/AuthRoute.js');
const errorHandler = require('./middleware/errorHandling.js');
const logger = require('./middleware/logger.js');
const rateLimit = require('express-rate-limit');
const securityHeaders = require('./middleware/securityHeaders.js');
const compression = require('compression');
const cors = require('cors');
const asyncHandler = require('express-async-handler');
const http = require('http');
const { initSocket } = require('./socket');
const config = require('./config/config.js');
const helmet = require('helmet');

// Import other routes
const adminRoutes = require('./routes/adminRoute.js');
const AnalyticsRoute = require('./routes/AnalyticsRoute');
const UserRoute = require('./routes/UserRoute.js');
const BrandRoute = require('./routes/BrandRoute.js');
const CartRoute = require('./routes/CartRoute.js');
const CategoryRoute = require('./routes/CategoryRoute.js');
const chatRoutes = require('./routes/ChatRoute.js');
const ContentRoute = require('./routes/ContentRoute.js');
const InfoRoute = require('./routes/InfoRoute.js');
const InventoryRoute = require('./routes/InventoryRoute.js');
const MarketingRoute = require('./routes/MarketingRoute.js');
const NotificationRoute = require('./routes/NotificationRoute.js');
const OrderRoute = require('./routes/OrderRoute.js');
const PaymentRoute = require('./routes/PaymentRoute.js');
const ProductRoute = require('./routes/ProductRoute.js');
const PromotionRoute = require('./routes/PromotionRoute.js');
const ReturnRoute = require('./routes/ReturnRoute.js');
const ReviewRoute = require('./routes/ReviewRoute.js');
const settingsRoute = require('./routes/SettingsRoute.js');
const ShippingRoute = require('./routes/ShippingRoute.js');
const SupportTicketRoute = require('./routes/SupportTicketRoute.js');
const SearchRoute = require('./routes/SearchRoute.js');
const TransactionRoute = require('./routes/TransactionRoute.js');

// 🔌 Connect to the database
connectDB();

// Create Express app
const app = express();

// 🛡 Security middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(securityHeaders);
app.use(compression());
app.use(logger);

// Parse JSON & URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📜 Logging in development
if (config.app.environment === 'development') {
  app.use(morgan('dev'));
}

// 🌍 CORS setup (working pattern)
const allowedOrigins = config.cors.allowedOrigins || ['http://localhost:3000'];
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow Postman or server-to-server requests
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

// 🔒 Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit per IP
});
app.use(limiter);

// ------------------------------
// API Routes
// ------------------------------
app.use('/api/v1/auth', AuthRoute);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/analytics', AnalyticsRoute);
app.use('/api/v1/brands', BrandRoute);
app.use('/api/v1/carts', CartRoute);
app.use('/api/v1/categories', CategoryRoute);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/content', ContentRoute);
app.use('/api/v1/info', InfoRoute);
app.use('/api/v1/inventory', InventoryRoute);
app.use('/api/v1/marketing', MarketingRoute);
app.use('/api/v1/notifications', NotificationRoute);
app.use('/api/v1/orders', OrderRoute);
app.use('/api/v1/payments', PaymentRoute);
app.use('/api/v1/products', ProductRoute);
app.use('/api/v1/promotions', PromotionRoute);
app.use('/api/v1/returns', ReturnRoute);
app.use('/api/v1/reviews', ReviewRoute);
app.use('/api/v1/settings', settingsRoute);
app.use('/api/v1/shipping', ShippingRoute);
app.use('/api/v1/support', SupportTicketRoute);
app.use('/api', SearchRoute);
app.use('/api/v1/transactions', TransactionRoute);
app.use('/api/v1/users', UserRoute);

// Example protected route
app.get('/api/v1/protected', authenticate, (req, res) => {
  res.json({ success: true, message: 'You have accessed a protected route!' });
});

// Example admin route
app.get(
  '/api/v1/admin',
  authenticate,
  authorize('Admin'),
  asyncHandler(async (req, res) => {
    res.status(200).json({ message: 'You have admin access!' });
  })
);

// Basic home route
app.get('/', (req, res) => {
  res.send("<h1>Welcome to Yaya's Futurist E-commerce App</h1>");
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler (should be last)
app.use(errorHandler);

// Create HTTP server & integrate WebSockets
const server = http.createServer(app);
initSocket(server);

// Start server
const PORT = config.app.port;
server.listen(PORT, () => {
  console.log(`Server running in ${config.app.environment} mode on port ${PORT}`.green.bold);
  console.log('JWT_SECRET loaded:', !!process.env.JWT_SECRET);
});
