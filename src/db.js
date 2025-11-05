const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbFile = process.env.DB_PATH || './data/app.db';
const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;