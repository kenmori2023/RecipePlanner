const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT r.id, r.title, r.cuisine, r.created_at
    FROM recipes r
    ORDER BY r.created_at DESC
  `).all();
  res.render('recipes/index', { recipes: rows });
});

router.get('/new', (req, res) => {
  const ingredients = db.prepare('SELECT id, name FROM ingredients ORDER BY name').all();
  res.render('recipes/new', { ingredients });
});

router.post('/', (req, res) => {
  const { title, cuisine, description, prep_minutes, cook_minutes, ingredient_ids } = req.body;

  if (!title) return res.send('Title is required');

  const info = db.prepare(`
    INSERT INTO recipes (title, cuisine, description, prep_minutes, cook_minutes, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(title, cuisine, description, prep_minutes || 0, cook_minutes || 0);

  const recipeId = info.lastInsertRowid;

  const insertIngredient = db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, price)
    VALUES (?, ?, ?)
  `);

  const ids = Array.isArray(ingredient_ids) ? ingredient_ids : ingredient_ids ? [ingredient_ids] : [];
  ids.forEach(id => insertIngredient.run(recipeId, id, 1.0)); // default price

  res.redirect('/recipes');
});

module.exports = router;