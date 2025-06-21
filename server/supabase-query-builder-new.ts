import { createClient } from '@supabase/supabase-js';

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
}

// Post-processing filtering to handle complex numeric conditions and array overlaps
function applyPostProcessingFilters(data: any[], filters: FilterParams): any[] {
  return data.filter((item: any) => {
    // Handle numeric filtering for listings vs client requests
    if (filters.unit_kind === 'listing') {
      // For listings: filter by price_aed within budget range
      if (filters.budget_min && item.price_aed && item.price_aed < filters.budget_min) return false;
      if (filters.budget_max && item.price_aed && item.price_aed > filters.budget_max) return false;
    } else if (filters.unit_kind === 'client_request') {
      // For client requests: filter by budget range within price_aed
      if (filters.price_aed && item.budget_min_aed && item.budget_min_aed > filters.price_aed) return false;
      if (filters.price_aed && item.budget_max_aed && item.budget_max_aed < filters.price_aed) return false;
    }

    // Area filtering
    if (filters.area_sqft_min && item.area_sqft && item.area_sqft < filters.area_sqft_min) return false;
    if (filters.area_sqft_max && item.area_sqft && item.area_sqft > filters.area_sqft_max) return false;

    // Communities filtering - union (OR) logic for multiple communities
    if (filters.communities && filters.communities.length > 0) {
      const itemCommunities = item.communities;
      const itemCommunity = item.community;
      
      const hasMatchingCommunity = filters.communities.some(filterCommunity => {
        // Check array communities field
        if (Array.isArray(itemCommunities)) {
          return itemCommunities.some((community: string) => 
            community && community.toLowerCase().includes(filterCommunity.toLowerCase())
          );
        }
        
        // Check scalar communities field
        if (itemCommunities && typeof itemCommunities === 'string') {
          return itemCommunities.toLowerCase().includes(filterCommunity.toLowerCase());
        }
        
        // Check scalar community field
        if (itemCommunity && typeof itemCommunity === 'string') {
          return itemCommunity.toLowerCase().includes(filterCommunity.toLowerCase());
        }
        
        return false;
      });
      
      if (!hasMatchingCommunity) return false;
    }

    return true;
  });
}

export async function queryPropertiesWithSupabase(filters: FilterParams) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Execute multiple queries to bypass 1000 record limit
  let allData: any[] = [];
  let currentPage = 0;
  const batchSize = 1000; // Supabase limit per query
  let hasMoreData = true;

  while (hasMoreData && allData.length < 50000) {
    // Start with base query for each batch
    let query = supabase
      .from('inventory_unit_preference')
      .select(`
        pk,
        id,
        data,
        updated_at,
        inventory_unit:inventory_unit_pk(agent_details)
      `);

    // Apply basic sanity checks
    query = query.not('data->>kind', 'is', null)
      .not('data->>transaction_type', 'is', null);

    // Apply PostgREST filters
    if (filters.unit_kind) {
      query = query.eq('data->>kind', filters.unit_kind);
    }

    if (filters.transaction_type) {
      query = query.eq('data->>transaction_type', filters.transaction_type);
    }

    // Apply simpler filters that work with PostgREST (complex filtering done in post-processing)
    if (filters.bedrooms && filters.bedrooms.length === 1) {
      query = query.or(`data->>bedrooms.eq."${filters.bedrooms[0]}",data->bedrooms.cs.["${filters.bedrooms[0]}"]`);
    }

    if (filters.property_type && filters.property_type.length === 1) {
      query = query.or(`data->>property_type.eq."${escapePostgRESTString(filters.property_type[0])}",data->property_type.cs.["${escapePostgRESTString(filters.property_type[0])}"]`);
    }

    // Boolean filters with three-state logic
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
      const searchTerm = filters.keyword_search.trim();
      query = query.ilike('data->>message_body_raw', `%${searchTerm}%`);
    }

    // Apply pagination for this batch
    query = query.range(currentPage * batchSize, (currentPage + 1) * batchSize - 1);

    const { data: batchData, error: batchError } = await query;
    
    if (batchError) {
      console.error('Batch query error:', batchError);
      break;
    }
    
    if (!batchData || batchData.length === 0) {
      hasMoreData = false;
      break;
    }
    
    allData.push(...batchData);
    
    // Stop if we got less than expected batch size (end of data)
    if (batchData.length < batchSize) {
      hasMoreData = false;
    }
    
    currentPage++;
  }

  console.log(`Query returned ${allData.length} properties`);

  if (allData.length === 0) {
    return [];
  }

  // Transform the data to match expected format
  const transformedData = allData.map((record: any) => {
    if (!record.data) return null;

    const data = record.data;
    const agentDetails = record.inventory_unit?.agent_details || {};

    return {
      pk: record.pk,
      id: record.id,
      kind: data.kind,
      transaction_type: data.transaction_type,
      bedrooms: Array.isArray(data.bedrooms) ? data.bedrooms : (data.bedrooms ? [data.bedrooms] : []),
      property_type: Array.isArray(data.property_type) ? data.property_type : (data.property_type ? [data.property_type] : []),
      communities: Array.isArray(data.communities) ? data.communities : (data.communities ? [data.communities] : []),
      price_aed: data.price_aed || null,
      budget_max_aed: data.budget_max_aed || null,
      budget_min_aed: data.budget_min_aed || null,
      area_sqft: data.area_sqft || null,
      message_body_raw: data.message_body_raw || null,
      furnishing: data.furnishing || null,
      is_urgent: data.is_urgent || null,
      is_agent_covered: data.is_agent_covered || null,
      bathrooms: Array.isArray(data.bathrooms) ? data.bathrooms : (data.bathrooms ? [data.bathrooms] : []),
      location_raw: data.location_raw || null,
      other_details: data.other_details || null,
      has_maid_bedroom: data.has_maid_bedroom || null,
      is_direct: data.is_direct || null,
      mortgage_or_cash: data.mortgage_or_cash || null,
      is_distressed_deal: data.is_distressed_deal || null,
      is_off_plan: data.is_off_plan || null,
      is_mortgage_approved: data.is_mortgage_approved || null,
      is_community_agnostic: data.is_community_agnostic || null,
      developers: Array.isArray(data.developers) ? data.developers : (data.developers ? [data.developers] : []),
      whatsapp_participant: data.whatsapp_participant || null,
      agent_phone: agentDetails.phone || null,
      groupJID: data.groupJID || null,
      evolution_instance_id: data.evolution_instance_id || null,
      updated_at: record.updated_at
    };
  }).filter(Boolean);

  // Apply post-processing filtering for complex numeric conditions
  return applyPostProcessingFilters(transformedData, filters);
}

export async function getFilterOptionsWithSupabase() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  
  console.log('Supabase RPC failed, using table queries: RPC not available, using table queries');
  
  // Extract communities using comprehensive approach with high limits
  const communitiesQuery = supabase
    .from('inventory_unit_preference')
    .select('data')
    .not('data->>communities', 'is', null)
    .limit(50000);

  const { data: communitiesData, error: communitiesError } = await communitiesQuery;

  if (communitiesError) {
    console.error('Error fetching communities:', communitiesError);
    return {
      kinds: ['listing', 'client_request'],
      transaction_types: ['sale', 'rent'],
      property_types: ['apartment', 'villa', 'townhouse', 'penthouse'],
      bedrooms: ['studio', '1', '2', '3', '4', '5', '6+'],
      communities: []
    };
  }

  // Extract unique communities from the data
  const communitiesSet = new Set<string>();

  communitiesData?.forEach((record: any) => {
    if (record.data?.communities) {
      const communities = record.data.communities;
      if (Array.isArray(communities)) {
        communities.forEach((community: string) => {
          if (community && community.trim()) {
            communitiesSet.add(community.trim());
          }
        });
      } else if (typeof communities === 'string' && communities.trim()) {
        communitiesSet.add(communities.trim());
      }
    }
  });

  const communitiesList = Array.from(communitiesSet).sort();
  console.log(`Extracted ${communitiesList.length} communities from database`);

  return {
    kinds: ['listing', 'client_request'],
    transaction_types: ['sale', 'rent'],
    property_types: ['apartment', 'villa', 'townhouse', 'penthouse', 'office', 'retail', 'warehouse'],
    bedrooms: ['studio', '1', '2', '3', '4', '5', '6+'],
    communities: communitiesList
  };
}