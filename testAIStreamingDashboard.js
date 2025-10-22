process.env.NODE_ENV = "production";

const mongoose = require("mongoose");
const chalk = require("chalk");
const assert = require("assert");
const { Types } = mongoose;

const AIService = require("./services/AIService");
const User = require("./models/UserModel");
const Product = require("./models/ProductModel");
const Cart = require("./models/CartModel");
const UserMemory = require("./models/UserMemoryModel");

// -------------------------
// Spinner & highlighting
// -------------------------
const spinnerFrames = ["-", "\\", "|", "/"];

const highlightOutput = (text) => {
  if (!text) return "";
  return text
    .replace(/"(intent|action|suggestions|products|cart|user|role)"/g, chalk.green("$1"))
    .replace(/"(productId|price|quantity|total|name|_id)"/g, chalk.cyan("$1"))
    .replace(/"(add_to_cart|remove_from_cart|checkout|apply_promo)"/g, chalk.yellow("$1"))
    .replace(/\b([A-Z]{3,}[0-9]{0,2})\b/g, chalk.magenta("$1"))
    .replace(/\b(\d+(\.\d{1,2})?)\b/g, chalk.blue("$1"))
    .replace(/"([A-Z][a-zA-Z0-9 ]+?)"/g, chalk.cyan("$1"));
};

// -------------------------
// MongoDB connection
// -------------------------
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/futurist_ecommerce";

const connectDB = async () => {
  console.log(chalk.blue(`🔗 Connecting to MongoDB at ${MONGO_URI}...`));
  await mongoose.connect(MONGO_URI);
  console.log(chalk.green("✅ MongoDB connected successfully."));
};

// -------------------------
// Pre-populate test data
// -------------------------
const prepopulateTestData = async () => {
  console.log(chalk.yellow("🛠 Pre-populating test user and database..."));

  await User.deleteMany({});
  await Product.deleteMany({});
  await Cart.deleteMany({});
  await UserMemory.deleteMany({});

  const mockPromotion = { _id: new Types.ObjectId("000000000000000000000001"), code: "SUMMER10", discountAmount: 20 };

  const testUser = await User.create({
    _id: new Types.ObjectId(),
    name: "CI Test User",
    email: "ci-test@example.com",
    password: "Password123!",
    role: "Customer",
  });

  const featuredProducts = await Product.insertMany([
    { name: "Shoes", price: 120, isFeatured: true },
    { name: "Watch", price: 250, isFeatured: true },
    { name: "Headphones", price: 99, isFeatured: true },
  ]);

  const cart = await Cart.create({
    user: testUser._id,
    items: [
      { productId: featuredProducts[0]._id, price: featuredProducts[0].price, quantity: 1 },
      { productId: featuredProducts[1]._id, price: featuredProducts[1].price, quantity: 1 },
    ],
    appliedPromotion: mockPromotion._id,
    discount: mockPromotion.discountAmount,
  });

  const memory = await UserMemory.create({
    userId: testUser._id,
    messages: [],
    cartItems: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
    appliedPromotion: cart.appliedPromotion,
    discount: cart.discount,
    finalTotal: cart.finalTotal,
    personality: {
      name: testUser.name,
      cartSummary: `Cart has ${cart.items.length} items totaling $${cart.finalTotal}`,
      catalogSummary: `We have ${featuredProducts.length} featured products: ${featuredProducts.map(p => p.name).join(", ")}`,
    },
  });

  console.log(chalk.green("✅ Pre-population complete."));
  return { testUser, featuredProducts, mockPromotion };
};

// -------------------------
// CI Test Execution
// -------------------------
const runTests = async ({ testUser }) => {
  console.log(chalk.yellow("🚀 Starting AIService production-mode CI tests..."));
  console.log(chalk.gray("====================================================="));

  const TEST_INPUTS = [
    "Show me the latest featured products",
    "Add the first featured product to my cart",
    "Apply promo code SUMMER10",
    "Checkout my cart",
  ];

  for (const TEST_INPUT of TEST_INPUTS) {
    console.log(chalk.blue(`\n--- Testing input: "${TEST_INPUT}" ---\n`));

    let spinnerIndex = 0;
    let accumulatedOutput = "";
    let tokenCount = 0;

    const spinnerInterval = setInterval(() => {
      process.stdout.write(`\r${spinnerFrames[spinnerIndex]} Tokens: ${tokenCount}`);
      spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length;
    }, 80);

    try {
      const result = await AIService.handleUserInput(
        testUser._id,
        TEST_INPUT,
        true,
        (partial) => {
          if (partial.type === "fast") {
            console.log(chalk.cyan(`⏱ Fast message: ${partial.output}`));
          } else if (partial.type === "full") {
            accumulatedOutput += partial.output;
            tokenCount += partial.output.length;
            const highlighted = highlightOutput(accumulatedOutput);
            process.stdout.write(`\r${spinnerFrames[spinnerIndex]} ${highlighted}   Tokens: ${tokenCount}`);
          }
        }
      );

      clearInterval(spinnerInterval);
      process.stdout.write("\n");

      assert(result && result.output, "AIService returned no output");
      console.log(chalk.greenBright("\n✅ AI Output (final):\n"), chalk.whiteBright(result.output));

      if (result.cart) {
        console.log(chalk.yellow("🛒 Cart after action:\n"), chalk.whiteBright(JSON.stringify(result.cart, null, 2)));
      }

    } catch (err) {
      clearInterval(spinnerInterval);
      console.error(chalk.red(`❌ Test failed for input "${TEST_INPUT}": ${err.message}`));
      process.exit(1);
    }
  }

  console.log(chalk.yellow("\n🎉 Production-mode AIService + Cart/Product CI test completed successfully.\n"));
};

// -------------------------
// Main
// -------------------------
(async () => {
  try {
    await connectDB();
    const testData = await prepopulateTestData();
    await runTests(testData);
    process.exit(0);
  } catch (err) {
    console.error(chalk.red("Fatal CI test error:"), err);
    process.exit(1);
  }
})();
