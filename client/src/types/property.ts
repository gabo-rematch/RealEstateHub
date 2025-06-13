export interface SearchFilters {
  unit_kind: string;
  transaction_type: string;
  property_type?: string;
  beds?: string;
  area_sqft_min?: number;
  area_sqft_max?: number;
  price_min?: number;
  price_max?: number;
  community?: string;
  off_plan?: boolean;
  distressed?: boolean;
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
