import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Supabase client for database access
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? 
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Execute raw SQL queries through Supabase RPC (fallback to table queries)
async function querySupabaseRPC(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // RPC functions not available in basic Supabase setup, so we fall back immediately
  throw new Error('RPC not available, using table queries');
}

// Convert PostgreSQL query to Supabase table query for basic cases
async function querySupabaseTable(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Handle basic SELECT queries for inventory_unit_preference
  if (query.includes('inventory_unit_preference') && query.includes('SELECT')) {
    let supabaseQuery = supabase.from('inventory_unit_preference').select('pk, id, data, updated_at, inventory_unit_pk');
    
    // Apply ORDER BY updated_at DESC and remove default limits
    supabaseQuery = supabaseQuery.order('updated_at', { ascending: false });
    
    // Apply LIMIT
    const limitMatch = query.match(/LIMIT\s+\$(\d+)/);
    if (limitMatch) {
      const paramIndex = parseInt(limitMatch[1]) - 1;
      if (params[paramIndex]) {
        supabaseQuery = supabaseQuery.limit(parseInt(params[paramIndex]));
      }
    }
    
    // Apply OFFSET
    const offsetMatch = query.match(/OFFSET\s+\$(\d+)/);
    if (offsetMatch) {
      const paramIndex = parseInt(offsetMatch[1]) - 1;
      if (params[paramIndex]) {
        supabaseQuery = supabaseQuery.range(parseInt(params[paramIndex]), parseInt(params[paramIndex]) + (limitMatch ? parseInt(params[parseInt(limitMatch[1]) - 1]) : 50) - 1);
      }
    }
    
    const { data, error } = await supabaseQuery;
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    return data || [];
  }
  
  // For filter options queries, handle specific cases
  if (query.includes('DISTINCT') && query.includes('inventory_unit_preference')) {
    // This is a filter options query - return basic data for now
    const { data, error } = await supabase.from('inventory_unit_preference').select('data').limit(1000);
    
    if (error) {
      throw new Error(`Supabase query error: ${error.message}`);
    }
    
    // Process data to extract unique values based on the query
    const processedData: any[] = [];
    if (query.includes('kind')) {
      const kinds = new Set();
      data?.forEach((row: any) => {
        if (row.data?.kind) kinds.add(row.data.kind);
      });
      kinds.forEach(kind => processedData.push({ value: kind }));
    }
    
    return processedData;
  }
  
  throw new Error('Complex SQL queries require direct Supabase query builder implementation');
}

export async function queryDatabase(query: string, params: any[] = []) {
  // Use only Supabase connection
  if (!supabase) {
    throw new Error('Supabase connection not configured - missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  
  // Try RPC first, then fall back to table queries
  try {
    return await querySupabaseRPC(query, params);
  } catch (error) {
    console.log('Supabase RPC failed, using table queries:', (error as Error).message);
    return await querySupabaseTable(query, params);
  }
}

export async function testConnection() {
  try {
    if (!supabase) {
      throw new Error('Supabase connection not configured - missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }
    
    console.log('Using Supabase connection');
    const { data, error } = await supabase.from('inventory_unit_preference').select('*').limit(1);
    if (error) {
      throw error;
    }
    console.log('Supabase connection successful, found', data?.length || 0, 'records');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}