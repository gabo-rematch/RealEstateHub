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
    // Handle bedrooms filtering for multiple selections (union logic)
    if (filters.bedrooms && filters.bedrooms.length > 1) {
      const itemBedrooms = item.bedrooms;
      const hasMatchingBedroom = filters.bedrooms.some(filterBedroom => {
        if (Array.isArray(itemBedrooms)) {
          return itemBedrooms.some((bedroom: any) => bedroom.toString() === filterBedroom);
        }
        return itemBedrooms && itemBedrooms.toString() === filterBedroom;
      });
      if (!hasMatchingBedroom) return false;
    }

    // Handle property_type filtering for multiple selections (union logic)
    if (filters.property_type && filters.property_type.length > 1) {
      const itemPropertyTypes = item.property_type;
      const hasMatchingType = filters.property_type.some(filterType => {
        if (Array.isArray(itemPropertyTypes)) {
          return itemPropertyTypes.some((type: string) => 
            type && type.toLowerCase() === filterType.toLowerCase()
          );
        }
        return itemPropertyTypes && itemPropertyTypes.toLowerCase() === filterType.toLowerCase();
      });
      if (!hasMatchingType) return false;
    }

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

    // Communities filtering - union (OR) logic for multiple communities with fuzzy matching
    if (filters.communities && filters.communities.length > 0) {
      const itemCommunities = item.communities;
      
      const hasMatchingCommunity = filters.communities.some(filterCommunity => {
        // Check array communities field with fuzzy matching
        if (Array.isArray(itemCommunities)) {
          return itemCommunities.some((community: string) => {
            if (!community) return false;
            const cleanCommunity = community.toLowerCase().trim();
            const cleanFilter = filterCommunity.toLowerCase().trim();
            return cleanCommunity.includes(cleanFilter) || cleanFilter.includes(cleanCommunity);
          });
        }
        
        // Check scalar communities field with fuzzy matching
        if (itemCommunities && typeof itemCommunities === 'string') {
          const cleanCommunity = itemCommunities.toLowerCase().trim();
          const cleanFilter = filterCommunity.toLowerCase().trim();
          return cleanCommunity.includes(cleanFilter) || cleanFilter.includes(cleanCommunity);
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

    // Handle communities field properly - extract from message_body_raw and other fields
    let communities = [];
    
    // First check explicit community fields
    if (data.communities) {
      communities = Array.isArray(data.communities) ? data.communities : [data.communities];
    } else if (data.community) {
      communities = Array.isArray(data.community) ? data.community : [data.community];
    } else if (data.location_raw) {
      // Extract community from location_raw field
      const locationText = data.location_raw.toString();
      communities = [locationText];
    } else if (data.message_body_raw) {
      // Extract community from message text using common patterns
      const messageText = data.message_body_raw.toString();
      const communityPatterns = [
        /JLT|Jumeirah Lake Towers/i,
        /JVC|Jumeirah Village Circle/i,
        /Dubai Hills Estate/i,
        /Downtown Dubai/i,
        /Business Bay/i,
        /Dubai Marina/i,
        /Palm Jumeirah/i,
        /DIFC/i,
        /Al Barsha/i,
        /Discovery Gardens/i,
        /International City/i,
        /Sports City/i,
        /Motor City/i,
        /Arabian Ranches/i,
        /The Greens/i,
        /Emirates Hills/i,
        /Meydan/i,
        /City Walk/i,
        /Al Furjan/i,
        /Mudon/i,
        /Town Square/i,
        /DAMAC Hills/i
      ];
      
      for (const pattern of communityPatterns) {
        const match = messageText.match(pattern);
        if (match) {
          let communityName = match[0];
          // Normalize community names
          if (communityName.toLowerCase().includes('jlt')) {
            communityName = 'Jumeirah Lake Towers';
          } else if (communityName.toLowerCase().includes('jvc')) {
            communityName = 'Jumeirah Village Circle';
          }
          communities = [communityName];
          break;
        }
      }
    }
    
    // Filter out empty/null communities
    communities = communities.filter((c: any) => c && c.toString().trim());

    return {
      pk: record.pk,
      id: record.id,
      kind: data.kind,
      transaction_type: data.transaction_type,
      bedrooms: Array.isArray(data.bedrooms) ? data.bedrooms : (data.bedrooms ? [data.bedrooms] : []),
      property_type: Array.isArray(data.property_type) ? data.property_type : (data.property_type ? [data.property_type] : []),
      communities: communities,
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