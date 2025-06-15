import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/expandable-text";
import { SupabaseProperty } from "@/types/property";
import { Bed, Bath, Square, MapPin, DollarSign, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface SupabasePropertyCardProps {
  property: SupabaseProperty;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

export function SupabasePropertyCard({ property, isSelected, onSelectionChange }: SupabasePropertyCardProps) {
  const isMobile = useIsMobile();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  const formatPrice = (price: number | null) => {
    if (!price || price === 1) return null; // Don't show if undefined, null, or 1
    if (price >= 1000000) {
      return `AED ${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `AED ${(price / 1000).toFixed(0)}K`;
    }
    return `AED ${price.toLocaleString()}`;
  };

  const formatPricePerSqft = (price: number | null, area: number | null) => {
    if (!area || !price) return null;
    const pricePerSqft = price / area;
    return `~AED ${pricePerSqft.toLocaleString(undefined, { maximumFractionDigits: 0 })}/sq ft`;
  };

  const getTransactionBadgeColor = (type: string) => {
    return type === 'sale' ? 'bg-primary-100 text-primary-800' : 'bg-green-100 text-green-800';
  };

  const truncateDescription = (text: string | null, maxLength: number = 120) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const getDisplayPrice = () => {
    if (property.kind === 'listing') {
      const formattedPrice = formatPrice(property.price_aed);
      return formattedPrice || 'Price on request';
    } else {
      // Client request - show budget range
      const minPrice = formatPrice(property.budget_min_aed);
      const maxPrice = formatPrice(property.budget_max_aed);
      
      // If both min and max are the same, only show max
      if (property.budget_min_aed && property.budget_max_aed && property.budget_min_aed === property.budget_max_aed) {
        return maxPrice || 'Budget flexible';
      }
      
      if (minPrice && maxPrice) {
        return `${minPrice} - ${maxPrice}`;
      } else if (maxPrice) {
        return `Up to ${maxPrice}`;
      } else if (minPrice) {
        return `From ${minPrice}`;
      }
      return 'Budget flexible';
    }
  };

  const getBedroomsDisplay = () => {
    if (!property.bedrooms || !Array.isArray(property.bedrooms) || property.bedrooms.length === 0) return null;
    
    // Filter out invalid bedrooms (111 or undefined/null)
    const validBedrooms = property.bedrooms.filter(bed => 
      bed !== null && bed !== undefined && bed !== 111 && typeof bed === 'number'
    );
    if (validBedrooms.length === 0) return null;
    
    const bedCount = validBedrooms[0];
    if (bedCount === 0) return 'Studio';
    return `${bedCount} Bed${bedCount !== 1 ? 's' : ''}`;
  };

  const getBathroomsDisplay = () => {
    if (!property.bathrooms || !Array.isArray(property.bathrooms) || property.bathrooms.length === 0) return null;
    
    // Filter out invalid bathrooms (undefined/null)
    const validBathrooms = property.bathrooms.filter(bath => 
      bath !== null && bath !== undefined && typeof bath === 'number'
    );
    if (validBathrooms.length === 0) return null;
    
    const bathCount = validBathrooms[0];
    return `${bathCount} Bath${bathCount !== 1 ? 's' : ''}`;
  };

  const getCommunityDisplay = () => {
    if (!property.communities || !Array.isArray(property.communities) || property.communities.length === 0) return null;
    
    // Filter out invalid communities (undefined/null/empty)
    const validCommunities = property.communities.filter(community => 
      community && community.trim() !== ''
    );
    if (validCommunities.length === 0) return null;
    
    return validCommunities[0];
  };

  // Helper function to create expandable multi-value display
  const createExpandableDisplay = (
    values: any[], 
    sectionKey: string, 
    formatSingle: (value: any) => string,
    filterValid: (value: any) => boolean = (v) => v !== null && v !== undefined
  ) => {
    if (!values || !Array.isArray(values)) return null;
    
    const validValues = values.filter(filterValid);
    if (validValues.length === 0) return null;
    
    const isExpanded = expandedSections[sectionKey];
    const shouldShowExpandToggle = validValues.length > 1 && property.kind === 'client_request';
    
    if (!shouldShowExpandToggle) {
      return formatSingle(validValues[0]);
    }
    
    const toggleExpansion = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedSections(prev => ({
        ...prev,
        [sectionKey]: !prev[sectionKey]
      }));
    };
    
    if (isExpanded) {
      return (
        <div className="space-y-1">
          {validValues.map((value, index) => (
            <div key={index}>{formatSingle(value)}</div>
          ))}
          <button 
            onClick={toggleExpansion}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <ChevronUp className="h-3 w-3" />
            Show less
          </button>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1">
        <span>{formatSingle(validValues[0])}</span>
        <button 
          onClick={toggleExpansion}
          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
        >
          <span>+{validValues.length - 1} more</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    );
  };

  // Enhanced display functions for client requests with multi-values
  const getBedroomsDisplayEnhanced = () => {
    if (!property.bedrooms || !Array.isArray(property.bedrooms)) return null;
    
    const validBedrooms = property.bedrooms.filter(bed => 
      bed !== null && bed !== undefined && bed !== 111 && typeof bed === 'number'
    );
    
    return createExpandableDisplay(
      validBedrooms,
      'bedrooms',
      (bedCount) => bedCount === 0 ? 'Studio' : `${bedCount} Bed${bedCount !== 1 ? 's' : ''}`
    );
  };

  const getPropertyTypesDisplayEnhanced = () => {
    if (!property.property_type || !Array.isArray(property.property_type)) return null;
    
    const validTypes = property.property_type.filter(type => 
      type && type.trim() !== ''
    );
    
    return createExpandableDisplay(
      validTypes,
      'property_types',
      (type) => type.charAt(0).toUpperCase() + type.slice(1)
    );
  };

  const getCommunitiesDisplayEnhanced = () => {
    if (!property.communities || !Array.isArray(property.communities)) return null;
    
    const validCommunities = property.communities.filter(community => 
      community && community.trim() !== ''
    );
    
    return createExpandableDisplay(
      validCommunities,
      'communities',
      (community) => community
    );
  };

  const getTitle = () => {
    // Generate title: xBR (Studio if x = 0) + property_type + "in" + communities
    const validBedrooms = property.bedrooms && Array.isArray(property.bedrooms) 
      ? property.bedrooms.filter(bed => bed !== null && bed !== undefined && bed !== 111 && typeof bed === 'number')
      : [];
    
    const validCommunities = property.communities && Array.isArray(property.communities)
      ? property.communities.filter(community => community && community.trim() !== '')
      : [];
    
    // Handle property type - it might be a string or array
    let propertyType = null;
    if (Array.isArray(property.property_type) && property.property_type.length > 0) {
      propertyType = property.property_type[0];
    } else if (typeof property.property_type === 'string') {
      propertyType = property.property_type;
    }
    
    let title = '';
    
    // Add bedrooms only if valid
    if (validBedrooms.length > 0) {
      const bedCount = validBedrooms[0];
      if (bedCount === 0) {
        title += 'Studio ';
      } else {
        title += `${bedCount}BR `;
      }
    }
    
    // Add property type only if valid
    if (propertyType && propertyType.trim()) {
      const formattedType = propertyType
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      title += formattedType;
      
      // Add "in" before community if both property type and community exist
      if (validCommunities.length > 0) {
        title += ' in ';
      } else {
        title += ' ';
      }
    }
    
    // Add community only if valid
    if (validCommunities.length > 0) {
      title += validCommunities[0];
    }
    
    return title.trim() || 'Property';
  };

  // Handle selection click on specific areas
  const handleSelectionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange(!isSelected);
  };

  if (isMobile) {
    return (
      <Card 
        className={cn(
          "hover:shadow-md transition-all duration-200",
          isSelected && "ring-2 ring-primary bg-primary/5"
        )}
      >
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Selection indicator and badges row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge className={getTransactionBadgeColor(property.transaction_type)} variant="secondary">
                    {property.transaction_type.charAt(0).toUpperCase() + property.transaction_type.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {property.kind === 'client_request' ? 'Request' : 'Listing'}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {getDisplayPrice()}
                </div>
                {property.area_sqft && property.area_sqft !== 1 && property.price_aed && property.price_aed !== 1 && property.kind === 'listing' && (
                  <div className="text-xs text-gray-500">
                    {property.transaction_type === 'rent' ? 'per year' : formatPricePerSqft(property.price_aed, property.area_sqft)}
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 leading-tight">
              {getTitle()}
            </h3>

            {/* Property details */}
            <div className="space-y-2 text-sm text-gray-600">
              {/* Bedrooms and Size on same line - only show if either exists */}
              {(getBedroomsDisplayEnhanced() || (property.area_sqft && property.area_sqft !== 1)) && (
                <div className="flex items-center gap-4">
                  {getBedroomsDisplayEnhanced() && (
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">{getBedroomsDisplayEnhanced()}</div>
                    </div>
                  )}
                  {property.area_sqft && property.area_sqft !== 1 && (
                    <div className="flex items-center">
                      <Square className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                      <span className="truncate">{property.area_sqft.toLocaleString()} sq ft</span>
                    </div>
                  )}
                </div>
              )}
              
              {/* Communities on separate line - only show if exists */}
              {getCommunitiesDisplayEnhanced() && (
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">{getCommunitiesDisplayEnhanced()}</div>
                </div>
              )}
              
              {/* Other details */}
              {getBathroomsDisplay() && (
                <div className="flex items-center">
                  <Bath className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="truncate">{getBathroomsDisplay()}</span>
                </div>
              )}
              
              {getPropertyTypesDisplayEnhanced() && (
                <div className="flex items-start">
                  <Square className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">{getPropertyTypesDisplayEnhanced()}</div>
                </div>
              )}
            </div>

            {/* Special badges */}
            {(property.is_off_plan || property.is_distressed_deal || property.is_urgent) && (
              <div className="flex flex-wrap gap-1">
                {property.is_off_plan && (
                  <Badge className="bg-orange-100 text-orange-800 text-xs">
                    Off Plan
                  </Badge>
                )}
                {property.is_distressed_deal && (
                  <Badge className="bg-red-100 text-red-800 text-xs">
                    Distressed
                  </Badge>
                )}
                {property.is_urgent && (
                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                    Urgent
                  </Badge>
                )}
              </div>
            )}

            {/* Description with expandable text */}
            {property.message_body_raw && (
              <ExpandableText 
                text={property.message_body_raw}
                maxLines={3}
                className="leading-relaxed"
              />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
              <span>
                {property.updated_at ? new Date(property.updated_at).toLocaleDateString() : 'Recently updated'}
              </span>
              <span>#{property.id?.slice(-6) || property.pk}</span>
            </div>

            {/* CTA Button */}
            <Button
              onClick={handleSelectionClick}
              variant={isSelected ? "outline" : "default"}
              className={cn(
                "w-full mt-3 touch-target",
                isSelected 
                  ? "border-primary text-primary hover:bg-primary/10" 
                  : "bg-primary hover:bg-primary/90 text-white"
              )}
            >
              {isSelected ? "Deselect" : "Select"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop layout (original)
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectionChange}
              className="h-5 w-5"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Badge className={getTransactionBadgeColor(property.transaction_type)}>
                    {property.transaction_type.charAt(0).toUpperCase() + property.transaction_type.slice(1)}
                  </Badge>
                  <Badge variant="secondary">
                    {property.kind === 'client_request' ? 'Client Request' : 'Listing'}
                  </Badge>
                  {property.is_off_plan && (
                    <Badge className="bg-orange-100 text-orange-800">
                      Off Plan
                    </Badge>
                  )}
                  {property.is_distressed_deal && (
                    <Badge className="bg-red-100 text-red-800">
                      Distressed
                    </Badge>
                  )}
                  {property.is_urgent && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      Urgent
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {getTitle()}
                </h3>
                
                <div className="space-y-2 text-sm text-gray-600 mb-3">
                  {/* Bedrooms and Size on same line - only show if either exists */}
                  {(getBedroomsDisplayEnhanced() || (property.area_sqft && property.area_sqft !== 1)) && (
                    <div className="flex items-center gap-6">
                      {getBedroomsDisplayEnhanced() && (
                        <div className="flex items-center">
                          <Bed className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">{getBedroomsDisplayEnhanced()}</div>
                        </div>
                      )}
                      {property.area_sqft && property.area_sqft !== 1 && (
                        <div className="flex items-center">
                          <Square className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          <span>{property.area_sqft.toLocaleString()} sq ft</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Communities on separate line - only show if exists */}
                  {getCommunitiesDisplayEnhanced() && (
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">{getCommunitiesDisplayEnhanced()}</div>
                    </div>
                  )}
                  
                  {/* Other details */}
                  {getBathroomsDisplay() && (
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{getBathroomsDisplay()}</span>
                    </div>
                  )}
                  
                  {getPropertyTypesDisplayEnhanced() && (
                    <div className="flex items-start">
                      <Square className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">{getPropertyTypesDisplayEnhanced()}</div>
                    </div>
                  )}
                </div>
                
                {property.message_body_raw && (
                  <ExpandableText 
                    text={property.message_body_raw}
                    maxLines={2}
                    className="mb-2"
                  />
                )}
                
                
              </div>
              
              <div className="flex-shrink-0 text-right ml-4">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {getDisplayPrice()}
                </div>
                {property.area_sqft && property.area_sqft !== 1 && property.price_aed && property.price_aed !== 1 && property.kind === 'listing' && (
                  <div className="text-sm text-gray-500">
                    {property.transaction_type === 'rent' ? 'per year' : formatPricePerSqft(property.price_aed, property.area_sqft)}
                  </div>
                )}
                {property.furnishing && property.furnishing.trim() !== '' && property.furnishing.toLowerCase() !== 'null' && (
                  <div className="text-xs text-gray-500 mt-1">
                    {property.furnishing}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-sm text-gray-500">
          <span>
            Updated {property.updated_at ? new Date(property.updated_at).toLocaleDateString() : 'recently'}
          </span>
          <span>ID: #{property.id || property.pk}</span>
        </div>
      </CardContent>
    </Card>
  );
}