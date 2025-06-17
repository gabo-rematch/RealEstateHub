import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? 
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

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
}

export async function queryPropertiesWithSupabase(filters: FilterParams) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Use RPC call to execute the complex filtering logic similar to the provided SQL
  const { data, error } = await supabase.rpc('filter_properties_advanced', {
    p_unit_kind: filters.unit_kind || null,
    p_transaction_type: filters.transaction_type || null,
    p_bedrooms: filters.bedrooms || [],
    p_communities: filters.communities || [],
    p_property_type: filters.property_type || [],
    p_budget_min: filters.budget_min || null,
    p_budget_max: filters.budget_max || null,
    p_price_aed: filters.price_aed || null,
    p_area_sqft_min: filters.area_sqft_min || null,
    p_area_sqft_max: filters.area_sqft_max || null,
    p_is_off_plan: filters.is_off_plan === undefined ? null : (filters.is_off_plan ? 'off-plan' : 'ready'),
    p_is_distressed_deal: filters.is_distressed_deal === undefined ? null : (filters.is_distressed_deal ? 'distressed' : 'market'),
    p_keyword_search: filters.keyword_search || null,
    p_page: filters.page || 0,
    p_page_size: filters.pageSize || 50
  });

  if (error) {
    console.log('RPC call failed, falling back to basic filtering:', error.message);
    
    // Fallback to basic PostgREST filtering if RPC fails
    return await queryPropertiesWithBasicFiltering(filters);
  }

  return data || [];
}

async function queryPropertiesWithBasicFiltering(filters: FilterParams) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Start with base query including the join to get agent details
  let query = supabase
    .from('inventory_unit_preference')
    .select(`
      pk,
      id,
      data,
      updated_at,
      inventory_unit:inventory_unit_pk(agent_details)
    `);

  // Apply basic sanity checks - only include records with essential fields
  query = query.not('data->>kind', 'is', null)
    .not('data->>transaction_type', 'is', null);

  // Apply filters using PostgREST filter syntax with array overlap operator
  if (filters.unit_kind) {
    query = query.eq('data->>kind', filters.unit_kind);
  }

  if (filters.transaction_type) {
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // Handle bedrooms filter for both scalar and array formats
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b)).filter(n => !isNaN(n));
    
    if (bedroomNumbers.length > 0) {
      // Create conditions for both scalar and array bedrooms using OR logic
      const bedroomConditions = [];
      
      // For scalar bedrooms (common in listings)
      bedroomConditions.push(...bedroomNumbers.map(n => `data->>bedrooms.eq.${n}`));
      
      // For array bedrooms (common in client_requests) - use contains operator
      bedroomConditions.push(...bedroomNumbers.map(n => `data->bedrooms.cs.[${n}]`));
      
      // Include null handling
      bedroomConditions.push('data->>bedrooms.is.null', 'data->bedrooms.is.null');
      
      query = query.or(bedroomConditions.join(','));
    }
  }

  // Handle communities filter for both 'community' and 'communities' fields
  if (filters.communities && filters.communities.length > 0) {
    const validCommunities = filters.communities.filter(c => c && c !== 'null');
    
    if (validCommunities.length > 0) {
      // Use a simpler approach with individual filters
      if (validCommunities.length === 1) {
        const community = validCommunities[0];
        query = query.or(`data->>community.eq."${community}",data->communities.cs.["${community}"]`);
      } else {
        // For multiple communities, check each one individually
        const orConditions = validCommunities.flatMap(community => [
          `data->>community.eq."${community}"`,
          `data->communities.cs.["${community}"]`
        ]);
        query = query.or(orConditions.join(','));
      }
    }
  }

  // Handle property types using contains operator
  if (filters.property_type && filters.property_type.length > 0) {
    const validTypes = filters.property_type.filter(t => t && t !== 'null');
    if (validTypes.length > 0) {
      const typeConditions = validTypes.map(t => `data->property_type.cs.["${t}"]`);
      query = query.or(typeConditions.join(','));
    }
  }

  // Handle area filters with null value inclusion
  if (filters.area_sqft_min && filters.area_sqft_max) {
    query = query.or(`and(data->>area_sqft.gte.${filters.area_sqft_min},data->>area_sqft.lte.${filters.area_sqft_max}),data->>area_sqft.is.null`);
  } else if (filters.area_sqft_min) {
    query = query.or(`data->>area_sqft.gte.${filters.area_sqft_min},data->>area_sqft.is.null`);
  } else if (filters.area_sqft_max) {
    query = query.or(`data->>area_sqft.lte.${filters.area_sqft_max},data->>area_sqft.is.null`);
  }

  // Handle price filters based on property kind with proper null handling
  if (filters.unit_kind === 'listing') {
    // For listings, filter by price_aed within budget range
    if (filters.budget_min && filters.budget_max) {
      query = query.or(`and(data->>price_aed.gte.${filters.budget_min},data->>price_aed.lte.${filters.budget_max}),data->>price_aed.is.null,data->>price_aed.eq.1`);
    } else if (filters.budget_min) {
      query = query.or(`data->>price_aed.gte.${filters.budget_min},data->>price_aed.is.null,data->>price_aed.eq.1`);
    } else if (filters.budget_max) {
      query = query.or(`data->>price_aed.lte.${filters.budget_max},data->>price_aed.is.null,data->>price_aed.eq.1`);
    }
  } else if (filters.unit_kind === 'client_request') {
    // For client_request, check if listing price falls within budget range
    if (filters.price_aed && filters.price_aed > 0) {
      query = query.or(`and(data->>budget_min_aed.lte.${filters.price_aed},data->>budget_max_aed.gte.${filters.price_aed}),data->>budget_min_aed.is.null,data->>budget_max_aed.is.null,data->>budget_max_aed.eq.1`);
    }
  } else {
    // When no kind is specified, handle both scenarios
    if (filters.budget_min && filters.budget_min > 0) {
      query = query.or(`data->>price_aed.gte.${filters.budget_min},data->>price_aed.is.null,data->>price_aed.eq.1`);
    }
    if (filters.budget_max && filters.budget_max > 0) {
      query = query.or(`data->>price_aed.lte.${filters.budget_max},data->>price_aed.is.null,data->>price_aed.eq.1`);
    }
    if (filters.price_aed && filters.price_aed > 0) {
      query = query.or(`and(data->>budget_min_aed.lte.${filters.price_aed},data->>budget_max_aed.gte.${filters.price_aed}),data->>budget_min_aed.is.null,data->>budget_max_aed.is.null,data->>budget_max_aed.eq.1`);
    }
  }

  // Handle boolean filters with three-state logic
  if (filters.is_off_plan === true) {
    query = query.eq('data->>is_off_plan', true);
  } else if (filters.is_off_plan === false) {
    query = query.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null,data->>is_off_plan.neq.true');
  }

  if (filters.is_distressed_deal === true) {
    query = query.eq('data->>is_distressed_deal', true);
  } else if (filters.is_distressed_deal === false) {
    query = query.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null,data->>is_distressed_deal.neq.true');
  }

  // Handle keyword search
  if (filters.keyword_search) {
    query = query.ilike('data->>message_body_raw', `%${filters.keyword_search}%`);
  }

  // Apply ordering and pagination
  query = query.order('updated_at', { ascending: false });

  if (filters.pageSize) {
    query = query.limit(filters.pageSize);
  }

  if (filters.page && filters.pageSize) {
    const offset = filters.page * filters.pageSize;
    query = query.range(offset, offset + filters.pageSize - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error('PostgREST query error:', error);
    console.error('Query details:', query);
    throw new Error(`Supabase query error: ${error.message}`);
  }

  return data || [];
}

export async function getFilterOptionsWithSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  try {
    // Get all data to process filter options
    const { data, error } = await supabase
      .from('inventory_unit_preference')
      .select('data')
      .limit(5000);

    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }

    const kinds = new Set<string>();
    const transactionTypes = new Set<string>();
    const propertyTypes = new Set<string>();
    const bedrooms = new Set<number>();
    const communities = new Set<string>();

    data?.forEach(row => {
      const jsonData = row.data;
      
      // Extract kinds
      if (jsonData?.kind) {
        kinds.add(jsonData.kind);
      }
      
      // Extract transaction types
      if (jsonData?.transaction_type) {
        transactionTypes.add(jsonData.transaction_type);
      }
      
      // Extract property types
      if (jsonData?.property_type) {
        if (Array.isArray(jsonData.property_type)) {
          jsonData.property_type.forEach((pt: string) => pt && propertyTypes.add(pt));
        } else if (typeof jsonData.property_type === 'string') {
          propertyTypes.add(jsonData.property_type);
        }
      }
      
      // Extract bedrooms
      if (jsonData?.bedrooms !== undefined) {
        if (Array.isArray(jsonData.bedrooms)) {
          jsonData.bedrooms.forEach((b: any) => {
            const num = parseInt(b);
            if (!isNaN(num)) bedrooms.add(num);
          });
        } else {
          const num = parseInt(jsonData.bedrooms);
          if (!isNaN(num)) bedrooms.add(num);
        }
      }
      
      // Extract communities from both fields
      if (jsonData?.communities) {
        if (Array.isArray(jsonData.communities)) {
          jsonData.communities.forEach((c: string) => c && c !== 'null' && communities.add(c));
        }
      }
      if (jsonData?.community && jsonData.community !== 'null') {
        communities.add(jsonData.community);
      }
    });

    return {
      kinds: Array.from(kinds).filter(Boolean).sort(),
      transactionTypes: Array.from(transactionTypes).filter(Boolean).sort(),
      propertyTypes: Array.from(propertyTypes).filter(Boolean).sort(),
      bedrooms: Array.from(bedrooms).sort((a, b) => a - b),
      communities: Array.from(communities).filter(Boolean).sort()
    };
  } catch (error) {
    console.error('Error getting filter options:', error);
    throw error;
  }
}