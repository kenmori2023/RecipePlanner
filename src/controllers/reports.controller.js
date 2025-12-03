const db = require('../db');

module.exports.filterForm = (_req, res) => {
  const cuisines = db.prepare(`SELECT DISTINCT cuisine AS name FROM recipes WHERE cuisine IS NOT NULL ORDER BY 1`).all();
  const ingredients = db.prepare(`SELECT id, name FROM ingredients ORDER BY name`).all();
  res.render('reports/filter', { cuisines: cuisines || [], ingredients: ingredients || [] });
};

module.exports.results = (req, res) => {
  const { from, to, cuisine, ingredient_id } = req.body;

  const where = [];
  const params = {};
  if (from) { where.push(`DATE(r.created_at) >= DATE(@from)`); params.from = from; }
  if (to)   { where.push(`DATE(r.created_at) <= DATE(@to)`);   params.to   = to;   }
  if (cuisine) { where.push(`r.cuisine = @cuisine`); params.cuisine = cuisine; }
  if (ingredient_id) {
    where.push(`EXISTS (SELECT 1 FROM recipe_ingredients x WHERE x.recipe_id=r.id AND x.ingredient_id=@ingredient_id)`);
    params.ingredient_id = +ingredient_id;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const list = db.prepare(`
    SELECT r.id, r.title, r.cuisine, r.created_at,
           r.prep_minutes, r.cook_minutes,
           COALESCE((SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS ingredient_count,
           COALESCE((SELECT SUM(price) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS total_cost
    FROM recipes r
    ${whereSql}
    ORDER BY r.created_at DESC
  `).all(params);

  const stats = db.prepare(`
    WITH per_recipe AS (
      SELECT r.id,
             r.prep_minutes,
             r.cook_minutes,
             COALESCE((SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS ingredient_count,
             COALESCE((SELECT SUM(price) FROM recipe_ingredients ri WHERE ri.recipe_id=r.id),0) AS total_cost
      FROM recipes r
      ${whereSql}
    )
    SELECT AVG(prep_minutes)     AS avg_prep,
           AVG(cook_minutes)     AS avg_cook,
           AVG(ingredient_count) AS avg_ingredients,
           AVG(total_cost)       AS avg_total_cost
    FROM per_recipe
  `).get(params) || { avg_prep: 0, avg_cook: 0, avg_ingredients: 0, avg_total_cost: 0 };

  const cuisines = db.prepare(`SELECT DISTINCT cuisine AS name FROM recipes WHERE cuisine IS NOT NULL ORDER BY 1`).all();
  const ingredients = db.prepare(`SELECT id, name FROM ingredients ORDER BY name`).all();

  res.render('reports/results', {
    list, stats, cuisines, ingredients,
    filters: { from: from || '', to: to || '', cuisine: cuisine || '', ingredient_id: ingredient_id || '' }
  });
};