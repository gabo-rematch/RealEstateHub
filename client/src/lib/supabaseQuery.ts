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

// Direct table query for inventory_unit_preference
export async function querySupabasePropertiesDirect(filters: SearchFilters): Promise<any[]> {
  if (!supabase) {
    console.error('Supabase client not initialized');
    throw new Error('Database connection not available');
  }

  console.log('Querying with filters:', filters);

  // Start with comprehensive table investigation
  try {
    // First, try to get the table schema/structure
    console.log('Investigating table structure...');
    
    // Get a sample of ALL records to see what's actually in the table
    const allRecordsQuery = await supabase
      .from('inventory_unit_preference')
      .select('*')
      .limit(10);
    
    console.log('All records query result:', allRecordsQuery);
    console.log(`Total records found: ${allRecordsQuery.data?.length || 0}`);
    
    if (allRecordsQuery.data && allRecordsQuery.data.length > 0) {
      console.log('Sample record structure:', allRecordsQuery.data[0]);
      console.log('Sample data field content:', allRecordsQuery.data[0]?.data);
      
      // Analyze the data field structure
      const sampleData = allRecordsQuery.data[0]?.data;
      if (sampleData) {
        console.log('Data field keys:', Object.keys(sampleData));
        console.log('Kind value:', sampleData.kind || sampleData.rec_kind);
        console.log('Transaction type:', sampleData.transaction_type || sampleData.rec_transaction_type);
      }
    } else {
      // Table might be empty, let's check if it exists at all
      console.log('No records found. Checking if table exists...');
      
      // Try a different approach - check other possible table names
      const altQuery1 = await supabase
        .from('inventory_unit')
        .select('*')
        .limit(5);
      console.log('inventory_unit table query:', altQuery1);
      
      if (altQuery1.error?.code === '42P01') {
        console.log('Table does not exist or access denied');
      }
    }
    
    if (allRecordsQuery.error) {
      console.error('Table access error:', allRecordsQuery.error);
      throw new Error(`Database access error: ${allRecordsQuery.error.message}`);
    }

  } catch (error) {
    console.error('Database investigation failed:', error);
    throw error;
  }

  // Build main query with filters
  let query = supabase
    .from('inventory_unit_preference')
    .select('pk, id, data, updated_at');

  // Apply filters using JSONB operators
  if (filters.unit_kind && filters.unit_kind !== '') {
    // Map frontend terms to database values
    const kindValue = filters.unit_kind === 'listing' ? 'listing' : 
                     filters.unit_kind === 'client_request' ? 'client_request' : 
                     filters.unit_kind;
    query = query.eq('data->>kind', kindValue);
  }
  
  if (filters.transaction_type && filters.transaction_type !== '') {
    query = query.eq('data->>transaction_type', filters.transaction_type);
  }

  // Add limit to prevent timeout
  query = query.limit(100).order('updated_at', { ascending: false });

  console.log('Executing main query...');
  const { data, error } = await query;

  if (error) {
    console.error('Main query error:', error);
    throw new Error(`Query failed: ${error.message}`);
  }

  console.log(`Query returned ${data?.length || 0} records`);

  // Transform the data to match our expected format
  const transformedData = (data || []).map((item: any) => {
    const rec = item.data || {};
    
    return {
      pk: item.pk,
      id: item.id || String(item.pk),
      kind: rec.kind,
      transaction_type: rec.transaction_type,
      bedrooms: Array.isArray(rec.bedrooms) ? rec.bedrooms : (rec.bedrooms ? [rec.bedrooms] : []),
      property_type: Array.isArray(rec.property_type) ? rec.property_type : (rec.property_type ? [rec.property_type] : []),
      communities: Array.isArray(rec.communities) ? rec.communities : 
                   Array.isArray(rec.community) ? rec.community :
                   (rec.communities || rec.community ? [rec.communities || rec.community] : []),
      price_aed: rec.price_aed ? parseFloat(rec.price_aed) : null,
      budget_max_aed: rec.budget_max_aed ? parseFloat(rec.budget_max_aed) : null,
      budget_min_aed: rec.budget_min_aed ? parseFloat(rec.budget_min_aed) : null,
      area_sqft: rec.area_sqft ? parseFloat(rec.area_sqft) : null,
      message_body_raw: rec.message_body_raw,
      furnishing: rec.furnishing,
      is_urgent: rec.is_urgent,
      is_agent_covered: rec.is_agent_covered,
      bathrooms: Array.isArray(rec.bathrooms) ? rec.bathrooms : (rec.bathrooms ? [rec.bathrooms] : []),
      location_raw: rec.location_raw,
      other_details: rec.other_details,
      has_maid_bedroom: rec.has_maid_bedroom,
      is_direct: rec.is_direct,
      mortgage_or_cash: rec.mortgage_or_cash,
      is_distressed_deal: rec.is_distressed_deal,
      is_off_plan: rec.is_off_plan,
      is_mortgage_approved: rec.is_mortgage_approved,
      is_community_agnostic: rec.is_community_agnostic,
      developers: Array.isArray(rec.developers) ? rec.developers : (rec.developers ? [rec.developers] : []),
      whatsapp_participant: null,
      agent_phone: null,
      groupJID: null,
      evolution_instance_id: null,
      updated_at: item.updated_at
    };
  });

  console.log('Sample transformed record:', transformedData[0]);
  return transformedData;
}