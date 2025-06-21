import { useState, useEffect } from "react";
import { SearchFiltersComponent } from "@/components/search-filters";
import { SupabasePropertyCard } from "@/components/supabase-property-card";
import { FloatingActionButton } from "@/components/floating-action-button";
import { NewSearchFab } from "@/components/new-search-fab";
import { InquiryModal } from "@/components/inquiry-modal";
import { SearchLoadingIndicator } from "@/components/search-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchFilters, SupabaseProperty } from "@/types/property";
import { Building, RotateCcw, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSmartSearch } from "@/hooks/use-smart-search";
import { cn } from "@/lib/utils";

export default function Home() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<SearchFilters>({
    unit_kind: "",
    transaction_type: "",
  });
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState("updated_at_desc");
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Use the new smart search hook
  const { 
    searchProperties, 
    clearResults, 
    properties, 
    pagination, 
    error, 
    searchState 
  } = useSmartSearch({
    onProgressUpdate: (progress) => {
      // Could add additional progress handling here if needed
    },
    onError: (errorMessage) => {
      toast({
        title: "Search Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Helper function to deduplicate properties based on pk
  const deduplicateProperties = (properties: SupabaseProperty[]): SupabaseProperty[] => {
    const seen = new Set<number>();
    return properties.filter(property => {
      if (seen.has(property.pk)) {
        return false;
      }
      seen.add(property.pk);
      return true;
    });
  };

  // Get deduplicated properties
  const deduplicatedProperties = deduplicateProperties(properties);

  const handleSearch = () => {
    setCurrentPage(0);
    searchProperties(filters, 0);
  };

  // Mobile scroll behavior - hide/show header on scroll
  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up - show header
        setIsHeaderVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isMobile]);

  const handlePropertySelection = (propertyId: string, selected: boolean) => {
    if (selected) {
      setSelectedPropertyIds(prev => [...prev, propertyId]);
    } else {
      setSelectedPropertyIds(prev => prev.filter(id => id !== propertyId));
    }
  };

  const handleDeselectProperty = (propertyId: string) => {
    setSelectedPropertyIds(prev => prev.filter(id => id !== propertyId));
  };

  const handleNewSearch = () => {
    setFilters({ unit_kind: "", transaction_type: "" });
    setSelectedPropertyIds([]);
    setCurrentPage(0);
    clearResults();
    sessionStorage.removeItem('inquiryFormData');
    toast({
      title: "Search reset successfully",
      description: "All filters and selections have been cleared.",
    });
  };

  // Check if any filters are active to show New Search FAB
  const hasActiveFilters = () => {
    return Boolean(
      filters.unit_kind || 
      filters.transaction_type || 
      filters.property_type?.length || 
      filters.bedrooms?.length || 
      filters.communities?.length || 
      filters.area_sqft_min || 
      filters.area_sqft_max || 
      filters.budget_min || 
      filters.budget_max || 
      filters.price_aed || 
      filters.is_off_plan || 
      filters.is_distressed_deal || 
      filters.keyword_search
    );
  };

  const handleOpenInquiry = () => {
    setIsInquiryModalOpen(true);
  };

  // Pull-to-refresh for mobile
  const handleRefresh = async () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Haptic feedback
    }
    await searchProperties(filters, 0);
    toast({
      title: "Properties refreshed",
      description: "Showing latest property listings",
    });
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

  // Get selected properties for FAB
  const selectedProperties = selectedPropertyIds.map(id => {
    const property = deduplicatedProperties.find((p: SupabaseProperty) => p.id === id || p.pk.toString() === id);
    return property ? {
      id: property.id || property.pk.toString(),
      title: `${property.property_type?.[0] || 'Property'} in ${property.communities?.[0] || 'Dubai'}${property.bedrooms?.[0] ? ` - ${property.bedrooms[0]} BR` : ''}`
    } : null;
  }).filter(Boolean) as { id: string; title: string }[];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile-optimized Header */}
      <header className={cn(
        "bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-transform duration-300",
        isMobile && !isHeaderVisible && "-translate-y-full"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "flex items-center justify-between",
            isMobile ? "h-14" : "h-16"
          )}>
            <div className="flex items-center space-x-3">
              <div className={cn(
                "bg-primary rounded-lg flex items-center justify-center",
                isMobile ? "w-6 h-6" : "w-8 h-8"
              )}>
                <Building className={cn(
                  "text-white",
                  isMobile ? "text-xs" : "text-sm"
                )} />
              </div>
              <div>
                <h1 className={cn(
                  "font-semibold text-gray-900 dark:text-gray-100",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  {isMobile ? "UAE Properties" : "UAE Property Portal"}
                </h1>
                {!isMobile && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Real Estate Agent Dashboard
                  </p>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              {/* Mobile refresh button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  className="p-2"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              
              {/* Desktop new search button */}
              {!isMobile && (
                <Button
                  onClick={handleNewSearch}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  New Search
                </Button>
              )}
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
              isLoading={searchState.isLoading}
            />
          </div>

          {/* Property Results */}
          <div className="lg:col-span-8 xl:col-span-9 mt-6 lg:mt-0">
            {/* Search Progress Indicator */}
            <SearchLoadingIndicator
              isLoading={searchState.isLoading}
              progress={searchState.progress}
              isSmartFiltering={searchState.canUseSmartFiltering}
              className="mb-6"
            />

            {deduplicatedProperties.length > 0 ? (
              <>
                {/* Keyword Search Bar */}
                <div className="mb-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center space-x-3">
                      <Search className="h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search property descriptions, keywords, details..."
                        value={filters.keyword_search || ""}
                        onChange={(e) => setFilters(prev => ({ ...prev, keyword_search: e.target.value }))}
                        className="flex-1"
                      />
                      {filters.keyword_search && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFilters(prev => ({ ...prev, keyword_search: "" }))}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {filters.keyword_search && (
                      <p className="text-xs text-gray-500 mt-2">
                        Searching in property descriptions and details
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Properties</h2>
                      <div className="text-sm text-gray-500 mt-1 space-y-1">
                        <p>
                          Showing {properties.length} of {pagination?.totalResults || 0} total results
                          {pagination && pagination.totalPages > 1 && ` (Page ${(pagination.currentPage ?? 0) + 1} of ${pagination.totalPages})`}
                        </p>
                        {pagination && (pagination.totalResults || 0) > properties.length && (
                          <p className="text-blue-600">
                            {(pagination.totalResults || 0) - properties.length} more results available
                          </p>
                        )}
                      </div>
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

                {searchState.isLoading && deduplicatedProperties.length === 0 ? (
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
                ) : deduplicatedProperties && deduplicatedProperties.length > 0 ? (
                  <div className="space-y-4">
                    {deduplicatedProperties.map((property: SupabaseProperty, index: number) => (
                      <SupabasePropertyCard
                        key={`${property.pk}-${property.id || index}`}
                        property={property}
                        isSelected={selectedPropertyIds.includes(property.id || String(property.pk))}
                        onSelectionChange={(selected) => 
                          handlePropertySelection(property.id || String(property.pk), selected)
                        }
                      />
                    ))}
                    
                    {/* Pagination Controls */}
                    {pagination && pagination.totalPages > 1 && (
                      <div className="flex items-center justify-between py-4 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(0)}
                            disabled={currentPage === 0}
                          >
                            First
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                            disabled={currentPage === 0}
                          >
                            Previous
                          </Button>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">
                            Page {currentPage + 1} of {pagination.totalPages}
                          </span>
                          <div className="flex items-center space-x-1">
                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                              const pageNum = Math.max(0, Math.min(pagination.totalPages - 5, currentPage - 2)) + i;
                              return (
                                <Button
                                  key={pageNum}
                                  variant={pageNum === currentPage ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(pageNum)}
                                  className="w-8 h-8 p-0"
                                >
                                  {pageNum + 1}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages - 1, prev + 1))}
                            disabled={currentPage >= pagination.totalPages - 1}
                          >
                            Next
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(pagination.totalPages - 1)}
                            disabled={currentPage >= pagination.totalPages - 1}
                          >
                            Last
                          </Button>
                        </div>
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
                      The property database is currently empty. Properties will appear here once data is added to the system.
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading properties...</h3>
                <p className="text-gray-500 mb-6">
                  Fetching available properties from the database.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Search FAB */}
      <NewSearchFab
        onClick={handleNewSearch}
        isVisible={hasActiveFilters()}
      />

      {/* Enhanced Floating Action Button with Mobile Optimization */}
      <FloatingActionButton
        selectedCount={selectedPropertyIds.length}
        onClick={handleOpenInquiry}
        isVisible={selectedPropertyIds.length > 0}
        selectedProperties={selectedProperties}
        onDeselectProperty={handleDeselectProperty}
      />

      {/* Mobile-Optimized Inquiry Modal */}
      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        selectedPropertyIds={selectedPropertyIds}
        searchFilters={filters}
      />
    </div>
  );
}
