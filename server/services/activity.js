const ActivityLog = require('../models/ActivityLog');
// Records administrative and security-relevant actions. Never blocks the request.
const logActivity = (req, action, target = '', userOverride) => {
  const u = userOverride || req.user;
  ActivityLog.create({ user: u?._id, userName: u?.name, role: u?.role, action, target, ip: req.ip }).catch(() => {});
};
module.exports = { logActivity };
