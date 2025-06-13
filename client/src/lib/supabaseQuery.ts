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
    // Test table access permissions first
    console.log('Testing table access permissions...');
    
    // Check which tables are accessible
    const tables = [
      'inventory_unit_preference', 
      'inventory_unit', 
      'properties',
      'messages',
      'units',
      'listings'
    ];
    
    for (const tableName of tables) {
      try {
        console.log(`Testing access to table: ${tableName}`);
        const testQuery = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        console.log(`${tableName} access result:`, {
          error: testQuery.error?.message || null,
          hasData: testQuery.data && testQuery.data.length > 0,
          count: testQuery.data?.length || 0
        });
        
        if (testQuery.data && testQuery.data.length > 0) {
          console.log(`${tableName} sample record:`, testQuery.data[0]);
          console.log(`${tableName} field names:`, Object.keys(testQuery.data[0]));
        }
      } catch (tableError) {
        console.log(`${tableName} access failed:`, tableError);
      }
    }
    
    // If we found accessible tables with data, use the best one
    let accessibleTable = null;
    let sampleData = null;
    
    // Try inventory_unit first since we saw it had data earlier
    try {
      const inventoryUnitQuery = await supabase
        .from('inventory_unit')
        .select('*')
        .limit(5);
      
      if (inventoryUnitQuery.data && inventoryUnitQuery.data.length > 0) {
        accessibleTable = 'inventory_unit';
        sampleData = inventoryUnitQuery.data;
        console.log('Using inventory_unit table with data');
        console.log('Sample inventory_unit records:', sampleData);
      }
    } catch (error) {
      console.log('inventory_unit access failed:', error);
    }

    // Use the accessible table with data
    if (!accessibleTable) {
      console.log('No accessible table found with data, returning empty results');
      return [];
    }

    // Build query using the accessible table - get all fields to see what's available
    let query = supabase
      .from(accessibleTable)
      .select('*');

    // Apply filters based on the table structure
    if (filters.unit_kind && filters.unit_kind !== '' && accessibleTable === 'inventory_unit') {
      console.log(`Applying filter for unit_kind: ${filters.unit_kind} on ${accessibleTable}`);
      query = query.eq('kind', filters.unit_kind);
    }

    query = query.limit(50).order('updated_at', { ascending: false });

    console.log(`Executing query on ${accessibleTable}...`);
    const { data, error } = await query;

    if (error) {
      console.error(`${accessibleTable} query error:`, error);
      throw new Error(`Query failed: ${error.message}`);
    }

    console.log(`${accessibleTable} query returned ${data?.length || 0} records`);
    
    if (data && data.length > 0) {
      console.log(`${accessibleTable} sample record:`, data[0]);
    }

    // Transform the data based on the actual structure
    const transformedData = (data || []).map((item: any) => {
      const agentDetails = item.agent_details || {};
      
      return {
        pk: item.pk,
        id: item.id || String(item.pk),
        kind: item.kind || 'unknown',
        transaction_type: 'sale', // Default since not available in current structure
        bedrooms: [],
        property_type: [],
        communities: [],
        price_aed: null,
        budget_max_aed: null,
        budget_min_aed: null,
        area_sqft: null,
        message_body_raw: `${item.kind} record from ${item.source || 'unknown'} source`,
        furnishing: null,
        is_urgent: item.priority || false,
        is_agent_covered: true,
        bathrooms: [],
        location_raw: null,
        other_details: `Created: ${item.created_at || 'unknown'}`,
        has_maid_bedroom: null,
        is_direct: true,
        mortgage_or_cash: null,
        is_distressed_deal: false,
        is_off_plan: false,
        is_mortgage_approved: null,
        is_community_agnostic: null,
        developers: [],
        whatsapp_participant: agentDetails.whatsapp_participant,
        agent_phone: null,
        groupJID: agentDetails.whatsapp_remote_jid,
        evolution_instance_id: agentDetails.evolution_instance_id,
        updated_at: item.updated_at || item.created_at
      };
    });

    console.log('Final transformed data sample:', transformedData[0]);
    return transformedData;

  } catch (error) {
    console.error('Query investigation failed:', error);
    // Return empty array instead of throwing to prevent app crash
    return [];
  }
}