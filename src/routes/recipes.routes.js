const express = require('express');
const router = express.Router();
const db = require('../db');

// List all recipes
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, cuisine, created_at
    FROM recipes
    ORDER BY created_at DESC
  `).all();
  res.render('recipes/index', { recipes: rows });
});

// New recipe form
router.get('/new', (req, res) => {
  const ingredients = db.prepare('SELECT id, name FROM ingredients ORDER BY name').all();
  res.render('recipes/new', { ingredients });
});

// Create a recipe
router.post('/', (req, res) => {
  const { title, cuisine, description, prep_minutes, cook_minutes } = req.body;
  if (!title) return res.send('Title is required');

  const info = db.prepare(`
  INSERT INTO recipes (user_id, title, cuisine, description, prep_minutes, cook_minutes, created_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`).run(1, title, cuisine, description, prep_minutes || 0, cook_minutes || 0);

  const recipeId = info.lastInsertRowid;

  // Add existing ingredients
  const existing = req.body.existing || [];
  for (const entry of Object.values(existing)) {
    if (!entry.id) continue;
    db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, price)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      recipeId,
      entry.id,
      entry.quantity ? +entry.quantity : null,
      entry.unit || null,
      1.0
    );
  }

  // Add new ingredients
  const newIngredients = req.body.new_ingredients || [];
  for (const entry of Object.values(newIngredients)) {
    const name = entry.name?.trim();
    if (!name) continue;

    db.prepare(`INSERT OR IGNORE INTO ingredients(name) VALUES (?)`).run(name);
    const ing = db.prepare(`SELECT id FROM ingredients WHERE name = ?`).get(name);
    if (!ing) continue;

    db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, price, preparation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      recipeId,
      ing.id,
      entry.quantity ? +entry.quantity : null,
      entry.unit || null,
      entry.price !== '' ? +entry.price : null,
      entry.preparation?.trim() || null
    );
  }

  res.redirect('/recipes');
});

// Delete a recipe
router.post('/:id/delete', (req, res) => {
  db.prepare(`DELETE FROM recipes WHERE id = ?`).run(req.params.id);
  db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ?`).run(req.params.id);
  res.redirect('/recipes');
});

// Edit form
router.get('/:id/edit', (req, res) => {
  const recipeId = req.params.id;
  const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(recipeId);
  if (!recipe) return res.status(404).send('Recipe not found');

  const ingredients = db.prepare(`
    SELECT ri.ingredient_id AS id,
           i.name,
           ri.quantity,
           ri.unit,
           ri.price,
           ri.preparation
    FROM recipe_ingredients ri
    JOIN ingredients i ON i.id = ri.ingredient_id
    WHERE ri.recipe_id = ?
    ORDER BY i.name
  `).all(recipeId);

  const allIngredients = db.prepare(`SELECT id, name FROM ingredients ORDER BY name`).all();

  const totalCost = db.prepare(`
    SELECT COALESCE(SUM(price), 0) AS total
    FROM recipe_ingredients
    WHERE recipe_id = ?
  `).get(recipeId)?.total || 0;

  res.render('recipes/edit', { recipe, ingredients, totalCost, allIngredients });
});

// Update recipe details
router.post('/:id', (req, res) => {
  const recipeId = +req.params.id;
  const { title, cuisine, description, servings, prep_minutes, cook_minutes } = req.body;

  db.prepare(`
    UPDATE recipes
    SET title = ?, cuisine = ?, description = ?, servings = ?, prep_minutes = ?, cook_minutes = ?
    WHERE id = ?
  `).run(title, cuisine, description, servings || null, +prep_minutes || 0, +cook_minutes || 0, recipeId);

  res.redirect(`/recipes/${recipeId}/edit`);
});

// Add new ingredient from edit page
router.post('/:id/ingredients/add', (req, res) => {
  const recipeId = +req.params.id;
  const { name, quantity, unit, price, preparation } = req.body;
  const clean = name?.trim();
  if (!clean) return res.redirect(`/recipes/${recipeId}/edit`);

  db.prepare(`INSERT OR IGNORE INTO ingredients(name) VALUES (?)`).run(clean);
  const ing = db.prepare(`SELECT id FROM ingredients WHERE name = ?`).get(clean);
  if (!ing) return res.redirect(`/recipes/${recipeId}/edit`);

  db.prepare(`
    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, price, preparation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    recipeId,
    ing.id,
    quantity ? +quantity : null,
    unit || null,
    price !== '' ? +price : null,
    preparation?.trim() || null
  );

  res.redirect(`/recipes/${recipeId}/edit`);
});

// Remove ingredient from recipe
router.post('/:id/ingredients/delete/:ingredientId', (req, res) => {
  const recipeId = +req.params.id;
  const ingredientId = +req.params.ingredientId;
  db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?`)
    .run(recipeId, ingredientId);
  res.redirect(`/recipes/${recipeId}/edit`);
});

module.exports = router;