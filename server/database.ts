import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

const DATABASE_URL = null; // Temporarily disable to test Supabase connection
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// PostgreSQL connection for direct database access
const pool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
}) : null;

// Supabase client for when using Supabase credentials
const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) ? 
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Execute raw SQL queries through Supabase RPC
async function querySupabaseRPC(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  try {
    // Use Supabase RPC to execute raw SQL queries
    const { data, error } = await supabase.rpc('execute_sql', {
      query: query,
      params: params
    });

    if (error) {
      throw new Error(`Supabase RPC error: ${error.message}`);
    }

    return data || [];
  } catch (rpcError) {
    // If RPC doesn't exist, fall back to basic table queries for simple cases
    console.log('RPC not available, falling back to basic table queries');
    return await querySupabaseTable(query, params);
  }
}

// Convert PostgreSQL query to Supabase table query for basic cases
async function querySupabaseTable(query: string, params: any[] = []) {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }

  // Handle basic SELECT queries for inventory_unit_preference
  if (query.includes('inventory_unit_preference') && query.includes('SELECT')) {
    let supabaseQuery = supabase.from('inventory_unit_preference').select('pk, id, data, updated_at, inventory_unit_pk');
    
    // Apply ORDER BY updated_at DESC (default for most queries)
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
    const processedData = [];
    if (query.includes('kind')) {
      const kinds = new Set();
      data?.forEach(row => {
        if (row.data?.kind) kinds.add(row.data.kind);
      });
      kinds.forEach(kind => processedData.push({ value: kind }));
    }
    
    return processedData;
  }
  
  throw new Error('Complex SQL queries require RPC functions in Supabase or direct PostgreSQL connection');
}

export async function queryDatabase(query: string, params: any[] = []) {
  // Use PostgreSQL connection if available, otherwise fall back to Supabase
  if (pool) {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    } finally {
      client.release();
    }
  } else if (supabase) {
    // Use Supabase client - first try RPC, then fall back to table queries
    try {
      return await querySupabaseRPC(query, params);
    } catch (error) {
      console.log('Supabase RPC failed, using table queries:', error.message);
      return await querySupabaseTable(query, params);
    }
  } else {
    throw new Error('No database connection configured');
  }
}

export async function testConnection() {
  try {
    if (pool) {
      console.log('Using PostgreSQL connection');
      const result = await queryDatabase('SELECT NOW() as current_time');
      console.log('Database connection successful:', result[0]);
      return true;
    } else if (supabase) {
      console.log('Using Supabase connection');
      const { data, error } = await supabase.from('inventory_unit_preference').select('*').limit(1);
      if (error) {
        throw error;
      }
      console.log('Supabase connection successful, found', data?.length || 0, 'records');
      return true;
    } else {
      throw new Error('No database connection configured');
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}