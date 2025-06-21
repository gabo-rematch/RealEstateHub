import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured');
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

function escapePostgRESTString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
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
}

export async function queryPropertiesWithSupabase(filters: FilterParams) {
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

  // Handle bedrooms filtering for both scalar and array formats
  if (filters.bedrooms && filters.bedrooms.length > 0) {
    const validBedrooms = filters.bedrooms.filter(b => b && b !== 'null');
    if (validBedrooms.length > 0) {
      // Create conditions for both scalar and array bedrooms
      const bedroomConditions: string[] = [];
      
      validBedrooms.forEach(bedroom => {
        // For scalar bedrooms field - need quotes for string values
        bedroomConditions.push(`data->>bedrooms.eq."${bedroom}"`);
        // For array bedrooms field
        bedroomConditions.push(`data->bedrooms.cs.${JSON.stringify([parseInt(bedroom)])}`);
      });
      
      query = query.or(bedroomConditions.join(','));
    }
  }

  // Handle communities filtering with array overlap - handle both community (scalar) and communities (array) fields
  if (filters.communities && filters.communities.length > 0) {
    const validCommunities = filters.communities.filter(c => c && c !== 'null');
    if (validCommunities.length > 0) {
      // Create conditions for both field names and data types
      const communityConditions: string[] = [];
      
      validCommunities.forEach(community => {
        // For scalar 'community' field (used in listings)
        communityConditions.push(`data->>community.eq.${escapePostgRESTString(community)}`);
        // For scalar 'communities' field
        communityConditions.push(`data->>communities.eq.${escapePostgRESTString(community)}`);
        // For array 'communities' field - check if array contains the community
        communityConditions.push(`data->communities.cs.${JSON.stringify([community])}`);
      });
      
      query = query.or(communityConditions.join(','));
    }
  }

  // Handle property types using both scalar and array formats
  if (filters.property_type && filters.property_type.length > 0) {
    const validTypes = filters.property_type.filter(t => t && t !== 'null');
    if (validTypes.length > 0) {
      // Create conditions for both scalar and array property types
      const typeConditions: string[] = [];
      
      validTypes.forEach(type => {
        // For scalar property_type field - need quotes for string values
        typeConditions.push(`data->>property_type.eq."${type}"`);
        // For array property_type field
        typeConditions.push(`data->property_type.cs.${JSON.stringify([type])}`);
      });
      
      query = query.or(typeConditions.join(','));
    }
  }

  // Skip numeric filtering in PostgREST query - will handle in post-processing

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
  if (filters.keyword_search && filters.keyword_search.trim()) {
    const searchTerm = filters.keyword_search.trim();
    query = query.ilike('data->>message_body_raw', `%${searchTerm}%`);
  }

  // Apply pagination
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

  // Apply numeric filtering in post-processing since PostgREST has issues with JSON numeric comparisons
  let filteredData = data || [];
  
  if (filters.unit_kind === 'listing') {
    // For listings: filter by price_aed within budget range
    if (filters.budget_min || filters.budget_max) {
      filteredData = filteredData.filter(item => {
        const price = item.data?.price_aed;
        if (price === null || price === undefined) return true; // Include null values
        const numericPrice = typeof price === 'number' ? price : parseFloat(price);
        if (isNaN(numericPrice)) return true; // Include invalid numbers
        
        let withinRange = true;
        if (filters.budget_min) withinRange = withinRange && numericPrice >= filters.budget_min;
        if (filters.budget_max) withinRange = withinRange && numericPrice <= filters.budget_max;
        return withinRange;
      });
    }
  }

  // Apply area filtering
  if (filters.area_sqft_min || filters.area_sqft_max) {
    filteredData = filteredData.filter(item => {
      const area = item.data?.area_sqft;
      if (area === null || area === undefined) return true; // Include null values
      const numericArea = typeof area === 'number' ? area : parseFloat(area);
      if (isNaN(numericArea)) return true; // Include invalid numbers
      
      let withinRange = true;
      if (filters.area_sqft_min) withinRange = withinRange && numericArea >= filters.area_sqft_min;
      if (filters.area_sqft_max) withinRange = withinRange && numericArea <= filters.area_sqft_max;
      return withinRange;
    });
  }

  console.log(`Query returned ${filteredData?.length || 0} properties`);
  return filteredData;
}

export async function getFilterOptionsWithSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await supabase
    .from('inventory_unit_preference')
    .select('data')
    .not('data->>kind', 'is', null)
    .not('data->>transaction_type', 'is', null);

  if (error) {
    console.error('Error fetching filter options:', error);
    throw new Error(`Supabase query error: ${error.message}`);
  }

  const kinds = new Set<string>();
  const transactionTypes = new Set<string>();
  const propertyTypes = new Set<string>();
  const bedrooms = new Set<string>();

  data?.forEach((item: any) => {
    const record = item.data;
    if (record.kind) kinds.add(record.kind);
    if (record.transaction_type) transactionTypes.add(record.transaction_type);
    
    // Handle both scalar and array property types
    if (record.property_type) {
      if (Array.isArray(record.property_type)) {
        record.property_type.forEach((type: string) => propertyTypes.add(type));
      } else {
        propertyTypes.add(record.property_type);
      }
    }
    
    // Handle both scalar and array bedrooms
    if (record.bedrooms) {
      if (Array.isArray(record.bedrooms)) {
        record.bedrooms.forEach((bedroom: number) => bedrooms.add(bedroom.toString()));
      } else {
        bedrooms.add(record.bedrooms.toString());
      }
    }
  });

  // Use predefined UAE communities list instead of extracting from database
  const predefinedCommunities = [
    "Al Barsha",
    "Al Furjan",
    "Al Garhoud",
    "Al Jaddaf",
    "Al Karama",
    "Al Khail Gate",
    "Al Mizhar",
    "Al Qusais",
    "Al Reef",
    "Al Satwa",
    "Al Sufouh",
    "Al Wasl",
    "Arabian Ranches",
    "Barsha Heights",
    "Business Bay",
    "City Walk",
    "Culture Village",
    "DAMAC Hills",
    "DAMAC Hills 2",
    "DIFC",
    "Discovery Gardens",
    "Downtown Dubai",
    "Dubai Creek Harbour",
    "Dubai Festival City",
    "Dubai Hills Estate",
    "Dubai Investment Park",
    "Dubai Land",
    "Dubai Marina",
    "Dubai South",
    "Dubai Sports City",
    "Dubai Studio City",
    "Dubai World Central",
    "Dubailand",
    "Emirates Hills",
    "Emirates Living",
    "Falcon City",
    "Green Community",
    "Greens",
    "International City",
    "Jumeirah",
    "Jumeirah Beach Residence",
    "Jumeirah Golf Estates",
    "Jumeirah Heights",
    "Jumeirah Islands",
    "Jumeirah Lake Towers",
    "Jumeirah Park",
    "Jumeirah Village Circle",
    "Jumeirah Village Triangle",
    "Liwan",
    "Meydan City",
    "Mirdif",
    "Motor City",
    "Mudon",
    "Nad Al Sheba",
    "Nakhl",
    "Old Town",
    "Palm Jebel Ali",
    "Palm Jumeirah",
    "Remraam",
    "Serena",
    "Silicon Oasis",
    "Sports City",
    "Springs",
    "The Lakes",
    "The Meadows",
    "The Villa",
    "Town Square",
    "Umm Suqeim",
    "Wasl Gate",
    "World Islands"
  ];

  return {
    kinds: Array.from(kinds).sort(),
    transactionTypes: Array.from(transactionTypes).sort(),
    propertyTypes: Array.from(propertyTypes).filter(type => type).sort(),
    bedrooms: Array.from(bedrooms).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b).map(String),
    communities: predefinedCommunities.sort()
  };
}