# Database Security & Optimization Documentation

This document describes the security measures, indexing strategy, and transaction management implemented in the RecipePlanner application.

---

## A. SQL Injection Protection

### Overview
SQL Injection is prevented throughout the application using **prepared statements** (parameterized queries). We use the `better-sqlite3` library which provides built-in prepared statement support.

### Implementation

#### 1. Parameterized Queries with Positional Parameters (`?`)
All user input is passed as parameters, never concatenated into SQL strings:

```javascript
// ✅ SAFE: User input passed as parameter
const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

// ❌ UNSAFE: Never do this - vulnerable to SQL injection
// const user = db.prepare(`SELECT * FROM users WHERE username = '${username}'`).get();
```

**Examples from our codebase:**

```javascript
// Login authentication (src/app.js)
const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

// Recipe creation (src/routes/recipes.routes.js)
db.prepare(`
  INSERT INTO recipes (user_id, title, cuisine, description, prep_minutes, cook_minutes)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(userId, title, cuisine, description, prep_minutes, cook_minutes);

// Recipe deletion
db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
```

#### 2. Named Parameters (`@param`)
For complex queries with many parameters, we use named parameters:

```javascript
// Search with multiple optional filters (src/controllers/search.controller.js)
const params = {};
if (q) { 
  where.push(`r.title LIKE '%'||@q||'%'`); 
  params.q = q; 
}
if (cuisine) { 
  where.push(`r.cuisine = @cuisine`); 
  params.cuisine = cuisine; 
}

const rows = db.prepare(`
  SELECT * FROM recipes r ${whereSql}
`).all(params);
```

#### 3. Input Sanitization
In addition to prepared statements, we sanitize input:

```javascript
// Trim whitespace from usernames (src/app.js)
const username = (req.body.username || '').trim();

// Validate required fields
if (!username || !password) {
  return res.render('auth/register', { error: 'Username and password required.' });
}

// Type coercion for numeric values
const prep_minutes = +req.body.prep_minutes || 0;  // Convert to number, default 0
```

#### 4. Password Hashing
Passwords are never stored in plain text - we use bcrypt:

```javascript
// Registration: Hash password before storing
const hash = bcrypt.hashSync(password, 10);
db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);

// Login: Compare using bcrypt
const ok = bcrypt.compareSync(password, user.password_hash);
```

---

## B. Database Indexes

### Index Overview
Indexes are database structures that improve query performance by allowing the database to find rows faster without scanning the entire table.

### Our Indexes

#### Index 1: `idx_recipes_created_at`
```sql
CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
```

**Purpose:** Optimizes queries that sort or filter by creation date.

**Queries that benefit:**
```sql
-- Recipe listing (most recent first)
SELECT * FROM recipes ORDER BY created_at DESC;

-- Reports date range filter
SELECT * FROM recipes WHERE created_at BETWEEN '2024-01-01' AND '2024-12-31';
```

**Used in:**
- Recipe index page (`/recipes`)
- Search results
- Reports with date filters

---

#### Index 2: `idx_recipes_user_id`
```sql
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
```

**Purpose:** Optimizes user-specific recipe lookups.

**Queries that benefit:**
```sql
-- Get all recipes for a specific user
SELECT * FROM recipes WHERE user_id = ?;

-- Delete all recipes when user deletes account
DELETE FROM recipes WHERE user_id = ?;
```

**Used in:**
- User dashboard (future feature)
- Account deletion transaction

---

#### Index 3: `idx_recipes_cuisine`
```sql
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
```

**Purpose:** Optimizes cuisine-based filtering.

**Queries that benefit:**
```sql
-- Search by cuisine
SELECT * FROM recipes WHERE cuisine = 'Italian';

-- Get distinct cuisines for dropdown
SELECT DISTINCT cuisine FROM recipes WHERE cuisine IS NOT NULL;
```

**Used in:**
- Search filter (`/search`)
- Reports filter (`/reports`)

---

#### Index 4: `idx_ri_ingredient`
```sql
CREATE INDEX idx_ri_ingredient ON recipe_ingredients(ingredient_id);
```

**Purpose:** Optimizes "find recipes containing ingredient X" queries.

**Queries that benefit:**
```sql
-- Find all recipes with a specific ingredient
SELECT recipe_id FROM recipe_ingredients WHERE ingredient_id = ?;

-- Subquery in search/reports
EXISTS (SELECT 1 FROM recipe_ingredients WHERE ingredient_id = @ingredientId)
```

**Used in:**
- Search by ingredient filter
- Reports ingredient filter

---

#### Index 5: `idx_ri_recipe`
```sql
CREATE INDEX idx_ri_recipe ON recipe_ingredients(recipe_id);
```

**Purpose:** Optimizes fetching all ingredients for a recipe.

**Queries that benefit:**
```sql
-- Get all ingredients for a recipe
SELECT * FROM recipe_ingredients WHERE recipe_id = ?;

-- Calculate total cost
SELECT SUM(price) FROM recipe_ingredients WHERE recipe_id = ?;
```

**Used in:**
- Recipe edit page (displaying ingredients)
- Total cost calculation

---

#### Index 6: `idx_users_username`
```sql
CREATE INDEX idx_users_username ON users(username);
```

**Purpose:** Optimizes username lookups during authentication.

**Queries that benefit:**
```sql
-- Login authentication
SELECT * FROM users WHERE username = ?;

-- Registration duplicate check
SELECT id FROM users WHERE username = ?;
```

**Used in:**
- Login (`/auth/login`)
- Registration (`/auth/register`)

---

#### Index 7: `idx_recipes_title_cuisine` (Composite Index)
```sql
CREATE INDEX idx_recipes_title_cuisine ON recipes(title, cuisine);
```

**Purpose:** Optimizes queries that filter by both title and cuisine.

**Queries that benefit:**
```sql
-- Combined search
SELECT * FROM recipes WHERE title LIKE '%pasta%' AND cuisine = 'Italian';
```

**Used in:**
- Search with multiple filters

---

## C. Transactions and Isolation Levels

### Overview
Transactions ensure that a series of database operations either all succeed or all fail together (atomicity). This is critical for data consistency.

### SQLite Isolation Level
SQLite uses **SERIALIZABLE** isolation level by default - the strongest level. This prevents:

| Issue | Description | Prevention |
|-------|-------------|------------|
| **Dirty Reads** | Reading uncommitted data from another transaction | ✅ Prevented |
| **Non-repeatable Reads** | Same query returning different results within a transaction | ✅ Prevented |
| **Phantom Reads** | New rows appearing in range queries | ✅ Prevented |

### Transaction Implementations

#### Transaction 1: Create Recipe with Ingredients
**Location:** `src/routes/recipes.routes.js`

```javascript
const createRecipeWithIngredientsTx = db.transaction((userId, recipeData, existingIngredients, newIngredients) => {
  // Step 1: Insert the recipe
  const info = db.prepare(`INSERT INTO recipes ...`).run(...);
  const recipeId = info.lastInsertRowid;
  
  // Step 2: Add existing ingredients
  for (const entry of existingIngredients) {
    db.prepare(`INSERT INTO recipe_ingredients ...`).run(...);
  }
  
  // Step 3: Add new ingredients
  for (const entry of newIngredients) {
    db.prepare(`INSERT OR IGNORE INTO ingredients ...`).run(...);
    db.prepare(`INSERT INTO recipe_ingredients ...`).run(...);
  }
  
  return recipeId;
});
```

**Why use a transaction?**
- If adding an ingredient fails, the entire recipe creation is rolled back
- No partial data (recipe without ingredients) is left in the database
- Multiple users creating recipes simultaneously won't interfere

---

#### Transaction 2: Delete Recipe with Related Data
**Location:** `src/routes/recipes.routes.js`

```javascript
const deleteRecipeTx = db.transaction((recipeId) => {
  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM steps WHERE recipe_id = ?').run(recipeId);
  db.prepare('DELETE FROM recipes WHERE id = ?').run(recipeId);
});
```

**Why use a transaction?**
- Ensures all related data is deleted together
- If deletion fails partway, everything is rolled back
- No orphaned recipe_ingredients or steps

---

#### Transaction 3: Delete User Account
**Location:** `src/app.js`

```javascript
const deleteAccountTx = db.transaction((userId) => {
  db.prepare('DELETE FROM recipes WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
});
```

**Why use a transaction?**
- User's recipes must be deleted before the user (foreign key constraint)
- If user deletion fails, we don't want orphaned recipes
- Ensures complete cleanup of user data

---

### Multi-User Concurrency Scenario

**Scenario:** Two users simultaneously try to:
1. User A creates a recipe with ingredient "Garlic"
2. User B creates a recipe with ingredient "Garlic"

**Without transactions:** Both might try to insert "Garlic" into ingredients table, causing conflicts.

**With our implementation:**
1. `INSERT OR IGNORE INTO ingredients(name)` - safely handles duplicates
2. Serializable isolation ensures one transaction completes before the other sees changes
3. Each user gets the correct ingredient ID for their recipe

```javascript
// This is safe for concurrent access:
db.prepare('INSERT OR IGNORE INTO ingredients(name) VALUES (?)').run('Garlic');
const ing = db.prepare('SELECT id FROM ingredients WHERE name = ?').get('Garlic');
```

---

## Summary

| Feature | Implementation | Location |
|---------|---------------|----------|
| SQL Injection Prevention | Prepared statements with `?` and `@param` | All database queries |
| Password Security | bcrypt hashing | `src/app.js` |
| Query Optimization | 7 indexes on frequently queried columns | `db/schema.sql` |
| Atomic Operations | `db.transaction()` wrapper | Recipe and user routes |
| Isolation Level | Serializable (SQLite default) | Automatic |

---

*Last updated: December 2024*

