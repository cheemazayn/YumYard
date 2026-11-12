const Setting = require('../models/Setting');
const getSettings = () =>
  Setting.findOneAndUpdate({ key: 'global' }, { $setOnInsert: { key: 'global' } }, { upsert: true, new: true, setDefaultsOnInsert: true });
module.exports = { getSettings };
