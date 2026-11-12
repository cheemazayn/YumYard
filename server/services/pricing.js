// Price a customer pays right now: the item's live price, plus an approved peak-hour surge if one is active.
function surgeActive(restaurant, now = new Date()) {
  const s = restaurant?.surge;
  return !!(s && s.enabled && s.pct > 0 && (s.hours || []).includes(now.getHours()));
}
function effectivePrice(item, restaurant, now = new Date()) {
  const base = item.price;
  return surgeActive(restaurant, now) ? Math.round(base * (1 + restaurant.surge.pct / 100)) : base;
}
module.exports = { surgeActive, effectivePrice };
