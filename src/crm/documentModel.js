export function calculateDocument(items, taxPercent = 0) {
  let subtotal = 0,
    discount = 0;
  for (const item of items) {
    const qty = Number(item.quantity),
      price = Number(item.price),
      off = Number(item.discount || 0);
    if (
      !Number.isFinite(qty) ||
      qty <= 0 ||
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(off) ||
      off < 0 ||
      off > 100
    )
      throw new Error(
        "Each item needs a positive quantity, a valid price, and a discount between 0 and 100%.",
      );
    subtotal += qty * price;
    discount += (qty * price * off) / 100;
  }
  const rate = Number(taxPercent);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100)
    throw new Error("Tax must be between 0 and 100%.");
  const net = subtotal - discount,
    tax = (net * rate) / 100;
  const round = (number) => Math.round((number + Number.EPSILON) * 100) / 100;
  return {
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(net + tax),
  };
}
