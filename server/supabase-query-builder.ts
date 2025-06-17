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
    .select('pk, id, data, updated_at, inventory_unit_pk');

  // Apply basic filters with AND logic
  if (filters.unit_kind) {
    query = query.eq('data->>kind', filters.unit_kind);
  }

  if (filters.transaction_type) {
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // Handle bedrooms filter - Apply as individual contains checks to avoid complex OR syntax
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b)).filter(n => !isNaN(n));
    console.log('🛏️ Bedroom numbers to filter:', bedroomNumbers);
    
    if (bedroomNumbers.length > 0 && bedroomNumbers.length === 1) {
      const bedroom = bedroomNumbers[0];
      if (filters.unit_kind === 'client_request') {
        // For client_request, use @> operator for array contains
        console.log('🔍 Applying contains filter for client_request bedrooms:', bedroom);
        query = query.filter('data->bedrooms', 'cs', JSON.stringify([bedroom]));
      } else if (filters.unit_kind === 'listing') {
        // For listings, check scalar bedroom value
        console.log('🔍 Applying eq filter for listing bedrooms:', bedroom);
        query = query.eq('data->>bedrooms', bedroom);
      }
    }
  }

  // Handle property types - Different logic for listings vs client_requests
  if (filters.property_type && filters.property_type.length > 0) {
    const validTypes = filters.property_type.filter(t => t && t !== 'null');
    console.log('🏠 Property types to filter:', validTypes);
    
    if (validTypes.length > 0 && validTypes.length === 1) {
      const propertyType = validTypes[0];
      
      // For all property types, use array contains logic since property_type appears to be arrays
      console.log('🔍 Applying property_type contains filter:', propertyType);
      query = query.filter('data->property_type', 'cs', JSON.stringify([propertyType]));
    }
  }

  // Handle communities filter (different field names)
  if (filters.communities && filters.communities.length > 0) {
    const validCommunities = filters.communities.filter(c => c && c !== 'null');
    
    if (validCommunities.length > 0) {
      if (filters.unit_kind === 'listing') {
        // For listings, use 'community' field (scalar)
        query = query.in('data->>community', validCommunities);
      } else if (filters.unit_kind === 'client_request') {
        // For client_request, use 'communities' field (array)
        if (validCommunities.length === 1) {
          query = query.contains('data->communities', [validCommunities[0]]);
        }
      }
    }
  }

  // Handle area filters (simplified - no complex OR logic for now)
  if (filters.area_sqft_min) {
    query = query.gte('data->>area_sqft', filters.area_sqft_min);
  }
  if (filters.area_sqft_max) {
    query = query.lte('data->>area_sqft', filters.area_sqft_max);
  }

  // Handle price filters (simplified - basic range checks only)
  if (filters.unit_kind === 'listing') {
    if (filters.budget_min) {
      query = query.gte('data->>price_aed', filters.budget_min);
    }
    if (filters.budget_max) {
      query = query.lte('data->>price_aed', filters.budget_max);
    }
  } else if (filters.unit_kind === 'client_request' && filters.price_aed) {
    query = query.lte('data->>budget_min_aed', filters.price_aed);
    query = query.gte('data->>budget_max_aed', filters.price_aed);
  }

  // Handle boolean filters (simplified)
  if (filters.is_off_plan === true) {
    query = query.eq('data->>is_off_plan', true);
  }
  if (filters.is_distressed_deal === true) {
    query = query.eq('data->>is_distressed_deal', true);
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
    throw new Error(`Supabase query error: ${error.message}`);
  }

  // Debug: Log a sample of the returned data to understand structure
  if (data && data.length > 0) {
    if (filters.unit_kind === 'client_request' && filters.bedrooms?.includes('1')) {
      console.log('🔍 Sample client_request data:', data.slice(0, 2).map(item => ({
        pk: item.pk,
        bedrooms: item.data?.bedrooms,
        property_type: item.data?.property_type,
        kind: item.data?.kind,
        transaction_type: item.data?.transaction_type
      })));
    } else if (filters.unit_kind === 'listing' && filters.property_type?.length > 0) {
      console.log('🔍 Sample listing data with property_type:', data.slice(0, 2).map(item => ({
        pk: item.pk,
        bedrooms: item.data?.bedrooms,
        property_type: item.data?.property_type,
        kind: item.data?.kind,
        transaction_type: item.data?.transaction_type
      })));
    }
  }

  console.log(`Query returned ${data?.length || 0} properties`);
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