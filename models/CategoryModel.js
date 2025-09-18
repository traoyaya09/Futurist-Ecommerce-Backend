const mongoose = require('mongoose');
const slugify = require('slugify');

// Define category schema
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Category name must be less than 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true,
  },
  description: {
    type: String,
    maxlength: [500, 'Description must be less than 500 characters'],
    trim: true,
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  image: {
    type: String,
    validate: {
      validator: function (value) {
        return /https?:\/\/.+\.(jpg|jpeg|png|gif|svg)/i.test(value);
      },
      message: 'Invalid image URL format'
    },
    default: ''
  },
  childrenCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }]
}, { timestamps: true });

// Pre-save middleware to create a slug from the category name
categorySchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Static method to fetch categories by parent-child hierarchy
categorySchema.statics.getCategoryTree = async function () {
  const categories = await this.aggregate([
    {
      $match: { parentCategory: null }
    },
    {
      $graphLookup: {
        from: 'categories',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentCategory',
        as: 'subcategories'
      }
    }
  ]);
  return categories;
};

// Instance method to update the category details
categorySchema.methods.updateDetails = async function (updateData) {
  Object.assign(this, updateData);
  return this.save();
};

// Ensure that the category name is unique for the same parent category
categorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });

// Virtual for checking if the category is a root category
categorySchema.virtual('isRoot').get(function () {
  return !this.parentCategory;
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
