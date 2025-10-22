const mongoose = require('mongoose');
const slugify = require('slugify');

// Define the schema
const infoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        trim: true,
        maxlength: [5000, 'Content cannot be more than 5000 characters'],
    },
    slug: {
        type: String,
        unique: true,
        trim: true,
    },
    views: {
        type: Number,
        default: 0, // To track the number of times the info is viewed
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft', // Status for the info entry
    },
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Middleware to automatically generate a slug before saving
infoSchema.pre('save', function(next) {
    if (this.isModified('title')) {
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    next();
});

// Virtual to generate a summary of the content
infoSchema.virtual('summary').get(function() {
    return this.content.slice(0, 200) + '...';  // Shorten content to 200 chars for summary
});

// Static method to find published info
infoSchema.statics.findPublished = function() {
    return this.find({ status: 'published' });
};

// Instance method to increment views
infoSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Full-text search index on title and content
infoSchema.index({ title: 'text', content: 'text' });

// Adding indexes for improved performance on frequent queries
infoSchema.index({ slug: 1, status: 1 });

const Info = mongoose.model('Info', infoSchema);

module.exports = Info;
