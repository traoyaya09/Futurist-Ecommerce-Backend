// sanitizeImageUrls.js
const mongoose = require('mongoose');
const Product = require('./models/ProductModel'); // Adjust path if needed

const MONGO_URI = "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce";

async function sanitizeAllImages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Find all products with broken Amazon URLs
    const products = await Product.find(
      { imageUrl: /\/W\/IMAGERENDERING_/ },
      { _id: 1, imageUrl: 1 }
    );

    if (!products.length) {
      console.log('ℹ️ No products need updating.');
      await mongoose.disconnect();
      return;
    }

    // Prepare bulk update operations
    const bulkOps = products.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { imageUrl: p.imageUrl.replace(/\/W\/IMAGERENDERING_[^/]+/, '') } },
      },
    }));

    // Execute bulk update
    const result = await Product.bulkWrite(bulkOps);
    console.log(`✅ Bulk update complete. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

    // Disconnect from DB
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

sanitizeAllImages();
