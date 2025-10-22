function adaptProduct(raw) {
  if (!raw) return null;

  const parsePrice = (value) => {
    if (value == null) return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const digits = value.replace(/[^0-9.]/g, '');
      return digits ? parseFloat(digits) : null;
    }
    return null;
  };

  const parseNumberString = (value) => {
    if (value == null) return 0;
    if (typeof value === 'number') return value;
    return Number(value.toString().replace(/,/g, '')) || 0;
  };

  const id = raw._id?.toString() || raw.id?.toString() || '';

  const price = parsePrice(raw.actual_price ?? raw.price);
  const discountPrice = parsePrice(raw.discount_price ?? raw.discountPrice);

  // -----------------------------
  // IMAGE URL SANITIZATION
  // -----------------------------
  let imageUrl = raw.imageUrl || raw.image || 'https://via.placeholder.com/150';

  // Strip problematic Amazon IMAGERENDERING path
  imageUrl = imageUrl.replace(/\/W\/IMAGERENDERING_[^\/]+/, '');

  // Encode URL to handle special characters
  try {
    imageUrl = encodeURI(imageUrl);
  } catch (err) {
    imageUrl = 'https://via.placeholder.com/150';
  }

  return {
    _id: id,
    id,
    name: raw.name || 'Unnamed Product',
    description: raw.description || 'No description available',
    price: price ?? null,
    discountPrice: discountPrice ?? null,
    category: raw.main_category || raw.category || 'Uncategorized',
    subCategory: raw.sub_category || raw.subCategory || '',
    brand: raw.brand || '',
    stock: raw.stock ?? 0,
    imageUrl,
    rating: raw.rating ?? raw.ratings ?? 0,
    reviewsCount: parseNumberString(raw.reviewsCount ?? raw.no_of_ratings),
    reviews: raw.reviews || [],
    link: raw.link || '',
    isFeatured: raw.isFeatured ?? false,
    createdAt: raw.createdAt || raw._id?.getTimestamp?.() || new Date(),
    promotion: raw.promotion || null,
  };
}



function normalizeIncomingProduct(raw) {
  if (!raw) return {};

  const adapted = adaptProduct(raw);

  // Infer category if missing
  let category = adapted.category;
  if (!category || category === 'Uncategorized') {
    category = adapted.subCategory || (adapted.name.match(/Air Conditioner|AC/i) ? 'Air Conditioners' : 'Other');
  }

  // -----------------------------
  // IMAGE URL SANITIZATION
  // -----------------------------
  let imageUrl = adapted.imageUrl || 'https://via.placeholder.com/150';

  // Strip problematic Amazon IMAGERENDERING path
  imageUrl = imageUrl.replace(/\/W\/IMAGERENDERING_[^\/]+/, '');

  // Encode URL to handle special characters
  try {
    imageUrl = encodeURI(imageUrl);
  } catch (err) {
    imageUrl = 'https://via.placeholder.com/150';
  }

  return {
    ...adapted,
    price: adapted.price ?? null,
    discountPrice: adapted.discountPrice ?? null,
    category,
    stock: adapted.stock ?? 0,
    rating: adapted.rating ?? 0,
    reviewsCount: adapted.reviewsCount ?? 0,
    imageUrl,
  };
}

module.exports = { adaptProduct, normalizeIncomingProduct };
