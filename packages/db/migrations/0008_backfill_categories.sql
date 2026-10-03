INSERT INTO categories (product_id, name, created_at)
SELECT p.id, 'Feature Request', now()
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.product_id = p.id
);
--> statement-breakpoint
INSERT INTO categories (product_id, name, created_at)
SELECT p.id, 'Bug', fr.created_at + interval '1 millisecond'
FROM products p
JOIN categories fr ON fr.product_id = p.id AND fr.name = 'Feature Request'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.product_id = p.id AND c.name = 'Bug'
)
AND NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.product_id = p.id AND c.name NOT IN ('Feature Request', 'Bug')
);