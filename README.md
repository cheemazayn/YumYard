# YumYard: Restaurants Management System (MERN)

A multi-restaurant SaaS platform: each restaurant gets its own ordering website, a POS, inventory with AI forecasting, smart pricing, review sentiment analysis and weekly reports. Built to the YumYard SRS (Federal Urdu University, Department of Computer Science).

**Stack:** MongoDB, Express, React (Vite + Tailwind), Node.js, Socket.io for live orders.

---

## 1. Setup

You need Node.js 18 or newer and a MongoDB database (Atlas or local).

```bash
# 1. install everything
npm run install:all

# 2. connect your database
cd server
cp .env.example .env        # on Windows: copy .env.example .env
# open .env and paste your connection string into MONGO_URI

# 3. (optional) fill the database with demo data
npm run seed

# 4. run the API (terminal 1)
npm run dev                 # from /server, http://localhost:5000

# 5. run the website (terminal 2)
cd ../client
npm run dev                 # http://localhost:5173
```

The only thing you must edit is **`MONGO_URI`** in `server/.env`. Everything else has working defaults.

> `npm run seed` clears the YumYard collections first. Skip it if you want an empty database; then create the admin account yourself (see "Create an admin without seeding").

## 2. Demo accounts (created by `npm run seed`)

| Role | Email | Password | Where to sign in |
|---|---|---|---|
| Admin | admin@yumyard.com | Admin@123 | /admin/login |
| Owner | owner@yumyard.com | Owner@123 | /owner/login |
| Manager | manager@yumyard.com | Manager@123 | /owner/login |
| Branch staff (F-7 Markaz) | staff@yumyard.com | Staff@123 | /owner/login |
| Customer | customer@yumyard.com | Customer@123 | /login |
| Owner awaiting approval | owner2@yumyard.com | Owner@123 | /owner/login |

The demo restaurant is at **/r/saffron-table**: two branches, 20 dishes, 30 days of orders, reviews, suppliers and coupons, so every chart and AI feature has real data.

Test card for checkout: `4242 4242 4242 4242`, any future expiry, any CVV.

## 3. How the SRS maps to the app

| SRS module | Where to find it |
|---|---|
| 2.1 Customer: register, OTP verification, login, forgot/reset password, profile and addresses, account deletion | `/register`, `/login`, `/forgot-password`, `/account` |
| 2.2 Owner: registration with documents and admin approval, secure login, optional 2FA, security settings (password, active sessions), business profile (hours, logo, banners, map location) | `/register-restaurant`, `/owner/login`, Dashboard > Settings and Branches |
| 2.3 Admin: restricted login, user list with search/filter/suspend/block, approve or reject owners, tax and service fee, activity logs with filter and CSV export | `/admin/login`, `/admin/*` |
| 2.4 Website builder: generated URL, three templates, colors and fonts, live preview, menu management, multi-branch with menu copy | Dashboard > Website, Menu, Branches |
| 2.5 Customer experience: categories, search, price and dietary filters (Halal, Veg...), cart, promo codes, payment selection, live countdown timer, mini games with points and discount codes | `/r/:slug`, `/track/:id` |
| 2.6 Order life-cycle: sound and visual alerts, live queue, Accept/Reject, In Kitchen, Ready, Out for Delivery, Delivered, POS billing and receipt printing, payment ledger | Dashboard > Orders, POS and payments |
| 2.7 AI: recommendations ("Suggested for you", "Frequently bought together"), image generator, sentiment analysis (NLP), smart pricing (slow-moving offers and peak-hour pricing) | Storefront and cart, Menu form, Dashboard > AI insights |
| 2.8 Inventory: live stock, manual audit adjustment, AI forecast (weekends and holidays), suggested purchase list, low-stock email/SMS alerts and dashboard widget, supplier tracking | Dashboard > Inventory |
| 2.9 Business intelligence: live dashboard, week-over-week charts, profitability ranking, weekly AI reports, promotions with dates and limits, ratings and public owner replies | Dashboard > Overview, AI insights, Promotions, Reviews |
| 2.10 / 3.x Non-functional: role-based access, hashed passwords, sessions, backups, responsive UI, validation messages | Throughout; `npm run backup` for backups |

### Roles
- **Owner**: everything for their restaurant, including branches, website, team and subscription.
- **Manager**: all branches, menu, inventory, promotions, AI insights. Cannot manage team or branches.
- **Staff**: locked to one branch. Orders, POS, stock updates, hiding out-of-stock dishes.
- **Customer** and **Admin** as described in the SRS.

## 4. Optional configuration (`server/.env`)

| Setting | What it does | Without it |
|---|---|---|
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Sends OTP codes, reset links, approval emails and low-stock alerts | The code or link is printed in the server console **and shown on screen in development**. This is never shown when `NODE_ENV=production`. |
| `ANTHROPIC_API_KEY` | Claude-powered sentiment analysis and review digests | Built-in NLP (sentiment lexicon with negation handling and topic detection) |
| `OPENAI_API_KEY` | DALL-E 3 dish image generation | Free Pollinations image generator |
| `SERVER_URL` | Public API address used for uploaded file links | Taken from the request |

SMS alerts are written to the console in `server/services/mailer.js` (`sendSMS`). Connect Twilio or a local gateway there.

## 5. How the AI features work

- **Sentiment**: every review is tagged positive, neutral or negative with topics (food, service, speed, price, cleanliness, ambience). Claude is used when a key is set, with automatic fallback to the built-in model.
- **Smart pricing**: compares each dish's 30-day sales to the menu average. Slow sellers get a 10 to 15% offer suggestion, strong sellers a 5% rise. Busy-hour traffic can trigger a peak-pricing suggestion. **Nothing changes until the manager approves**, and every change can be undone.
- **Inventory predictor**: ingredients are deducted from stock as dishes sell (set up in each dish's recipe). Forecasts use a weighted moving average of 14 days, a trend line, day-of-week patterns and public holidays (edit `HOLIDAYS` in `server/services/ai.js`). The purchase list groups items by supplier and can be logged as a supply order.
- **Recommendations**: "frequently bought together" from order co-occurrence, "suggested for you" from the customer's order history, browsing and favorite categories, best sellers for new users.

## 6. Folder structure

```
server/
  server.js            Express + Socket.io entry
  seed.js              demo data
  models/              Mongoose schemas
  routes/              auth, public, manage (dashboard), admin, upload, notifications
  services/            orders, ai, analytics, reports, notifications, mailer
  scripts/backup.js    npm run backup
client/
  src/pages/           public pages, dash/ (restaurant dashboard), admin/
  src/components/      layouts, cart, receipt, shared UI
  src/games/           memory match and tap-the-dish
```

## 7. Notes

- **Payments** are simulated: card numbers are validated (Luhn) but never stored, and online wallet payments always succeed. Replace the logic in `server/routes/public.js` and `server/services/orders.js` with a real gateway for production.
- **Receipt printing** uses the browser print dialog with an 80 mm layout, which works with any connected receipt printer.
- **File uploads** are stored in `server/uploads`. For production use cloud storage.
- **Time zone**: peak-hour pricing and charts use the server's clock. Set `TZ=Asia/Karachi` when starting the server.
- **Create an admin without seeding**: run `node -e "require('dotenv').config();const m=require('mongoose');const U=require('./models/User');m.connect(process.env.MONGO_URI).then(async()=>{await U.create({name:'Admin',email:'admin@yumyard.com',password:'Admin@123',role:'admin',emailVerified:true});console.log('done');process.exit()})"` from the `server` folder.
- **Production build**: `cd client && npm run build`, host `client/dist` on any static host, and set `VITE_API_URL` (see `client/.env.example`). Set `CLIENT_URL` on the server to the website address.
