const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (_req, res) => {
  const ingredients = db.prepare('SELECT id, name FROM ingredients ORDER BY name').all();
  res.render('ingredients/index', { ingredients });
});

router.post('/', (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    db.prepare('INSERT OR IGNORE INTO ingredients(name) VALUES (?)').run(name);
  }
  res.redirect('/ingredients');
});

router.get('/:id/edit', (req, res) => {
  const ingredient = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(req.params.id);
  if (!ingredient) return res.status(404).send('Ingredient not found');
  res.render('ingredients/edit', { ingredient });
});

router.post('/:id', (req, res) => {
  const name = req.body.name?.trim();
  if (name) {
    db.prepare('UPDATE ingredients SET name = ? WHERE id = ?').run(name, req.params.id);
  }
  res.redirect('/ingredients');
});

router.post('/:id/delete', (req, res) => {
  db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
  res.redirect('/ingredients');
});

module.exports = router;