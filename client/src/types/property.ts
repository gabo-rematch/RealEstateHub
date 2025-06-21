export interface SearchFilters {
  unit_kind: string; // kind: listing or client_request
  transaction_type: string;
  property_type?: string[];
  bedrooms?: string[];
  area_sqft_min?: number;
  area_sqft_max?: number;
  budget_min?: number; // for listings
  budget_max?: number; // for listings
  price_aed?: number; // for client requests
  communities?: string[];
  is_off_plan?: boolean;
  is_distressed_deal?: boolean;
  keyword_search?: string; // for searching message_body_raw
}

export interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalResults: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PropertiesResponse {
  properties: SupabaseProperty[];
  pagination: PaginationInfo;
}

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

export interface InquiryFormData {
  whatsappNumber: string;
  lookingFor: string;
  transactionType: string;
  propertyType: string[];
  priceMin?: number;
  priceMax?: number;
  listingPrice?: number;
  bedrooms: string[];
  communities: string[];
  notes?: string;
  portalLink?: string;
  isOffPlan?: boolean;
  isDistressed?: boolean;
}

export interface InquiryPayload {
  selectedUnitIds: string[];
  formData: InquiryFormData & {
    searchCriteria: SearchFilters;
  };
  timestamp: string;
}

// New interfaces for smart filtering and progress tracking
export interface SearchProgress {
  current: number;
  total: number;
  phase: string;
  percentage?: number;
}

export interface SearchState {
  isLoading: boolean;
  progress?: SearchProgress;
  previousResults?: SupabaseProperty[];
  canUseSmartFiltering: boolean;
}

export interface PropertiesWithProgressResponse {
  type: 'progress' | 'complete' | 'error';
  properties?: SupabaseProperty[];
  pagination?: PaginationInfo;
  all_results?: SupabaseProperty[];
  current?: number;
  total?: number;
  phase?: string;
  error?: string;
  details?: string;
}