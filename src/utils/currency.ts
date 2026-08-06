/** Format listing price for display (USD, whole dollars). */
export function formatPrice(price: number): string {
  return price === 0 ? 'Free' : `$${price}`;
}
