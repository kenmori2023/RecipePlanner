const db = require('../db');

exports.list = (_req, res) => {
  const rows = db.prepare(`
    SELECT id, title, cuisine, prep_minutes, cook_minutes
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
  const r = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(req.params.id);
  if (!r) return res.redirect('/recipes');
  res.render('recipes/edit', { recipe: r });
};

exports.update = (req, res) => {
  const { title, description, cuisine, servings, prep_minutes, cook_minutes } = req.body;
  db.prepare(`
    UPDATE recipes
    SET title=?, description=?, cuisine=?, servings=?, prep_minutes=?, cook_minutes=?
    WHERE id=?
  `).run(title, description, cuisine, servings || null, +prep_minutes || 0, +cook_minutes || 0, req.params.id);
  res.redirect('/recipes');
};

exports.remove = (req, res) => {
  db.prepare(`DELETE FROM recipes WHERE id = ?`).run(req.params.id);
  res.redirect('/recipes');
};