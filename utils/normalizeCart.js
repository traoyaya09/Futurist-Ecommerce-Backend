const normalizeCartItems = (items) => {
  if (!Array.isArray(items)) return [];

  return items.map((i) => {
    const plainItem = i.toObject ? i.toObject() : i;

    // Determine product _id: prioritize product._id, fallback to product.id or product.product_id
    let productId = null;
    if (plainItem.product) {
      productId = plainItem.product._id ?? plainItem.product.id ?? plainItem.product.product_id ?? null;
    }

    return {
      ...plainItem,
      product: plainItem.product
        ? {
            _id: productId,
            name: plainItem.product.name || "Unnamed Product",
            price: Number(plainItem.product.price ?? 0),
            imageUrl: plainItem.product.imageUrl || plainItem.product.image || "/placeholder.png",
          }
        : {
            _id: null,
            name: "Unnamed Product",
            price: 0,
            imageUrl: "/placeholder.png",
          },
      quantity: Number(plainItem.quantity ?? 1),
      price: Number(plainItem.price ?? 0),
      total:
        Number(plainItem.total ?? (Number(plainItem.price ?? 0) * Number(plainItem.quantity ?? 1))),
    };
  });
};

const normalizeCart = (cartDoc) => {
  if (!cartDoc) return { items: [], savedItems: [] };

  const cart = cartDoc.toObject ? cartDoc.toObject() : cartDoc;

  return {
    ...cart,
    items: normalizeCartItems(cart.items),
    savedItems: normalizeCartItems(cart.savedItems),
  };
};

module.exports = { normalizeCartItems, normalizeCart };
