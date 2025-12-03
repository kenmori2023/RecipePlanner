const db = require('../db');

module.exports.form = (_req, res) => {
  const cuisines = db.prepare(
    `SELECT DISTINCT cuisine AS name FROM recipes WHERE cuisine IS NOT NULL ORDER BY 1`
  ).all();
  const ingredients = db.prepare(
    `SELECT id, name FROM ingredients ORDER BY name`
  ).all();

  res.render('search/form', {
    cuisines,
    ingredients,
    q: '',
    cuisine: '',
    ingredientId: ''
  });
};

module.exports.results = (req, res) => {
  const q = (req.query.q || '').trim();
  const cuisine = (req.query.cuisine || '').trim();
  const ingredientId = req.query.ingredient_id ? +req.query.ingredient_id : null;

  const where = [];
  const params = {};
  if (q)        { where.push(`(r.title LIKE '%'||@q||'%' OR r.description LIKE '%'||@q||'%')`); params.q = q; }
  if (cuisine)  { where.push(`r.cuisine = @cuisine`); params.cuisine = cuisine; }
  if (ingredientId) {
    where.push(`EXISTS (SELECT 1 FROM recipe_ingredients x WHERE x.recipe_id=r.id AND x.ingredient_id=@ingredientId)`);
    params.ingredientId = ingredientId;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT r.id, r.title, r.cuisine, r.created_at,
           COALESCE((SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS ingredient_count,
           COALESCE((SELECT SUM(price) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS total_cost
    FROM recipes r
    ${whereSql}
    ORDER BY r.created_at DESC
  `).all(params);

  const cuisines = db.prepare(`SELECT DISTINCT cuisine AS name FROM recipes WHERE cuisine IS NOT NULL ORDER BY 1`).all();
  const ingredients = db.prepare(`SELECT id, name FROM ingredients ORDER BY name`).all();

  res.render('search/results', { rows, cuisines, ingredients, q, cuisine, ingredientId });
};