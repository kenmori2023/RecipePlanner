require('dotenv').config();
require('./db'); 

const path = require('path');
const express = require('express');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.send(`
    <h1>RecipePlanner 🍳</h1>
    <p><a href="/recipes">View Recipes</a></p>
  `);
});

const db = require('./db');
app.get('/debug/recipes', (_req, res) => {
  const rows = db.prepare('SELECT id, title, cuisine FROM recipes').all();
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));