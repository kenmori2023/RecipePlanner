require('dotenv').config();
const db = require('./db');

const session = require('express-session');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');

const app = express();

// --------- View engine & middleware ---------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false
}));

// expose current user id to templates
app.use((req, res, next) => {
  res.locals.currentUserId = req.session.userId || null;
  next();
});

// simple request logging
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// --------- Home page ---------
app.get('/', (_req, res) => {
  res.send(`
    <h1>RecipePlanner 🔍</h1>
    <p>
      <a href="/recipes">Recipes</a> ·
      <a href="/ingredients">Ingredients</a> ·
      <a href="/search">Search</a> ·
      <a href="/reports">Reports</a> ·
      <a href="/auth/register">Register</a> ·
      <a href="/auth/login">Login</a>
    </p>
  `);
});

// --------- Existing routers ---------
const recipeRoutes     = require('./routes/recipes.routes');
const searchRoutes     = require('./routes/search.routes');
const reportRoutes     = require('./routes/reports.routes');
const ingredientRoutes = require('./routes/ingredients.routes');

app.use('/recipes',     recipeRoutes);
app.use('/search',      searchRoutes);
app.use('/reports',     reportRoutes);
app.use('/ingredients', ingredientRoutes);

// --------- AUTH INLINE (no separate auth.routes.js needed) ---------

// require login helper
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// --- Register ---
app.get('/auth/register', (_req, res) => {
  res.render('auth/register', { error: null });
});

app.post('/auth/register', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    return res.render('auth/register', { error: 'Username and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.render('auth/register', { error: 'That username is already taken.' });
  }

  const hash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO users (username, password_hash)
    VALUES (?, ?)
  `).run(username, hash);

  req.session.userId = info.lastInsertRowid;
  res.redirect('/');
});

// --- Login / Logout ---
app.get('/auth/login', (_req, res) => {
  res.render('auth/login', { error: null });
});

app.post('/auth/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.render('auth/login', { error: 'Invalid username or password.' });
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return res.render('auth/login', { error: 'Invalid username or password.' });
  }

  req.session.userId = user.id;
  res.redirect('/');
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --- Account page / change username / delete account ---

app.get('/auth/account', requireLogin, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                 .get(req.session.userId);
  res.render('auth/account', { user, error: null });
});

app.post('/auth/account/username', requireLogin, (req, res) => {
  const newUsername = (req.body.username || '').trim();

  if (!newUsername) {
    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                   .get(req.session.userId);
    return res.render('auth/account', { user, error: 'Username cannot be empty.' });
  }

  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?')
      .run(newUsername, req.session.userId);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                     .get(req.session.userId);
      return res.render('auth/account', { user, error: 'That username is already taken.' });
    }
    throw err;
  }

  res.redirect('/auth/account');
});

// transaction for deleting account + recipes
const deleteAccountTx = db.transaction((userId) => {
  // if recipes.user_id has ON DELETE CASCADE you can drop the first line
  db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

app.post('/auth/account/delete', requireLogin, (req, res) => {
  const userId = req.session.userId;
  deleteAccountTx(userId);
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// --------- Debug route ---------
app.get('/debug/recipes', (_req, res) => {
  const rows = db.prepare('SELECT id, title, cuisine FROM recipes').all();
  res.json(rows);
});

// --------- Error handler ---------
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).send(`<pre>${err.stack}</pre>`);
});

// --------- Start server ---------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
