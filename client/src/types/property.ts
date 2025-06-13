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
}

export interface InquiryFormData {
  whatsappNumber: string;
  notes?: string;
  portalLink?: string;
}

export interface InquiryPayload {
  selectedUnitIds: string[];
  formData: InquiryFormData & {
    searchCriteria: SearchFilters;
  };
  timestamp: string;
}
