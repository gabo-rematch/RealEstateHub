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

// Fallback to direct table query if RPC function doesn't exist
export async function querySupabasePropertiesDirect(filters: SearchFilters): Promise<any[]> {
  if (!supabase) {
    throw new Error('Supabase not initialized');
  }

  let query = supabase
    .from('inventory_unit_preference')
    .select(`
      pk,
      id,
      data,
      updated_at,
      inventory_unit!inner(
        agent_details
      )
    `);

  // Apply basic filters that we can handle directly
  if (filters.unit_kind) {
    query = query.contains('data', { kind: filters.unit_kind });
  }
  
  if (filters.transaction_type) {
    query = query.contains('data', { transaction_type: filters.transaction_type });
  }

  // Order by updated_at descending
  query = query.order('updated_at', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Supabase direct query error:', error);
    throw new Error(error.message);
  }

  // Transform the data to match our expected format
  return (data || []).map((item: any) => {
    const rec = item.data || {};
    const agentDetails = item.inventory_unit?.agent_details || {};
    
    return {
      pk: item.pk,
      id: item.id,
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
      whatsapp_participant: agentDetails.whatsapp_participant,
      agent_phone: agentDetails.agent_phone,
      groupJID: agentDetails.whatsapp_remote_jid,
      evolution_instance_id: agentDetails.evolution_instance_id,
      updated_at: item.updated_at
    };
  });
}