// utils/adaptProduct.js (Node-compatible version for backend)
function adaptProduct(raw) {
  if (!raw) return null;

  const id =
    raw.id ||
    raw._id?.toString?.() ||
    raw._id?.$oid ||
    (typeof raw._id === "string" ? raw._id : undefined);

  const parsePrice = (value) => {
    if (!value) return null;
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const digits = value.replace(/[^0-9.]/g, "");
      return digits ? parseFloat(digits) : null;
    }
    return null;
  };

  const parsedPrice = parsePrice(raw.price) ?? parsePrice(raw.actual_price);
  const parsedDiscount = parsePrice(raw.discountPrice) ?? parsePrice(raw.discount_price);
  const finalPrice = parsedPrice ?? parsedDiscount ?? 0;

  return {
    id,
    name: raw.name || "Unnamed Product",
    description: raw.description || raw.sub_category || "No description available",
    price: finalPrice,
    discountPrice: parsedDiscount,
    category: raw.category || raw.main_category || "Uncategorized",
    brand: raw.brand || "",
    stock: raw.stock ?? 0,
    imageUrl: raw.imageUrl || raw.image || "https://via.placeholder.com/150",
    rating: raw.rating || raw.ratings || 0,
    reviewsCount: raw.reviewsCount ?? raw.no_of_ratings ?? 0,
    reviews: raw.reviews || [],
    createdAt: raw.createdAt || null,
    promotion: raw.promotion || null,
  };
}

module.exports = { adaptProduct };
