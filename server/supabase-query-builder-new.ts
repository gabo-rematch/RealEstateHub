import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function escapePostgRESTString(value: string): string {
  return value.replace(/"/g, '\\"');
}

interface FilterParams {
  unit_kind?: string;
  transaction_type?: string;
  bedrooms?: string[];
  communities?: string[];
  property_type?: string[];
  budget_min?: number;
  budget_max?: number;
  price_aed?: number;
  area_sqft_min?: number;
  area_sqft_max?: number;
  is_off_plan?: boolean;
  is_distressed_deal?: boolean;
  keyword_search?: string;
  page?: number;
  pageSize?: number;
  // New parameters for smart filtering
  previous_results?: any[];  // Previous results to filter from
  is_refinement?: boolean;   // Whether this is a refinement of previous search
  progress_callback?: (progress: { current: number; total: number; phase: string }) => void;
}

// Helper function to ensure array format with proper handling of both scalar and array values
function ensureArray(value: any, isNumeric = false): any[] {
  if (value === null || value === undefined) return [];
  
  if (Array.isArray(value)) {
    // Handle array input - process each element
    return value
      .map(v => {
        if (v === null || v === undefined) return null;
        if (isNumeric) {
          const parsed = parseFloat(v);
          return isNaN(parsed) ? null : parsed;
  }
        return typeof v === 'string' ? v.trim() : v.toString().trim();
      })
      .filter(v => v !== null && v !== '' && v !== undefined);
  } else {
    // Handle scalar input
    if (isNumeric) {
      const parsed = parseFloat(value);
  return isNaN(parsed) ? [] : [parsed];
    }
    const stringValue = typeof value === 'string' ? value.trim() : value.toString().trim();
    return stringValue ? [stringValue] : [];
  }
}

// Enhanced helper function for communities (handles both 'communities' and 'community' fields)
function ensureCommunitiesArray(data: any): string[] {
  // First check communities field (array or scalar)
  if (data.communities !== null && data.communities !== undefined) {
    return ensureArray(data.communities, false);
  }
  // Then check community field (array or scalar)
  if (data.community !== null && data.community !== undefined) {
    return ensureArray(data.community, false);
  }
  return [];
}

// Enhanced helper function for property types (handles both array and scalar values)
function ensurePropertyTypesArray(data: any): string[] {
  if (data.property_type !== null && data.property_type !== undefined) {
    return ensureArray(data.property_type, false);
  }
  return [];
}

// Enhanced helper function for bedrooms with strict validation
function ensureBedroomsArray(data: any): number[] {
  if (data.bedrooms !== null && data.bedrooms !== undefined) {
    const rawValues = ensureArray(data.bedrooms, true);
    
    // Apply strict validation for bedroom values
    return rawValues.filter(v => {
      if (typeof v === 'number' && !isNaN(v)) {
        // Only accept reasonable bedroom counts (0 to 15) and clean 0.5 increments
        if (v >= 0 && v <= 15) {
          const rounded = Math.round(v * 2) / 2;
          // Only accept whole numbers or clean half increments (0.5, 1.5, 2.5, etc.)
          return rounded === v;
        }
      }
      return false;
    });
  }
  return [];
}

// Post-processing filtering to exactly match SQL query logic
function applyPostProcessingFilters(data: any[], filters: FilterParams): any[] {
  return data.filter((item: any) => {
    // A) bedrooms multiselect - use array overlap (&&) logic with enhanced validation
    if (filters.bedrooms && filters.bedrooms.length > 0) {
      const itemBedrooms = ensureBedroomsArray(item);
      const filterBedrooms = filters.bedrooms.map(b => {
        // Handle special case for studio
        if (b.toLowerCase() === 'studio') return 0;
        const parsed = parseFloat(b);
        return isNaN(parsed) ? null : parsed;
      }).filter(v => v !== null);
      
      // Check for array overlap (&& operator in SQL)
      const hasOverlap = itemBedrooms.some(itemBed => 
        filterBedrooms.some(filterBed => itemBed === filterBed)
      );
      if (!hasOverlap) return false;
    }

    // B) communities multiselect - use array overlap (&&) logic with enhanced handling
    if (filters.communities && filters.communities.length > 0) {
      const itemCommunities = ensureCommunitiesArray(item);
      const filterCommunities = filters.communities;
      
      // Check for array overlap (&& operator in SQL)
      const hasOverlap = itemCommunities.some(itemComm => 
        filterCommunities.some(filterComm => 
          itemComm && filterComm && itemComm.trim().toLowerCase() === filterComm.trim().toLowerCase()
        )
      );
      if (!hasOverlap) return false;
    }

    // C) property_type multiselect - use array overlap (&&) logic with enhanced handling
    if (filters.property_type && filters.property_type.length > 0) {
      const itemPropertyTypes = ensurePropertyTypesArray(item);
      const filterPropertyTypes = filters.property_type;
      
      // Check for array overlap (&& operator in SQL)
      const hasOverlap = itemPropertyTypes.some(itemType => 
        filterPropertyTypes.some(filterType => 
          itemType && filterType && itemType.trim().toLowerCase() === filterType.trim().toLowerCase()
        )
      );
      if (!hasOverlap) return false;
    }

    // Skip other filters as they are handled at database level in hybrid approach

    return true;
  });
}

export async function queryPropertiesWithSupabase(filters: FilterParams) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const requestedPageSize = filters.pageSize || 50;
  const requestedPage = filters.page || 0;
  
  // Check if we have complex filters that need post-processing
  const requiresComplexFiltering = (filters.bedrooms && filters.bedrooms.length > 0) ||
                                   (filters.communities && filters.communities.length > 0) ||
                                   (filters.property_type && filters.property_type.length > 0);

  // Smart filtering: Use previous results if this is a refinement
  if (filters.is_refinement && filters.previous_results && filters.previous_results.length > 0) {
    // Apply only the new filters to previous results
    const filteredData = applyPostProcessingFilters(filters.previous_results, filters);
    
    // Calculate pagination details
    const targetStart = requestedPage * requestedPageSize;
    const targetEnd = targetStart + requestedPageSize;
    const paginatedData = filteredData.slice(targetStart, targetEnd);
    
    return {
      properties: paginatedData,
      pagination: {
        currentPage: requestedPage,
        pageSize: requestedPageSize,
        totalResults: filteredData.length,
        totalPages: Math.ceil(filteredData.length / requestedPageSize),
        hasMore: requestedPage < Math.ceil(filteredData.length / requestedPageSize) - 1
      }
    };
  }

  if (!requiresComplexFiltering && requestedPageSize <= 100) {
    // Simple case: no complex filters, use direct database pagination
    const directOffset = requestedPage * requestedPageSize;
    
    let query = supabase
      .from('inventory_unit_preference')
      .select(`
        pk,
        id,
        data,
        updated_at,
        inventory_unit:inventory_unit_pk(agent_details)
      `);

    // Apply basic filters
    if (filters.unit_kind) {
      query = query.eq('data->>kind', filters.unit_kind);
    }
    if (filters.transaction_type) {
      query = query.eq('data->>transaction_type', filters.transaction_type);
    }

    // Numeric range filters
    if (filters.budget_min !== undefined) {
      query = query.gte('data->>budget_min_aed', filters.budget_min.toString());
    }
    if (filters.budget_max !== undefined) {
      query = query.lte('data->>budget_max_aed', filters.budget_max.toString());
    }
    if (filters.price_aed !== undefined) {
      query = query.eq('data->>price_aed', filters.price_aed.toString());
    }
    if (filters.area_sqft_min !== undefined) {
      query = query.gte('data->>area_sqft', filters.area_sqft_min.toString());
    }
    if (filters.area_sqft_max !== undefined) {
      query = query.lte('data->>area_sqft', filters.area_sqft_max.toString());
    }

    // Boolean filters
    if (filters.is_off_plan !== undefined) {
      if (filters.is_off_plan === true) {
        query = query.eq('data->>is_off_plan', 'true');
      } else {
        query = query.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
      }
    }
    if (filters.is_distressed_deal !== undefined) {
      if (filters.is_distressed_deal === true) {
        query = query.eq('data->>is_distressed_deal', 'true');
      } else {
        query = query.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
      }
    }

    // Keyword search
    if (filters.keyword_search && filters.keyword_search.trim()) {
      query = query.ilike('data->>message_body_raw', `%${filters.keyword_search.trim()}%`);
    }

    // Get count and apply pagination
    let countQuery = supabase
      .from('inventory_unit_preference')
      .select('pk', { count: 'exact', head: true });

    // Apply same filters to count
    if (filters.unit_kind) {
      countQuery = countQuery.eq('data->>kind', filters.unit_kind);
    }
    if (filters.transaction_type) {
      countQuery = countQuery.eq('data->>transaction_type', filters.transaction_type);
    }
    if (filters.budget_min !== undefined) {
      countQuery = countQuery.gte('data->>budget_min_aed', filters.budget_min.toString());
    }
    if (filters.budget_max !== undefined) {
      countQuery = countQuery.lte('data->>budget_max_aed', filters.budget_max.toString());
    }
    if (filters.price_aed !== undefined) {
      countQuery = countQuery.eq('data->>price_aed', filters.price_aed.toString());
    }
    if (filters.area_sqft_min !== undefined) {
      countQuery = countQuery.gte('data->>area_sqft', filters.area_sqft_min.toString());
    }
    if (filters.area_sqft_max !== undefined) {
      countQuery = countQuery.lte('data->>area_sqft', filters.area_sqft_max.toString());
    }
    if (filters.is_off_plan !== undefined) {
      if (filters.is_off_plan === true) {
        countQuery = countQuery.eq('data->>is_off_plan', 'true');
      } else {
        countQuery = countQuery.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
      }
    }
    if (filters.is_distressed_deal !== undefined) {
      if (filters.is_distressed_deal === true) {
        countQuery = countQuery.eq('data->>is_distressed_deal', 'true');
      } else {
        countQuery = countQuery.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
      }
    }
    if (filters.keyword_search && filters.keyword_search.trim()) {
      countQuery = countQuery.ilike('data->>message_body_raw', `%${filters.keyword_search.trim()}%`);
    }

    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Count query error:', countError);
      throw new Error(`Count query failed: ${countError.message}`);
    }

    // Apply pagination and ordering
    query = query
      .order('updated_at', { ascending: false })
      .range(directOffset, directOffset + requestedPageSize - 1);

    const { data, error } = await query;
    
    if (error) {
      console.error('Main query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }

    // Transform data
    const transformedData = (data || []).map((row: any) => {
      const data = row.data;
      const agentDetails = row.inventory_unit?.agent_details || {};

      return {
        pk: row.pk,
        id: row.id,
        kind: data?.kind,
        transaction_type: data?.transaction_type,
        bedrooms: ensureBedroomsArray(data),
        property_type: ensurePropertyTypesArray(data),
        communities: ensureCommunitiesArray(data),
        price_aed: data?.price_aed,
        budget_max_aed: data?.budget_max_aed,
        budget_min_aed: data?.budget_min_aed,
        area_sqft: data?.area_sqft,
        message_body_raw: data?.message_body_raw,
        furnishing: data?.furnishing,
        is_urgent: data?.is_urgent,
        is_agent_covered: data?.is_agent_covered,
        bathrooms: ensureArray(data?.bathrooms, true),
        location_raw: data?.location_raw,
        other_details: data?.other_details,
        has_maid_bedroom: data?.has_maid_bedroom,
        is_direct: data?.is_direct,
        mortgage_or_cash: data?.mortgage_or_cash,
        is_distressed_deal: data?.is_distressed_deal,
        is_off_plan: data?.is_off_plan,
        is_mortgage_approved: data?.is_mortgage_approved,
        is_community_agnostic: data?.is_community_agnostic,
        developers: ensureArray(data?.developers, false),
        whatsapp_participant: agentDetails.whatsapp_participant || data?.whatsapp_participant,
        agent_phone: agentDetails.agent_phone || data?.agent_phone,
        groupJID: agentDetails.whatsapp_remote_jid || data?.groupJID,
        evolution_instance_id: agentDetails.evolution_instance_id || data?.evolution_instance_id,
        updated_at: row.updated_at
      };
    });

    return {
      properties: transformedData,
      pagination: {
        currentPage: requestedPage,
        pageSize: requestedPageSize,
        totalResults: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / requestedPageSize),
        hasMore: requestedPage < Math.ceil((totalCount || 0) / requestedPageSize) - 1
      }
    };
  }

  // Complex case: has complex filters, use optimized batch-fetch approach for accurate results
  
  // Strategy: Fetch ALL records matching basic filters in batches, then post-process for complex filters
  // This ensures we get accurate counts and proper pagination
  
  let allData: any[] = [];
  const batchSize = 1000; // Supabase's recommended batch size
  let fromIndex = 0;
  let hasMoreData = true;
  let batchCount = 0;
  
  while (hasMoreData) {
    batchCount++;
    
    // Report progress for batch fetching
    if (filters.progress_callback) {
      filters.progress_callback({
        current: batchCount,
        total: batchCount + 10, // Estimate
        phase: `Fetching batch ${batchCount}...`
      });
    }
    
    let batchQuery = supabase
      .from('inventory_unit_preference')
      .select('pk,id,data,updated_at')
      .order('updated_at', { ascending: false })
      .range(fromIndex, fromIndex + batchSize - 1);

    // Apply basic filters to reduce dataset size significantly
    if (filters.unit_kind) {
      batchQuery = batchQuery.eq('data->>kind', filters.unit_kind);
    }
    if (filters.transaction_type) {
      batchQuery = batchQuery.eq('data->>transaction_type', filters.transaction_type);
    }
    if (filters.budget_min !== undefined) {
      batchQuery = batchQuery.gte('data->>budget_min_aed', filters.budget_min.toString());
    }
    if (filters.budget_max !== undefined) {
      batchQuery = batchQuery.lte('data->>budget_max_aed', filters.budget_max.toString());
    }
    if (filters.price_aed !== undefined) {
      batchQuery = batchQuery.eq('data->>price_aed', filters.price_aed.toString());
    }
    if (filters.area_sqft_min !== undefined) {
      batchQuery = batchQuery.gte('data->>area_sqft', filters.area_sqft_min.toString());
    }
    if (filters.area_sqft_max !== undefined) {
      batchQuery = batchQuery.lte('data->>area_sqft', filters.area_sqft_max.toString());
    }
    if (filters.is_off_plan !== undefined) {
      if (filters.is_off_plan === true) {
        batchQuery = batchQuery.eq('data->>is_off_plan', 'true');
      } else {
        batchQuery = batchQuery.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
      }
    }
    if (filters.is_distressed_deal !== undefined) {
      if (filters.is_distressed_deal === true) {
        batchQuery = batchQuery.eq('data->>is_distressed_deal', 'true');
      } else {
        batchQuery = batchQuery.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
      }
    }
    if (filters.keyword_search && filters.keyword_search.trim()) {
      batchQuery = batchQuery.ilike('data->>message_body_raw', `%${filters.keyword_search.trim()}%`);
    }

    const { data: batchData, error: fetchError } = await batchQuery;
    
    if (fetchError) {
      console.error('Batch query error:', fetchError);
      throw new Error(`Batch query failed: ${fetchError.message}`);
    }

    if (!batchData || batchData.length === 0) {
      hasMoreData = false;
      break;
    }

    allData = allData.concat(batchData);
    
    // Check if we got a full batch - if not, we're done
    if (batchData.length < batchSize) {
      hasMoreData = false;
    } else {
      fromIndex += batchSize;
    }
  }
  
  if (allData.length === 0) {
    return {
      properties: [],
      pagination: {
        currentPage: requestedPage,
        pageSize: requestedPageSize,
        totalResults: 0,
        totalPages: 0,
        hasMore: false
      }
    };
  }
  
  // Report progress: Starting data processing
  if (filters.progress_callback) {
    filters.progress_callback({
      current: 100,
      total: 100,
      phase: 'Processing and filtering results...'
    });
  }

  // Transform data
  const transformedData = allData.map((row: any) => {
    const data = row.data;
    return {
      pk: row.pk,
      id: row.id,
      kind: data?.kind,
      transaction_type: data?.transaction_type,
      bedrooms: ensureBedroomsArray(data),
      property_type: ensurePropertyTypesArray(data),
      communities: ensureCommunitiesArray(data),
      price_aed: data?.price_aed,
      budget_max_aed: data?.budget_max_aed,
      budget_min_aed: data?.budget_min_aed,
      area_sqft: data?.area_sqft,
      message_body_raw: data?.message_body_raw,
      furnishing: data?.furnishing,
      is_urgent: data?.is_urgent,
      is_agent_covered: data?.is_agent_covered,
      bathrooms: ensureArray(data?.bathrooms, true),
      location_raw: data?.location_raw,
      other_details: data?.other_details,
      has_maid_bedroom: data?.has_maid_bedroom,
      is_direct: data?.is_direct,
      mortgage_or_cash: data?.mortgage_or_cash,
      is_distressed_deal: data?.is_distressed_deal,
      is_off_plan: data?.is_off_plan,
      is_mortgage_approved: data?.is_mortgage_approved,
      is_community_agnostic: data?.is_community_agnostic,
      developers: ensureArray(data?.developers, false),
      whatsapp_participant: data?.whatsapp_participant,
      agent_phone: data?.agent_phone,
      groupJID: data?.groupJID,
      evolution_instance_id: data?.evolution_instance_id,
      updated_at: row.updated_at
    };
  });

  // Apply complex filters to get final results
  const filteredData = applyPostProcessingFilters(transformedData, filters);
  
  // Calculate pagination details
  const targetStart = requestedPage * requestedPageSize;
  const targetEnd = targetStart + requestedPageSize;
  const paginatedData = filteredData.slice(targetStart, targetEnd);
  
  return {
    properties: paginatedData,
    pagination: {
      currentPage: requestedPage,
      pageSize: requestedPageSize,
      totalResults: filteredData.length,
      totalPages: Math.ceil(filteredData.length / requestedPageSize),
      hasMore: requestedPage < Math.ceil(filteredData.length / requestedPageSize) - 1
    }
  };
}

// Helper function to transform raw data to expected format - EXACTLY matching SQL query
function transformDataToExpectedFormat(allData: any[]) {
  return allData.map((record: any) => {
    if (!record.data) return null;

    const data = record.data;
    const agentDetails = record.inventory_unit?.agent_details || {};

    // Transform data EXACTLY as per SQL query with enhanced scalar/array handling
    return {
      pk: record.pk,
      id: record.id,
      kind: data.kind,
      transaction_type: data.transaction_type,
      
      // Bedrooms - enhanced handling of both scalar and array values with strict validation
      bedrooms: ensureBedroomsArray(data),
      
      // Property type - enhanced handling of both scalar and array values
      property_type: ensurePropertyTypesArray(data),
      
      // Communities - enhanced handling (checks both 'communities' and 'community' fields, scalar and array)
      communities: ensureCommunitiesArray(data),
      
      // Direct field mappings
      price_aed: data.price_aed || null,
      budget_max_aed: data.budget_max_aed || null,
      budget_min_aed: data.budget_min_aed || null,
      area_sqft: data.area_sqft || null,
      message_body_raw: data.message_body_raw || null,
      furnishing: data.furnishing || null,
      is_urgent: data.is_urgent || null,
      is_agent_covered: data.is_agent_covered || null,
      
      // Bathrooms - enhanced handling of both scalar and array values
      bathrooms: ensureArray(data.bathrooms, true),
      
      // Direct field mappings
      location_raw: data.location_raw || null,
      other_details: data.other_details || null,
      has_maid_bedroom: data.has_maid_bedroom || null,
      is_direct: data.is_direct || null,
      mortgage_or_cash: data.mortgage_or_cash || null,
      is_distressed_deal: data.is_distressed_deal || null,
      is_off_plan: data.is_off_plan || null,
      is_mortgage_approved: data.is_mortgage_approved || null,
      is_community_agnostic: data.is_community_agnostic || null,
      
      // Developers - enhanced handling of both scalar and array values
      developers: ensureArray(data.developers, false),
      
      // Agent details - exactly as per SQL query
      whatsapp_participant: agentDetails.whatsapp_participant || null,
      agent_phone: agentDetails.agent_phone || null,
      groupJID: agentDetails.whatsapp_remote_jid || null,
      evolution_instance_id: agentDetails.evolution_instance_id || null,
      
      updated_at: record.updated_at
    };
  }).filter(Boolean);
}

// Use a dedicated cache directory so we don't clutter project root and
// to avoid edge-cases where the root might be read-only (e.g. some CI runners).
const CACHE_DIR = join(process.cwd(), 'cache');

// Ensure the cache directory exists (sync – runs only once at start-up)
try {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch (err) {
  console.error('[CACHE] Failed to create cache directory', err);
}

const CACHE_FILE_PATH = join(process.cwd(), 'cache', 'filter-options-cache.json');

interface CachedFilterOptions {
  data: {
    kinds: string[];
    transaction_types: string[];
    property_types: string[];
    bedrooms: string[];
    communities: string[];
  };
  timestamp: number;
  expiresAt: number;
  lastUpdated: string;
  recordCount: number;
}

function loadCachedFilterOptions(): CachedFilterOptions | null {
  try {
    if (!existsSync(CACHE_FILE_PATH)) {
      return null;
    }

    const fileStats = statSync(CACHE_FILE_PATH);
    const fileContent = readFileSync(CACHE_FILE_PATH, 'utf-8');
    const cachedData: CachedFilterOptions = JSON.parse(fileContent);
    
    const now = Date.now();
    
    // Check if cache is still valid
    if (now < cachedData.expiresAt) {
      return cachedData;
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
}

function saveCachedFilterOptions(data: any, recordCount: number): void {
  try {
    const now = Date.now();
    const cachedData: CachedFilterOptions = {
      data,
      timestamp: now,
      expiresAt: now + CACHE_DURATION_MS,
      lastUpdated: new Date().toISOString(),
      recordCount
    };
    
    // Ensure cache directory exists
    const cacheDir = dirname(CACHE_FILE_PATH);
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    
    writeFileSync(CACHE_FILE_PATH, JSON.stringify(cachedData, null, 2));
  } catch (error) {
    console.error('[CACHE] Error saving cache file:', error);
  }
}

export async function getFilterOptionsWithSupabase() {
  // Check if we have valid cached data
  const cachedData = loadCachedFilterOptions();
  if (cachedData) {
    return cachedData.data;
  }


  
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  
  try {
    // Use proper SQL queries to extract distinct values from the entire database
    // This matches the exact SQL logic provided by the user
    
    // 1. Extract communities using the exact SQL logic provided
    const communitiesQuery = `
      SELECT DISTINCT x.community AS communities
      FROM inventory_unit_preference AS t,
           LATERAL (
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
           ) AS x
      WHERE x.community IS NOT NULL AND x.community != ''
      ORDER BY communities;
    `;

    // 2. Extract property types using similar logic
    const propertyTypesQuery = `
      SELECT DISTINCT x.property_type AS property_types
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
      ORDER BY property_types;
    `;

    // 3. Extract bedrooms using similar logic
    const bedroomsQuery = `
      SELECT DISTINCT x.bedroom AS bedrooms
      FROM inventory_unit_preference AS t,
           LATERAL (
             SELECT UNNEST(
               CASE
                 WHEN t.data->'bedrooms' IS NULL THEN '{}'::numeric[]
                 WHEN jsonb_typeof(t.data->'bedrooms') = 'array' THEN (
                   SELECT array_agg(elem::numeric)
                   FROM jsonb_array_elements_text(t.data->'bedrooms') AS elem
                 )
                 ELSE ARRAY[ (t.data->>'bedrooms')::numeric ]
               END
             ) AS bedroom
           ) AS x
      WHERE x.bedroom IS NOT NULL
      ORDER BY bedrooms;
    `;

    // 4. Extract simple distinct values
    const kindsQuery = `
      SELECT DISTINCT data->>'kind' AS kinds
      FROM inventory_unit_preference
      WHERE data->>'kind' IS NOT NULL AND data->>'kind' != ''
      ORDER BY kinds;
    `;

    const transactionTypesQuery = `
      SELECT DISTINCT data->>'transaction_type' AS transaction_types
      FROM inventory_unit_preference
      WHERE data->>'transaction_type' IS NOT NULL AND data->>'transaction_type' != ''
      ORDER BY transaction_types;
    `;

    // Execute all queries in parallel
    const [communitiesResult, propertyTypesResult, bedroomsResult, kindsResult, transactionTypesResult] = await Promise.allSettled([
      supabase.rpc('exec_sql', { query: communitiesQuery }),
      supabase.rpc('exec_sql', { query: propertyTypesQuery }),
      supabase.rpc('exec_sql', { query: bedroomsQuery }),
      supabase.rpc('exec_sql', { query: kindsQuery }),
      supabase.rpc('exec_sql', { query: transactionTypesQuery })
    ]);

    // Extract values from results, handling both fulfilled and rejected promises
    const communities = (communitiesResult.status === 'fulfilled' ? communitiesResult.value.data?.map((row: any) => row.communities).filter(Boolean) : []) || [];
    const propertyTypes = (propertyTypesResult.status === 'fulfilled' ? propertyTypesResult.value.data?.map((row: any) => row.property_types).filter(Boolean) : []) || [];
    const bedrooms = (bedroomsResult.status === 'fulfilled' ? bedroomsResult.value.data?.map((row: any) => row.bedrooms).filter(Boolean) : []) || [];
    const kinds = (kindsResult.status === 'fulfilled' ? kindsResult.value.data?.map((row: any) => row.kinds).filter(Boolean) : []) || [];
    const transactionTypes = (transactionTypesResult.status === 'fulfilled' ? transactionTypesResult.value.data?.map((row: any) => row.transaction_types).filter(Boolean) : []) || [];

    // Process bedrooms to handle special cases and sorting
    const processedBedrooms = bedrooms
      .map((b: any) => {
        // Handle special cases and edge cases
        if (b === 0 || b === '0' || b === 'studio' || b === 'Studio' || b === 'STUDIO') return 'studio';
        if (b === 0.5 || b === '0.5' || b === 'half') return '0.5';
        if (b === 1.5 || b === '1.5') return '1.5';
        if (b === 2.5 || b === '2.5') return '2.5';
        if (b === 3.5 || b === '3.5') return '3.5';
        if (b === 4.5 || b === '4.5') return '4.5';
        if (b === 5.5 || b === '5.5') return '5.5';
        if (b === 6.5 || b === '6.5') return '6.5';
        if (b === 7.5 || b === '7.5') return '7.5';
        if (b === 8.5 || b === '8.5') return '8.5';
        if (b === 9.5 || b === '9.5') return '9.5';
        if (b === 10.5 || b === '10.5') return '10.5';
        
        // Handle decimal values like 1.23, 2.34, etc.
        const num = parseFloat(b);
        if (!isNaN(num)) {
          // Only accept clean 0.5 increments, reject values like 1.23
          const rounded = Math.round(num * 2) / 2;
          // Only return if it's a clean 0.5 increment (no decimal places beyond 0.5)
          if (rounded === Math.floor(rounded) || rounded === Math.floor(rounded) + 0.5) {
            return rounded.toString();
          }
          // For values like 1.23, round to nearest integer
          return Math.round(num).toString();
        }
        
        return b.toString();
      })
      .filter((value: any, index: number, array: any[]) => {
        // Remove duplicates
        if (array.indexOf(value) !== index) return false;
        
        // Handle special cases
        if (value === 'studio') return true;
        
        // Handle decimal values
        const num = parseFloat(value);
        if (!isNaN(num)) {
          // Accept reasonable bedroom counts (0.5 to 15) and only clean 0.5 increments
          return num >= 0.5 && num <= 15 && (num === Math.floor(num) || num === Math.floor(num) + 0.5);
        }
        
        // Accept string values that might be valid
        return value && value.trim() !== '';
      })
      .sort((a: any, b: any) => {
        // Custom sort: studio first, then numbers
        if (a === 'studio') return -1;
        if (b === 'studio') return 1;
        
        const aNum = parseFloat(a);
        const bNum = parseFloat(b);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        
        // If one is numeric and the other isn't, put numeric first
        if (!isNaN(aNum) && isNaN(bNum)) return -1;
        if (isNaN(aNum) && !isNaN(bNum)) return 1;
        
        // Both are strings, sort alphabetically
        return a.localeCompare(b);
      });



    // If communities < 50 (likely because exec_sql RPC not available) consider it incomplete and throw to activate fallback path
    if (communities.length < 50) {
      throw new Error(`Insufficient communities returned (${communities.length}) – falling back to table scanning method`);
    }

    // Return only actual data from database - no fallbacks
    const finalResult = {
      kinds: kinds,
      transaction_types: transactionTypes,
      property_types: propertyTypes,
      bedrooms: processedBedrooms,
      communities: communities
    };

    // Cache the results
    saveCachedFilterOptions(finalResult, 0);
    
    return finalResult;
    
  } catch (error) {
    console.error('Error in getFilterOptionsWithSupabase:', error);
    
    // If RPC fails, fall back to the previous method with larger sample
    try {
      // Get a count to understand the dataset size
      const { count: totalRecords } = await supabase
        .from('inventory_unit_preference')
        .select('*', { count: 'exact', head: true });

      // Use a much larger sample for better coverage
      const batchSize = 1000; // Supabase row cap per request
      // Determine how many rows we intend to scan. If the count query fails (null/0), fall back to a generous hard cap.
      const totalToProcess = totalRecords && totalRecords > 0 ? Math.min(totalRecords, 250000) : 250000; // Hard cap ≈250 batches

      const kindsSet = new Set<string>();
      const transactionTypesSet = new Set<string>();
      const propertyTypesSet = new Set<string>();
      const bedroomsSet = new Set<string>();
      const communitiesSet = new Set<string>();

      let lastPk: number | null = null;
      let recordsProcessed = 0;

      while (true) {
        let queryBuilder = supabase
          .from('inventory_unit_preference')
          .select('pk,data')
          .order('pk', { ascending: true })
          .limit(batchSize);

        if (lastPk !== null) {
          // Fetch next window
          queryBuilder = queryBuilder.gt('pk', lastPk);
        }

        const { data: batchData, error: batchError } = await queryBuilder;

        if (batchError) {
          throw batchError;
        }

        if (!batchData || batchData.length === 0) {
          break; // All rows processed
        }

        // Update lastPk for next iteration
        lastPk = batchData[batchData.length - 1].pk as number;

        // Process this batch
        batchData.forEach((record: any) => {
          const data = record.data;
          recordsProcessed++;

          if (data?.kind && typeof data.kind === 'string') {
            kindsSet.add(data.kind.trim());
          }
          if (data?.transaction_type && typeof data.transaction_type === 'string') {
            transactionTypesSet.add(data.transaction_type.trim());
          }
          
          // Property types - enhanced handling of both scalar and array values
          const propertyTypes = ensurePropertyTypesArray(data);
          propertyTypes.forEach(type => {
            if (type && typeof type === 'string' && type.trim()) {
                  propertyTypesSet.add(type.trim());
                }
              });
          
          // Bedrooms - enhanced handling with strict validation
          const bedrooms = ensureBedroomsArray(data);
          bedrooms.forEach(bedroom => {
            if (bedroom === 0) {
              bedroomsSet.add('studio');
            } else if (bedroom > 0) {
              bedroomsSet.add(bedroom.toString());
            }
          });
          
          // Communities - enhanced handling of both scalar and array values
          const communities = ensureCommunitiesArray(data);
          communities.forEach(comm => {
                if (comm && typeof comm === 'string' && comm.trim()) {
                  communitiesSet.add(comm.trim());
                }
              });
        });

        // Early stop if processed more than the hard cap
        if (recordsProcessed >= totalToProcess) {
          break;
        }
      }



      // Convert sets to sorted arrays with enhanced processing
      const kindsList = Array.from(kindsSet).sort();
      const transactionTypesList = Array.from(transactionTypesSet).sort();
      const propertyTypesList = Array.from(propertyTypesSet).sort();
      
      // Enhanced bedroom processing with strict validation
      const bedroomsList = Array.from(bedroomsSet)
        .filter(b => {
          // Always include studio
          if (b === 'studio') return true;
          
          // Validate numeric values
          const num = parseFloat(b);
          if (!isNaN(num)) {
            // Only accept reasonable bedroom counts (0.5 to 15) and clean increments
            if (num >= 0.5 && num <= 15) {
            const rounded = Math.round(num * 2) / 2;
              // Only accept whole numbers or clean half increments (0.5, 1.5, 2.5, etc.)
              return rounded === num;
            }
          }
          
          return false;
        })
        // Remove duplicates while preserving order
        .filter((value, index, array) => array.indexOf(value) === index)
        .sort((a, b) => {
          // Custom sort: studio first, then numbers in ascending order
          if (a === 'studio') return -1;
          if (b === 'studio') return 1;
          
          const aNum = parseFloat(a);
          const bNum = parseFloat(b);
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          
          // If one is numeric and the other isn't, put numeric first
          if (!isNaN(aNum) && isNaN(bNum)) return -1;
          if (isNaN(aNum) && !isNaN(bNum)) return 1;
          
          // Both are strings, sort alphabetically
          return a.localeCompare(b);
        });
        
      const communitiesList = Array.from(communitiesSet).sort();

      // Return only actual data from database - no fallbacks
      const finalResult = {
        kinds: kindsList,
        transaction_types: transactionTypesList,
        property_types: propertyTypesList,
        bedrooms: bedroomsList,
        communities: communitiesList
      };

      // Cache the results
      saveCachedFilterOptions(finalResult, totalRecords || 0);
      
      return finalResult;
      
    } catch (fallbackError) {
      console.error('Database query failed:', fallbackError);
      
      // Throw error instead of returning fallback options
      throw new Error(`Failed to retrieve filter options from database: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
    }
  }
}

// Function to manually refresh the cache (can be called via API endpoint)
export async function refreshFilterOptionsCache() {
  // Delete the cache file if it exists
  try {
    if (existsSync(CACHE_FILE_PATH)) {
      const fs = await import('fs');
      fs.unlinkSync(CACHE_FILE_PATH);
    }
  } catch (error) {
    // Silently ignore cache deletion errors
  }
  
  return await getFilterOptionsWithSupabase();
}