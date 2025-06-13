import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchFiltersComponent } from "@/components/search-filters";
import { PropertyCard } from "@/components/property-card";
import { FloatingActionButton } from "@/components/floating-action-button";
import { InquiryModal } from "@/components/inquiry-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters } from "@/types/property";
import { Property } from "@shared/schema";
import { supabase } from "@/lib/supabase";
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
  const [hasSearched, setHasSearched] = useState(false);
  const [sortBy, setSortBy] = useState("updated_at_desc");

  // Fetch properties based on filters
  const { data: properties = [], isLoading, error, refetch } = useQuery({
    queryKey: ['properties', filters, hasSearched],
    queryFn: async () => {
      if (!hasSearched || !filters.unit_kind || !filters.transaction_type) {
        return [];
      }

      let query = supabase
        .from('properties')
        .select('*')
        .eq('unit_kind', filters.unit_kind)
        .eq('transaction_type', filters.transaction_type);

      // Apply optional filters
      if (filters.property_type) {
        query = query.eq('property_type', filters.property_type);
      }
      if (filters.beds) {
        query = query.eq('beds', filters.beds);
      }
      if (filters.area_sqft_min) {
        query = query.gte('area_sqft', filters.area_sqft_min);
      }
      if (filters.area_sqft_max) {
        query = query.lte('area_sqft', filters.area_sqft_max);
      }
      if (filters.price_min) {
        query = query.gte('price', filters.price_min);
      }
      if (filters.price_max) {
        query = query.lte('price', filters.price_max);
      }
      if (filters.community) {
        query = query.eq('community', filters.community);
      }
      if (filters.off_plan !== undefined) {
        query = query.eq('off_plan', filters.off_plan);
      }
      if (filters.distressed !== undefined) {
        query = query.eq('distressed', filters.distressed);
      }

      // Apply sorting
      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message);
      }

      // Deduplicate identical units based on key properties
      const uniqueProperties = data?.reduce((acc: Property[], current: Property) => {
        const isDuplicate = acc.some(prop => 
          prop.title === current.title &&
          prop.unit_kind === current.unit_kind &&
          prop.community === current.community &&
          prop.beds === current.beds &&
          prop.area_sqft === current.area_sqft
        );
        
        if (!isDuplicate) {
          acc.push(current);
        }
        
        return acc;
      }, []) || [];

      return uniqueProperties;
    },
    enabled: hasSearched && !!filters.unit_kind && !!filters.transaction_type,
  });

  const handleSearch = () => {
    if (!filters.unit_kind || !filters.transaction_type) {
      toast({
        title: "Missing required filters",
        description: "Please select both Unit Kind and Transaction Type.",
        variant: "destructive",
      });
      return;
    }
    setHasSearched(true);
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
                <p className="text-xs text-gray-500">Real Estate Agent Dashboard</p>
              </div>
            </div>
            <Button
              onClick={handleNewSearch}
              variant="outline"
              size="sm"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              New Search
            </Button>
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
                    {properties.map((property) => (
                      <PropertyCard
                        key={property.id}
                        property={property}
                        isSelected={selectedPropertyIds.includes(property.id.toString())}
                        onSelectionChange={(selected) => 
                          handlePropertySelection(property.id.toString(), selected)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
                    <p className="text-gray-500 mb-6">
                      Try adjusting your search filters to see more results.
                    </p>
                    <Button onClick={handleNewSearch} variant="outline">
                      Clear All Filters
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to search properties?</h3>
                <p className="text-gray-500 mb-6">
                  Set your search criteria and click "Search Properties" to find available units.
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
