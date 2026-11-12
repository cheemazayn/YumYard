// Fills the database with demo data: npm run seed
// WARNING: this clears the YumYard collections first.
require('dotenv').config();
const mongoose = require('mongoose');
const models = {
  User: require('./models/User'), Token: require('./models/Token'), Session: require('./models/Session'), Setting: require('./models/Setting'),
  Restaurant: require('./models/Restaurant'), Branch: require('./models/Branch'), Category: require('./models/Category'), MenuItem: require('./models/MenuItem'),
  Order: require('./models/Order'), Payment: require('./models/Payment'), InventoryItem: require('./models/InventoryItem'), Supplier: require('./models/Supplier'),
  Review: require('./models/Review'), Coupon: require('./models/Coupon'), GameScore: require('./models/GameScore'), Notification: require('./models/Notification'),
  ActivityLog: require('./models/ActivityLog'), Report: require('./models/Report'),
};
const { ruleSentiment } = require('./services/ai');
const { buildReport } = require('./services/reports');

let seedState = 20260930;
const rnd = () => { seedState |= 0; seedState = (seedState + 0x6d2b79f5) | 0; let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (list) => { const total = list.reduce((s, x) => s + x.w, 0); let r = rnd() * total; for (const x of list) { r -= x.w; if (r <= 0) return x; } return list[0]; };
const U = (id, w = 900) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
const DAY = 864e5;

const MENU = [
  ['Starters', 'Crispy Chicken Wings', 'Twice-fried wings tossed in a smoky chili glaze.', 690, 260, ['halal', 'spicy'], '1567620832903-9fc6debc209f', 6, [['Chicken', 0.25], ['Cooking Oil', 0.05]], 12],
  ['Starters', 'Loaded Fries', 'Skin-on fries with melted cheddar, jalapeno and house sauce.', 490, 150, ['halal', 'veg'], '1573080496219-bb080dd4f877', 7, [['Potatoes', 0.3], ['Cheese', 0.05], ['Cooking Oil', 0.05]], 10],
  ['Starters', 'Seekh Kebab Platter', 'Four charcoal-grilled beef seekh kebabs with mint chutney.', 850, 340, ['halal', 'spicy'], '1529006557810-274b9b2fc783', 4, [['Beef', 0.2], ['Onions', 0.05]], 15],
  ['Starters', 'Garden Salad', 'Crisp greens, cucumber, tomato and lemon dressing.', 390, 110, ['halal', 'veg', 'vegan', 'gluten-free'], '1546069901-ba9599a7e63c', 1, [['Tomatoes', 0.1], ['Onions', 0.05]], 6],
  ['BBQ & Grill', 'Chicken Malai Boti', 'Creamy marinated chicken cubes grilled over charcoal.', 950, 380, ['halal'], '1555939594-58d7cb561ad1', 6, [['Chicken', 0.3], ['Cream', 0.05], ['Yogurt', 0.05]], 20],
  ['BBQ & Grill', 'Beef Ribeye Steak', '300g ribeye with garlic butter and grilled vegetables.', 2450, 1100, ['halal', 'gluten-free'], '1544025162-d76694265947', 2, [['Beef', 0.35]], 25],
  ['BBQ & Grill', 'Mutton Chops', 'Slow-marinated mutton chops finished on the grill.', 1890, 900, ['halal', 'spicy'], '1600891964092-4316c288032e', 1, [['Mutton', 0.35]], 25],
  ['Mains', 'Chicken Biryani', 'Long-grain basmati layered with spiced chicken and fried onions.', 750, 260, ['halal', 'spicy'], '1563379091339-03b21ab4a4f8', 10, [['Chicken', 0.25], ['Basmati Rice', 0.2], ['Onions', 0.05], ['Cooking Oil', 0.03], ['Yogurt', 0.03]], 20],
  ['Mains', 'Butter Chicken', 'Tandoori chicken in a rich tomato and cream gravy.', 1150, 430, ['halal'], '1631452180519-c014fe946bc7', 8, [['Chicken', 0.25], ['Tomatoes', 0.15], ['Cream', 0.05]], 20],
  ['Mains', 'Chicken Karahi', 'Wok-cooked with tomatoes, green chili and ginger. Serves two.', 1490, 620, ['halal', 'spicy'], '1603894584373-5ac82b2ae398', 4, [['Chicken', 0.4], ['Tomatoes', 0.2], ['Onions', 0.05], ['Cooking Oil', 0.05]], 25],
  ['Mains', 'Dal Makhani', 'Black lentils simmered overnight with butter and cream.', 620, 180, ['halal', 'veg'], '1585937421612-70a008356fbe', 1, [['Lentils', 0.12], ['Cream', 0.03]], 15],
  ['Mains', 'Garlic Naan', 'Tandoor-baked bread brushed with garlic butter.', 120, 30, ['halal', 'veg'], '1601050690597-df0568f70950', 7, [['Flour', 0.1], ['Yogurt', 0.02]], 8],
  ['Burgers & Pizza', 'Smash Burger', 'Two smashed beef patties, cheese, pickles and burger sauce.', 890, 330, ['halal'], '1568901346375-23c9450c58cd', 9, [['Beef', 0.15], ['Burger Buns', 1], ['Cheese', 0.03], ['Onions', 0.03]], 15],
  ['Burgers & Pizza', 'Crispy Chicken Burger', 'Buttermilk fried chicken, slaw and chipotle mayo.', 790, 290, ['halal'], '1551782450-a2132b4ba21d', 5, [['Chicken', 0.15], ['Burger Buns', 1], ['Cooking Oil', 0.03]], 15],
  ['Burgers & Pizza', 'Margherita Pizza', 'Wood-fired base, San Marzano tomato and fresh mozzarella.', 1190, 380, ['halal', 'veg'], '1565299624946-b28f40a0ae38', 5, [['Flour', 0.2], ['Cheese', 0.15], ['Tomatoes', 0.1]], 20],
  ['Burgers & Pizza', 'Fajita Pizza', 'Chicken fajita, peppers and onions on a crisp base.', 1290, 430, ['halal', 'spicy'], '1574071318508-1cdbab80d002', 2, [['Flour', 0.2], ['Cheese', 0.12], ['Chicken', 0.12]], 20],
  ['Desserts', 'Chocolate Lava Cake', 'Warm cake with a molten dark chocolate centre.', 590, 170, ['veg'], '1578985545062-69928b1d9587', 3, [['Chocolate', 0.1], ['Flour', 0.05], ['Cream', 0.02]], 12],
  ['Desserts', 'Kulfi Falooda', 'Pistachio kulfi over rose falooda and vermicelli.', 450, 120, ['halal', 'veg'], '1563805042-7684c019e1cb', 1, [['Fresh Milk', 0.2], ['Cream', 0.05]], 8],
  ['Drinks', 'Mint Margarita', 'Fresh mint, lime and soda over crushed ice.', 350, 70, ['halal', 'veg', 'vegan', 'gluten-free'], '1544145945-f90425340c7e', 6, [['Mint', 0.02]], 5],
  ['Drinks', 'Cold Coffee', 'Double espresso shaken with milk and vanilla ice cream.', 420, 110, ['halal', 'veg'], '1495474472287-4d71bcdd2085', 7, [['Coffee Beans', 0.02], ['Fresh Milk', 0.25]], 5],
];
const BRANCH2_SKIP = ['Mutton Chops', 'Dal Makhani', 'Fajita Pizza', 'Kulfi Falooda'];

const INVENTORY = [
  ['Chicken', 'kg', 620, false, 1.2], ['Beef', 'kg', 1450, false, 2.5], ['Mutton', 'kg', 2100, false, 5], ['Basmati Rice', 'kg', 260, false, 3],
  ['Flour', 'kg', 95, false, 14], ['Cooking Oil', 'l', 380, false, 9], ['Tomatoes', 'kg', 140, true, 6], ['Onions', 'kg', 90, true, 8], ['Potatoes', 'kg', 80, true, 7],
  ['Cheese', 'kg', 1300, true, 8], ['Fresh Milk', 'l', 190, true, 3.5], ['Coffee Beans', 'kg', 3200, false, 20], ['Mint', 'kg', 400, true, 40], ['Cream', 'l', 620, true, 5],
  ['Burger Buns', 'pcs', 45, true, 6], ['Lentils', 'kg', 270, false, 18], ['Chocolate', 'kg', 1400, false, 16], ['Yogurt', 'kg', 260, true, 5],
];
const SUPPLIERS = [
  { name: 'Al-Madina Meat Traders', contact: 'Tariq Mehmood', phone: '+92 300 5551234', email: 'orders@almadina.example', materials: ['Chicken', 'Beef', 'Mutton'] },
  { name: 'Fresh Farm Produce', contact: 'Sajid Ali', phone: '+92 321 5559876', email: 'sales@freshfarm.example', materials: ['Tomatoes', 'Onions', 'Potatoes', 'Mint'] },
  { name: 'Punjab Dairy Co.', contact: 'Nadia Khan', phone: '+92 333 5554321', email: 'supply@punjabdairy.example', materials: ['Fresh Milk', 'Cream', 'Yogurt', 'Cheese'] },
  { name: 'Grain House', contact: 'Imran Butt', phone: '+92 302 5556677', email: 'hello@grainhouse.example', materials: ['Basmati Rice', 'Flour', 'Lentils', 'Cooking Oil', 'Burger Buns', 'Chocolate', 'Coffee Beans'] },
];

const REVIEWS = {
  positive: ['The biryani was fresh, fragrant and arrived hot. Great service too.', 'Loved the smash burger. Juicy and worth every rupee.', 'Fast delivery and the food was delicious. Will order again.', 'Excellent butter chicken and the staff were very friendly.', 'Best malai boti in town. Perfect portion and clean place.', 'Amazing flavors and quick service. Highly recommend.', 'The cold coffee was superb and the naan was crispy and fresh.'],
  neutral: ['Food was okay. Nothing special but fine for the price.', 'Decent meal. The portion was average.', 'It was fine. Service could be a little faster.'],
  negative: ['Food arrived cold and the delivery was very late. Disappointed.', 'The karahi was too salty and the waiter was rude.', 'Waited over an hour and the burger was soggy. Not good.', 'Overpriced for the quality. The fries were stale.', 'Table was dirty and the service was slow.'],
};
const REPLIES = ['Thank you for the kind words. We look forward to serving you again.', 'We are glad you enjoyed it. See you soon!'];

async function main() {
  if (!process.env.MONGO_URI) { console.error('MONGO_URI is missing in .env'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Clearing old data...');
  await Promise.all(Object.values(models).map((m) => m.deleteMany({})));

  const settings = await models.Setting.create({ key: 'global', taxRate: 5, serviceFee: 0, requireEmailVerification: true, requireOwner2FA: false });

  // ---- users
  const admin = await models.User.create({ name: 'YumYard Admin', email: 'admin@yumyard.com', password: 'Admin@123', role: 'admin', emailVerified: true });
  const owner = await models.User.create({ name: 'Hamza Rauf', email: 'owner@yumyard.com', password: 'Owner@123', role: 'owner', phone: '+92 300 1112233', emailVerified: true });
  const owner2 = await models.User.create({ name: 'Sana Yusuf', email: 'owner2@yumyard.com', password: 'Owner@123', role: 'owner', phone: '+92 311 2223344', emailVerified: true });
  const customer = await models.User.create({ name: 'Ayesha Malik', email: 'customer@yumyard.com', password: 'Customer@123', phone: '+92 345 6667788', emailVerified: true, points: 120, addresses: [{ label: 'Home', line: 'House 14, Street 6, F-8/3, Islamabad' }, { label: 'Office', line: 'Blue Area, Jinnah Avenue, Islamabad' }] });
  const customers = [customer];
  for (const [n, e] of [['Bilal Ahmed', 'bilal'], ['Fatima Noor', 'fatima'], ['Usman Tariq', 'usman']])
    customers.push(await models.User.create({ name: n, email: `${e}@example.com`, password: 'Customer@123', phone: '+92 300 0000000', emailVerified: true }));

  // ---- restaurants
  const rest = await models.Restaurant.create({
    name: 'Saffron Table', slug: 'saffron-table', owner: owner._id, status: 'active', isPublished: true, cuisine: 'Pakistani and BBQ',
    tagline: 'Charcoal grills, slow biryani and the best naan in Islamabad.',
    about: 'Saffron Table started as a single tandoor in F-7 and still cooks the way it did then: over charcoal, with whole spices ground in house. Come hungry, order the biryani, and save room for kulfi.',
    cover: U('1517248135467-4c7edcad34c4', 1800), logo: undefined,
    gallery: [U('1414235077428-338989a2e8c0', 900), U('1555396273-367ea4eb4db5', 900), U('1504674900247-0877df9cc836', 900)],
    template: 'modern', theme: { primary: '#1F4D3A', secondary: '#F0A81F', font: 'Bricolage Grotesque' },
    phone: '+92 51 2650101', email: 'hello@saffrontable.example', openingHours: '12:00 PM - 12:00 AM', social: { instagram: 'saffrontable', facebook: 'saffrontable' },
    plan: { status: 'active', activatedAt: new Date() },
  });
  owner.restaurant = rest._id; await owner.save();

  const pendingRest = await models.Restaurant.create({
    name: 'Bun & Barrow', slug: 'bun-and-barrow', owner: owner2._id, status: 'pending', cuisine: 'Burgers and Shakes',
    documents: [{ name: 'business-registration.pdf', url: 'https://example.com/business-registration.pdf' }, { name: 'food-authority-license.jpg', url: 'https://example.com/license.jpg' }],
    cover: U('1559339352-11d035aa65de', 1600),
  });
  owner2.restaurant = pendingRest._id; await owner2.save();
  await models.Branch.create({ restaurant: pendingRest._id, name: 'Main Branch', address: 'Shop 4, Bahria Town Phase 4, Rawalpindi', city: 'Rawalpindi', phone: '+92 311 2223344' });

  const branches = await models.Branch.insertMany([
    { restaurant: rest._id, name: 'F-7 Markaz', address: 'Shop 12, Jinnah Super Market, F-7 Markaz', city: 'Islamabad', phone: '+92 51 2650101', operatingHours: '12:00 PM - 12:00 AM', geo: { lat: 33.7215, lng: 73.0559 } },
    { restaurant: rest._id, name: 'Saddar', address: '45 Bank Road, Saddar', city: 'Rawalpindi', phone: '+92 51 5550202', operatingHours: '11:00 AM - 1:00 AM', geo: { lat: 33.5973, lng: 73.0479 } },
  ]);
  const manager = await models.User.create({ name: 'Zainab Iqbal', email: 'manager@yumyard.com', password: 'Manager@123', role: 'manager', restaurant: rest._id, emailVerified: true, phone: '+92 300 9998877' });
  const staff = await models.User.create({ name: 'Kamran Shah', email: 'staff@yumyard.com', password: 'Staff@123', role: 'staff', restaurant: rest._id, branch: branches[0]._id, emailVerified: true });

  // ---- menus (each branch has its own)
  const itemsByBranch = {};
  for (const [bi, b] of branches.entries()) {
    const cats = {};
    const wanted = MENU.filter((m) => bi === 0 || !BRANCH2_SKIP.includes(m[1]));
    for (const name of [...new Set(wanted.map((m) => m[0]))]) cats[name] = await models.Category.create({ restaurant: rest._id, branch: b._id, name, sort: Object.keys(cats).length });
    itemsByBranch[b._id] = await models.MenuItem.insertMany(wanted.map((m) => ({
      restaurant: rest._id, branch: b._id, category: cats[m[0]]._id, name: m[1], description: m[2], basePrice: m[3], price: m[3], cost: m[4], dietaryTags: m[5],
      image: U(m[6]), prepMinutes: m[9], recipe: m[8].map(([name, qty]) => ({ name, qty })),
    })));
  }
  const weightOf = (name) => MENU.find((m) => m[1] === name)[7];

  // ---- suppliers
  const supplierDocs = await models.Supplier.insertMany(SUPPLIERS.map((s) => ({ ...s, restaurant: rest._id })));
  const supplierOf = (mat) => supplierDocs.find((s) => s.materials.includes(mat));

  // ---- orders for the last 30 days
  console.log('Generating 30 days of orders...');
  const now = Date.now();
  const orders = [], payments = [], usage = {}; // usage[branchId][ingredient] = [{qty,date}]
  const fav = ['Chicken Biryani', 'Cold Coffee', 'Garlic Naan'];
  let counter = 100000;
  for (let d = 29; d >= 0; d--) {
    for (const b of branches) {
      const day = new Date(now - d * DAY);
      const dow = day.getDay();
      const base = b.name === 'F-7 Markaz' ? 22 : 15;
      const count = Math.round(base * ([5, 6, 0].includes(dow) ? 1.5 : 1) * (0.8 + rnd() * 0.4) * (1 + (29 - d) * 0.006));
      for (let i = 0; i < count; i++) {
        const hour = weighted([{ h: 12, w: 4 }, { h: 13, w: 9 }, { h: 14, w: 8 }, { h: 15, w: 3 }, { h: 16, w: 2 }, { h: 17, w: 2 }, { h: 18, w: 4 }, { h: 19, w: 8 }, { h: 20, w: 10 }, { h: 21, w: 9 }, { h: 22, w: 5 }, { h: 23, w: 2 }]).h;
        const created = new Date(day); created.setHours(hour, Math.floor(rnd() * 60), Math.floor(rnd() * 60));
        if (created.getTime() > now) continue;
        const menu = itemsByBranch[b._id];
        const isFav = b.name === 'F-7 Markaz' && rnd() < 0.12;
        const chosen = new Map();
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n; k++) { const it = weighted(menu.map((m) => ({ m, w: weightOf(m.name) }))).m; chosen.set(String(it._id), it); }
        if (isFav) fav.forEach((f) => { const it = menu.find((m) => m.name === f); if (it) chosen.set(String(it._id), it); });
        if (chosen.size && [...chosen.values()].some((m) => m.name === 'Chicken Biryani') && rnd() < 0.5) { const naan = menu.find((m) => m.name === 'Garlic Naan'); chosen.set(String(naan._id), naan); }
        const lines = [...chosen.values()].map((m) => ({ menuItem: m._id, name: m.name, price: m.price, qty: 1 + Math.floor(rnd() * 2.2) }));
        const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
        const tax = Math.round(subtotal * settings.taxRate / 100);
        const type = weighted([{ t: 'dine-in', w: 50 }, { t: 'takeaway', w: 20 }, { t: 'delivery', w: 30 }]).t;
        const source = rnd() < 0.4 ? 'pos' : 'website';
        const est = Math.max(...lines.map((l) => menu.find((m) => String(m._id) === String(l.menuItem)).prepMinutes)) + (type === 'delivery' ? 15 : 0);
        const ageMin = (now - created.getTime()) / 60000;
        const dead = rnd() < 0.04;
        let status = dead ? (rnd() < 0.5 ? 'rejected' : 'cancelled') : 'delivered';
        if (ageMin < 45 && !dead) status = pick(['pending', 'confirmed', 'in_kitchen', 'in_kitchen', 'ready']);
        if (ageMin < 45 && status === 'ready' && type === 'delivery') status = 'in_kitchen';
        const late = rnd() < 0.08;
        const readyAt = new Date(created.getTime() + (est * (late ? 1.6 : 0.85 + rnd() * 0.25)) * 60000);
        const custom = rnd() < 0.25 && source === 'website' ? pick(customers) : null;
        const method = weighted([{ m: 'cash', w: 45 }, { m: 'card', w: 35 }, { m: 'online', w: 20 }]).m;
        const isDelivered = status === 'delivered';
        const timeline = [{ status: source === 'pos' ? 'confirmed' : 'pending', at: created }];
        if (['confirmed', 'in_kitchen', 'ready', 'delivered'].includes(status) && source !== 'pos') timeline.push({ status: 'confirmed', at: new Date(created.getTime() + 60000) });
        if (['in_kitchen', 'ready', 'delivered'].includes(status)) timeline.push({ status: 'in_kitchen', at: new Date(created.getTime() + 120000) });
        if (isDelivered) { timeline.push({ status: 'ready', at: readyAt }); timeline.push({ status: 'delivered', at: new Date(readyAt.getTime() + (type === 'delivery' ? 20 : 5) * 60000) }); }
        const paid = isDelivered || (method !== 'cash' && !dead);
        const order = {
          _id: new mongoose.Types.ObjectId(), orderNo: `YY${counter++}`, restaurant: rest._id, branch: b._id, customer: custom?._id,
          customerName: custom?.name || pick(['Guest', 'Ali', 'Sara', 'Hassan', 'Mehreen', 'Walk-in']), phone: '+92 300 0000000', items: lines, subtotal, discount: 0, tax, serviceFee: 0, total: subtotal + tax,
          type, source, tableNo: type === 'dine-in' ? String(1 + Math.floor(rnd() * 14)) : undefined, address: type === 'delivery' ? 'House 22, Street 9, G-9/1, Islamabad' : undefined,
          status, paymentMethod: method, paymentStatus: dead ? (method === 'cash' ? 'pending' : 'refunded') : paid ? 'paid' : 'pending', estimatedMinutes: est, timeline,
          readyAt: isDelivered ? readyAt : undefined, outAt: isDelivered && type === 'delivery' ? new Date(readyAt.getTime() + 60000) : undefined,
          deliveredAt: isDelivered ? timeline[timeline.length - 1].at : undefined,
          stockDeducted: !['pending', 'rejected', 'cancelled'].includes(status), createdAt: created, updatedAt: created,
        };
        orders.push(order);
        if (dead && method !== 'cash') payments.push({ restaurant: rest._id, branch: b._id, order: order._id, orderNo: order.orderNo, amount: order.total, method, status: 'refunded', paidAt: created, createdAt: created });
        else if (order.paymentStatus === 'paid') payments.push({ restaurant: rest._id, branch: b._id, order: order._id, orderNo: order.orderNo, amount: order.total, method, status: 'paid', paidAt: created, createdAt: created });
        if (order.stockDeducted) for (const l of lines) {
          const m = menu.find((x) => String(x._id) === String(l.menuItem));
          for (const ing of m.recipe) {
            usage[b._id] = usage[b._id] || {}; (usage[b._id][ing.name] = usage[b._id][ing.name] || []).push({ qty: ing.qty * l.qty, date: created });
          }
        }
      }
    }
  }
  await models.Order.collection.insertMany(orders);
  await models.Payment.collection.insertMany(payments);
  console.log(`  ${orders.length} orders, ${payments.length} payments`);

  // ---- inventory built from real usage
  const inv = [];
  for (const b of branches) for (const [name, unit, cost, perishable, days] of INVENTORY) {
    const logs = usage[b._id]?.[name] || [];
    const last14 = logs.filter((l) => now - l.date < 14 * DAY).reduce((s, l) => s + l.qty, 0);
    const daily = last14 / 14 || 0.5;
    const wastage = ['Tomatoes', 'Mint', 'Cream', 'Fresh Milk', 'Burger Buns'].includes(name)
      ? [{ qty: Math.max(0.5, Math.round(daily * 0.8 * 10) / 10), reason: 'Spoiled', date: new Date(now - 4 * DAY) }, { qty: Math.max(0.5, Math.round(daily * 0.5 * 10) / 10), reason: 'Expired', date: new Date(now - 12 * DAY) }] : [];
    inv.push({
      restaurant: rest._id, branch: b._id, supplier: supplierOf(name)?._id, name, unit, costPerUnit: cost, perishable,
      quantity: Math.round(daily * days * 10) / 10, reorderLevel: Math.max(1, Math.ceil(daily * 1.5)), usageLogs: logs, wastageLogs: wastage,
    });
  }
  await models.InventoryItem.insertMany(inv);
  for (const s of supplierDocs) {
    s.orders.push({ date: new Date(now - 9 * DAY), branch: branches[0]._id, status: 'received', items: s.materials.slice(0, 2).map((m) => ({ name: m, qty: 40, unit: 'kg', cost: 40 * (INVENTORY.find((i) => i[0] === m)?.[2] || 100) })), total: 40 * 200, note: 'Weekly delivery' });
    s.orders.push({ date: new Date(now - 2 * DAY), branch: branches[1]._id, status: 'received', items: s.materials.slice(0, 1).map((m) => ({ name: m, qty: 25, unit: 'kg', cost: 25 * (INVENTORY.find((i) => i[0] === m)?.[2] || 100) })), total: 25 * 200 });
    await s.save();
  }

  // ---- reviews
  const delivered = orders.filter((o) => o.status === 'delivered' && rnd() < 0.09);
  const reviews = delivered.map((o) => {
    const kind = weighted([{ k: 'positive', w: 62 }, { k: 'neutral', w: 15 }, { k: 'negative', w: 23 }]).k;
    const rating = kind === 'positive' ? 4 + Math.round(rnd()) : kind === 'neutral' ? 3 : 1 + Math.round(rnd());
    const comment = pick(REVIEWS[kind]);
    const ageDays = (now - o.createdAt) / DAY;
    const replied = ageDays > 4 && (kind === 'positive' ? rnd() < 0.5 : rnd() < 0.7);
    return {
      restaurant: rest._id, branch: o.branch, order: o._id, customer: o.customer, name: o.customerName, rating, comment,
      sentiment: ruleSentiment(comment, rating), reply: replied ? (kind === 'negative' ? 'We are sorry about this experience. Please contact us so we can make it right.' : pick(REPLIES)) : undefined,
      repliedAt: replied ? new Date(o.createdAt.getTime() + DAY) : undefined, createdAt: new Date(o.createdAt.getTime() + 3600e3), updatedAt: o.createdAt,
    };
  });
  await models.Review.collection.insertMany(reviews);
  await models.Order.collection.updateMany({ _id: { $in: delivered.map((o) => o._id) } }, { $set: { reviewed: true } });

  // ---- coupons
  await models.Coupon.insertMany([
    { restaurant: rest._id, code: 'WELCOME10', description: '10% off your first order over Rs 800', type: 'percent', value: 10, minOrder: 800, usageLimit: 200, usedCount: 34, startsAt: new Date(now - 10 * DAY), expiresAt: new Date(now + 60 * DAY) },
    { restaurant: rest._id, code: 'FEAST200', description: 'Rs 200 off orders above Rs 1,500', type: 'flat', value: 200, minOrder: 1500, usageLimit: 100, usedCount: 12, expiresAt: new Date(now + 30 * DAY) },
    { restaurant: rest._id, branch: branches[0]._id, code: 'HAPPYHOUR', description: '15% off at F-7 Markaz', type: 'percent', value: 15, startsAt: new Date(now - DAY), expiresAt: new Date(now + 14 * DAY) },
  ]);

  await models.Notification.insertMany([
    { user: owner._id, restaurant: rest._id, type: 'approval', message: 'Saffron Table has been approved. Welcome to YumYard.', link: '/dashboard' },
    { user: admin._id, type: 'approval', message: 'Bun & Barrow applied to join YumYard.', link: '/admin/approvals' },
  ]);
  await models.ActivityLog.insertMany([
    { user: admin._id, userName: admin.name, role: 'admin', action: 'restaurant approved', target: 'Saffron Table', ip: '127.0.0.1', createdAt: new Date(now - 30 * DAY) },
    { user: admin._id, userName: admin.name, role: 'admin', action: 'system settings updated', target: 'tax 5%, service fee 0%', ip: '127.0.0.1', createdAt: new Date(now - 20 * DAY) },
  ]);
  try { await buildReport(rest._id, { auto: true }); } catch (e) { console.log('Report skipped:', e.message); }

  console.log('\nDone. Demo accounts:');
  console.log('  Admin      admin@yumyard.com     Admin@123     (portal: /admin/login)');
  console.log('  Owner      owner@yumyard.com     Owner@123     (portal: /owner/login)');
  console.log('  Manager    manager@yumyard.com   Manager@123');
  console.log('  Staff      staff@yumyard.com     Staff@123     (F-7 Markaz branch)');
  console.log('  Customer   customer@yumyard.com  Customer@123');
  console.log('  Pending    owner2@yumyard.com    Owner@123     (waiting for admin approval)');
  console.log('\nVisit the restaurant at /r/saffron-table');
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
