import type { Express } from "express";
import { createServer, type Server } from "http";
import { queryDatabase, testConnection } from "./database";
import { queryPropertiesWithSupabase, getFilterOptionsWithSupabase } from "./supabase-query-builder";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test database connection on startup
  await testConnection();

  // API route for querying properties
  app.get("/api/properties", async (req, res) => {
    try {
      const {
        unit_kind,
        transaction_type,
        budget_min,
        budget_max,
        price_aed,
        area_sqft_min,
        area_sqft_max,
        is_off_plan,
        is_distressed_deal,
        keyword_search,
        page = 0,
        pageSize = 50
      } = req.query;

      // Handle multi-select parameters properly, including comma-separated values
      const bedrooms = req.query.bedrooms ? 
        (Array.isArray(req.query.bedrooms) ? req.query.bedrooms : [req.query.bedrooms]).flatMap(b => b.toString().split(',')) : [];
      const communities = req.query.communities ? 
        (Array.isArray(req.query.communities) ? req.query.communities : [req.query.communities]).flatMap(c => c.toString().split(',')) : [];
      const property_type = req.query.property_type ? 
        (Array.isArray(req.query.property_type) ? req.query.property_type : [req.query.property_type]).flatMap(p => p.toString().split(',')) : [];



      // Always use Supabase query builder when credentials are available
      const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
      
      if (useSupabase) {
        // Use dedicated Supabase query builder for better filtering
        const results = await queryPropertiesWithSupabase({
          unit_kind: unit_kind as string,
          transaction_type: transaction_type as string,
          bedrooms: bedrooms as string[],
          communities: communities as string[],
          property_type: property_type as string[],
          budget_min: budget_min ? parseInt(budget_min as string) : undefined,
          budget_max: budget_max ? parseInt(budget_max as string) : undefined,
          price_aed: price_aed ? parseInt(price_aed as string) : undefined,
          area_sqft_min: area_sqft_min ? parseInt(area_sqft_min as string) : undefined,
          area_sqft_max: area_sqft_max ? parseInt(area_sqft_max as string) : undefined,
          is_off_plan: is_off_plan ? is_off_plan === 'true' : undefined,
          is_distressed_deal: is_distressed_deal ? is_distressed_deal === 'true' : undefined,
          keyword_search: keyword_search as string,
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string)
        });

        // Transform Supabase results to match expected format
        const transformedResults = results.map((row: any) => {
          // If data comes from RPC function, it's already in the correct format
          if (row.kind && row.transaction_type && row.bedrooms !== undefined) {
            return {
              pk: row.pk,
              id: row.id,
              kind: row.kind,
              transaction_type: row.transaction_type,
              bedrooms: row.bedrooms || [],
              property_type: row.property_type || [],
              communities: row.communities || [],
              price_aed: row.price_aed,
              budget_max_aed: row.budget_max_aed,
              budget_min_aed: row.budget_min_aed,
              area_sqft: row.area_sqft,
              message_body_raw: row.message_body_raw,
              furnishing: row.furnishing,
              is_urgent: row.is_urgent,
              is_agent_covered: row.is_agent_covered,
              bathrooms: row.bathrooms || [],
              location_raw: row.location_raw,
              other_details: row.other_details,
              has_maid_bedroom: row.has_maid_bedroom,
              is_direct: row.is_direct,
              mortgage_or_cash: row.mortgage_or_cash,
              is_distressed_deal: row.is_distressed_deal,
              is_off_plan: row.is_off_plan,
              is_mortgage_approved: row.is_mortgage_approved,
              is_community_agnostic: row.is_community_agnostic,
              developers: row.developers || [],
              whatsapp_participant: row.whatsapp_participant,
              agent_phone: row.agent_phone,
              groupJID: row.groupjid, // Note: PostgreSQL returns lowercase field names
              evolution_instance_id: row.evolution_instance_id,
              updated_at: row.updated_at
            };
          }
          
          // Fallback transformation for basic PostgREST results
          return {
            pk: row.pk,
            id: row.id,
            kind: row.data?.kind,
            transaction_type: row.data?.transaction_type,
            bedrooms: row.data?.bedrooms || [],
            property_type: row.data?.property_type || [],
            communities: row.data?.communities || [row.data?.community].filter(Boolean),
            price_aed: row.data?.price_aed,
            budget_max_aed: row.data?.budget_max_aed,
            budget_min_aed: row.data?.budget_min_aed,
            area_sqft: row.data?.area_sqft,
            message_body_raw: row.data?.message_body_raw,
            furnishing: row.data?.furnishing,
            is_urgent: row.data?.is_urgent,
            is_agent_covered: row.data?.is_agent_covered,
            bathrooms: row.data?.bathrooms || [],
            location_raw: row.data?.location_raw,
            other_details: row.data?.other_details,
            has_maid_bedroom: row.data?.has_maid_bedroom,
            is_direct: row.data?.is_direct,
            mortgage_or_cash: row.data?.mortgage_or_cash,
            is_distressed_deal: row.data?.is_distressed_deal,
            is_off_plan: row.data?.is_off_plan,
            is_mortgage_approved: row.data?.is_mortgage_approved,
            is_community_agnostic: row.data?.is_community_agnostic,
            developers: row.data?.developers || [],
            whatsapp_participant: row.inventory_unit?.agent_details?.whatsapp_participant || row.data?.whatsapp_participant,
            agent_phone: row.inventory_unit?.agent_details?.agent_phone || row.data?.agent_phone,
            groupJID: row.inventory_unit?.agent_details?.whatsapp_remote_jid || row.data?.groupJID,
            evolution_instance_id: row.inventory_unit?.agent_details?.evolution_instance_id || row.data?.evolution_instance_id,
            updated_at: row.updated_at
          };
        });

        console.log(`Query returned ${transformedResults.length} properties`);
        res.json(transformedResults);
        return;
      }



      let query = `
        SELECT 
          pk,
          id,
          data,
          updated_at,
          inventory_unit_pk
        FROM inventory_unit_preference
        WHERE 1=1
      `;
      
      const params: any[] = [];
      let paramIndex = 1;

      // Add filters if provided
      if (unit_kind && unit_kind !== '') {
        query += ` AND data->>'kind' = $${paramIndex}`;
        params.push(unit_kind);
        paramIndex++;
      }

      if (transaction_type && transaction_type !== '') {
        query += ` AND data->>'transaction_type' = $${paramIndex}`;
        params.push(transaction_type);
        paramIndex++;
      }

      if (bedrooms && Array.isArray(bedrooms) && bedrooms.length > 0) {
        // Convert bedroom strings to numbers for database comparison
        const bedroomNumbers = bedrooms.map(b => parseInt(b.toString()));
        // Handle both scalar (listing) and array (client_request) bedroom formats
        const bedroomConditions = bedroomNumbers.map(() => {
          return `(
            (jsonb_typeof(data->'bedrooms') = 'number' AND ROUND((data->>'bedrooms')::numeric) = $${paramIndex++}) OR
            (jsonb_typeof(data->'bedrooms') = 'array' AND data->'bedrooms' @> $${paramIndex++})
          )`;
        });
        query += ` AND (${bedroomConditions.join(' OR ')})`;
        
        // Add parameters for each bedroom number
        bedroomNumbers.forEach(num => {
          params.push(num); // For scalar comparison
          params.push(`[${num}]`); // For array containment
        });
      }

      if (communities && Array.isArray(communities) && communities.length > 0) {
        // Handle different field names: 'community' for listings, 'communities' for client_request
        query += ` AND (
          (data->>'kind' = 'listing' AND data->>'community' = ANY($${paramIndex})) OR
          (data->>'kind' = 'client_request' AND data->'communities' ?| $${paramIndex + 1})
        )`;
        params.push(communities); // For listing community field
        params.push(communities); // For client_request communities field
        paramIndex += 2;
      }

      if (property_type && Array.isArray(property_type) && property_type.length > 0) {
        query += ` AND data->'property_type' ?| $${paramIndex}`;
        params.push(property_type);
        paramIndex++;
      }

      // Handle area filters - area_sqft should be between area min and area max filters (inclusive)
      // Include null values and treat 111 as null/unknown for area
      if (area_sqft_min && area_sqft_min !== '') {
        query += ` AND ((data->>'area_sqft')::numeric >= $${paramIndex} OR data->>'area_sqft' IS NULL OR (data->>'area_sqft')::numeric = 111)`;
        params.push(parseFloat(area_sqft_min as string));
        paramIndex++;
      }

      if (area_sqft_max && area_sqft_max !== '') {
        query += ` AND ((data->>'area_sqft')::numeric <= $${paramIndex} OR data->>'area_sqft' IS NULL OR (data->>'area_sqft')::numeric = 111)`;
        params.push(parseFloat(area_sqft_max as string));
        paramIndex++;
      }

      // Handle price filters based on property kind
      // For kind = listing: price_aed should be between price range min and max (inclusive)
      // For kind = client_request: listing price should be between budget_min_aed and budget_max_aed
      if (unit_kind === 'listing') {
        // For listings, filter by price_aed within budget_min to budget_max range
        if (budget_min && budget_min !== '') {
          query += ` AND ((data->>'price_aed')::numeric >= $${paramIndex} OR data->>'price_aed' IS NULL OR (data->>'price_aed')::numeric = 1)`;
          params.push(parseFloat(budget_min as string));
          paramIndex++;
        }

        if (budget_max && budget_max !== '') {
          query += ` AND ((data->>'price_aed')::numeric <= $${paramIndex} OR data->>'price_aed' IS NULL OR (data->>'price_aed')::numeric = 1)`;
          params.push(parseFloat(budget_max as string));
          paramIndex++;
        }
      } else if (unit_kind === 'client_request') {
        // For client_request, filter by price_aed (listing price) within budget_min_aed to budget_max_aed range
        if (price_aed && price_aed !== '') {
          query += ` AND (((data->>'budget_min_aed')::numeric <= $${paramIndex} AND (data->>'budget_max_aed')::numeric >= $${paramIndex}) OR data->>'budget_min_aed' IS NULL OR data->>'budget_max_aed' IS NULL OR (data->>'budget_min_aed')::numeric = 1 OR (data->>'budget_max_aed')::numeric = 1)`;
          params.push(parseFloat(price_aed as string));
          paramIndex++;
        }
      } else {
        // When no kind is specified, handle both scenarios
        if (budget_min && budget_min !== '') {
          query += ` AND ((data->>'price_aed')::numeric >= $${paramIndex} OR data->>'price_aed' IS NULL OR (data->>'price_aed')::numeric = 1)`;
          params.push(parseFloat(budget_min as string));
          paramIndex++;
        }

        if (budget_max && budget_max !== '') {
          query += ` AND ((data->>'price_aed')::numeric <= $${paramIndex} OR data->>'price_aed' IS NULL OR (data->>'price_aed')::numeric = 1)`;
          params.push(parseFloat(budget_max as string));
          paramIndex++;
        }

        if (price_aed && price_aed !== '') {
          query += ` AND (((data->>'budget_min_aed')::numeric <= $${paramIndex} AND (data->>'budget_max_aed')::numeric >= $${paramIndex}) OR data->>'budget_min_aed' IS NULL OR data->>'budget_max_aed' IS NULL OR (data->>'budget_min_aed')::numeric = 1 OR (data->>'budget_max_aed')::numeric = 1)`;
          params.push(parseFloat(price_aed as string));
          paramIndex++;
        }
      }

      if (is_off_plan !== undefined) {
        query += ` AND (data->>'is_off_plan')::boolean = $${paramIndex}`;
        params.push(is_off_plan === 'true');
        paramIndex++;
      }

      if (is_distressed_deal !== undefined) {
        query += ` AND (data->>'is_distressed_deal')::boolean = $${paramIndex}`;
        params.push(is_distressed_deal === 'true');
        paramIndex++;
      }

      if (keyword_search && keyword_search !== '') {
        query += ` AND LOWER(data->>'message_body_raw') LIKE LOWER($${paramIndex})`;
        params.push(`%${keyword_search as string}%`);
        paramIndex++;
      }

      // Add ordering and pagination
      query += ` ORDER BY updated_at DESC`;
      
      const offset = parseInt(page as string) * parseInt(pageSize as string);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(pageSize as string), offset);

      console.log('Executing query:', query);
      console.log('With parameters:', params);

      const results = await queryDatabase(query, params);
      
      // Ensure results is an array before processing
      if (!Array.isArray(results)) {
        return res.json([]);
      }
      
      // Transform the results to match the expected format
      const transformedResults = results.map((row: any) => {
        const jsonData = row.data || {};
        
        const ensureArray = (value: any): any[] => {
          if (Array.isArray(value)) return value;
          if (value != null) return [value];
          return [];
        };

        const ensureNumericArray = (value: any): number[] => {
          if (Array.isArray(value)) return value.map(v => parseFloat(v)).filter(n => !isNaN(n));
          if (value != null) {
            const num = parseFloat(value);
            return !isNaN(num) ? [num] : [];
          }
          return [];
        };
        
        return {
          pk: row.pk,
          id: row.id || String(row.pk),
          kind: jsonData.kind || 'unknown',
          transaction_type: jsonData.transaction_type || 'sale',
          bedrooms: ensureNumericArray(jsonData.bedrooms),
          property_type: ensureArray(jsonData.property_type),
          communities: ensureArray(jsonData.communities || jsonData.community),
          price_aed: jsonData.price_aed ? parseFloat(String(jsonData.price_aed)) : null,
          budget_max_aed: jsonData.budget_max_aed ? parseFloat(String(jsonData.budget_max_aed)) : null,
          budget_min_aed: jsonData.budget_min_aed ? parseFloat(String(jsonData.budget_min_aed)) : null,
          area_sqft: jsonData.area_sqft ? parseFloat(String(jsonData.area_sqft)) : null,
          message_body_raw: jsonData.message_body_raw || `${jsonData.kind || 'Property'} inquiry`,
          furnishing: jsonData.furnishing,
          is_urgent: jsonData.is_urgent || false,
          is_agent_covered: jsonData.is_agent_covered !== false,
          bathrooms: ensureNumericArray(jsonData.bathrooms),
          location_raw: jsonData.location_raw,
          other_details: jsonData.other_details,
          has_maid_bedroom: jsonData.has_maid_bedroom,
          is_direct: jsonData.is_direct || false,
          mortgage_or_cash: jsonData.mortgage_or_cash,
          is_distressed_deal: jsonData.is_distressed_deal || false,
          is_off_plan: jsonData.is_off_plan || false,
          is_mortgage_approved: jsonData.is_mortgage_approved,
          is_community_agnostic: jsonData.is_community_agnostic,
          developers: ensureArray(jsonData.developers),
          whatsapp_participant: jsonData.whatsapp_participant,
          agent_phone: jsonData.agent_phone,
          groupJID: jsonData.groupJID,
          evolution_instance_id: jsonData.evolution_instance_id,
          updated_at: row.updated_at
        };
      });

      console.log(`Query returned ${transformedResults.length} properties`);
      res.json(transformedResults);
      
    } catch (error) {
      console.error('Properties API error:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  // Get unique filter values for dropdowns
  app.get("/api/filter-options", async (req, res) => {
    try {
      // Get communities from database using both 'community' and 'communities' fields
      const communitiesResult = await queryDatabase(`
        SELECT DISTINCT community AS communities
        FROM (
          -- Get communities from client_request records (array field)
          SELECT UNNEST(
            CASE
              WHEN t.data->'communities' IS NULL THEN '{}'::text[]
              WHEN jsonb_typeof(t.data->'communities') = 'array' THEN (
                SELECT array_agg(elem)
                FROM jsonb_array_elements_text(t.data->'communities') AS elem
              )
              ELSE ARRAY[ t.data->>'communities' ]
            END
          ) AS community
          FROM inventory_unit_preference AS t
          WHERE t.data->>'kind' = 'client_request'
          
          UNION
          
          -- Get community from listing records (scalar field)
          SELECT t.data->>'community' AS community
          FROM inventory_unit_preference AS t
          WHERE t.data->>'kind' = 'listing' AND t.data->>'community' IS NOT NULL
        ) AS combined_communities
        WHERE community IS NOT NULL AND community != '' AND community != 'null'
        ORDER BY communities
      `);

      // Always use Supabase query builder when credentials are available
      const useSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
      
      if (useSupabase) {
        const filterOptions = await getFilterOptionsWithSupabase();
        const safeCommunitiesResult = Array.isArray(communitiesResult) ? communitiesResult : [];
        res.json({
          kinds: filterOptions.kinds,
          transactionTypes: filterOptions.transactionTypes,
          propertyTypes: filterOptions.propertyTypes,
          bedrooms: filterOptions.bedrooms,
          communities: safeCommunitiesResult.map((row: any) => row.communities).filter(Boolean).sort()
        });
        return;
      }
      // Get unique kinds
      const kindsResult = await queryDatabase(`
        SELECT DISTINCT x.kind AS value
        FROM inventory_unit_preference AS t,
             LATERAL (
               SELECT UNNEST(
                 CASE
                   WHEN t.data->'kind' IS NULL THEN '{}'::text[]
                   WHEN jsonb_typeof(t.data->'kind') = 'array' THEN (
                     SELECT array_agg(elem)
                     FROM jsonb_array_elements_text(t.data->'kind') AS elem
                   )
                   ELSE ARRAY[ t.data->>'kind' ]
                 END
               ) AS kind
             ) AS x
        ORDER BY value
      `);

      // Get unique transaction types
      const transactionTypesResult = await queryDatabase(`
        SELECT DISTINCT x.transaction_type AS value
        FROM inventory_unit_preference AS t,
             LATERAL (
               SELECT UNNEST(
                 CASE
                   WHEN t.data->'transaction_type' IS NULL THEN '{}'::text[]
                   WHEN jsonb_typeof(t.data->'transaction_type') = 'array' THEN (
                     SELECT array_agg(elem)
                     FROM jsonb_array_elements_text(t.data->'transaction_type') AS elem
                   )
                   ELSE ARRAY[ t.data->>'transaction_type' ]
                 END
               ) AS transaction_type
             ) AS x
        ORDER BY value
      `);

      // Get unique property types
      const propertyTypesResult = await queryDatabase(`
        SELECT DISTINCT x.property_type AS value
        FROM inventory_unit_preference AS t,
             LATERAL (
               SELECT UNNEST(
                 CASE
                   WHEN t.data->'property_type' IS NULL THEN '{}'::text[]
                   WHEN jsonb_typeof(t.data->'property_type') = 'array' THEN (
                     SELECT array_agg(elem)
                     FROM jsonb_array_elements_text(t.data->'property_type') AS elem
                   )
                   ELSE ARRAY[ t.data->>'property_type' ]
                 END
               ) AS property_type
             ) AS x
        WHERE x.property_type IS NOT NULL AND x.property_type != ''
        ORDER BY value
      `);

      // Get unique bedroom counts
      const bedroomsResult = await queryDatabase(`
        SELECT DISTINCT x.bedrooms AS value
        FROM inventory_unit_preference AS t,
             LATERAL (
               SELECT UNNEST(
                 CASE
                   WHEN t.data->'bedrooms' IS NULL THEN '{}'::text[]
                   WHEN jsonb_typeof(t.data->'bedrooms') = 'array' THEN (
                     SELECT array_agg(elem)
                     FROM jsonb_array_elements_text(t.data->'bedrooms') AS elem
                   )
                   ELSE ARRAY[ t.data->>'bedrooms' ]
                 END
               ) AS bedrooms
             ) AS x
        ORDER BY value
      `);

      // This will be replaced by the communities query above

      // Ensure all results are arrays before processing
      const safeKindsResult = Array.isArray(kindsResult) ? kindsResult : [];
      const safeTransactionTypesResult = Array.isArray(transactionTypesResult) ? transactionTypesResult : [];
      const safePropertyTypesResult = Array.isArray(propertyTypesResult) ? propertyTypesResult : [];
      const safeBedroomsResult = Array.isArray(bedroomsResult) ? bedroomsResult : [];
      const safeCommunitiesResult = Array.isArray(communitiesResult) ? communitiesResult : [];

      const filterOptions = {
        kinds: safeKindsResult.map((row: any) => row.value).filter(Boolean),
        transactionTypes: safeTransactionTypesResult.map((row: any) => row.value).filter(Boolean),
        propertyTypes: safePropertyTypesResult.map((row: any) => row.value).filter(Boolean),
        bedrooms: safeBedroomsResult.map((row: any) => parseInt(row.value)).filter((val: any) => !isNaN(val) && val >= 0 && val <= 20).sort((a: any, b: any) => a - b),
        communities: safeCommunitiesResult.map((row: any) => row.communities).filter(Boolean).sort()
      };

      res.json(filterOptions);
    } catch (error) {
      console.error('Filter options API error:', error);
      res.status(500).json({ error: 'Failed to fetch filter options' });
    }
  });

  // Test database endpoint
  app.get("/api/test-db", async (req, res) => {
    try {
      const result = await queryDatabase('SELECT COUNT(*) as count FROM inventory_unit_preference');
      const safeResult = Array.isArray(result) ? result : [];
      res.json({ 
        success: true, 
        recordCount: safeResult.length > 0 ? (safeResult[0] as any).count : 0,
        message: 'Database connection successful' 
      });
    } catch (error) {
      console.error('Database test error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
