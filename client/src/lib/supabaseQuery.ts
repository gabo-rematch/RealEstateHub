import { supabase } from './supabase';
import { SearchFilters } from '@/types/property';

export interface SupabaseProperty {
  pk: number;
  id: string;
  kind: string;
  transaction_type: string;
  bedrooms: number[];
  property_type: string[];
  communities: string[];
  price_aed: number | null;
  budget_max_aed: number | null;
  budget_min_aed: number | null;
  area_sqft: number | null;
  message_body_raw: string | null;
  furnishing: string | null;
  is_urgent: boolean | null;
  is_agent_covered: boolean | null;
  bathrooms: number[];
  location_raw: string | null;
  other_details: string | null;
  has_maid_bedroom: boolean | null;
  is_direct: boolean | null;
  mortgage_or_cash: string | null;
  is_distressed_deal: boolean | null;
  is_off_plan: boolean | null;
  is_mortgage_approved: boolean | null;
  is_community_agnostic: boolean | null;
  developers: string[];
  whatsapp_participant: string | null;
  agent_phone: string | null;
  groupJID: string | null;
  evolution_instance_id: string | null;
  updated_at: string;
}

export async function querySupabaseProperties(filters: SearchFilters): Promise<SupabaseProperty[]> {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  // Build the complex SQL query similar to your provided query
  const { data, error } = await supabase.rpc('search_properties', {
    bedrooms_filter: filters.bedrooms || [],
    communities_filter: filters.communities || [],
    transaction_type_filter: filters.transaction_type || null,
    kind_filter: filters.unit_kind || null,
    property_type_filter: filters.property_type || [],
    budget_min_filter: filters.budget_min || 0,
    budget_max_filter: filters.budget_max || 0,
    price_aed_filter: filters.price_aed || 0,
    area_min_filter: filters.area_sqft_min || 0,
    area_max_filter: filters.area_sqft_max || 0,
    is_distressed_filter: filters.is_distressed_deal,
    is_off_plan_filter: filters.is_off_plan
  });

  if (error) {
    console.error('Supabase RPC error:', error);
    throw new Error(error.message);
  }

  return data || [];
}

// Query the inventory_unit_preference table with property data in JSONB format
export async function querySupabasePropertiesDirect(filters: SearchFilters): Promise<any[]> {
  if (!supabase) {
    console.error('Supabase client not initialized');
    throw new Error('Database connection not available');
  }

  console.log('Querying inventory_unit_preference table with JSONB data, filters:', filters);

  try {
    // First, test access to inventory_unit_preference table and examine data structure
    console.log('Testing inventory_unit_preference table access...');
    const sampleQuery = await supabase
      .from('inventory_unit_preference')
      .select('pk, id, data, inventory_unit_pk, created_at, updated_at, priority')
      .limit(5);
    
    console.log('Sample query result:', {
      error: sampleQuery.error?.message || null,
      count: sampleQuery.data?.length || 0
    });

    if (sampleQuery.error) {
      console.error('Table access error:', sampleQuery.error);
      return [];
    }

    if (sampleQuery.data && sampleQuery.data.length > 0) {
      console.log('Sample record structure:', sampleQuery.data[0]);
      console.log('JSONB data content:', sampleQuery.data[0].data);
      
      // Examine the JSONB data structure
      const sampleData = sampleQuery.data[0].data;
      if (sampleData) {
        console.log('JSONB data keys:', Object.keys(sampleData));
        console.log('Property kind field:', sampleData.rec_kind || sampleData.kind);
        console.log('Transaction type field:', sampleData.rec_transaction_type || sampleData.transaction_type);
      }
    } else {
      console.log('No sample data found in inventory_unit_preference');
      return [];
    }

    // Build the main query
    let query = supabase
      .from('inventory_unit_preference')
      .select('pk, id, data, inventory_unit_pk, created_at, updated_at, priority');

    // Apply filters using JSONB operators
    if (filters.unit_kind && filters.unit_kind !== '') {
      console.log(`Applying JSONB filter for unit_kind: ${filters.unit_kind}`);
      // Try different possible field names in the JSONB data
      query = query.or(`data->>rec_kind.eq.${filters.unit_kind},data->>kind.eq.${filters.unit_kind}`);
    }

    if (filters.transaction_type && filters.transaction_type !== '') {
      console.log(`Applying JSONB filter for transaction_type: ${filters.transaction_type}`);
      query = query.or(`data->>rec_transaction_type.eq.${filters.transaction_type},data->>transaction_type.eq.${filters.transaction_type}`);
    }

    // Add other property filters
    if (filters.bedrooms && filters.bedrooms.length > 0) {
      console.log(`Applying bedroom filter: ${filters.bedrooms}`);
      // For array fields, we need to check if any of the filter values match
      const bedroomFilters = filters.bedrooms.map(bed => 
        `data->>bedrooms.cs.["${bed}"]`
      ).join(',');
      if (bedroomFilters) {
        query = query.or(bedroomFilters);
      }
    }

    if (filters.communities && filters.communities.length > 0) {
      console.log(`Applying community filter: ${filters.communities}`);
      const communityFilters = filters.communities.map(community => 
        `data->>communities.cs.["${community}"]`
      ).join(',');
      if (communityFilters) {
        query = query.or(communityFilters);
      }
    }

    if (filters.budget_min && filters.budget_min > 0) {
      console.log(`Applying budget_min filter: ${filters.budget_min}`);
      query = query.gte('data->>price_aed', filters.budget_min.toString());
    }

    if (filters.budget_max && filters.budget_max > 0) {
      console.log(`Applying budget_max filter: ${filters.budget_max}`);
      query = query.lte('data->>price_aed', filters.budget_max.toString());
    }

    if (filters.area_sqft_min && filters.area_sqft_min > 0) {
      console.log(`Applying area_sqft_min filter: ${filters.area_sqft_min}`);
      query = query.gte('data->>area_sqft', filters.area_sqft_min.toString());
    }

    if (filters.area_sqft_max && filters.area_sqft_max > 0) {
      console.log(`Applying area_sqft_max filter: ${filters.area_sqft_max}`);
      query = query.lte('data->>area_sqft', filters.area_sqft_max.toString());
    }

    if (filters.is_off_plan !== undefined) {
      console.log(`Applying is_off_plan filter: ${filters.is_off_plan}`);
      query = query.eq('data->>is_off_plan', filters.is_off_plan.toString());
    }

    if (filters.is_distressed_deal !== undefined) {
      console.log(`Applying is_distressed_deal filter: ${filters.is_distressed_deal}`);
      query = query.eq('data->>is_distressed_deal', filters.is_distressed_deal.toString());
    }

    // Order by updated_at and limit results
    query = query.order('updated_at', { ascending: false }).limit(50);

    console.log('Executing inventory_unit_preference query...');
    const { data, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return [];
    }

    console.log(`Query returned ${data?.length || 0} records`);
    
    if (data && data.length > 0) {
      console.log('First result sample:', data[0]);
      console.log('First result JSONB data:', data[0].data);
    }

    // Transform the JSONB data to our expected format
    const transformedData = (data || []).map((item: any) => {
      const jsonData = item.data || {};
      
      return {
        pk: item.pk,
        id: item.id || String(item.pk),
        kind: jsonData.rec_kind || jsonData.kind || 'unknown',
        transaction_type: jsonData.rec_transaction_type || jsonData.transaction_type || 'sale',
        bedrooms: Array.isArray(jsonData.bedrooms) ? jsonData.bedrooms : 
                 (jsonData.bedrooms ? [jsonData.bedrooms] : []),
        property_type: Array.isArray(jsonData.property_type) ? jsonData.property_type : 
                      (jsonData.property_type ? [jsonData.property_type] : []),
        communities: Array.isArray(jsonData.communities) ? jsonData.communities : 
                    Array.isArray(jsonData.community) ? jsonData.community :
                    (jsonData.communities || jsonData.community ? [jsonData.communities || jsonData.community] : []),
        price_aed: jsonData.price_aed ? parseFloat(String(jsonData.price_aed)) : null,
        budget_max_aed: jsonData.budget_max_aed ? parseFloat(String(jsonData.budget_max_aed)) : null,
        budget_min_aed: jsonData.budget_min_aed ? parseFloat(String(jsonData.budget_min_aed)) : null,
        area_sqft: jsonData.area_sqft ? parseFloat(String(jsonData.area_sqft)) : null,
        message_body_raw: jsonData.message_body_raw || 'Property inquiry',
        furnishing: jsonData.furnishing,
        is_urgent: jsonData.is_urgent || item.priority || false,
        is_agent_covered: jsonData.is_agent_covered || true,
        bathrooms: Array.isArray(jsonData.bathrooms) ? jsonData.bathrooms : 
                  (jsonData.bathrooms ? [jsonData.bathrooms] : []),
        location_raw: jsonData.location_raw,
        other_details: jsonData.other_details,
        has_maid_bedroom: jsonData.has_maid_bedroom,
        is_direct: jsonData.is_direct || false,
        mortgage_or_cash: jsonData.mortgage_or_cash,
        is_distressed_deal: jsonData.is_distressed_deal || false,
        is_off_plan: jsonData.is_off_plan || false,
        is_mortgage_approved: jsonData.is_mortgage_approved,
        is_community_agnostic: jsonData.is_community_agnostic,
        developers: Array.isArray(jsonData.developers) ? jsonData.developers : 
                   (jsonData.developers ? [jsonData.developers] : []),
        whatsapp_participant: jsonData.whatsapp_participant,
        agent_phone: jsonData.agent_phone,
        groupJID: jsonData.groupJID,
        evolution_instance_id: jsonData.evolution_instance_id,
        updated_at: item.updated_at
      };
    });

    console.log('Final transformed data sample:', transformedData[0]);
    return transformedData;

  } catch (error) {
    console.error('Query failed:', error);
    return [];
  }
}