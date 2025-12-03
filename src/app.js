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
  if (req.session.userId) {
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.session.userId);
    res.locals.currentUsername = user?.username || null;
  } else {
    res.locals.currentUsername = null;
  }
  next();
});

// simple request logging
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

// require login for all routes except auth routes
app.use((req, res, next) => {
  // Allow access to auth routes without login
  if (req.path.startsWith('/auth')) {
    return next();
  }
  // If not logged in, redirect to login page
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
});

// --------- Home page ---------
app.get('/', (_req, res) => {
  const { currentUsername } = res.locals;

  res.send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RecipePlanner</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Poppins', sans-serif;
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          color: #fff;
        }
        .navbar {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          padding: 15px 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .navbar .logo {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          text-decoration: none;
        }
        .navbar .user-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .navbar .user-info span { color: #ccc; }
        .navbar .user-info strong { color: #fff; }
        .navbar a {
          color: #4facfe;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.3s;
        }
        .navbar a:hover { color: #00f2fe; }
        .navbar button {
          background: none;
          border: none;
          color: #ff6b6b;
          cursor: pointer;
          font-family: 'Poppins', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .navbar button:hover { color: #ee5a5a; }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .hero {
          text-align: center;
          padding: 60px 20px;
          animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero h1 {
          font-size: 3rem;
          margin-bottom: 10px;
          background: linear-gradient(135deg, #4facfe, #00f2fe);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero p {
          color: #aaa;
          font-size: 1.1rem;
          margin-bottom: 40px;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 25px;
          margin-top: 20px;
        }
        .feature-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 30px;
          text-align: center;
          transition: all 0.3s ease;
          text-decoration: none;
          color: inherit;
        }
        .feature-card:hover {
          background: rgba(255,255,255,0.1);
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .feature-card .icon {
          font-size: 3rem;
          margin-bottom: 15px;
        }
        .feature-card h3 {
          font-size: 1.3rem;
          margin-bottom: 10px;
          color: #fff;
        }
        .feature-card p {
          color: #888;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <nav class="navbar">
        <a href="/" class="logo">🍳 RecipePlanner</a>
        <div class="user-info">
          <span>Hello, <strong>${currentUsername}</strong></span>
          <a href="/auth/account">Account</a>
          <form method="post" action="/auth/logout" style="display:inline">
            <button type="submit">Logout</button>
          </form>
        </div>
      </nav>
      <div class="container">
        <div class="hero">
          <h1>Welcome to RecipePlanner</h1>
          <p>Organize your recipes, track ingredients, and cook with confidence</p>
        </div>
        <div class="features">
          <a href="/recipes" class="feature-card">
            <div class="icon">📖</div>
            <h3>Recipes</h3>
            <p>Create, edit, and manage all your favorite recipes</p>
          </a>
          <a href="/ingredients" class="feature-card">
            <div class="icon">🥕</div>
            <h3>Ingredients</h3>
            <p>Keep track of your ingredient inventory</p>
          </a>
          <a href="/search" class="feature-card">
            <div class="icon">🔍</div>
            <h3>Search</h3>
            <p>Find recipes by name, cuisine, or ingredient</p>
          </a>
          <a href="/reports" class="feature-card">
            <div class="icon">📊</div>
            <h3>Reports</h3>
            <p>Analyze your recipes with detailed statistics</p>
          </a>
        </div>
      </div>
    </body>
    </html>
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
  res.render('auth/account', { user, error: null, success: null });
});

app.post('/auth/account/username', requireLogin, (req, res) => {
  const newUsername = (req.body.username || '').trim();

  if (!newUsername) {
    const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                   .get(req.session.userId);
    return res.render('auth/account', { user, error: 'Username cannot be empty.', success: null });
  }

  try {
    db.prepare('UPDATE users SET username = ? WHERE id = ?')
      .run(newUsername, req.session.userId);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                     .get(req.session.userId);
      return res.render('auth/account', { user, error: 'That username is already taken.', success: null });
    }
    throw err;
  }

  res.redirect('/auth/account');
});

app.post('/auth/account/password', requireLogin, (req, res) => {
  const currentPassword = req.body.current_password || '';
  const newPassword = req.body.new_password || '';
  const confirmPassword = req.body.confirm_password || '';

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  // Verify current password
  const isCurrentCorrect = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!isCurrentCorrect) {
    return res.render('auth/account', { 
      user, 
      error: 'Current password is incorrect.', 
      success: null 
    });
  }

  // Check new passwords match
  if (newPassword !== confirmPassword) {
    return res.render('auth/account', { 
      user, 
      error: 'New passwords do not match.', 
      success: null 
    });
  }

  // Check new password is not empty
  if (!newPassword) {
    return res.render('auth/account', { 
      user, 
      error: 'New password cannot be empty.', 
      success: null 
    });
  }

  // Hash and save new password
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(newHash, req.session.userId);

  res.render('auth/account', { 
    user, 
    error: null, 
    success: 'Password changed successfully!' 
  });
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
