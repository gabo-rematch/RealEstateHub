import type { Express } from "express";
import { createServer, type Server } from "http";
import { queryDatabase, testConnection } from "./database";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test database connection on startup
  await testConnection();

  // API route for querying properties
  app.get("/api/properties", async (req, res) => {
    try {
      const {
        unit_kind,
        transaction_type,
        bedrooms,
        communities,
        property_type,
        budget_min,
        budget_max,
        price_aed,
        area_sqft_min,
        area_sqft_max,
        is_off_plan,
        is_distressed_deal,
        page = 0,
        pageSize = 50
      } = req.query;

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
        query += ` AND data->'bedrooms' ?| $${paramIndex}`;
        params.push(bedrooms);
        paramIndex++;
      }

      if (communities && Array.isArray(communities) && communities.length > 0) {
        query += ` AND data->'communities' ?| $${paramIndex}`;
        params.push(communities);
        paramIndex++;
      }

      if (property_type && Array.isArray(property_type) && property_type.length > 0) {
        query += ` AND data->'property_type' ?| $${paramIndex}`;
        params.push(property_type);
        paramIndex++;
      }

      if (budget_min && budget_min !== '') {
        query += ` AND (data->>'price_aed')::numeric >= $${paramIndex}`;
        params.push(parseFloat(budget_min as string));
        paramIndex++;
      }

      if (budget_max && budget_max !== '') {
        query += ` AND (data->>'price_aed')::numeric <= $${paramIndex}`;
        params.push(parseFloat(budget_max as string));
        paramIndex++;
      }

      if (price_aed && price_aed !== '') {
        query += ` AND (data->>'budget_min_aed')::numeric <= $${paramIndex} AND (data->>'budget_max_aed')::numeric >= $${paramIndex}`;
        params.push(parseFloat(price_aed as string));
        paramIndex++;
      }

      if (area_sqft_min && area_sqft_min !== '') {
        query += ` AND (data->>'area_sqft')::numeric >= $${paramIndex}`;
        params.push(parseFloat(area_sqft_min as string));
        paramIndex++;
      }

      if (area_sqft_max && area_sqft_max !== '') {
        query += ` AND (data->>'area_sqft')::numeric <= $${paramIndex}`;
        params.push(parseFloat(area_sqft_max as string));
        paramIndex++;
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

      // Add ordering and pagination
      query += ` ORDER BY updated_at DESC`;
      
      const offset = parseInt(page as string) * parseInt(pageSize as string);
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(pageSize as string), offset);

      console.log('Executing query:', query);
      console.log('With parameters:', params);

      const results = await queryDatabase(query, params);
      
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
      // Get unique kinds
      const kindsResult = await queryDatabase(`
        SELECT DISTINCT data->>'kind' as value
        FROM inventory_unit_preference 
        WHERE data->>'kind' IS NOT NULL
        ORDER BY value
      `);

      // Get unique transaction types
      const transactionTypesResult = await queryDatabase(`
        SELECT DISTINCT data->>'transaction_type' as value
        FROM inventory_unit_preference 
        WHERE data->>'transaction_type' IS NOT NULL
        ORDER BY value
      `);

      // Get unique property types (stored as strings)
      const propertyTypesResult = await queryDatabase(`
        SELECT DISTINCT data->>'property_type' as value
        FROM inventory_unit_preference 
        WHERE data->>'property_type' IS NOT NULL 
        AND data->>'property_type' != ''
        ORDER BY value
      `);

      // Get unique bedroom counts (stored as numbers)
      const bedroomsResult = await queryDatabase(`
        SELECT DISTINCT (data->>'bedrooms')::int as value
        FROM inventory_unit_preference 
        WHERE data->>'bedrooms' IS NOT NULL 
        AND data->>'bedrooms' ~ '^[0-9]+$'
        ORDER BY value
      `);

      // Get unique communities (check both string and array formats)
      const communitiesResult = await queryDatabase(`
        SELECT DISTINCT 
          CASE 
            WHEN jsonb_typeof(data->'communities') = 'array' THEN 
              jsonb_array_elements_text(data->'communities')
            WHEN jsonb_typeof(data->'communities') = 'string' THEN 
              data->>'communities'
            ELSE NULL
          END as value
        FROM inventory_unit_preference 
        WHERE data->'communities' IS NOT NULL 
        AND (
          (jsonb_typeof(data->'communities') = 'array' AND jsonb_array_length(data->'communities') > 0) OR
          (jsonb_typeof(data->'communities') = 'string' AND data->>'communities' != '')
        )
        ORDER BY value
        LIMIT 200
      `);

      const filterOptions = {
        kinds: kindsResult.map(row => row.value).filter(Boolean),
        transactionTypes: transactionTypesResult.map(row => row.value).filter(Boolean),
        propertyTypes: propertyTypesResult.map(row => row.value).filter(Boolean),
        bedrooms: bedroomsResult.map(row => row.value).filter(val => val !== null && val >= 0),
        communities: communitiesResult.map(row => row.value).filter(Boolean)
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
      res.json({ 
        success: true, 
        recordCount: result[0].count,
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
