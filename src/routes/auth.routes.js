const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

//Login Required
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
}

// ---------- Register ----------

router.get('/register', (_req, res) => {
  res.render('auth/register', { error: null });
});

router.post('/register', (req, res) => {
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

// ---------- Login / Logout ----------

router.get('/login', (_req, res) => {
  res.render('auth/login', { error: null });
});

router.post('/login', (req, res) => {
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

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ---------- Account settings ----------

router.get('/account', requireLogin, (req, res) => {
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?')
                 .get(req.session.userId);
  res.render('auth/account', { user, error: null, success: null });
});

router.post('/account/username', requireLogin, (req, res) => {
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

const deleteAccountTx = db.transaction((userId) => {
  db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});

router.post('/account/delete', requireLogin, (req, res) => {
  const userId = req.session.userId;
  deleteAccountTx(userId);  
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;