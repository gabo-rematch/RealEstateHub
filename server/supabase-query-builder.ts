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

  // Start with base query
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

  // Apply filters based on SQL guide logic

  // A) Kind (unit_kind) filter - required for conditional logic
  if (filters.unit_kind) {
    console.log('🏠 Applying unit_kind filter:', filters.unit_kind);
    query = query.eq('data->>kind', filters.unit_kind);
  }

  // B) Transaction type filter  
  if (filters.transaction_type) {
    console.log('💼 Applying transaction_type filter:', filters.transaction_type);
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // C) Bedrooms multiselect - handle both scalar and array formats
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b, 10)).filter(b => !isNaN(b));
    if (bedroomNumbers.length > 0) {
      console.log('🛏️ Applying bedrooms filter:', bedroomNumbers);
      if (bedroomNumbers.length === 1) {
        const bedroom = bedroomNumbers[0];
        // Handle both scalar and array formats with OR
        query = query.or(`data->bedrooms.cs.[${bedroom}],data->>bedrooms.eq.${bedroom}`);
      } else {
        // Multiple bedrooms - use OR for each value in both formats
        const bedroomConditions = bedroomNumbers.flatMap(bedroom => [
          `data->bedrooms.cs.[${bedroom}]`,  // Array format
          `data->>bedrooms.eq.${bedroom}`    // Scalar format
        ]);
        query = query.or(bedroomConditions.join(','));
      }
    }
  }

  // D) Property type multiselect - handle both scalar and array formats
  if (filters.property_type && filters.property_type.length > 0) {
    console.log('🏢 Applying property_type filter:', filters.property_type);
    if (filters.property_type.length === 1) {
      const propertyType = filters.property_type[0];
      // Handle both scalar and array formats with OR
      query = query.or(`data->property_type.cs.["${propertyType}"],data->>property_type.eq.${propertyType}`);
    } else {
      // Multiple property types - use OR for each value in both formats
      const propertyTypeConditions = filters.property_type.flatMap(propertyType => [
        `data->property_type.cs.["${propertyType}"]`,  // Array format
        `data->>property_type.eq.${propertyType}`      // Scalar format
      ]);
      query = query.or(propertyTypeConditions.join(','));
    }
  }

  // E) Communities multiselect - handle both communities and community fields
  if (filters.communities && filters.communities.length > 0) {
    console.log('🏘️ Applying communities filter:', filters.communities);
    // Handle both 'communities' array and 'community' scalar fields
    if (filters.communities.length === 1) {
      const community = filters.communities[0];
      // Check both communities (array) and community (scalar) fields
      query = query.or(`data->communities.cs.${JSON.stringify([community])},data->>community.eq.${JSON.stringify(community)}`);
    } else {
      // For multiple communities, check both fields for each community
      const orConditions = filters.communities.flatMap(community => [
        `data->communities.cs.${JSON.stringify([community])}`,
        `data->>community.eq.${JSON.stringify(community)}`
      ]).join(',');
      query = query.or(orConditions);
    }
  }

  // F) Budget filters for listings (treat 0 as no filter)
  if (filters.budget_min && filters.budget_min > 0) {
    console.log('💰 Applying budget_min filter:', filters.budget_min);
    // Apply only to listings
    if (filters.unit_kind === 'listing') {
      query = query.gte('data->>price_aed', filters.budget_min.toString());
    }
  }

  if (filters.budget_max && filters.budget_max > 0) {
    console.log('💰 Applying budget_max filter:', filters.budget_max);
    // Apply only to listings
    if (filters.unit_kind === 'listing') {
      query = query.lte('data->>price_aed', filters.budget_max.toString());
    }
  }

  // G) Price filter for client_requests (treat 0 as no filter)
  if (filters.price_aed && filters.price_aed > 0) {
    console.log('💰 Applying price_aed filter:', filters.price_aed);
    // Apply only to client_requests - price should be within budget range
    if (filters.unit_kind === 'client_request') {
      query = query
        .lte('data->>budget_min_aed', filters.price_aed.toString())
        .gte('data->>budget_max_aed', filters.price_aed.toString());
    }
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

  // I) Boolean filters with null handling
  if (filters.is_off_plan !== undefined) {
    console.log('🏗️ Applying is_off_plan filter:', filters.is_off_plan);
    if (filters.is_off_plan === true) {
      query = query.eq('data->>is_off_plan', 'true');
    } else {
      // Include false and null values
      query = query.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
    }
  }
  
  if (filters.is_distressed_deal !== undefined) {
    console.log('🔥 Applying is_distressed_deal filter:', filters.is_distressed_deal);
    if (filters.is_distressed_deal === true) {
      query = query.eq('data->>is_distressed_deal', 'true');
    } else {
      // Include false and null values  
      query = query.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
    }
  }

  // J) Keyword search
  if (filters.keyword_search && filters.keyword_search.trim()) {
    console.log('🔍 Applying keyword search:', filters.keyword_search);
    query = query.ilike('data->>message_body_raw', `%${filters.keyword_search}%`);
  }

  // Static sanity checks - ensure required fields exist (removed communities check)
  query = query
    .not('data->bedrooms', 'is', null)
    .not('data->>kind', 'is', null)
    .not('data->>transaction_type', 'is', null)
    .not('data->property_type', 'is', null);

  // Pagination
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
    const { data, error } = await supabase
      .from('inventory_unit_preference')
      .select('data')
      .not('data->bedrooms', 'is', null)
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
      
      if (jsonData?.kind) {
        kinds.add(jsonData.kind);
      }
      
      if (jsonData?.transaction_type) {
        transactionTypes.add(jsonData.transaction_type);
      }
      
      if (jsonData?.property_type) {
        if (Array.isArray(jsonData.property_type)) {
          jsonData.property_type.forEach((pt: string) => pt && propertyTypes.add(pt));
        } else if (typeof jsonData.property_type === 'string') {
          propertyTypes.add(jsonData.property_type);
        }
      }
      
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
        } else {
          communities.add(jsonData.communities);
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