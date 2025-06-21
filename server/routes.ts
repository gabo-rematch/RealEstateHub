import type { Express } from "express";
import { createServer, type Server } from "http";
import { queryDatabase, testConnection } from "./database";
import { queryPropertiesWithSupabase, getFilterOptionsWithSupabase, refreshFilterOptionsCache } from "./supabase-query-builder-new";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test database connection on startup
  try {
    await testConnection();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }

  // API route for querying properties with progress tracking (Server-Sent Events)
  app.get("/api/properties-with-progress", async (req, res) => {
    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

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
        pageSize = 50,
        is_refinement = false
      } = req.query;

      // Handle multi-select parameters properly, including comma-separated values
      const bedrooms = req.query.bedrooms ? 
        (Array.isArray(req.query.bedrooms) ? req.query.bedrooms : [req.query.bedrooms]).flatMap(b => b.toString().split(',')) : [];
      const communities = req.query.communities ? 
        (Array.isArray(req.query.communities) ? req.query.communities : [req.query.communities]).flatMap(c => c.toString().split(',')) : [];
      const property_type = req.query.property_type ? 
        (Array.isArray(req.query.property_type) ? req.query.property_type : [req.query.property_type]).flatMap(p => p.toString().split(',')) : [];

      // Previous results for smart filtering (would be passed from frontend)
      const previous_results = req.query.previous_results ? 
        JSON.parse(decodeURIComponent(req.query.previous_results as string)) : undefined;

      // Progress callback function
      const progress_callback = (progress: { current: number; total: number; phase: string }) => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...progress })}\n\n`);
      };

      // Batch callback function for streaming results
      const batch_callback = (batch: any[]) => {
        // Transform batch results
        const transformedBatch = batch.map((row: any) => {
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
            groupJID: row.groupJID,
            evolution_instance_id: row.evolution_instance_id,
            updated_at: row.updated_at
          };
        });
        
        // Send batch event
        res.write(`data: ${JSON.stringify({ type: 'batch', properties: transformedBatch })}\n\n`);
      };

      // Use Supabase query builder
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
        pageSize: parseInt(pageSize as string),
        is_refinement: is_refinement === 'true',
        previous_results,
        progress_callback,
        batch_callback
      });

      // Transform results using same logic as existing endpoint
      const { properties: rawProperties, pagination } = results;
      const transformedResults = rawProperties.map((row: any) => {
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
          groupJID: row.groupJID,
          evolution_instance_id: row.evolution_instance_id,
          updated_at: row.updated_at
        };
      });

      // Send final result
      res.write(`data: ${JSON.stringify({ 
        type: 'complete', 
        properties: transformedResults,
        pagination: pagination,
        all_results: rawProperties // Include all results for smart filtering
      })}\n\n`);
      
      res.end();
    } catch (error) {
      console.error('Properties with progress API error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: 'Failed to fetch properties',
        details: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`);
      res.end();
    }
  });

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

      // Use Supabase query builder
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

      // Check if results is in the new format with pagination
      if (results && typeof results === 'object' && 'properties' in results && 'pagination' in results) {
        // New format with pagination info
        const { properties: rawProperties, pagination } = results;
        
        // Transform Supabase results to match expected format
        const transformedResults = rawProperties.map((row: any) => {
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
              groupJID: row.groupJID, // Use consistent camelCase naming
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
        
        res.json({
          properties: transformedResults,
          pagination: {
            currentPage: pagination.currentPage,
            pageSize: pagination.pageSize,
            totalResults: pagination.totalResults,
            totalPages: pagination.totalPages,
            hasMore: pagination.hasMore
          }
        });
        return;
      } else {
        // Legacy format - handle as array
        const transformedResults = (results as any[]).map((row: any) => {
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
              groupJID: row.groupJID, // Use consistent camelCase naming
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

        // Get total count for the current page results
        const totalResults = transformedResults.length;
        const totalPages = Math.ceil(totalResults / parseInt(pageSize as string));
        
        res.json({
          properties: transformedResults,
          pagination: {
            currentPage: parseInt(page as string),
            pageSize: parseInt(pageSize as string),
            totalResults,
            totalPages,
            hasMore: parseInt(page as string) < totalPages - 1
          }
        });
        return;
      }

    } catch (error) {
      console.error('Properties API error:', error);
      res.status(500).json({ error: 'Failed to fetch properties' });
    }
  });

  // Get unique filter values for dropdowns
  app.get("/api/filter-options", async (req, res) => {
    try {
      const filterOptions = await getFilterOptionsWithSupabase();
      
      const response = {
        kinds: filterOptions.kinds,
        transactionTypes: filterOptions.transaction_types,
        propertyTypes: filterOptions.property_types,
        bedrooms: filterOptions.bedrooms,
        communities: filterOptions.communities
      };
      
      res.json(response);
    } catch (error) {
      console.error('Filter options API error:', error);
      res.status(500).json({ error: 'Failed to fetch filter options from database' });
    }
  });

  // Refresh filter options cache endpoint
  app.post("/api/refresh-filter-options", async (req, res) => {
    try {
      const filterOptions = await refreshFilterOptionsCache();
      
      const response = {
        kinds: filterOptions.kinds,
        transactionTypes: filterOptions.transaction_types,
        propertyTypes: filterOptions.property_types,
        bedrooms: filterOptions.bedrooms,
        communities: filterOptions.communities
      };
      
      res.json({
        success: true,
        message: 'Filter options cache refreshed successfully',
        data: response,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Refresh filter options API error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to refresh filter options',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
