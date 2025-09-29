// seed.js
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

// Models
const Brand = require("./models/BrandModel");
const Category = require("./models/CategoryModel");
const Cart = require("./models/CartModel");
const User = require("./models/UserModel");
const Product = require("./models/ProductModel");
const Promotion = require("./models/PromotionModel");
const Payment = require("./models/PaymentModel");
const Inventory = require("./models/InventoryModel");
const Marketing = require("./models/MarketingModel");
const Notification = require("./models/NotificationModel");
const Order = require("./models/OrderModel");
const Transaction = require("./models/TransactionModel");
const Return = require("./models/ReturnModel");
const Review = require("./models/ReviewModel");
const Shipping = require("./models/ShippingModel");
const Support = require("./models/SupportTicketModel");
const slugify = require("slugify"); // install with npm i slugify

// Connect to MongoDB
mongoose
  .connect("mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

/* ---------------- SEEDERS ---------------- */

// Users
async function seedUsers(count = 100) {
  const users = Array.from({ length: count }).map(() => ({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: "Password123!", // will be hashed in pre-save
    address: faker.location.streetAddress(),
    phoneNumber: faker.phone.number("+1-###-###-####"),
    role: faker.helpers.arrayElement(["Customer", "Admin"]),
    isAdmin: faker.datatype.boolean(),
    isVerified: faker.datatype.boolean(),
  }));
  await User.insertMany(users);
  console.log(`${users.length} users inserted.`);
}

// Brands
async function seedBrands(count = 100) {
  const brands = Array.from({ length: count }).map(() => ({
    name: faker.company.name() + " " + faker.string.alpha(3),
    description: faker.commerce.productDescription(),
    logoUrl: faker.image.url(),
    establishedYear: faker.number.int({ min: 1900, max: new Date().getFullYear() }),
    website: faker.internet.url(),
  }));
  await Brand.insertMany(brands);
  console.log(`${brands.length} brands inserted.`);
}

// ----------------- CATEGORY SEEDER -----------------

async function seedCategories(count = 100) {
  const categories = Array.from({ length: count }).map(() => {
    const name = faker.commerce.department() + " " + faker.string.alpha(3);
    return {
      name,
      description: faker.commerce.productDescription(),
      parentCategory: null,
      isActive: faker.datatype.boolean(),
      image: `https://picsum.photos/seed/${faker.string.alphanumeric(8)}/600/400.jpg`,
      slug: slugify(name + "-" + faker.string.alphanumeric(4), { lower: true, strict: true }),
    };
  });

  await Category.insertMany(categories);
  console.log(`${categories.length} categories inserted.`);
}


// Carts
async function seedCarts(count = 100) {
  const users = await User.find().select("_id");
  const products = await Product.find().select("_id price stock");
  if (!users.length || !products.length) return console.log("Need users and products first!");

  const carts = [];
  for (let i = 0; i < count; i++) {
    const user = faker.helpers.arrayElement(users)._id;
    const items = [];
    const savedItems = [];
    const numItems = faker.number.int({ min: 1, max: 5 });

    for (let j = 0; j < numItems; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: Math.min(5, product.stock) });
      if (quantity > 0) {
        items.push({
          product: product._id,
          quantity,
          price: product.price,
          total: product.price * quantity,
        });
      }
    }

    const numSavedItems = faker.number.int({ min: 0, max: 3 });
    for (let k = 0; k < numSavedItems; k++) {
      const savedProduct = faker.helpers.arrayElement(products);
      savedItems.push({ product: savedProduct._id, addedAt: new Date() });
    }

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const discount = faker.number.int({ min: 0, max: Math.floor(total * 0.2) });
    const finalTotal = total - discount;

    carts.push({ user, items, savedItems, total, discount, finalTotal });
  }
  await Cart.insertMany(carts);
  console.log(`${carts.length} carts inserted.`);
}

// Promotions
async function seedPromotions(count = 100) {
  const promotions = Array.from({ length: count }).map(() => {
    const startDate = faker.date.soon({ days: 30 });
    const endDate = faker.date.soon({ days: 60, refDate: startDate });
    return {
      title: faker.commerce.productAdjective() + " Sale",
      description: faker.commerce.productDescription(),
      image: faker.image.urlLoremFlickr({ category: "business" }),
      alt: "Promotion image",
      startDate,
      endDate,
      isActive: faker.datatype.boolean(),
      priority: faker.number.int({ min: 0, max: 5 }),
    };
  });
  await Promotion.insertMany(promotions);
  console.log(`${promotions.length} promotions inserted.`);
}

// Payments
async function seedPayments(count = 100) {
  const carts = await Cart.find().select("_id user finalTotal");
  if (!carts.length) return console.log("Need carts first!");

  const payments = Array.from({ length: count }).map(() => {
    const cart = faker.helpers.arrayElement(carts);
    return {
      order: cart._id,
      userId: cart.user,
      amount: cart.finalTotal,
      method: faker.helpers.arrayElement(["Credit Card", "PayPal", "Bank Transfer", "Cash on Delivery", "Cryptocurrency"]),
      status: faker.helpers.arrayElement(["Pending", "Processed", "Failed", "Refunded", "Disputed"]),
      paymentGatewayResponse: faker.lorem.sentence(),
      failureReason: faker.datatype.boolean() ? faker.lorem.words(3) : null,
      transactionId: faker.string.uuid(),
      paymentDate: faker.date.recent({ days: 90 }),
      refundAmount: 0,
      refundDate: null,
      metadata: { ip: faker.internet.ip(), device: faker.internet.userAgent() },
    };
  });
  await Payment.insertMany(payments);
  console.log(`${payments.length} payments inserted.`);
}

// Inventories
async function seedInventories(count = 100) {
  const inventories = Array.from({ length: count }).map(() => ({
    name: faker.commerce.productName(),
    sku: faker.string.alphanumeric(10).toUpperCase(),
    description: faker.commerce.productDescription(),
    quantity: faker.number.int({ min: 0, max: 500 }),
    lowStockThreshold: 5,
    location: faker.location.city(),
    stockHistory: [
      { action: "initial", quantity: faker.number.int({ min: 10, max: 100 }) },
    ],
  }));
  await Inventory.insertMany(inventories);
  console.log(`${inventories.length} inventories inserted.`);
}

// Marketing
async function seedMarketings(count = 50) {
  const marketings = Array.from({ length: count }).map(() => {
    const startDate = faker.date.soon({ days: 10 });
    const endDate = faker.date.soon({ days: 30, refDate: startDate });
    return {
      campaignName: faker.company.catchPhrase(),
      startDate,
      endDate,
      description: faker.lorem.sentence(),
      status: faker.helpers.arrayElement(["active", "inactive", "completed"]),
      budget: faker.number.int({ min: 1000, max: 100000 }),
    };
  });
  await Marketing.insertMany(marketings);
  console.log(`${marketings.length} marketing campaigns inserted.`);
}

// Notifications
async function seedNotifications(count = 100) {
  const users = await User.find().select("_id");
  if (!users.length) return console.log("Need users first!");

  const notifications = Array.from({ length: count }).map(() => ({
    recipient: faker.helpers.arrayElement(users)._id,
    message: faker.lorem.sentence(),
    type: faker.helpers.arrayElement(["Order", "Promotion", "General", "Reminder", "Alert"]),
    isRead: faker.datatype.boolean(),
    channel: faker.helpers.arrayElement(["email", "sms", "push", "real-time"]),
    sentAt: faker.date.recent({ days: 30 }),
  }));
  await Notification.insertMany(notifications);
  console.log(`${notifications.length} notifications inserted.`);
}

// Orders
async function seedOrders(count = 100) {
  const users = await User.find().select("_id");
  const products = await Product.find().select("_id price");
  if (!users.length || !products.length) return console.log("Need users and products first!");

  const orders = [];
  for (let i = 0; i < count; i++) {
    const user = faker.helpers.arrayElement(users)._id;
    const items = [];
    const numItems = faker.number.int({ min: 1, max: 5 });

    for (let j = 0; j < numItems; j++) {
      const product = faker.helpers.arrayElement(products);
      const quantity = faker.number.int({ min: 1, max: 5 });
      const price = product.price;
      const discount = faker.number.int({ min: 0, max: 20 });
      items.push({
        product: product._id,
        quantity,
        price,
        discount,
        totalItemPrice: (quantity * price) - discount,
      });
    }

    const totalAmount = items.reduce((sum, i) => sum + i.totalItemPrice, 0);
    const discountAmount = items.reduce((sum, i) => sum + i.discount, 0);
    const netAmount = totalAmount - discountAmount;

    orders.push({
      userId: user,
      items,
      totalAmount,
      discountAmount,
      netAmount,
      paymentMethod: faker.helpers.arrayElement(["Credit Card", "PayPal", "Cash on Delivery", "Bank Transfer"]),
      paymentStatus: faker.helpers.arrayElement(["Pending", "Paid", "Failed"]),
      shippingAddress: faker.location.streetAddress(),
      shippingStatus: faker.helpers.arrayElement(["Not Shipped", "Shipped", "Delivered"]),
      status: faker.helpers.arrayElement(["Pending", "Processing", "Shipped", "Delivered", "Cancelled"]),
      trackingNumber: faker.string.alphanumeric(12).toUpperCase(),
      estimatedDelivery: faker.date.soon({ days: 14 }),
    });
  }
  await Order.insertMany(orders);
  console.log(`${orders.length} orders inserted.`);
}

// Transactions
async function seedTransactions(count = 100) {
  const users = await User.find().select("_id");
  if (!users.length) return console.log("Need users first!");

  const transactions = Array.from({ length: count }).map(() => ({
    user: faker.helpers.arrayElement(users)._id,
    amount: faker.number.float({ min: 10, max: 1000, precision: 0.01 }),
    type: faker.helpers.arrayElement(["Debit", "Credit"]),
    status: faker.helpers.arrayElement(["Pending", "Completed", "Failed", "Refunded"]),
    description: faker.commerce.productDescription(),
    paymentMethod: faker.helpers.arrayElement(["Credit Card", "PayPal", "Bank Transfer", "Cash"]),
    referenceId: faker.string.uuid(),
    currency: "USD",
    isRefundable: faker.datatype.boolean(),
    meta: { fees: faker.number.int({ min: 0, max: 10 }), tax: faker.number.int({ min: 0, max: 20 }) },
  }));
  await Transaction.insertMany(transactions);
  console.log(`${transactions.length} transactions inserted.`);
}

// Returns
async function seedReturns(count = 50) {
  const users = await User.find().select("_id");
  const products = await Product.find().select("_id");
  const orders = await Order.find().select("_id");
  if (!users.length || !products.length || !orders.length) return console.log("Need users, products, and orders first!");

  const returns = Array.from({ length: count }).map(() => ({
    user: faker.helpers.arrayElement(users)._id,
    order: faker.helpers.arrayElement(orders)._id,
    product: faker.helpers.arrayElement(products)._id,
    reason: faker.lorem.sentence(10),
    status: faker.helpers.arrayElement(["Requested", "Approved", "Rejected", "Processed"]),
    additionalComments: faker.lorem.sentence(),
    refundAmount: faker.number.int({ min: 0, max: 200 }),
    processedBy: faker.datatype.boolean() ? faker.helpers.arrayElement(users)._id : null,
    returnMethod: faker.helpers.arrayElement(["Courier Pickup", "Dropoff"]),
    returnTrackingNumber: faker.string.alphanumeric(12).toUpperCase(),
  }));
  await Return.insertMany(returns);
  console.log(`${returns.length} returns inserted.`);
}

// Reviews
async function seedReviews(count = 100) {
  const users = await User.find().select("_id");
  const products = await Product.find().select("_id");
  if (!users.length || !products.length) return console.log("Need users and products first!");

  const reviews = Array.from({ length: count }).map(() => ({
    productId: faker.helpers.arrayElement(products)._id,
    userId: faker.helpers.arrayElement(users)._id,
    rating: faker.number.int({ min: 1, max: 5 }),
    comment: faker.lorem.sentence(),
  }));
  await Review.insertMany(reviews).catch((err) => console.error("Review insert error:", err.message));
  console.log(`${reviews.length} reviews inserted.`);
}

// Shipping
async function seedShippings(count = 50) {
  const users = await User.find().select("_id");
  if (!users.length) return console.log("Need users first!");

  const shippings = Array.from({ length: count }).map(() => {
    const packages = [
      {
        weight: faker.number.float({ min: 0.5, max: 10, precision: 0.1 }),
        dimensions: {
          length: faker.number.int({ min: 10, max: 100 }),
          width: faker.number.int({ min: 10, max: 100 }),
          height: faker.number.int({ min: 10, max: 100 }),
        },
        trackingNumber: faker.string.alphanumeric(12).toUpperCase(),
      },
    ];
    return {
      user: faker.helpers.arrayElement(users)._id,
      address: faker.location.streetAddress(),
      city: faker.location.city(),
      postalCode: faker.location.zipCode(),
      country: faker.location.country(),
      status: faker.helpers.arrayElement(["Pending", "Shipped", "Delivered", "In Transit", "Canceled", "Returned"]),
      method: faker.helpers.arrayElement(["Standard", "Express", "Overnight", "Two-Day"]),
      estimatedDelivery: faker.date.soon({ days: 14 }),
      shippingCost: faker.number.float({ min: 5, max: 100, precision: 0.01 }),
      trackingNumbers: packages.map((p) => p.trackingNumber),
      packages,
      insurance: faker.datatype.boolean(),
      insuranceValue: faker.number.int({ min: 0, max: 500 }),
      dispatchedAt: faker.date.recent({ days: 10 }),
      deliveredAt: faker.datatype.boolean() ? faker.date.recent({ days: 5 }) : null,
    };
  });
  await Shipping.insertMany(shippings);
  console.log(`${shippings.length} shippings inserted.`);
}

// Support
async function seedSupports(count = 50) {
  const users = await User.find().select("_id");
  if (!users.length) return console.log("Need users first!");

  const supports = Array.from({ length: count }).map(() => ({
    user: faker.helpers.arrayElement(users)._id,
    subject: faker.lorem.sentence(5),
    message: faker.lorem.paragraph(),
    status: faker.helpers.arrayElement(["Open", "In Progress", "Closed", "Resolved"]),
    priority: faker.helpers.arrayElement(["Low", "Medium", "High", "Critical"]),
    assignedAgent: faker.datatype.boolean() ? faker.helpers.arrayElement(users)._id : null,
    responses: [
      {
        agent: faker.helpers.arrayElement(users)._id,
        message: faker.lorem.sentence(),
        timestamp: new Date(),
      },
    ],
    feedback: faker.datatype.boolean()
      ? { rating: faker.number.int({ min: 1, max: 5 }), comment: faker.lorem.sentence() }
      : {},
    escalation: faker.datatype.boolean(),
  }));
  await Support.insertMany(supports);
  console.log(`${supports.length} support tickets inserted.`);
}

/* ---------------- RUN ALL ---------------- */
async function runSeeders() {
  try {
    await seedUsers(100);
    await seedBrands(100);
    await seedCategories(100);
    await seedProducts(100);
    await seedCarts(100);
    await seedPromotions(100);
    await seedPayments(100);
    await seedInventories(100);
    await seedMarketings(50);
    await seedNotifications(100);
    await seedOrders(100);
    await seedTransactions(100);
    await seedReturns(50);
    await seedReviews(100);
    await seedShippings(50);
    await seedSupports(50);

    console.log("✅ All seeders completed successfully!");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
  }
}

runSeeders();
