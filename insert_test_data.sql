USE health;

-- Demo user: username 'gold', password 'smiths123ABC$'
INSERT INTO users (username, password_hash, display_name, created_at)
VALUES (
  'gold',
  '$2b$12$/QrQMHtrQwPjZKCmqPt8IO3adelbiMWTT4SA1F3RxPL/4.bj34J4.',
  'Gold Demo User',
  NOW()
);

-- Sample PCOS-friendly recipes
INSERT INTO recipes (title, summary, instructions, difficulty, prep_time_minutes, is_pcos_friendly, main_tag)
VALUES
(
  'High-Protein protien bowl',
  'Greek yoghurt with berries, nuts and seeds for a PCOS-friendly breakfast.',
  '1. Add full fat Greek yoghurt to a bowl.\n2. Top with berries, chopped nuts and seeds.\n3. Sprinkle with cinnamon.',
  'easy', 5, TRUE, 'breakfast'
),
(
  'steak bites with wholemeal bread and Roasted Veg Traybake',
  'One-pan dinner with protein, fibre and healthy fats to support insulin sensitivity.',
  '1. Preheat pan to 200C.\n2. Place chopped beef and chopped veg on the pan.\n3. Cook with 1/2 tsp butter, lemon, salt and pepper.\n4. Fry each side for 5 minutes.',
  'easy', 30, TRUE, 'dinner'
),
(
  'chicken and Spinach Curry',
  'Comforting, fibre-rich curry for batch cooking.',
  '1. Fry onions, garlic and spices.\n2. Add 200g chicken and tomato puree.\n3. Simmer.\n4. Stir in spinach and serve.',
  'medium', 40, TRUE, 'comfort_food'
);


