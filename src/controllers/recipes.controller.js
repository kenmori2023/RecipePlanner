const db = require('../db');

// ---------- Helpers ----------
function getRecipeOrRedirect(id, res) {
  const r = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(id);
  if (!r) {
    res.redirect('/recipes');
    return null;
  }
  return r;
}

function getIngredientsForRecipe(recipeId) {
  return db.prepare(`
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
}

function getTotalCost(recipeId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(price), 0) AS total
    FROM recipe_ingredients
    WHERE recipe_id = ?
  `).get(recipeId);
  return row?.total ?? 0;
}

// Insert-or-ignore ingredient name, then upsert to recipe_ingredients
const addIngredientTx = db.transaction((recipeId, name, quantity, unit, price, preparation) => {
  // normalize name
  const clean = name?.trim();
  if (!clean) return;

  // create ingredient name if not exists
  db.prepare(`INSERT OR IGNORE INTO ingredients(name) VALUES (trim(?))`).run(clean);

  // get id
  const ing = db.prepare(`SELECT id FROM ingredients WHERE name = trim(?)`).get(clean);
  if (!ing) return;

  // insert or replace the mapping (PK is recipe_id+ingredient_id)
  db.prepare(`
    INSERT OR REPLACE INTO recipe_ingredients
      (recipe_id, ingredient_id, quantity, unit, price, preparation)
    VALUES (?,?,?,?,?,?)
  `).run(recipeId, ing.id, quantity || null, unit || null, price || null, preparation || null);
});

// ---------- List / Create / Edit / Update / Delete ----------
exports.list = (_req, res) => {
  const rows = db.prepare(`
    SELECT id, title, cuisine, prep_minutes, cook_minutes, created_at
    FROM recipes
    ORDER BY created_at DESC
  `).all();
  res.render('recipes/list', { rows });
};

exports.newForm = (_req, res) => {
  res.render('recipes/create');
};

exports.create = (req, res) => {
  const { title, description, cuisine, servings, prep_minutes, cook_minutes } = req.body;
  db.prepare(`
    INSERT INTO recipes (user_id, title, description, cuisine, servings, prep_minutes, cook_minutes)
    VALUES (1, ?, ?, ?, ?, ?, ?)
  `).run(title, description, cuisine, servings || null, +prep_minutes || 0, +cook_minutes || 0);
  res.redirect('/recipes');
};

exports.editForm = (req, res) => {
  const recipe = getRecipeOrRedirect(req.params.id, res);
  if (!recipe) return;

  const ingredients = getIngredientsForRecipe(recipe.id);
  const totalCost = getTotalCost(recipe.id);

  res.render('recipes/edit', { recipe, ingredients, totalCost });
};

exports.update = (req, res) => {
  const { title, description, cuisine, servings, prep_minutes, cook_minutes } = req.body;
  db.prepare(`
    UPDATE recipes
    SET title = ?, description = ?, cuisine = ?, servings = ?, prep_minutes = ?, cook_minutes = ?
    WHERE id = ?
  `).run(title, description, cuisine, servings || null, +prep_minutes || 0, +cook_minutes || 0, req.params.id);
  res.redirect(`/recipes/${req.params.id}/edit`);
};

exports.remove = (req, res) => {
  db.prepare(`DELETE FROM recipes WHERE id = ?`).run(req.params.id);
  res.redirect('/recipes');
};

// ---------- Ingredients actions ----------
exports.addIngredient = (req, res) => {
  const recipeId = +req.params.id;
  const { name, quantity, unit, price, preparation } = req.body;

  // transaction ensures both the dictionary insert and mapping happen together
  addIngredientTx(
    recipeId,
    name,
    quantity ? +quantity : null,
    unit || null,
    price !== '' ? +price : null,
    preparation || null
  );

  res.redirect(`/recipes/${recipeId}/edit`);
};

exports.deleteIngredient = (req, res) => {
  const recipeId = +req.params.id;
  const ingredientId = +req.params.ingredientId;
  db.prepare(`DELETE FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?`)
    .run(recipeId, ingredientId);
  res.redirect(`/recipes/${recipeId}/edit`);
};