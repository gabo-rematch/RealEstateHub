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

  // Start with base query
  let query = supabase
    .from('inventory_unit_preference')
    .select('pk, id, data, updated_at, inventory_unit_pk');

  // Apply filters using PostgREST filter syntax
  if (filters.unit_kind) {
    query = query.eq('data->>kind', filters.unit_kind);
  }

  if (filters.transaction_type) {
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // Handle bedrooms filter (different formats for listing vs client_request)
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b));
    
    if (filters.unit_kind === 'listing') {
      // For listings, bedrooms is a scalar value
      query = query.in('data->>bedrooms', bedroomNumbers);
    } else if (filters.unit_kind === 'client_request') {
      // For client_request, bedrooms is an array - use overlaps operator
      const bedroomArrays = bedroomNumbers.map(n => `[${n}]`);
      query = query.overlaps('data->bedrooms', bedroomArrays);
    } else {
      // When no kind is specified, handle both formats
      query = query.or(`data->>bedrooms.in.(${bedroomNumbers.join(',')}),data->bedrooms.ov.{${bedroomNumbers.map(n => `"${n}"`).join(',')}}`);
    }
  }

  // Handle communities filter (different field names)
  if (filters.communities && filters.communities.length > 0) {
    if (filters.unit_kind === 'listing') {
      // For listings, use 'community' field (scalar)
      query = query.in('data->>community', filters.communities);
    } else if (filters.unit_kind === 'client_request') {
      // For client_request, use 'communities' field (array)
      query = query.overlaps('data->communities', filters.communities);
    } else {
      // When no kind is specified, handle both formats
      const communityConditions = filters.communities.map(c => `data->>community.eq."${c}",data->communities.cs.["${c}"]`).join(',');
      query = query.or(communityConditions);
    }
  }

  // Handle property types
  if (filters.property_type && filters.property_type.length > 0) {
    query = query.overlaps('data->property_type', filters.property_type);
  }

  // Handle budget filters
  if (filters.budget_min) {
    query = query.gte('data->>price_aed', filters.budget_min.toString());
  }

  if (filters.budget_max) {
    query = query.lte('data->>price_aed', filters.budget_max.toString());
  }

  // Handle client budget requests
  if (filters.price_aed) {
    query = query
      .lte('data->>budget_min_aed', filters.price_aed.toString())
      .gte('data->>budget_max_aed', filters.price_aed.toString());
  }

  // Handle area filters
  if (filters.area_sqft_min) {
    query = query.gte('data->>area_sqft', filters.area_sqft_min.toString());
  }

  if (filters.area_sqft_max) {
    query = query.lte('data->>area_sqft', filters.area_sqft_max.toString());
  }

  // Handle boolean filters
  if (filters.is_off_plan !== undefined) {
    query = query.eq('data->>is_off_plan', filters.is_off_plan.toString());
  }

  if (filters.is_distressed_deal !== undefined) {
    query = query.eq('data->>is_distressed_deal', filters.is_distressed_deal.toString());
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