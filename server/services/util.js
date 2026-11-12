const crypto = require('crypto');
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const otp = () => String(crypto.randomInt(100000, 999999));
const randomToken = () => crypto.randomBytes(32).toString('hex');
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const httpError = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
module.exports = { sha, otp, randomToken, round, slugify, httpError, escapeRegex };
