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

  // Efficient pagination strategy - fetch only what's needed
  const requestedPageSize = filters.pageSize || 50;
  const requestedPage = filters.page || 0;
  
  // For small page sizes, use direct pagination for speed
  if (requestedPageSize <= 100) {
    const directOffset = requestedPage * requestedPageSize;
    let query = supabase
      .from('inventory_unit_preference')
      .select(`
        pk,
        id,
        data,
        updated_at,
        inventory_unit:inventory_unit_pk(agent_details)
      `)
      .not('data->>kind', 'is', null)
      .not('data->>transaction_type', 'is', null);

    // Apply basic filters
    if (filters.unit_kind) {
      query = query.eq('data->>kind', filters.unit_kind);
    }
    if (filters.transaction_type) {
      query = query.eq('data->>transaction_type', filters.transaction_type);
    }

    // Apply simple filters - defer complex multi-value filters to post-processing
    if (filters.bedrooms && filters.bedrooms.length === 1) {
      query = query.or(`data->>bedrooms.eq."${filters.bedrooms[0]}",data->bedrooms.cs.["${filters.bedrooms[0]}"]`);
    }
    if (filters.property_type && filters.property_type.length === 1) {
      query = query.or(`data->>property_type.eq."${filters.property_type[0]}",data->property_type.cs.["${filters.property_type[0]}"]`);
    }
    // Note: Multiple bedrooms/property_types and communities handled in post-processing for accuracy

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

    // Apply direct pagination
    query = query.range(directOffset, directOffset + requestedPageSize - 1);

    const { data, error } = await query;
    
    if (error) {
      console.error('Direct query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform and apply post-processing
    const transformedData = transformDataToExpectedFormat(data);
    const filteredData = applyPostProcessingFilters(transformedData, filters);
    
    console.log(`Direct pagination: returned ${filteredData.length} properties for page ${requestedPage}`);
    return filteredData;
  }

  // For larger requests, use batch processing
  const batchSize = 1000;
  let allData: any[] = [];
  let currentBatch = 0;
  let hasMoreData = true;
  const maxBatches = Math.ceil(requestedPageSize / batchSize) + 2; // Buffer for filtering

  while (hasMoreData && currentBatch < maxBatches) {
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
    query = query.range(currentBatch * batchSize, (currentBatch + 1) * batchSize - 1);

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
    totalProcessed += batchData.length;
    
    // Stop if we got less than expected batch size (end of data)
    if (batchData.length < batchSize) {
      hasMoreData = false;
    }
    currentBatch++;
  }

  console.log(`Query returned ${allData.length} properties`);

  if (allData.length === 0) {
    return [];
  }

  // Transform the data to match expected format
  const transformedData = transformDataToExpectedFormat(allData);

  // Apply post-processing filtering for complex numeric conditions
  const filteredData = applyPostProcessingFilters(transformedData, filters);
  
  // Apply final pagination to the filtered results
  if (filters.pageSize && filters.pageSize <= 1000) {
    const start = (filters.page || 0) * filters.pageSize;
    const end = start + filters.pageSize;
    const paginatedData = filteredData.slice(start, end);
    
    console.log(`Filtered to ${filteredData.length} properties, returning page ${filters.page || 0} (${paginatedData.length} items)`);
    return paginatedData;
  }
  
  console.log(`Returning ${filteredData.length} filtered properties`);
  return filteredData;
}

// Helper function to transform raw data to expected format
function transformDataToExpectedFormat(allData: any[]) {
  return allData.map((record: any) => {
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
      const locationText = data.location_raw.toString();
      communities = [locationText];
    } else if (data.message_body_raw) {
      const messageText = data.message_body_raw.toString();
      
      // Enhanced pattern matching for communities
      if (/JLT|Jumeirah Lake Towers/i.test(messageText)) {
        communities = ['Jumeirah Lake Towers'];
      } else if (/JVC|Jumeirah Village Circle/i.test(messageText)) {
        communities = ['Jumeirah Village Circle'];
      } else if (/Dubai Hills Estate/i.test(messageText)) {
        communities = ['Dubai Hills Estate'];
      } else if (/Downtown Dubai/i.test(messageText)) {
        communities = ['Downtown Dubai'];
      } else if (/Business Bay/i.test(messageText)) {
        communities = ['Business Bay'];
      } else if (/Dubai Marina/i.test(messageText)) {
        communities = ['Dubai Marina'];
      } else if (/Palm Jumeirah/i.test(messageText)) {
        communities = ['Palm Jumeirah'];
      } else if (/DIFC/i.test(messageText)) {
        communities = ['DIFC'];
      } else {
        // Extract any community-like text patterns
        const communityWords = messageText.match(/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Estate|Hills|Village|City|Bay|Marina|Gardens|Heights|Park|Lakes|Meadows|Springs|Towers)))/gi);
        if (communityWords && communityWords.length > 0) {
          communities = [communityWords[0].trim()];
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
}

export async function getFilterOptionsWithSupabase() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  
  console.log('Supabase RPC failed, using table queries: RPC not available, using table queries');
  
  // Extract all filter options from a larger sample of the dataset
  const optionsQuery = supabase
    .from('inventory_unit_preference')
    .select('data')
    .not('data->>kind', 'is', null)
    .not('data->>transaction_type', 'is', null)
    .limit(10000);

  const { data: optionsData, error: optionsError } = await optionsQuery;

  if (optionsError) {
    console.error('Error fetching filter options:', optionsError);
    return {
      kinds: ['listing', 'client_request'],
      transaction_types: ['sale', 'rent'],
      property_types: ['apartment', 'villa', 'townhouse', 'penthouse'],
      bedrooms: ['studio', '1', '2', '3', '4', '5', '6+'],
      communities: []
    };
  }

  // Extract unique values from the actual dataset
  const kindsSet = new Set<string>();
  const transactionTypesSet = new Set<string>();
  const propertyTypesSet = new Set<string>();
  const bedroomsSet = new Set<string>();
  const communitiesSet = new Set<string>();

  let recordsProcessed = 0;
  optionsData?.forEach((record: any) => {
    const data = record.data;
    recordsProcessed++;
    
    // Extract kinds (unit_kind) 
    if (data?.kind && typeof data.kind === 'string') {
      kindsSet.add(data.kind.trim());
    }
    
    // Extract transaction types
    if (data?.transaction_type && typeof data.transaction_type === 'string') {
      transactionTypesSet.add(data.transaction_type.trim());
    }
    
    // Extract property types (handle both array and string formats)
    if (data?.property_type) {
      if (Array.isArray(data.property_type)) {
        data.property_type.forEach((type: string) => {
          if (type && typeof type === 'string') {
            propertyTypesSet.add(type.trim());
          }
        });
      } else if (typeof data.property_type === 'string') {
        propertyTypesSet.add(data.property_type.trim());
      }
    }
    
    // Extract bedrooms (handle both array and string/number formats)
    if (data?.bedrooms !== undefined && data.bedrooms !== null) {
      if (Array.isArray(data.bedrooms)) {
        data.bedrooms.forEach((bedroom: any) => {
          if (bedroom !== undefined && bedroom !== null) {
            const bedroomStr = bedroom.toString().trim();
            if (bedroomStr) bedroomsSet.add(bedroomStr);
          }
        });
      } else {
        const bedroomStr = data.bedrooms.toString().trim();
        if (bedroomStr) bedroomsSet.add(bedroomStr);
      }
    }
    
    // Extract communities (handle both array and string formats)
    if (data?.communities) {
      if (Array.isArray(data.communities)) {
        data.communities.forEach((community: string) => {
          if (community && typeof community === 'string' && community.trim()) {
            communitiesSet.add(community.trim());
          }
        });
      } else if (typeof data.communities === 'string' && data.communities.trim()) {
        communitiesSet.add(data.communities.trim());
      }
    }
  });

  console.log(`Processed ${recordsProcessed} records, found: ${kindsSet.size} kinds, ${transactionTypesSet.size} transaction types, ${propertyTypesSet.size} property types`);

  // Convert sets to sorted arrays
  const kindsList = Array.from(kindsSet).sort();
  const transactionTypesList = Array.from(transactionTypesSet).sort();
  const propertyTypesList = Array.from(propertyTypesSet).sort();
  const bedroomsList = Array.from(bedroomsSet)
    .map(b => {
      // Handle special cases
      if (b.toLowerCase() === 'studio' || b === '0') return 'studio';
      return b;
    })
    .filter((value, index, array) => array.indexOf(value) === index) // Remove duplicates
    .sort((a, b) => {
      // Custom sort: studio first, then numbers
      if (a === 'studio') return -1;
      if (b === 'studio') return 1;
      const aNum = parseInt(a);
      const bNum = parseInt(b);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.localeCompare(b);
    });
  const communitiesList = Array.from(communitiesSet).sort();

  console.log(`Extracted ${kindsList.length} kinds, ${transactionTypesList.length} transaction types, ${propertyTypesList.length} property types, ${bedroomsList.length} bedroom options, ${communitiesList.length} communities from database`);

  // Fallback to ensure we always have basic options even if extraction fails
  const finalResult = {
    kinds: kindsList.length > 0 ? kindsList : ['listing', 'client_request'],
    transaction_types: transactionTypesList.length > 0 ? transactionTypesList : ['sale', 'rent'],
    property_types: propertyTypesList.length > 0 ? propertyTypesList : ['apartment', 'villa', 'townhouse'],
    bedrooms: bedroomsList.length > 0 ? bedroomsList : ['studio', '1', '2', '3', '4', '5'],
    communities: communitiesList
  };

  console.log('Final filter options:', {
    kinds: finalResult.kinds,
    transaction_types: finalResult.transaction_types,
    property_types: finalResult.property_types.slice(0, 5), // Show first 5
    bedrooms: finalResult.bedrooms,
    communities_count: finalResult.communities.length
  });

  return finalResult;
}