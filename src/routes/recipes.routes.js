const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================
// TRANSACTIONS FOR MULTI-USER CONCURRENCY
// ============================================
// SQLite uses SERIALIZABLE isolation level by default, which provides
// the strongest isolation guarantees. This prevents:
// - Dirty reads (reading uncommitted data)
// - Non-repeatable reads (same query returning different results)
// - Phantom reads (new rows appearing in range queries)
//
// For a multi-user application, we use transactions to ensure:
// 1. Atomic operations (all-or-nothing)
// 2. Data consistency across related tables
// 3. Safe concurrent access to shared data

/**
 * Transaction: Create recipe with all its ingredients atomically
 * This ensures that if adding any ingredient fails, the entire recipe
 * creation is rolled back - no partial data is left in the database.
 * 
 * Multi-user scenario: Two users creating recipes simultaneously won't
 * interfere with each other due to SQLite's serializable isolation.
 */
const createRecipeWithIngredientsTx = db.transaction((userId, recipeData, existingIngredients, newIngredients) => {
  // Step 1: Insert the recipe
  const info = db.prepare(`
    INSERT INTO recipes (user_id, title, cuisine, description, prep_minutes, cook_minutes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(userId, recipeData.title, recipeData.cuisine, recipeData.description, 
         recipeData.prep_minutes || 0, recipeData.cook_minutes || 0);
  
  const recipeId = info.lastInsertRowid;
  
  // Step 2: Add existing ingredients
  for (const entry of Object.values(existingIngredients || {})) {
    if (!entry.id) continue;
    db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, price)
      VALUES (?, ?, ?, ?, ?)
    `).run(recipeId, entry.id, entry.quantity ? +entry.quantity : null, 
           entry.unit || null, entry.price !== '' && entry.price != null ? +entry.price : null);
  }
  
  // Step 3: Add new ingredients (create ingredient if not exists, then link)
  for (const entry of Object.values(newIngredients || {})) {
    const name = entry.name?.trim();
    if (!name) continue;
    
    // Insert or ignore the ingredient name
    db.prepare(`INSERT OR IGNORE INTO ingredients(name) VALUES (?)`).run(name);
    
    // Get the ingredient id
    const ing = db.prepare(`SELECT id FROM ingredients WHERE name = ?`).get(name);
    if (!ing) continue;
    
    // Link to recipe
    db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, price, preparation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(recipeId, ing.id, entry.quantity ? +entry.quantity : null, entry.unit || null,
           entry.price !== '' && entry.price != null ? +entry.price : null, entry.preparation?.trim() || null);
  }
  
  return recipeId;
});

/**
 * Transaction: Delete recipe with all related data atomically
 * Ensures recipe_ingredients are deleted along with the recipe.
 * Uses CASCADE in schema, but explicit transaction for safety.
 */
const deleteRecipeTx = db.transaction((recipeId) => {
  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
});

// List only the current user's recipes
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, cuisine, created_at
    FROM recipes
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.session.userId);
  res.render('recipes/index', { recipes: rows });
});

// New recipe form
router.get('/new', (req, res) => {
  const ingredients = db.prepare('SELECT id, name FROM ingredients ORDER BY name').all();
  res.render('recipes/new', { ingredients });
});

// Create a recipe (using transaction for atomicity)
router.post('/', (req, res) => {
  const { title, cuisine, description, prep_minutes, cook_minutes } = req.body;
  if (!title) return res.send('Title is required');

  // Use transaction to ensure all-or-nothing creation
  // This protects against partial data if the server crashes mid-operation
  // and ensures consistency when multiple users create recipes simultaneously
  createRecipeWithIngredientsTx(
    req.session.userId,
    { title, cuisine, description, prep_minutes, cook_minutes },
    req.body.existing || {},
    req.body.new_ingredients || {}
  );

  res.redirect('/recipes');
});

// Delete a recipe (using transaction for atomicity)
// Only allows deleting recipes owned by the current user
router.post('/:id/delete', (req, res) => {
  // Verify ownership before deleting
  const recipe = db.prepare('SELECT user_id FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe || recipe.user_id !== req.session.userId) {
    return res.status(403).send('You can only delete your own recipes');
  }
  
  // Transaction ensures recipe and all related data are deleted together
  // Prevents orphaned recipe_ingredients if deletion is interrupted
  deleteRecipeTx(req.params.id);
  res.redirect('/recipes');
});

// Edit form - only allows editing recipes owned by the current user
router.get('/:id/edit', (req, res) => {
  const recipeId = req.params.id;
  const recipe = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(recipeId);
  if (!recipe) return res.status(404).send('Recipe not found');
  
  // Verify ownership
  if (recipe.user_id !== req.session.userId) {
    return res.status(403).send('You can only edit your own recipes');
  }

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

// Update recipe details - only allows updating recipes owned by the current user
router.post('/:id', (req, res) => {
  const recipeId = +req.params.id;
  
  // Verify ownership before updating
  const recipe = db.prepare('SELECT user_id FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe || recipe.user_id !== req.session.userId) {
    return res.status(403).send('You can only update your own recipes');
  }
  
  const { title, cuisine, description, servings, prep_minutes, cook_minutes } = req.body;

  db.prepare(`
    UPDATE recipes
    SET title = ?, cuisine = ?, description = ?, servings = ?, prep_minutes = ?, cook_minutes = ?
    WHERE id = ?
  `).run(title, cuisine, description, servings || null, +prep_minutes || 0, +cook_minutes || 0, recipeId);

  res.redirect(`/recipes/${recipeId}/edit`);
});

// Add new ingredient from edit page - only for recipes owned by the current user
router.post('/:id/ingredients/add', (req, res) => {
  const recipeId = +req.params.id;
  
  // Verify ownership
  const recipe = db.prepare('SELECT user_id FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe || recipe.user_id !== req.session.userId) {
    return res.status(403).send('You can only modify your own recipes');
  }
  
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

// Remove ingredient from recipe - only for recipes owned by the current user
router.post('/:id/ingredients/delete/:ingredientId', (req, res) => {
  const recipeId = +req.params.id;
  
  // Verify ownership
  const recipe = db.prepare('SELECT user_id FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe || recipe.user_id !== req.session.userId) {
    return res.status(403).send('You can only modify your own recipes');
  }
  
  const ingredientId = +req.params.ingredientId;
  db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?`)
    .run(recipeId, ingredientId);
  res.redirect(`/recipes/${recipeId}/edit`);
});

module.exports = router;