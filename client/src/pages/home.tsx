import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchFiltersComponent } from "@/components/search-filters";

import { SupabasePropertyCard } from "@/components/supabase-property-card";
import { FloatingActionButton } from "@/components/floating-action-button";
import { InquiryModal } from "@/components/inquiry-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters, SupabaseProperty } from "@/types/property";
import { Building, RotateCcw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Home() {
  const { toast } = useToast();
  const [filters, setFilters] = useState<SearchFilters>({
    unit_kind: "",
    transaction_type: "",
  });
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState("updated_at_desc");

  // Fetch properties based on filters
  const { data: properties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['properties', filters, currentPage],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      
      // Add filters to query params
      if (filters.unit_kind) queryParams.append('unit_kind', filters.unit_kind);
      if (filters.transaction_type) queryParams.append('transaction_type', filters.transaction_type);
      if (filters.bedrooms?.length) {
        filters.bedrooms.forEach(bedroom => queryParams.append('bedrooms', bedroom));
      }
      if (filters.communities?.length) {
        filters.communities.forEach(community => queryParams.append('communities', community));
      }
      if (filters.property_type?.length) {
        filters.property_type.forEach(type => queryParams.append('property_type', type));
      }
      if (filters.budget_min) queryParams.append('budget_min', filters.budget_min.toString());
      if (filters.budget_max) queryParams.append('budget_max', filters.budget_max.toString());
      if (filters.price_aed) queryParams.append('price_aed', filters.price_aed.toString());
      if (filters.area_sqft_min) queryParams.append('area_sqft_min', filters.area_sqft_min.toString());
      if (filters.area_sqft_max) queryParams.append('area_sqft_max', filters.area_sqft_max.toString());
      if (filters.is_off_plan !== undefined) queryParams.append('is_off_plan', filters.is_off_plan.toString());
      if (filters.is_distressed_deal !== undefined) queryParams.append('is_distressed_deal', filters.is_distressed_deal.toString());
      
      queryParams.append('page', currentPage.toString());
      queryParams.append('pageSize', '50');

      const response = await fetch(`/api/properties?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      
      const data = await response.json();
      
      // Deduplicate identical units based on key properties
      const uniqueProperties = data.reduce((acc: SupabaseProperty[], current: SupabaseProperty) => {
        const isDuplicate = acc.some(prop => 
          prop.message_body_raw === current.message_body_raw &&
          prop.kind === current.kind &&
          prop.communities?.[0] === current.communities?.[0] &&
          prop.bedrooms?.[0] === current.bedrooms?.[0] &&
          prop.area_sqft === current.area_sqft
        );
        
        if (!isDuplicate) {
          acc.push(current);
        }
        
        return acc;
      }, []);

      console.log('Frontend received properties:', uniqueProperties.length);
      return uniqueProperties;
    },
    enabled: true,
  });

  // Debug logging
  console.log('Component state:', { 
    propertiesLength: properties.length, 
    isLoading, 
    hasSearched, 
    error: error?.message 
  });

  const handleSearch = () => {
    setCurrentPage(0); // Reset to first page when searching
    setHasSearched(true); // Mark that a search has been performed
    refetch(); // Trigger a new query
  };

  const handleDebugTable = async () => {
    console.log('Starting comprehensive table debug...');
    
    try {
      // Test database connection and record count
      const response = await fetch('/api/test-db');
      const result = await response.json();
      
      console.log('Database test result:', result);
      
      if (result.success) {
        console.log(`Database accessible with ${result.recordCount} total records`);
        
        // Test basic property query
        const propertiesResponse = await fetch('/api/properties?page=0&pageSize=5');
        const properties = await propertiesResponse.json();
        
        console.log(`Sample query returned ${properties.length} properties`);
        if (properties.length > 0) {
          console.log('Sample property:', properties[0]);
        }
      }
      
      toast({
        title: "Debug Complete",
        description: `Database has ${result.recordCount} records. Check browser console for details.`,
      });
    } catch (error) {
      console.error('Debug error:', error);
      toast({
        title: "Debug Failed",
        description: "Check browser console for error details",
        variant: "destructive",
      });
    }
  };

  const handlePropertySelection = (propertyId: string, selected: boolean) => {
    if (selected) {
      setSelectedPropertyIds(prev => [...prev, propertyId]);
    } else {
      setSelectedPropertyIds(prev => prev.filter(id => id !== propertyId));
    }
  };

  const handleNewSearch = () => {
    setFilters({ unit_kind: "", transaction_type: "" });
    setSelectedPropertyIds([]);
    setHasSearched(false);
    sessionStorage.removeItem('inquiryFormData');
    toast({
      title: "Search reset successfully",
      description: "All filters and selections have been cleared.",
    });
  };

  const handleOpenInquiry = () => {
    setIsInquiryModalOpen(true);
  };

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Building className="text-white text-sm" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">UAE Property Portal</h1>
                  <p className="text-xs text-gray-500">Real Estate Agent Dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h2>
            <p className="text-gray-600 mb-6">
              Unable to connect to the property database. Please check your Supabase configuration.
            </p>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Building className="text-white text-sm" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">UAE Property Portal</h1>
                <p className="text-xs text-gray-500">
                  Real Estate Agent Dashboard
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={handleNewSearch}
                variant="outline"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                New Search
              </Button>
              <Button
                onClick={handleDebugTable}
                variant="outline"
                size="sm"
              >
                Debug DB
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Search Filters */}
          <div className="lg:col-span-4 xl:col-span-3">
            <SearchFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onSearch={handleSearch}
              isLoading={isLoading}
            />
          </div>

          {/* Property Results */}
          <div className="lg:col-span-8 xl:col-span-9 mt-6 lg:mt-0">
            {hasSearched ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Properties</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {properties.length} properties found
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">Sort by:</span>
                      <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="updated_at_desc">Latest Updated</SelectItem>
                          <SelectItem value="price_asc">Price: Low to High</SelectItem>
                          <SelectItem value="price_desc">Price: High to Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="animate-pulse">
                          <div className="flex space-x-4">
                            <div className="w-5 h-5 bg-gray-200 rounded"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : properties.length > 0 ? (
                  <div className="space-y-4">
                    {(properties as SupabaseProperty[]).map((property: SupabaseProperty) => (
                      <SupabasePropertyCard
                        key={property.id || property.pk}
                        property={property}
                        isSelected={selectedPropertyIds.includes(property.id || String(property.pk))}
                        onSelectionChange={(selected) => 
                          handlePropertySelection(property.id || String(property.pk), selected)
                        }
                      />
                    ))}
                    
                    {/* Pagination Controls */}
                    {properties.length > 0 && (
                      <div className="flex justify-center items-center space-x-4 mt-8 pt-6 border-t">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrentPage(prev => Math.max(0, prev - 1));
                          }}
                          disabled={currentPage === 0}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {currentPage + 1}
                        </span>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCurrentPage(prev => prev + 1);
                          }}
                          disabled={properties.length < 50}
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No properties available</h3>
                    <p className="text-gray-500 mb-6">
                      {hasSearched ? 
                        "No properties match your current search criteria. Try adjusting your filters." :
                        "The property database is currently empty. Properties will appear here once data is added to the system."
                      }
                    </p>
                    {hasSearched && (
                      <Button onClick={handleNewSearch} variant="outline">
                        Clear All Filters
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading properties...</h3>
                <p className="text-gray-500 mb-6">
                  Fetching available properties from the database.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton
        selectedCount={selectedPropertyIds.length}
        onClick={handleOpenInquiry}
        isVisible={selectedPropertyIds.length > 0}
      />

      {/* Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        selectedPropertyIds={selectedPropertyIds}
        searchFilters={filters}
      />
    </div>
  );
}
