const validator = require('validator'); // Use validator for additional validation and sanitization

const brandHelper = {
  // Format and sanitize brand data before saving to the database
  formatBrandData: (data) => {
    const { name, description, logoUrl, websiteUrl, socialMediaLinks, establishedYear } = data;

    return {
      name: name.trim(),
      description: description ? description.trim() : '',
      logoUrl: validator.isURL(logoUrl) ? logoUrl.trim() : null, // Validate and sanitize URL
      websiteUrl: validator.isURL(websiteUrl) ? websiteUrl.trim() : null, // Validate website URL
      establishedYear: establishedYear ? parseInt(establishedYear, 10) : null, // Ensure establishedYear is a number
      socialMediaLinks: Array.isArray(socialMediaLinks)
        ? socialMediaLinks.map(link => ({
            platform: link.platform.trim(),
            url: validator.isURL(link.url) ? link.url.trim() : null, // Validate each social media link
          }))
        : [], // Default to an empty array if no links provided
    };
  },

  // Validate social media links
  validateSocialMediaLinks: (links) => {
    if (!Array.isArray(links)) return false;
    return links.every(link => {
      return (
        link.platform && link.url &&
        typeof link.platform === 'string' &&
        validator.isURL(link.url)
      );
    });
  },

  // Validate brand data before creating or updating
  validateBrandData: (data) => {
    const { name, logoUrl, websiteUrl, socialMediaLinks, establishedYear } = data;

    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Brand name is required and must be a valid string.');
    }

    if (logoUrl && !validator.isURL(logoUrl)) {
      errors.push('Invalid logo URL format.');
    }

    if (websiteUrl && !validator.isURL(websiteUrl)) {
      errors.push('Invalid website URL format.');
    }

    if (socialMediaLinks && !brandHelper.validateSocialMediaLinks(socialMediaLinks)) {
      errors.push('Invalid social media links provided.');
    }

    if (establishedYear && (isNaN(establishedYear) || establishedYear < 1800 || establishedYear > new Date().getFullYear())) {
      errors.push('Invalid established year. It must be between 1800 and the current year.');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Prepare default values for missing data
  setDefaultValues: (data) => {
    return {
      ...data,
      description: data.description || 'No description provided',
      socialMediaLinks: data.socialMediaLinks || [],
    };
  },

  // Format response data for client-side usage
  formatResponseData: (brand) => {
    return {
      id: brand._id,
      name: brand.name,
      description: brand.description || 'N/A',
      logoUrl: brand.logoUrl || '',
      websiteUrl: brand.websiteUrl || '',
      socialMediaLinks: brand.socialMediaLinks || [],
      establishedYear: brand.establishedYear || 'Unknown',
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  },

  // Example helper for validating URL fields
  validateUrlFields: (fields) => {
    return fields.every(field => validator.isURL(field));
  },

  // More helper functions can be added as needed
};

module.exports = brandHelper;
