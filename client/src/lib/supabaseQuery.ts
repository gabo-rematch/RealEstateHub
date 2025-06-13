import { supabase } from './supabase';
import type { SearchFilters } from '../types/property';

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

export async function querySupabaseProperties(filters: SearchFilters, page: number = 0, pageSize: number = 50): Promise<SupabaseProperty[]> {
  if (!supabase) {
    console.log('Supabase not configured, returning empty array');
    return [];
  }

  try {
    console.log('Querying inventory_unit_preference table, filters:', filters, 'page:', page);

    // Build query using the exact structure from the provided SQL
    let query = supabase
      .from('inventory_unit_preference')
      .select(`
        pk,
        id,
        data,
        updated_at,
        inventory_unit_pk
      `);

    // Check if any filters are applied
    const hasFilters = (
      (filters.unit_kind && filters.unit_kind !== '') ||
      (filters.transaction_type && filters.transaction_type !== '') ||
      (filters.bedrooms && filters.bedrooms.length > 0) ||
      (filters.communities && filters.communities.length > 0) ||
      (filters.property_type && filters.property_type.length > 0) ||
      (filters.budget_min && filters.budget_min > 0) ||
      (filters.budget_max && filters.budget_max > 0) ||
      (filters.price_aed && filters.price_aed > 0) ||
      (filters.area_sqft_min && filters.area_sqft_min > 0) ||
      (filters.area_sqft_max && filters.area_sqft_max > 0) ||
      (filters.is_off_plan !== undefined) ||
      (filters.is_distressed_deal !== undefined)
    );

    console.log('Has filters:', hasFilters);

    // Always add basic sanity checks for valid data structure
    query = query.not('data', 'is', null);

    // Apply filters only if they are specified
    if (hasFilters) {
      console.log('Applying filters...');

      // Kind filter (unit_kind -> kind in JSONB data)
      if (filters.unit_kind && filters.unit_kind !== '') {
        console.log(`Applying kind filter: ${filters.unit_kind}`);
        query = query.eq('data->kind', filters.unit_kind);
      }

      // Transaction type filter
      if (filters.transaction_type && filters.transaction_type !== '') {
        console.log(`Applying transaction_type filter: ${filters.transaction_type}`);
        query = query.eq('data->transaction_type', filters.transaction_type);
      }

      // Bedrooms filter - use array overlap for JSONB arrays
      if (filters.bedrooms && filters.bedrooms.length > 0) {
        console.log(`Applying bedrooms filter: ${filters.bedrooms}`);
        const bedroomNumbers = filters.bedrooms.map(b => parseFloat(b)).filter(n => !isNaN(n));
        if (bedroomNumbers.length > 0) {
          // PostgreSQL array overlap operator for JSONB
          query = query.overlaps('data->bedrooms', bedroomNumbers);
        }
      }

      // Communities filter - array overlap
      if (filters.communities && filters.communities.length > 0) {
        console.log(`Applying communities filter: ${filters.communities}`);
        query = query.overlaps('data->communities', filters.communities);
      }

      // Property type filter - array overlap
      if (filters.property_type && filters.property_type.length > 0) {
        console.log(`Applying property_type filter: ${filters.property_type}`);
        query = query.overlaps('data->property_type', filters.property_type);
      }

      // Budget filters for listings only
      if (filters.budget_min && filters.budget_min > 0) {
        console.log(`Applying budget_min filter: ${filters.budget_min}`);
        // Filter for listings with price >= budget_min
        query = query.gte('data->price_aed', filters.budget_min);
      }

      if (filters.budget_max && filters.budget_max > 0) {
        console.log(`Applying budget_max filter: ${filters.budget_max}`);
        // Filter for listings with price <= budget_max
        query = query.lte('data->price_aed', filters.budget_max);
      }

      // Price filter for client requests
      if (filters.price_aed && filters.price_aed > 0) {
        console.log(`Applying price_aed filter: ${filters.price_aed}`);
        // For client requests: budget_min <= price <= budget_max
        query = query
          .lte('data->budget_min_aed', filters.price_aed)
          .gte('data->budget_max_aed', filters.price_aed);
      }

      // Area filters
      if (filters.area_sqft_min && filters.area_sqft_min > 0) {
        console.log(`Applying area_sqft_min filter: ${filters.area_sqft_min}`);
        query = query.gte('data->area_sqft', filters.area_sqft_min);
      }

      if (filters.area_sqft_max && filters.area_sqft_max > 0) {
        console.log(`Applying area_sqft_max filter: ${filters.area_sqft_max}`);
        query = query.lte('data->area_sqft', filters.area_sqft_max);
      }

      // Boolean filters
      if (filters.is_off_plan !== undefined) {
        console.log(`Applying is_off_plan filter: ${filters.is_off_plan}`);
        query = query.eq('data->is_off_plan', filters.is_off_plan);
      }

      if (filters.is_distressed_deal !== undefined) {
        console.log(`Applying is_distressed_deal filter: ${filters.is_distressed_deal}`);
        query = query.eq('data->is_distressed_deal', filters.is_distressed_deal);
      }
    } else {
      console.log('No filters applied, returning all records with basic sanity checks');
    }

    // Apply pagination
    const offset = page * pageSize;
    query = query
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    console.log(`Executing query with pagination: page ${page}, pageSize ${pageSize}, offset ${offset}`);
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
      
      // Helper function to ensure arrays
      const ensureArray = (value: any): any[] => {
        if (Array.isArray(value)) return value;
        if (value != null) return [value];
        return [];
      };

      // Helper function to ensure numeric arrays
      const ensureNumericArray = (value: any): number[] => {
        if (Array.isArray(value)) return value.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (value != null) {
          const num = parseFloat(value);
          return !isNaN(num) ? [num] : [];
        }
        return [];
      };
      
      return {
        pk: item.pk,
        id: item.id || String(item.pk),
        kind: jsonData.kind || 'unknown',
        transaction_type: jsonData.transaction_type || 'sale',
        bedrooms: ensureNumericArray(jsonData.bedrooms),
        property_type: ensureArray(jsonData.property_type),
        communities: ensureArray(jsonData.communities || jsonData.community),
        price_aed: jsonData.price_aed ? parseFloat(String(jsonData.price_aed)) : null,
        budget_max_aed: jsonData.budget_max_aed ? parseFloat(String(jsonData.budget_max_aed)) : null,
        budget_min_aed: jsonData.budget_min_aed ? parseFloat(String(jsonData.budget_min_aed)) : null,
        area_sqft: jsonData.area_sqft ? parseFloat(String(jsonData.area_sqft)) : null,
        message_body_raw: jsonData.message_body_raw || `${jsonData.kind || 'Property'} inquiry`,
        furnishing: jsonData.furnishing,
        is_urgent: jsonData.is_urgent || false,
        is_agent_covered: jsonData.is_agent_covered !== false, // Default to true
        bathrooms: ensureNumericArray(jsonData.bathrooms),
        location_raw: jsonData.location_raw,
        other_details: jsonData.other_details,
        has_maid_bedroom: jsonData.has_maid_bedroom,
        is_direct: jsonData.is_direct || false,
        mortgage_or_cash: jsonData.mortgage_or_cash,
        is_distressed_deal: jsonData.is_distressed_deal || false,
        is_off_plan: jsonData.is_off_plan || false,
        is_mortgage_approved: jsonData.is_mortgage_approved,
        is_community_agnostic: jsonData.is_community_agnostic,
        developers: ensureArray(jsonData.developers),
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
    console.error('Error querying Supabase:', error);
    return [];
  }
}

// Direct query function for testing table access
export async function testTableAccess(): Promise<boolean> {
  if (!supabase) {
    console.log('Supabase not configured');
    return false;
  }

  try {
    console.log('Testing inventory_unit_preference table access...');

    // Test basic table access
    const { data, error, count } = await supabase
      .from('inventory_unit_preference')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Table access error:', error);
      return false;
    }

    console.log(`Table accessible with ${count} total records`);
    return true;

  } catch (error) {
    console.error('Error testing table access:', error);
    return false;
  }
}

// Get sample records for debugging
export async function getSampleRecords(): Promise<any[]> {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('inventory_unit_preference')
      .select('pk, id, data, updated_at')
      .limit(5);

    if (error) {
      console.error('Sample query error:', error);
      return [];
    }

    console.log('Sample records:', data);
    return data || [];

  } catch (error) {
    console.error('Error getting sample records:', error);
    return [];
  }
}