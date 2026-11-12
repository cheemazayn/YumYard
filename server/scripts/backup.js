// Exports every collection to JSON files: npm run backup
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

(async () => {
  if (!process.env.MONGO_URI) { console.error('MONGO_URI is missing in .env'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  const dir = path.join(__dirname, '..', 'backups', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const docs = await mongoose.connection.db.collection(c.name).find({}).toArray();
    fs.writeFileSync(path.join(dir, `${c.name}.json`), JSON.stringify(docs, null, 2));
    console.log(`${c.name}: ${docs.length} documents`);
  }
  console.log(`\nBackup saved to ${dir}`);
  await mongoose.disconnect();
})();
