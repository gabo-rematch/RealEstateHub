-- Advanced property filtering function that mimics the complex SQL logic
CREATE OR REPLACE FUNCTION filter_properties_advanced(
  p_unit_kind TEXT DEFAULT NULL,
  p_transaction_type TEXT DEFAULT NULL,
  p_bedrooms TEXT[] DEFAULT '{}',
  p_communities TEXT[] DEFAULT '{}',
  p_property_type TEXT[] DEFAULT '{}',
  p_budget_min NUMERIC DEFAULT NULL,
  p_budget_max NUMERIC DEFAULT NULL,
  p_price_aed NUMERIC DEFAULT NULL,
  p_area_sqft_min NUMERIC DEFAULT NULL,
  p_area_sqft_max NUMERIC DEFAULT NULL,
  p_is_off_plan TEXT DEFAULT NULL,
  p_is_distressed_deal TEXT DEFAULT NULL,
  p_keyword_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 0,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE(
  pk INTEGER,
  id TEXT,
  kind TEXT,
  transaction_type TEXT,
  bedrooms NUMERIC[],
  property_type TEXT[],
  communities TEXT[],
  price_aed NUMERIC,
  budget_max_aed NUMERIC,
  budget_min_aed NUMERIC,
  area_sqft NUMERIC,
  message_body_raw TEXT,
  furnishing TEXT,
  is_urgent BOOLEAN,
  is_agent_covered BOOLEAN,
  bathrooms NUMERIC[],
  location_raw TEXT,
  other_details TEXT,
  has_maid_bedroom BOOLEAN,
  is_direct BOOLEAN,
  mortgage_or_cash TEXT,
  is_distressed_deal BOOLEAN,
  is_off_plan BOOLEAN,
  is_mortgage_approved BOOLEAN,
  is_community_agnostic BOOLEAN,
  developers TEXT[],
  whatsapp_participant TEXT,
  agent_phone TEXT,
  groupJID TEXT,
  evolution_instance_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      t.pk,
      t.id,
      rec.kind,
      rec.transaction_type,

      -- Extracted arrays and fields
      CASE
        WHEN t.data->'bedrooms' IS NULL THEN '{}'::numeric[]
        WHEN jsonb_typeof(t.data->'bedrooms') = 'array' THEN (
          SELECT array_agg(x::numeric)
          FROM jsonb_array_elements_text(t.data->'bedrooms') AS x
        )
        ELSE ARRAY[(t.data->>'bedrooms')::numeric]
      END AS bedrooms,

      CASE
        WHEN t.data->'property_type' IS NULL THEN '{}'::text[]
        WHEN jsonb_typeof(t.data->'property_type') = 'array' THEN (
          SELECT array_agg(x)
          FROM jsonb_array_elements_text(t.data->'property_type') AS x
        )
        ELSE ARRAY[t.data->>'property_type']
      END AS property_type,

      CASE
        WHEN t.data->'communities' IS NOT NULL THEN
          CASE
            WHEN jsonb_typeof(t.data->'communities') = 'array' THEN (
              SELECT array_agg(x)
              FROM jsonb_array_elements_text(t.data->'communities') AS x
            )
            ELSE ARRAY[t.data->>'communities']
          END
        WHEN t.data->'community' IS NOT NULL THEN
          CASE
            WHEN jsonb_typeof(t.data->'community') = 'array' THEN (
              SELECT array_agg(x)
              FROM jsonb_array_elements_text(t.data->'community') AS x
            )
            ELSE ARRAY[t.data->>'community']
          END
        ELSE
          '{}'::text[]
      END AS communities,

      rec.price_aed,
      rec.budget_max_aed,
      rec.budget_min_aed,
      rec.area_sqft,
      rec.message_body_raw,
      rec.furnishing,
      rec.is_urgent,
      rec.is_agent_covered,

      CASE
        WHEN t.data->'bathrooms' IS NULL THEN '{}'::numeric[]
        WHEN jsonb_typeof(t.data->'bathrooms') = 'array' THEN (
          SELECT array_agg(x::numeric)
          FROM jsonb_array_elements_text(t.data->'bathrooms') AS x
        )
        ELSE ARRAY[(t.data->>'bathrooms')::numeric]
      END AS bathrooms,

      rec.location_raw,
      rec.other_details,
      rec.has_maid_bedroom,
      rec.is_direct,
      rec.mortgage_or_cash,
      rec.is_distressed_deal,
      rec.is_off_plan,
      rec.is_mortgage_approved,
      rec.is_community_agnostic,

      CASE
        WHEN t.data->'developers' IS NULL THEN '{}'::text[]
        WHEN jsonb_typeof(t.data->'developers') = 'array' THEN (
          SELECT array_agg(x)
          FROM jsonb_array_elements_text(t.data->'developers') AS x
        )
        ELSE ARRAY[t.data->>'developers']
      END AS developers,

      -- Agent details from joined table
      iu.agent_details->>'whatsapp_participant' AS whatsapp_participant,
      iu.agent_details->>'agent_phone'           AS agent_phone,
      iu.agent_details->>'whatsapp_remote_jid'   AS groupJID,
      iu.agent_details->>'evolution_instance_id' AS evolution_instance_id,

      t.updated_at

    FROM inventory_unit_preference AS t
    LEFT JOIN public.inventory_unit AS iu
      ON iu.pk = t.inventory_unit_pk
    CROSS JOIN LATERAL jsonb_to_record(t.data) AS rec(
      kind                  TEXT,
      area_sqft             NUMERIC,
      is_direct             BOOLEAN,
      is_urgent             BOOLEAN,
      furnishing            TEXT,
      location_raw          TEXT,
      other_details         TEXT,
      price_aed             NUMERIC,
      budget_max_aed        NUMERIC,
      budget_min_aed        NUMERIC,
      has_maid_bedroom      BOOLEAN,
      is_agent_covered      BOOLEAN,
      message_body_raw      TEXT,
      mortgage_or_cash      TEXT,
      transaction_type      TEXT,
      is_distressed_deal    BOOLEAN,
      is_off_plan           BOOLEAN,
      is_mortgage_approved  BOOLEAN,
      is_community_agnostic BOOLEAN
    )
  )
  SELECT *
  FROM base
  WHERE
    -- A) bedrooms multiselect
    (
      array_length(p_bedrooms, 1) IS NULL
      OR base.bedrooms && (p_bedrooms::TEXT[])::NUMERIC[]
    )
    AND

    -- B) communities multiselect
    (
      array_length(p_communities, 1) IS NULL
      OR base.communities && p_communities
    )
    AND

    -- C) transaction_type singleSelect
    (
      p_transaction_type IS NULL
      OR base.transaction_type = p_transaction_type
    )
    AND

    -- D) kind singleSelect
    (
      p_unit_kind IS NULL
      OR base.kind = p_unit_kind
    )
    AND

    -- E) unitType (property_type) multiselect
    (
      array_length(p_property_type, 1) IS NULL
      OR base.property_type && p_property_type
    )
    AND

    -- F) budgetMin / budgetMax (listings only), treat 0 as "no filter"
    (
      p_budget_min IS NULL OR p_budget_min = 0
      OR (
        base.kind = 'listing'
        AND base.price_aed >= p_budget_min
      )
    )
    AND
    (
      p_budget_max IS NULL OR p_budget_max = 0
      OR (
        base.kind = 'listing'
        AND (base.price_aed <= p_budget_max OR base.budget_max_aed = 1)
      )
    )
    AND

    -- G) listingPrice (client_requests only), treat 0 as "no filter"
    (
      p_price_aed IS NULL OR p_price_aed = 0
      OR (
        base.kind = 'client_request'
        AND (
          (base.budget_min_aed <= p_price_aed AND base.budget_max_aed >= p_price_aed)
          OR base.budget_max_aed = 1
        )
      )
    )
    AND

    -- H) areaMin / areaMax, treat 0 as "no filter"
    (
      p_area_sqft_min IS NULL OR p_area_sqft_min = 0
      OR base.area_sqft >= p_area_sqft_min
    )
    AND
    (
      p_area_sqft_max IS NULL OR p_area_sqft_max = 0
      OR base.area_sqft <= p_area_sqft_max
    )
    AND

    -- I) distressed deal filter
    (
      p_is_distressed_deal IS NULL
      OR (p_is_distressed_deal = 'distressed' AND base.is_distressed_deal IS TRUE)
      OR (p_is_distressed_deal = 'market' AND base.is_distressed_deal IS NOT TRUE)
    )
    AND

    -- J) off-plan filter
    (
      p_is_off_plan IS NULL
      OR (p_is_off_plan = 'off-plan' AND base.is_off_plan IS TRUE)
      OR (p_is_off_plan = 'ready' AND base.is_off_plan IS NOT TRUE)
    )
    AND

    -- K) keyword search
    (
      p_keyword_search IS NULL
      OR LOWER(base.message_body_raw) LIKE LOWER('%' || p_keyword_search || '%')
    )
    AND

    -- L) static sanity checks
    base.bedrooms         IS NOT NULL
    AND base.communities      IS NOT NULL
    AND base.kind             IS NOT NULL
    AND base.transaction_type IS NOT NULL
    AND base.property_type    IS NOT NULL

  ORDER BY base.updated_at DESC
  LIMIT p_page_size
  OFFSET p_page * p_page_size;
END;
$$ LANGUAGE plpgsql;