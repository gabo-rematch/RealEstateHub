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
    // Check all accessible tables to find where the 45k+ records are stored
    console.log('Checking all accessible tables for property data...');
    
    const tablesToCheck = [
      'inventory_unit_preference',
      'inventory_unit', 
      'message',
      'inventory',
      'unit_preference',
      'preferences',
      'property_data'
    ];
    
    let workingTable = null;
    let sampleData = null;
    
    for (const tableName of tablesToCheck) {
      try {
        console.log(`Testing table: ${tableName}`);
        const testQuery = await supabase
          .from(tableName)
          .select('*')
          .limit(3);
        
        console.log(`${tableName} result:`, {
          error: testQuery.error?.message || null,
          count: testQuery.data?.length || 0
        });
        
        if (!testQuery.error && testQuery.data && testQuery.data.length > 0) {
          console.log(`${tableName} sample record:`, testQuery.data[0]);
          console.log(`${tableName} fields:`, Object.keys(testQuery.data[0]));
          
          // Check if this table has property data
          const sample = testQuery.data[0];
          if (sample.data || sample.kind || sample.rec_kind || sample.property_type) {
            workingTable = tableName;
            sampleData = testQuery.data;
            console.log(`Found property data in ${tableName}`);
            break;
          }
        }
      } catch (error) {
        console.log(`${tableName} access failed:`, error);
      }
    }
    
    if (!workingTable) {
      console.log('No accessible table found with property data');
      return [];
    }
    
    console.log(`Using table: ${workingTable}`);
    
    // Try count query to see how many records are accessible
    try {
      const countQuery = await supabase
        .from(workingTable)
        .select('*', { count: 'exact', head: true });
      
      console.log(`${workingTable} total count:`, countQuery.count);
    } catch (error) {
      console.log('Count query failed:', error);
    }

    // Build the main query using the working table we found
    let query = supabase
      .from(workingTable)
      .select('*');
    
    // Determine the data structure and apply filters accordingly
    const hasJsonbData = sampleData && sampleData[0] && sampleData[0].data;
    console.log('Table has JSONB data field:', hasJsonbData);

    // Apply filters based on the table structure
    if (hasJsonbData) {
      // For tables with JSONB data field
      console.log('Applying JSONB filters...');
      
      if (filters.unit_kind && filters.unit_kind !== '') {
        console.log(`Applying JSONB filter for unit_kind: ${filters.unit_kind}`);
        query = query.or(`data->>rec_kind.eq.${filters.unit_kind},data->>kind.eq.${filters.unit_kind}`);
      }

      if (filters.transaction_type && filters.transaction_type !== '') {
        console.log(`Applying JSONB filter for transaction_type: ${filters.transaction_type}`);
        query = query.or(`data->>rec_transaction_type.eq.${filters.transaction_type},data->>transaction_type.eq.${filters.transaction_type}`);
      }
    } else {
      // For tables with direct fields (inventory_unit table)
      console.log('Applying direct field filters...');
      
      if (filters.unit_kind && filters.unit_kind !== '') {
        console.log(`Applying direct filter for unit_kind: ${filters.unit_kind}`);
        query = query.eq('kind', filters.unit_kind);
      }

      // Note: inventory_unit table doesn't have transaction_type field, it's in the JSONB data
      // We'll skip transaction_type filtering for direct field tables for now
      if (filters.transaction_type && filters.transaction_type !== '') {
        console.log(`Skipping transaction_type filter - not available in ${workingTable} table structure`);
      }
    }

    // Add other property filters based on table structure
    if (hasJsonbData) {
      // JSONB filtering
      if (filters.bedrooms && filters.bedrooms.length > 0) {
        console.log(`Applying JSONB bedroom filter: ${filters.bedrooms}`);
        const bedroomFilters = filters.bedrooms.map(bed => 
          `data->>bedrooms.cs.["${bed}"]`
        ).join(',');
        if (bedroomFilters) {
          query = query.or(bedroomFilters);
        }
      }

      if (filters.communities && filters.communities.length > 0) {
        console.log(`Applying JSONB community filter: ${filters.communities}`);
        const communityFilters = filters.communities.map(community => 
          `data->>communities.cs.["${community}"]`
        ).join(',');
        if (communityFilters) {
          query = query.or(communityFilters);
        }
      }

      if (filters.budget_min && filters.budget_min > 0) {
        console.log(`Applying JSONB budget_min filter: ${filters.budget_min}`);
        query = query.gte('data->>price_aed', filters.budget_min.toString());
      }

      if (filters.budget_max && filters.budget_max > 0) {
        console.log(`Applying JSONB budget_max filter: ${filters.budget_max}`);
        query = query.lte('data->>price_aed', filters.budget_max.toString());
      }

      if (filters.area_sqft_min && filters.area_sqft_min > 0) {
        console.log(`Applying JSONB area_sqft_min filter: ${filters.area_sqft_min}`);
        query = query.gte('data->>area_sqft', filters.area_sqft_min.toString());
      }

      if (filters.area_sqft_max && filters.area_sqft_max > 0) {
        console.log(`Applying JSONB area_sqft_max filter: ${filters.area_sqft_max}`);
        query = query.lte('data->>area_sqft', filters.area_sqft_max.toString());
      }

      if (filters.is_off_plan !== undefined) {
        console.log(`Applying JSONB is_off_plan filter: ${filters.is_off_plan}`);
        query = query.eq('data->>is_off_plan', filters.is_off_plan.toString());
      }

      if (filters.is_distressed_deal !== undefined) {
        console.log(`Applying JSONB is_distressed_deal filter: ${filters.is_distressed_deal}`);
        query = query.eq('data->>is_distressed_deal', filters.is_distressed_deal.toString());
      }
    } else {
      // Direct field filtering for non-JSONB tables
      if (filters.bedrooms && filters.bedrooms.length > 0) {
        console.log(`Applying direct bedroom filter: ${filters.bedrooms}`);
        query = query.in('bedrooms', filters.bedrooms);
      }

      if (filters.communities && filters.communities.length > 0) {
        console.log(`Applying direct community filter: ${filters.communities}`);
        query = query.in('communities', filters.communities);
      }

      if (filters.budget_min && filters.budget_min > 0) {
        console.log(`Applying direct budget_min filter: ${filters.budget_min}`);
        query = query.gte('price_aed', filters.budget_min);
      }

      if (filters.budget_max && filters.budget_max > 0) {
        console.log(`Applying direct budget_max filter: ${filters.budget_max}`);
        query = query.lte('price_aed', filters.budget_max);
      }
    }

    // Order by updated_at and limit results
    query = query.order('updated_at', { ascending: false }).limit(50);

    console.log(`Executing ${workingTable} query...`);
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

    // Transform the data to our expected format based on table structure
    const transformedData = (data || []).map((item: any) => {
      let sourceData: any;
      
      if (hasJsonbData) {
        // Extract from JSONB data field
        sourceData = item.data || {};
      } else {
        // Use direct fields
        sourceData = item;
      }
      
      return {
        pk: item.pk,
        id: item.id || String(item.pk),
        kind: sourceData.rec_kind || sourceData.kind || 'unknown',
        transaction_type: sourceData.rec_transaction_type || sourceData.transaction_type || 'sale',
        bedrooms: Array.isArray(sourceData.bedrooms) ? sourceData.bedrooms : 
                 (sourceData.bedrooms ? [sourceData.bedrooms] : []),
        property_type: Array.isArray(sourceData.property_type) ? sourceData.property_type : 
                      (sourceData.property_type ? [sourceData.property_type] : []),
        communities: Array.isArray(sourceData.communities) ? sourceData.communities : 
                    Array.isArray(sourceData.community) ? sourceData.community :
                    (sourceData.communities || sourceData.community ? [sourceData.communities || sourceData.community] : []),
        price_aed: sourceData.price_aed ? parseFloat(String(sourceData.price_aed)) : null,
        budget_max_aed: sourceData.budget_max_aed ? parseFloat(String(sourceData.budget_max_aed)) : null,
        budget_min_aed: sourceData.budget_min_aed ? parseFloat(String(sourceData.budget_min_aed)) : null,
        area_sqft: sourceData.area_sqft ? parseFloat(String(sourceData.area_sqft)) : null,
        message_body_raw: sourceData.message_body_raw || `${sourceData.rec_kind || sourceData.kind || 'Property'} inquiry`,
        furnishing: sourceData.furnishing,
        is_urgent: sourceData.is_urgent || item.priority || false,
        is_agent_covered: sourceData.is_agent_covered || true,
        bathrooms: Array.isArray(sourceData.bathrooms) ? sourceData.bathrooms : 
                  (sourceData.bathrooms ? [sourceData.bathrooms] : []),
        location_raw: sourceData.location_raw,
        other_details: sourceData.other_details,
        has_maid_bedroom: sourceData.has_maid_bedroom,
        is_direct: sourceData.is_direct || false,
        mortgage_or_cash: sourceData.mortgage_or_cash,
        is_distressed_deal: sourceData.is_distressed_deal || false,
        is_off_plan: sourceData.is_off_plan || false,
        is_mortgage_approved: sourceData.is_mortgage_approved,
        is_community_agnostic: sourceData.is_community_agnostic,
        developers: Array.isArray(sourceData.developers) ? sourceData.developers : 
                   (sourceData.developers ? [sourceData.developers] : []),
        whatsapp_participant: sourceData.whatsapp_participant || item.agent_details?.whatsapp_participant,
        agent_phone: sourceData.agent_phone,
        groupJID: sourceData.groupJID || item.agent_details?.whatsapp_remote_jid,
        evolution_instance_id: sourceData.evolution_instance_id || item.agent_details?.evolution_instance_id,
        updated_at: item.updated_at || item.created_at
      };
    });

    console.log('Final transformed data sample:', transformedData[0]);
    return transformedData;

  } catch (error) {
    console.error('Query failed:', error);
    return [];
  }
}