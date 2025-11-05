INSERT OR IGNORE INTO users (id, name, email)
VALUES (1, 'Demo User', 'demo@local');

INSERT OR IGNORE INTO recipes (id, user_id, title, cuisine, servings, prep_minutes, cook_minutes, description)
VALUES (1, 1, 'Spaghetti Aglio e Olio', 'Italian', 2, 10, 10, 'Garlic, olive oil, chili flakes');