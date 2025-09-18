const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Cart = require('./models/CartModel'); // Adjust path as needed
const User = require('./models/UserModel');
const Product = require('./models/ProductModel');

// Connect to MongoDB
mongoose.connect('mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce')
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

// Function to generate a random cart
async function generateRandomCart() {
  const users = await User.find().select('_id'); // Fetch user IDs
  const products = await Product.find().select('_id price stock'); // Fetch product IDs, prices, and stock

  if (users.length === 0 || products.length === 0) {
    console.log("No users or products found. Ensure your database has users and products before running this script.");
    return null;
  }

  const user = faker.helpers.arrayElement(users)._id; // Randomly pick a user
  const cartItems = [];
  const savedItems = [];

  // Generate random number of items (1-5) in the cart
  const numItems = faker.number.int({ min: 1, max: 5 });

  for (let i = 0; i < numItems; i++) {
    const product = faker.helpers.arrayElement(products);
    const quantity = faker.number.int({ min: 1, max: Math.min(5, product.stock) });
    
    if (quantity > 0) {
      cartItems.push({
        product: product._id,
        quantity,
        price: product.price,
        total: quantity * product.price,
      });
    }
  }

  // Generate random number of saved items (0-3)
  const numSavedItems = faker.number.int({ min: 0, max: 3 });

  for (let i = 0; i < numSavedItems; i++) {
    const savedProduct = faker.helpers.arrayElement(products);
    savedItems.push({ product: savedProduct._id, addedAt: new Date() });
  }

  const total = cartItems.reduce((acc, item) => acc + item.total, 0);
  const discount = faker.number.int({ min: 0, max: total * 0.2 }); // Up to 20% discount
  const finalTotal = total - discount;

  return {
    user,
    items: cartItems,
    savedItems,
    total,
    discount,
    finalTotal,
  };
}

// Insert multiple carts into the database
const numberOfCarts = 100; // Adjust the number of carts to generate

async function insertRandomCarts() {
  try {
    const cartsToInsert = [];
    for (let i = 0; i < numberOfCarts; i++) {
      const cartData = await generateRandomCart();
      if (cartData) cartsToInsert.push(cartData);
    }

    if (cartsToInsert.length > 0) {
      await Cart.insertMany(cartsToInsert);
      console.log(`${cartsToInsert.length} carts inserted successfully.`);
    }
  } catch (error) {
    console.error('Error inserting carts:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Execute the insertion
insertRandomCarts();
