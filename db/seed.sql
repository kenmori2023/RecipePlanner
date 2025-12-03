INSERT OR IGNORE INTO users (username, password_hash)
VALUES ('demo', '$2a$10$somethingFakeHashHere');

INSERT OR IGNORE INTO recipes (id, user_id, title, cuisine, servings, prep_minutes, cook_minutes, description)
VALUES (1, 1, 'Spaghetti Aglio e Olio', 'Italian', 2, 10, 10, 'Garlic, olive oil, chili flakes');