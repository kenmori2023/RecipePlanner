const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const dbFile = process.env.DB_PATH || './data/app.db';
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const seedPath = path.join(__dirname, '..', 'db', 'seed.sql');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
console.log('[DB] Using file:', path.resolve(dbFile));

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
  console.log('[DB] Schema applied');
}

if (fs.existsSync(seedPath)) {
  const seed = fs.readFileSync(seedPath, 'utf8');
  db.exec(seed);
  console.log('[DB] Seed applied');
}

module.exports = db;