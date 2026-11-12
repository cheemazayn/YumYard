require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { runWeeklyReports } = require('./services/reports');

const app = express();
const server = http.createServer(app);
const origin = process.env.CLIENT_URL || true;
const io = new Server(server, { cors: { origin } });
app.set('io', io);
app.set('trust proxy', 1);

// Lets async route handlers and middleware throw errors that reach the error handler below
const wrap = (router) => {
  const safe = (fn) => (fn.length > 3 || fn.stack ? fn : (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next));
  router.stack.forEach((layer) => {
    if (layer.route) layer.route.stack.forEach((l) => { l.handle = safe(l.handle); });
    else layer.handle = safe(layer.handle);
  });
  return router;
};

app.use(cors({ origin }));
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', wrap(require('./routes/auth')));
app.use('/api/public', wrap(require('./routes/public')));
app.use('/api/manage', wrap(require('./routes/manage')));
app.use('/api/admin', wrap(require('./routes/admin')));
app.use('/api/notifications', wrap(require('./routes/notifications')));
app.use('/api/upload', require('./routes/upload'));

app.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id.' });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0].message });
  if (err.code === 11000) return res.status(409).json({ message: 'That value already exists.' });
  if (!err.status) { console.error(err); return res.status(500).json({ message: 'Something went wrong on our side. Please try again.' }); }
  res.status(err.status).json({ message: err.message, ...(typeof err.code === 'string' ? { code: err.code } : {}) });
});

io.on('connection', (socket) => {
  socket.on('join', (room) => typeof room === 'string' && socket.join(room));
});

module.exports = { app, server };

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  connectDB().then(() => {
    server.listen(PORT, () => console.log(`YumYard API running on port ${PORT}`));
    runWeeklyReports().catch(() => {});
    setInterval(() => runWeeklyReports().catch(() => {}), 6 * 3600e3);
  });
}
