CREATE TABLE IF NOT EXISTS recipes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cuisine TEXT,
  servings INTEGER CHECK (servings > 0),
  prep_minutes INTEGER CHECK (prep_minutes >= 0),
  cook_minutes INTEGER CHECK (cook_minutes >= 0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ingredients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id INTEGER NOT NULL,
  ingredient_id INTEGER NOT NULL,
  quantity REAL,
  unit TEXT,
  price REAL,
  preparation TEXT,
  PRIMARY KEY (recipe_id, ingredient_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

CREATE TABLE IF NOT EXISTS steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id INTEGER NOT NULL,
  step_no INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  UNIQUE (recipe_id, step_no)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================

-- Index 1: Recipes by creation date (descending order for recent-first queries)
-- Used by: Reports date range filter, Recipe listing (ORDER BY created_at DESC)
-- Queries: SELECT * FROM recipes WHERE created_at BETWEEN ? AND ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes(created_at DESC);

-- Index 2: Recipes by user_id for user-specific recipe lookups
-- Used by: User dashboard, "My Recipes" page, account deletion
-- Queries: SELECT * FROM recipes WHERE user_id = ?
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON recipes(user_id);

-- Index 3: Recipes by cuisine for filtering
-- Used by: Search by cuisine, Reports cuisine filter
-- Queries: SELECT * FROM recipes WHERE cuisine = ?
CREATE INDEX IF NOT EXISTS idx_recipes_cuisine ON recipes(cuisine);

-- Index 4: Recipe ingredients by ingredient_id for ingredient-based searches
-- Used by: Search "contains ingredient", Reports ingredient filter
-- Queries: SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id = ?
CREATE INDEX IF NOT EXISTS idx_ri_ingredient ON recipe_ingredients(ingredient_id);

-- Index 5: Recipe ingredients by recipe_id for fetching all ingredients of a recipe
-- Used by: Recipe edit page, total cost calculation
-- Queries: SELECT * FROM recipe_ingredients WHERE recipe_id = ?
CREATE INDEX IF NOT EXISTS idx_ri_recipe ON recipe_ingredients(recipe_id);

-- Index 6: Users by username for login lookup
-- Used by: Login authentication, registration duplicate check
-- Queries: SELECT * FROM users WHERE username = ?
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Index 7: Composite index for recipe search (title + cuisine)
-- Used by: Search results with text and cuisine filter combined
-- Queries: SELECT * FROM recipes WHERE title LIKE ? AND cuisine = ?
CREATE INDEX IF NOT EXISTS idx_recipes_title_cuisine ON recipes(title, cuisine);