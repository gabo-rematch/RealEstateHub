-- Extract all communities from both scalar and array formats
WITH base AS (
  SELECT 
    t.pk,
    t.id,
    rec.kind,
    rec.transaction_type,
    -- Extract communities from various JSON formats
    CASE
      WHEN jsonb_typeof(rec.communities) = 'array' THEN rec.communities
      WHEN jsonb_typeof(rec.communities) = 'string' THEN to_jsonb(ARRAY[rec.communities #>> '{}'])
      ELSE '[]'::jsonb
    END as communities_array
  FROM inventory_unit_preference t,
  jsonb_to_record(t.data) AS rec(
    kind text,
    transaction_type text,
    communities jsonb
  )
  WHERE rec.kind IS NOT NULL 
    AND rec.transaction_type IS NOT NULL
    AND rec.communities IS NOT NULL
),
community_list AS (
  SELECT DISTINCT 
    jsonb_array_elements_text(communities_array) as community
  FROM base
  WHERE jsonb_array_length(communities_array) > 0
)
SELECT community 
FROM community_list 
WHERE community IS NOT NULL 
  AND trim(community) != ''
ORDER BY community;