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

  // Build a single complex filter string to handle all conditions with proper AND/OR logic
  let filterConditions: string[] = [];

  // Basic filters (always AND logic)
  if (filters.unit_kind) {
    filterConditions.push(`data->>kind.eq.${filters.unit_kind}`);
  }

  if (filters.transaction_type) {
    filterConditions.push(`data->>transaction_type.eq.${filters.transaction_type}`);
  }

  // Bedrooms filter with proper OR logic within the condition
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const bedroomNumbers = filters.bedrooms.map(b => parseInt(b)).filter(n => !isNaN(n));
    console.log('🛏️ Bedroom numbers to filter:', bedroomNumbers);
    
    if (bedroomNumbers.length > 0) {
      let bedroomCondition: string;
      
      if (filters.unit_kind === 'client_request') {
        // For client_request, bedrooms is an array
        const arrayChecks = bedroomNumbers.map(n => `data->bedrooms.cs.[${n}]`);
        bedroomCondition = `(${arrayChecks.join(',')},data->bedrooms.is.null,data->bedrooms.cs.[111])`;
      } else if (filters.unit_kind === 'listing') {
        // For listings, bedrooms is a scalar
        const scalarChecks = bedroomNumbers.map(n => `data->>bedrooms.eq.${n}`);
        bedroomCondition = `(${scalarChecks.join(',')},data->>bedrooms.is.null,data->>bedrooms.eq.111)`;
      } else {
        // When no kind specified, handle both formats
        const scalarChecks = bedroomNumbers.map(n => `data->>bedrooms.eq.${n}`);
        const arrayChecks = bedroomNumbers.map(n => `data->bedrooms.cs.[${n}]`);
        bedroomCondition = `(${scalarChecks.join(',')},${arrayChecks.join(',')},data->>bedrooms.is.null,data->bedrooms.is.null,data->>bedrooms.eq.111,data->bedrooms.cs.[111])`;
      }
      
      console.log('🛏️ Bedroom filter condition:', bedroomCondition);
      filterConditions.push(`or${bedroomCondition}`);
    }
  }

  // Property type filter with proper OR logic within the condition  
  if (filters.property_type && filters.property_type.length > 0) {
    const validTypes = filters.property_type.filter(t => t && t !== 'null');
    console.log('🏠 Property types to filter:', validTypes);
    
    if (validTypes.length > 0) {
      const typeChecks = validTypes.map(t => `data->property_type.cs.["${t}"]`);
      const propertyTypeCondition = `(${typeChecks.join(',')})`;
      console.log('🏠 Property type filter condition:', propertyTypeCondition);
      filterConditions.push(`or${propertyTypeCondition}`);
    }
  }

  // Start with base query
  let query = supabase
    .from('inventory_unit_preference')
    .select('pk, id, data, updated_at, inventory_unit_pk');

  // Apply all filters
  filterConditions.forEach(condition => {
    if (condition.startsWith('or(')) {
      query = query.or(condition.substring(2)); // Remove 'or' prefix
    } else {
      // Handle basic eq filters
      const [field, operator, value] = condition.split('.');
      if (operator === 'eq') {
        query = query.eq(field, value);
      }
    }
  });

  // Handle communities filter (different field names)
  if (filters.communities && filters.communities.length > 0) {
    const validCommunities = filters.communities.filter(c => c && c !== 'null');
    
    if (validCommunities.length > 0) {
      if (filters.unit_kind === 'listing') {
        // For listings, use 'community' field (scalar)
        query = query.in('data->>community', validCommunities);
      } else if (filters.unit_kind === 'client_request') {
        // For client_request, use 'communities' field (array)
        const orConditions = validCommunities.map(c => `data->communities.cs.["${c}"]`).join(',');
        query = query.or(orConditions);
      } else {
        // When no kind is specified, handle both formats
        const scalarConditions = validCommunities.map(c => `data->>community.eq."${c}"`).join(',');
        const arrayConditions = validCommunities.map(c => `data->communities.cs.["${c}"]`).join(',');
        query = query.or(`${scalarConditions},${arrayConditions}`);
      }
    }
  }

  // Handle property types - use direct contains check for each type
  if (filters.property_type && filters.property_type.length > 0) {
    const validTypes = filters.property_type.filter(t => t && t !== 'null');
    console.log('🏠 Property types to filter:', validTypes);
    if (validTypes.length > 0) {
      // For multiple property types, we need ANY of them to match (OR logic within property types)
      if (validTypes.length === 1) {
        // Single property type - use direct filter
        console.log('🔍 Single property type filter:', `data->property_type.cs.[${validTypes[0]}]`);
        query = query.filter('data->property_type', 'cs', `[${validTypes[0]}]`);
      } else {
        // Multiple property types - use OR logic
        const orConditions = validTypes.map(t => `data->property_type.cs.["${t}"]`).join(',');
        console.log('🔍 Multiple property type filter:', orConditions);
        query = query.or(orConditions);
      }
    }
  }

  // Handle area filters - area_sqft should be between area min and area max filters (inclusive)
  // Include null values and treat 111 as null/unknown for area
  if (filters.area_sqft_min && filters.area_sqft_max) {
    // When both min and max are specified, use AND logic for the range but OR for null values
    query = query.or(`and(data->>area_sqft.gte.${filters.area_sqft_min},data->>area_sqft.lte.${filters.area_sqft_max}),data->>area_sqft.is.null,data->>area_sqft.eq.111`);
  } else if (filters.area_sqft_min) {
    query = query.or(`data->>area_sqft.gte.${filters.area_sqft_min},data->>area_sqft.is.null,data->>area_sqft.eq.111`);
  } else if (filters.area_sqft_max) {
    query = query.or(`data->>area_sqft.lte.${filters.area_sqft_max},data->>area_sqft.is.null,data->>area_sqft.eq.111`);
  }

  // Handle price filters based on property kind
  // For kind = listing: price_aed should be between price range min and max (inclusive)
  // For kind = client_request: listing price should be between budget_min_aed and budget_max_aed
  if (filters.unit_kind === 'listing') {
    // For listings, filter by price_aed within budget_min to budget_max range
    if (filters.budget_min && filters.budget_max) {
      query = query.or(`and(data->>price_aed.gte.${filters.budget_min},data->>price_aed.lte.${filters.budget_max}),data->>price_aed.is.null,data->>price_aed.eq.1`);
    } else if (filters.budget_min) {
      query = query.or(`data->>price_aed.gte.${filters.budget_min},data->>price_aed.is.null,data->>price_aed.eq.1`);
    } else if (filters.budget_max) {
      query = query.or(`data->>price_aed.lte.${filters.budget_max},data->>price_aed.is.null,data->>price_aed.eq.1`);
    }
  } else if (filters.unit_kind === 'client_request') {
    // For client_request, filter by price_aed (listing price) within budget_min_aed to budget_max_aed range
    if (filters.price_aed) {
      query = query.or(`and(data->>budget_min_aed.lte.${filters.price_aed},data->>budget_max_aed.gte.${filters.price_aed}),data->>budget_min_aed.is.null,data->>budget_max_aed.is.null,data->>budget_min_aed.eq.1,data->>budget_max_aed.eq.1`);
    }
  } else {
    // When no kind is specified, handle both scenarios
    if (filters.budget_min || filters.budget_max) {
      // Apply listing logic for properties that might be listings
      if (filters.budget_min && filters.budget_max) {
        query = query.or(`and(data->>price_aed.gte.${filters.budget_min},data->>price_aed.lte.${filters.budget_max}),data->>price_aed.is.null,data->>price_aed.eq.1`);
      } else if (filters.budget_min) {
        query = query.or(`data->>price_aed.gte.${filters.budget_min},data->>price_aed.is.null,data->>price_aed.eq.1`);
      } else if (filters.budget_max) {
        query = query.or(`data->>price_aed.lte.${filters.budget_max},data->>price_aed.is.null,data->>price_aed.eq.1`);
      }
    }
    
    if (filters.price_aed) {
      // Apply client_request logic for properties that might be client requests
      query = query.or(`and(data->>budget_min_aed.lte.${filters.price_aed},data->>budget_max_aed.gte.${filters.price_aed}),data->>budget_min_aed.is.null,data->>budget_max_aed.is.null,data->>budget_min_aed.eq.1,data->>budget_max_aed.eq.1`);
    }
  }

  // Handle boolean filters - when clicked (true), only show TRUE values; when not clicked, show everything else
  if (filters.is_off_plan === true) {
    query = query.eq('data->>is_off_plan', 'true');
  } else if (filters.is_off_plan === false) {
    query = query.or('data->>is_off_plan.eq.false,data->>is_off_plan.is.null');
  }

  if (filters.is_distressed_deal === true) {
    query = query.eq('data->>is_distressed_deal', 'true');
  } else if (filters.is_distressed_deal === false) {
    query = query.or('data->>is_distressed_deal.eq.false,data->>is_distressed_deal.is.null');
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