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

// Query the inventory_unit_preference table with 45k+ records
export async function querySupabasePropertiesDirect(filters: SearchFilters): Promise<any[]> {
  if (!supabase) {
    console.error('Supabase client not initialized');
    throw new Error('Database connection not available');
  }

  console.log('Querying inventory_unit_preference table (45k+ records) with filters:', filters);

  try {
    // First, get a sample of records to understand the structure
    console.log('Getting sample records to understand data structure...');
    const sampleQuery = await supabase
      .from('inventory_unit_preference')
      .select('*')
      .limit(3);
    
    console.log('Sample query result:', sampleQuery);
    
    if (sampleQuery.data && sampleQuery.data.length > 0) {
      console.log('Sample record structure:', sampleQuery.data[0]);
      console.log('All field names:', Object.keys(sampleQuery.data[0]));
      
      // Check if there's a data field or if fields are at root level
      const sample = sampleQuery.data[0];
      if (sample.data) {
        console.log('Data field exists - content:', sample.data);
        console.log('Data field keys:', Object.keys(sample.data));
      }
      
      // Look for various possible field names
      console.log('Looking for kind-related fields:', {
        kind: sample.kind,
        rec_kind: sample.rec_kind,
        unit_kind: sample.unit_kind,
        data_kind: sample.data?.kind,
        data_rec_kind: sample.data?.rec_kind
      });
      
      console.log('Looking for transaction-related fields:', {
        transaction_type: sample.transaction_type,
        rec_transaction_type: sample.rec_transaction_type,
        data_transaction_type: sample.data?.transaction_type,
        data_rec_transaction_type: sample.data?.rec_transaction_type
      });
    }

    // Now try the actual query with no filters first to see if we get results
    console.log('Trying query with no filters to test basic access...');
    let testQuery = supabase
      .from('inventory_unit_preference')
      .select('pk, id, data, created_at, updated_at')
      .limit(10);

    const testResult = await testQuery;
    console.log('No-filter test query result:', testResult);
    console.log(`No-filter query returned ${testResult.data?.length || 0} records`);

    if (testResult.data && testResult.data.length > 0) {
      console.log('Test query sample record:', testResult.data[0]);
    }

    // Now try with filters based on what we learned
    let query = supabase
      .from('inventory_unit_preference')
      .select('pk, id, data, created_at, updated_at');

    // Try different approaches for filtering
    if (filters.unit_kind && filters.unit_kind !== '') {
      console.log(`Applying filter for unit_kind: ${filters.unit_kind}`);
      
      // Try multiple potential field paths
      if (sampleQuery.data?.[0]?.data?.rec_kind !== undefined) {
        console.log('Using data->rec_kind filter');
        query = query.eq('data->>rec_kind', filters.unit_kind);
      } else if (sampleQuery.data?.[0]?.data?.kind !== undefined) {
        console.log('Using data->kind filter');
        query = query.eq('data->>kind', filters.unit_kind);
      } else if (sampleQuery.data?.[0]?.rec_kind !== undefined) {
        console.log('Using direct rec_kind filter');
        query = query.eq('rec_kind', filters.unit_kind);
      } else if (sampleQuery.data?.[0]?.kind !== undefined) {
        console.log('Using direct kind filter');
        query = query.eq('kind', filters.unit_kind);
      } else {
        console.log('No suitable kind field found, trying all variations...');
        // Try a broad search approach
        query = supabase
          .from('inventory_unit_preference')
          .select('pk, id, data, created_at, updated_at')
          .or(`data->>rec_kind.eq.${filters.unit_kind},data->>kind.eq.${filters.unit_kind},rec_kind.eq.${filters.unit_kind},kind.eq.${filters.unit_kind}`);
      }
    }

    query = query.limit(50).order('updated_at', { ascending: false });

    console.log('Executing main filtered query...');
    const { data, error } = await query;

    if (error) {
      console.error('Filtered query error:', error);
      throw new Error(`Query failed: ${error.message}`);
    }

    console.log(`Filtered query returned ${data?.length || 0} records`);
    
    if (data && data.length > 0) {
      console.log('Filtered query sample record:', data[0]);
    }

    // Transform the data based on the actual structure we found
    const transformedData = (data || []).map((item: any) => {
      const rec = item.data || item;
      
      return {
        pk: item.pk,
        id: item.id || String(item.pk),
        kind: rec.rec_kind || rec.kind || 'unknown',
        transaction_type: rec.rec_transaction_type || rec.transaction_type || 'sale',
        bedrooms: Array.isArray(rec.bedrooms) ? rec.bedrooms : (rec.bedrooms ? [rec.bedrooms] : []),
        property_type: Array.isArray(rec.property_type) ? rec.property_type : (rec.property_type ? [rec.property_type] : []),
        communities: Array.isArray(rec.communities) ? rec.communities : 
                     Array.isArray(rec.community) ? rec.community :
                     (rec.communities || rec.community ? [rec.communities || rec.community] : []),
        price_aed: rec.price_aed ? parseFloat(String(rec.price_aed)) : null,
        budget_max_aed: rec.budget_max_aed ? parseFloat(String(rec.budget_max_aed)) : null,
        budget_min_aed: rec.budget_min_aed ? parseFloat(String(rec.budget_min_aed)) : null,
        area_sqft: rec.area_sqft ? parseFloat(String(rec.area_sqft)) : null,
        message_body_raw: rec.message_body_raw || 'Property record',
        furnishing: rec.furnishing,
        is_urgent: rec.is_urgent || false,
        is_agent_covered: rec.is_agent_covered || true,
        bathrooms: Array.isArray(rec.bathrooms) ? rec.bathrooms : (rec.bathrooms ? [rec.bathrooms] : []),
        location_raw: rec.location_raw,
        other_details: rec.other_details,
        has_maid_bedroom: rec.has_maid_bedroom,
        is_direct: rec.is_direct || false,
        mortgage_or_cash: rec.mortgage_or_cash,
        is_distressed_deal: rec.is_distressed_deal || false,
        is_off_plan: rec.is_off_plan || false,
        is_mortgage_approved: rec.is_mortgage_approved,
        is_community_agnostic: rec.is_community_agnostic,
        developers: Array.isArray(rec.developers) ? rec.developers : (rec.developers ? [rec.developers] : []),
        whatsapp_participant: null,
        agent_phone: null,
        groupJID: null,
        evolution_instance_id: null,
        updated_at: item.updated_at || item.created_at
      };
    });

    console.log('Final transformed data sample:', transformedData[0]);
    return transformedData;

  } catch (error) {
    console.error('Query investigation failed:', error);
    throw error;
  }
}