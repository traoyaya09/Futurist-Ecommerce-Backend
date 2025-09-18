require('dotenv').config();

const express = require('express');
const colors = require('colors');
const morgan = require('morgan');
const connectDB = require('../backend/config/db.js');
const { authenticate } = require('../backend/middleware/authentication.js');
const { authorize } = require('../backend/middleware/authorization.js');
const AuthRoute = require('../backend/routes/AuthRoute.js');
const errorHandler = require('../backend/middleware/errorHandling.js');
const logger = require('../backend/middleware/logger.js');
const rateLimit = require('express-rate-limit');
const securityHeaders = require('../backend/middleware/securityHeaders.js');
const compression = require('compression');
const cors = require('cors');
const asyncHandler = require('express-async-handler');
const http = require('http');
const { initSocket } = require('./socket'); // Import the socket initialization function
const config = require('./config/config.js');


const helmet = require('helmet');

// Import Routes
const adminRoutes = require('../backend/routes/adminRoute.js');
const AnalyticsRoute = require('./routes/AnalyticsRoute');
const UserRoute = require('./routes/UserRoute.js');
const BrandRoute = require('../backend/routes/BrandRoute.js');
const CartRoute = require('./routes/CartRoute.js');
const CategoryRoute = require('../backend/routes/CategoryRoute.js');
const chatRoutes = require('../backend/routes/ChatRoute.js');
const ContentRoute = require('../backend/routes/ContentRoute.js');
const InfoRoute = require('../backend/routes/InfoRoute.js');
const InventoryRoute = require('../backend/routes/InventoryRoute.js');
const MarketingRoute = require('../backend/routes/MarketingRoute.js');
const NotificationRoute = require('../backend/routes/NotificationRoute.js');
const OrderRoute = require('./routes/OrderRoute.js');
const PaymentRoute = require('./routes/PaymentRoute.js');
const ProductRoute = require('../backend/routes/ProductRoute.js');
const PromotionRoute = require('../backend/routes/PromotionRoute.js');
const ReturnRoute = require('./routes/ReturnRoute.js');
const ReviewRoute = require('../backend/routes/ReviewRoute.js');
const settingsRoute = require('./routes/SettingsRoute.js');
const ShippingRoute = require('../backend/routes/ShippingRoute.js');
const SupportTicketRoute = require('../backend/routes/SupportTicketRoute.js');
const SearchRoute = require('./routes/SearchRoute.js');
const TransactionRoute = require('../backend/routes/TransactionRoute.js');

// Connect to the database
connectDB();

// Create Express app
const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP
  })
);

app.use(express.json()); // Middleware to parse JSON bodies
app.use(morgan('dev')); // For logging requests
app.use(compression()); // Middleware to handle response compression
app.use(securityHeaders); // Custom security headers middleware
app.use(logger); // Logging middleware
app.use(cors()); // Enable CORS for all requests
// Enable CORS for all requests
// CSP Middleware
// app.use((req, res, next) => {
//   res.setHeader(
//     'Content-Security-Policy',
//     "default-src 'self'; connect-src 'self' http://localhost:8080; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
//   );
//   next();
// });


// Set up rate limiter to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
app.use(limiter); // Apply rate limiter middleware

// API routes
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
  res.send('You have accessed a protected route!');
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

// Basic route to check server status
app.get('/', (req, res) => {
  res.send("<h1>Welcome to Yaya's Futurist E-commerce App</h1>");
});

// Error handling middleware (should be at the end)
app.use(errorHandler);

// Create HTTP server and integrate WebSockets
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Start the server
const PORT = config.app.port; // Use the correct port property from config.app
server.listen(PORT, () => {
  console.log(`Server running in ${config.app.environment} mode on port ${config.app.port}`);
  console.log("JWT_SECRET:", process.env.JWT_SECRET); // verify that the secret is loaded.
});
