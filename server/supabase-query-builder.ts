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

  console.log('🔍 Query filters received:', JSON.stringify(filters, null, 2));

  // Start with base query including agent details join
  let query = supabase
    .from('inventory_unit_preference')
    .select(`
      pk,
      id,
      data,
      updated_at,
      inventory_unit!inner(
        agent_details
      )
    `)
    .order('updated_at', { ascending: false });

  // A) Bedrooms multiselect - use array contains with OR logic
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b, 10)).filter(b => !isNaN(b));
    if (bedroomNumbers.length > 0) {
      console.log('🛏️ Applying bedrooms contains filter:', bedroomNumbers);
      // Use contains for each bedroom value with OR logic
      const bedroomConditions = bedroomNumbers.map(bedroom => 
        `data->bedrooms.cs.[${bedroom}]`
      );
      query = query.or(bedroomConditions.join(','));
    }
  }

  // B) Communities multiselect - handle both 'communities' and 'community' fields with overlap
  if (filters.communities && filters.communities.length > 0) {
    console.log('🏘️ Applying communities overlap filter:', filters.communities);
    // Use OR to check both communities (array) and community (could be array or scalar)
    const communityOrConditions = filters.communities.map(community => 
      `data->communities.ov.[${community}],data->community.ov.[${community}]`
    );
    query = query.or(communityOrConditions.join(','));
  }

  // C) Transaction type single select
  if (filters.transaction_type) {
    console.log('💼 Applying transaction_type filter:', filters.transaction_type);
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // D) Kind (unit_kind) single select
  if (filters.unit_kind) {
    console.log('🏠 Applying unit_kind filter:', filters.unit_kind);
    query = query.eq('data->>kind', filters.unit_kind);
  }

  // E) Property type multiselect - use array overlap with PostgREST syntax
  if (filters.property_type && filters.property_type.length > 0) {
    console.log('🏢 Applying property_type overlap filter:', filters.property_type);
    query = query.filter('data->property_type', 'ov', filters.property_type);
  }

  // F) Budget filters for listings only (treat 0 as no filter)
  if (filters.budget_min && filters.budget_min > 0) {
    console.log('💰 Applying budget_min filter for listings:', filters.budget_min);
    // Apply only when kind=listing AND price_aed >= budget_min, OR when kind != listing (pass through)
    query = query.or(`and(data->>kind.eq.listing,data->>price_aed.gte.${filters.budget_min}),data->>kind.neq.listing`);
  }

  if (filters.budget_max && filters.budget_max > 0) {
    console.log('💰 Applying budget_max filter for listings:', filters.budget_max);
    // Apply only when kind=listing AND (price_aed <= budget_max OR budget_max_aed = 1), OR when kind != listing
    query = query.or(`and(data->>kind.eq.listing,or(data->>price_aed.lte.${filters.budget_max},data->>budget_max_aed.eq.1)),data->>kind.neq.listing`);
  }

  // G) Listing price for client_requests only (treat 0 as no filter)
  if (filters.price_aed && filters.price_aed > 0) {
    console.log('💰 Applying price_aed filter for client_requests:', filters.price_aed);
    // Apply only when kind=client_request AND (budget_min <= price <= budget_max OR budget_max_aed = 1), OR when kind != client_request
    query = query.or(`and(data->>kind.eq.client_request,and(data->>budget_min_aed.lte.${filters.price_aed},or(data->>budget_max_aed.gte.${filters.price_aed},data->>budget_max_aed.eq.1))),data->>kind.neq.client_request`);
  }

  // H) Area filters (treat 0 as no filter)
  if (filters.area_sqft_min && filters.area_sqft_min > 0) {
    console.log('📐 Applying area_sqft_min filter:', filters.area_sqft_min);
    query = query.gte('data->>area_sqft', filters.area_sqft_min.toString());
  }
  
  if (filters.area_sqft_max && filters.area_sqft_max > 0) {
    console.log('📐 Applying area_sqft_max filter:', filters.area_sqft_max);
    query = query.lte('data->>area_sqft', filters.area_sqft_max.toString());
  }

  // Handle boolean filters with proper null handling
  if (filters.is_off_plan !== undefined) {
    console.log('🏗️ Applying is_off_plan filter:', filters.is_off_plan);
    if (filters.is_off_plan === true) {
      query = query.eq('data->>is_off_plan', 'true');
    } else {
      // When false, include both explicit false and null values
      query = query.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
    }
  }
  
  if (filters.is_distressed_deal !== undefined) {
    console.log('🔥 Applying is_distressed_deal filter:', filters.is_distressed_deal);
    if (filters.is_distressed_deal === true) {
      query = query.eq('data->>is_distressed_deal', 'true');
    } else {
      // When false, include both explicit false and null values
      query = query.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
    }
  }

  // Handle keyword search in message_body_raw
  if (filters.keyword_search && filters.keyword_search.trim()) {
    console.log('🔍 Applying keyword search:', filters.keyword_search);
    query = query.ilike('data->>message_body_raw', `%${filters.keyword_search}%`);
  }

  // Static sanity checks - ensure required fields are not null (following SQL logic)
  query = query
    .not('data->bedrooms', 'is', null)
    .not('data->communities', 'is', null)
    .not('data->>kind', 'is', null)
    .not('data->>transaction_type', 'is', null)
    .not('data->property_type', 'is', null);

  // Handle pagination
  const page = filters.page || 0;
  const pageSize = filters.pageSize || 50;
  const from = page * pageSize;
  const to = from + pageSize - 1;
  
  query = query.range(from, to);

  // Execute query
  const { data, error } = await query;
  
  if (error) {
    console.error('Supabase query error:', error);
    throw new Error(`Supabase query error: ${error.message}`);
  }

  console.log(`Query returned ${data?.length || 0} properties`);
  return data || [];
}

export async function getFilterOptionsWithSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  try {
    // Get all data to process filter options with sanity checks
    const { data, error } = await supabase
      .from('inventory_unit_preference')
      .select('data')
      .not('data->bedrooms', 'is', null)
      .not('data->communities', 'is', null)
      .not('data->>kind', 'is', null)
      .not('data->>transaction_type', 'is', null)
      .not('data->property_type', 'is', null)
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
      
      // Extract property types (always arrays based on SQL)
      if (jsonData?.property_type) {
        if (Array.isArray(jsonData.property_type)) {
          jsonData.property_type.forEach((pt: string) => pt && propertyTypes.add(pt));
        } else if (typeof jsonData.property_type === 'string') {
          propertyTypes.add(jsonData.property_type);
        }
      }
      
      // Extract bedrooms (always arrays based on SQL)
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
      
      // Extract communities from both 'communities' and 'community' fields (as per SQL)
      if (jsonData?.communities) {
        if (Array.isArray(jsonData.communities)) {
          jsonData.communities.forEach((c: string) => c && c !== 'null' && communities.add(c));
        } else {
          communities.add(jsonData.communities);
        }
      }
      if (jsonData?.community && jsonData.community !== 'null') {
        if (Array.isArray(jsonData.community)) {
          jsonData.community.forEach((c: string) => c && communities.add(c));
        } else {
          communities.add(jsonData.community);
        }
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