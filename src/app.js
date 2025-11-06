require('dotenv').config();
require('./db');

const path = require('path');
const express = require('express');
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => { console.log(`[REQ] ${req.method} ${req.url}`); next(); });

app.get('/', (_req, res) => {
  res.send(`
    <h1>RecipePlanner 🔍</h1>
    <p>
      <a href="/recipes">Recipes</a> ·
      <a href="/search">Search</a> ·
      <a href="/reports">Reports</a>
    </p>
  `);
});

const recipeRoutes  = require('./routes/recipes.routes');
const searchRoutes  = require('./routes/search.routes');
const reportRoutes  = require('./routes/reports.routes');

app.use('/recipes', recipeRoutes);
app.use('/search',  searchRoutes);
app.use('/reports', reportRoutes);

const db = require('./db');
app.get('/debug/recipes', (_req, res) => {
  const rows = db.prepare('SELECT id, title, cuisine FROM recipes').all();
  res.json(rows);
});

app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).send(`<pre>${err.stack}</pre>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));