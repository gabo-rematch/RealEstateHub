import { useState, useCallback, useRef } from 'react';
import { SearchFilters, SupabaseProperty, SearchProgress, SearchState, PropertiesWithProgressResponse, PaginationInfo } from '@/types/property';

interface SmartSearchOptions {
  onProgressUpdate?: (progress: SearchProgress) => void;
  onError?: (error: string) => void;
}

export function useSmartSearch(options: SmartSearchOptions = {}) {
  const [searchState, setSearchState] = useState<SearchState>({
    isLoading: false,
    previousResults: undefined,
    canUseSmartFiltering: false
  });

  const [properties, setProperties] = useState<SupabaseProperty[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const previousFiltersRef = useRef<SearchFilters | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Helper function to determine if new filters are a refinement of previous ones
  const isRefinement = useCallback((newFilters: SearchFilters, previousFilters: SearchFilters | null): boolean => {
    if (!previousFilters || !searchState.previousResults?.length) {
      return false;
    }

    // Check if we're only adding filters (not changing existing ones)
    const basicFiltersChanged = 
      newFilters.unit_kind !== previousFilters.unit_kind ||
      newFilters.transaction_type !== previousFilters.transaction_type ||
      newFilters.budget_min !== previousFilters.budget_min ||
      newFilters.budget_max !== previousFilters.budget_max ||
      newFilters.price_aed !== previousFilters.price_aed ||
      newFilters.area_sqft_min !== previousFilters.area_sqft_min ||
      newFilters.area_sqft_max !== previousFilters.area_sqft_max ||
      newFilters.is_off_plan !== previousFilters.is_off_plan ||
      newFilters.is_distressed_deal !== previousFilters.is_distressed_deal ||
      newFilters.keyword_search !== previousFilters.keyword_search;

    if (basicFiltersChanged) {
      return false; // Can't use smart filtering if basic filters changed
    }

    // Check if complex filters are being added (not removed or changed)
    const previousBedrooms = previousFilters.bedrooms || [];
    const newBedrooms = newFilters.bedrooms || [];
    const previousCommunities = previousFilters.communities || [];
    const newCommunities = newFilters.communities || [];
    const previousPropertyTypes = previousFilters.property_type || [];
    const newPropertyTypes = newFilters.property_type || [];

    // For refinement, all previous selections should still be present
    const bedroomsRefinement = previousBedrooms.every(b => newBedrooms.includes(b));
    const communitiesRefinement = previousCommunities.every(c => newCommunities.includes(c));
    const propertyTypesRefinement = previousPropertyTypes.every(p => newPropertyTypes.includes(p));

    // At least one filter should be more restrictive (added items)
    const hasAddedFilters = 
      newBedrooms.length > previousBedrooms.length ||
      newCommunities.length > previousCommunities.length ||
      newPropertyTypes.length > previousPropertyTypes.length;

    return bedroomsRefinement && communitiesRefinement && propertyTypesRefinement && hasAddedFilters;
  }, [searchState.previousResults]);

  // Fallback function for regular API
  const fallbackToRegularAPI = useCallback(async (filters: SearchFilters, page: number = 0, pageSize: number = 50) => {
    try {
      // Build query parameters for regular API
      const queryParams = new URLSearchParams();
      
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
      if (filters.keyword_search) queryParams.append('keyword_search', filters.keyword_search);
      
      queryParams.append('page', page.toString());
      queryParams.append('pageSize', pageSize.toString());

      const response = await fetch(`/api/properties?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch properties');
      }
      
      const data = await response.json();
      
      setProperties(data.properties || []);
      setPagination(data.pagination || null);
      
      setSearchState(prevState => ({
        ...prevState,
        isLoading: false,
        previousResults: data.properties || [],
        canUseSmartFiltering: false,
        progress: undefined
      }));

      // Update previous filters reference
      previousFiltersRef.current = filters;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch properties';
      setError(errorMessage);
      setSearchState(prevState => ({
        ...prevState,
        isLoading: false,
        progress: undefined
      }));
      
      if (options.onError) {
        options.onError(errorMessage);
      }
    }
  }, [options]);

  const searchProperties = useCallback(async (filters: SearchFilters, page: number = 0, pageSize: number = 50) => {
    // Clean up previous event source if it exists
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setError(null);
    
    const canUseSmartFiltering = isRefinement(filters, previousFiltersRef.current);
    
    setSearchState(prevState => ({
      ...prevState,
      isLoading: true,
      canUseSmartFiltering,
      progress: undefined
    }));

    // Build query parameters
    const queryParams = new URLSearchParams();
    
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
    if (filters.keyword_search) queryParams.append('keyword_search', filters.keyword_search);
    
    queryParams.append('page', page.toString());
    queryParams.append('pageSize', pageSize.toString());
    queryParams.append('is_refinement', canUseSmartFiltering.toString());

    // Add previous results if this is a refinement
    if (canUseSmartFiltering && searchState.previousResults) {
      queryParams.append('previous_results', encodeURIComponent(JSON.stringify(searchState.previousResults)));
    }

    try {
      // Use EventSource for progress tracking
      const eventSource = new EventSource(`/api/properties-with-progress?${queryParams.toString()}`);
      eventSourceRef.current = eventSource;

      // Accumulate properties from batch events
      let accumulatedProperties: SupabaseProperty[] = [];

      eventSource.onmessage = (event) => {
        try {
          const data: PropertiesWithProgressResponse = JSON.parse(event.data);
          
          switch (data.type) {
            case 'progress':
              const progress: SearchProgress = {
                current: data.current || 0,
                total: data.total || 100,
                phase: data.phase || 'Processing...',
                percentage: data.total ? Math.round((data.current || 0) / data.total * 100) : 0
              };
              
              setSearchState(prevState => ({
                ...prevState,
                progress
              }));
              
              if (options.onProgressUpdate) {
                options.onProgressUpdate(progress);
              }
              break;

            case 'batch':
              if (data.properties) {
                // Accumulate properties from batches
                accumulatedProperties = [...accumulatedProperties, ...data.properties];
                
                // Deduplicate based on pk
                const seen = new Set<number>();
                const deduplicatedProperties = accumulatedProperties.filter(property => {
                  if (seen.has(property.pk)) {
                    return false;
                  }
                  seen.add(property.pk);
                  return true;
                });
                
                // Update displayed properties immediately
                setProperties(deduplicatedProperties);
                
                // Update search state to show partial results
                setSearchState(prevState => ({
                  ...prevState,
                  isLoading: true, // Keep loading state
                  previousResults: deduplicatedProperties,
                  progress: prevState.progress
                }));
              }
              break;

            case 'complete':
              if (data.properties && data.pagination) {
                setProperties(data.properties);
                setPagination(data.pagination);
                
                // Store all results for future smart filtering
                const allResults = data.all_results || data.properties;
                setSearchState(prevState => ({
                  ...prevState,
                  isLoading: false,
                  previousResults: allResults,
                  canUseSmartFiltering: false,
                  progress: undefined
                }));

                // Update previous filters reference
                previousFiltersRef.current = filters;
              }
              eventSource.close();
              eventSourceRef.current = null;
              break;

            case 'error':
              const errorMessage = data.error || 'Failed to fetch properties';
              setError(errorMessage);
              setSearchState(prevState => ({
                ...prevState,
                isLoading: false,
                progress: undefined
              }));
              
              if (options.onError) {
                options.onError(errorMessage);
              }
              eventSource.close();
              eventSourceRef.current = null;
              break;
          }
        } catch (parseError) {
          // Error parsing SSE data
        }
      };

      eventSource.onerror = () => {
        const errorMessage = 'Connection error while fetching properties';
        // SSE connection failed, falling back to regular API
        setError(errorMessage);
        setSearchState(prevState => ({
          ...prevState,
          isLoading: false,
          progress: undefined
        }));
        
        eventSource.close();
        eventSourceRef.current = null;
        
        // Fall back to regular API
        fallbackToRegularAPI(filters, page, pageSize);
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch properties';
      // SSE setup failed, falling back to regular API
      setError(errorMessage);
      setSearchState(prevState => ({
        ...prevState,
        isLoading: false,
        progress: undefined
      }));
      
      // Fall back to regular API
      fallbackToRegularAPI(filters, page, pageSize);
    }
  }, [isRefinement, searchState.previousResults, options, fallbackToRegularAPI]);

  const clearResults = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    setProperties([]);
    setPagination(null);
    setError(null);
    setSearchState({
      isLoading: false,
      previousResults: undefined,
      canUseSmartFiltering: false
    });
    previousFiltersRef.current = null;
  }, []);

  return {
    searchProperties,
    clearResults,
    properties,
    pagination,
    error,
    searchState
  };
} 