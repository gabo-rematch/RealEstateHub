import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/expandable-text";
import { SupabaseProperty } from "@/types/property";
import { Bed, Bath, Square, MapPin, DollarSign, CheckCircle2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface SupabasePropertyCardProps {
  property: SupabaseProperty;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

export function SupabasePropertyCard({ property, isSelected, onSelectionChange }: SupabasePropertyCardProps) {
  const isMobile = useIsMobile();
  
  const formatPrice = (price: number | null) => {
    if (!price) return 'Price on request';
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
      return property.price_aed ? formatPrice(property.price_aed) : 'Price on request';
    } else {
      // Client request - show budget range
      if (property.budget_min_aed && property.budget_max_aed) {
        return `${formatPrice(property.budget_min_aed)} - ${formatPrice(property.budget_max_aed)}`;
      } else if (property.budget_max_aed) {
        return `Up to ${formatPrice(property.budget_max_aed)}`;
      } else if (property.budget_min_aed) {
        return `From ${formatPrice(property.budget_min_aed)}`;
      }
      return 'Budget flexible';
    }
  };

  const getBedroomsDisplay = () => {
    if (!property.bedrooms || property.bedrooms.length === 0) return null;
    const bedCount = property.bedrooms[0];
    if (bedCount === 0) return 'Studio';
    return `${bedCount} Bed${bedCount !== 1 ? 's' : ''}`;
  };

  const getBathroomsDisplay = () => {
    if (!property.bathrooms || property.bathrooms.length === 0) return null;
    const bathCount = property.bathrooms[0];
    return `${bathCount} Bath${bathCount !== 1 ? 's' : ''}`;
  };

  const getCommunityDisplay = () => {
    if (!property.communities || property.communities.length === 0) return null;
    return property.communities[0];
  };

  const getTitle = () => {
    // Generate a title from available data
    const bedrooms = getBedroomsDisplay();
    const community = getCommunityDisplay();
    const propertyType = property.property_type?.[0];
    
    let title = '';
    if (bedrooms) title += bedrooms + ' ';
    if (propertyType) title += propertyType.charAt(0).toUpperCase() + propertyType.slice(1) + ' ';
    if (community) title += `in ${community}`;
    
    return title || 'Property';
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
                <div 
                  className="cursor-pointer touch-target p-1 -m-1"
                  onClick={handleSelectionClick}
                >
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full hover:border-primary transition-colors" />
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
                {property.area_sqft && property.price_aed && property.kind === 'listing' && (
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

            {/* Property details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
              {getBedroomsDisplay() && (
                <div className="flex items-center">
                  <Bed className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="truncate">{getBedroomsDisplay()}</span>
                </div>
              )}
              {getBathroomsDisplay() && (
                <div className="flex items-center">
                  <Bath className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="truncate">{getBathroomsDisplay()}</span>
                </div>
              )}
              {property.area_sqft && (
                <div className="flex items-center">
                  <Square className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="truncate">{property.area_sqft.toLocaleString()} sq ft</span>
                </div>
              )}
              {getCommunityDisplay() && (
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="truncate">{getCommunityDisplay()}</span>
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
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                  {getBedroomsDisplay() && (
                    <div key="bedrooms" className="flex items-center">
                      <Bed className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{getBedroomsDisplay()}</span>
                    </div>
                  )}
                  {getBathroomsDisplay() && (
                    <div key="bathrooms" className="flex items-center">
                      <Bath className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{getBathroomsDisplay()}</span>
                    </div>
                  )}
                  {property.area_sqft && (
                    <div key="area" className="flex items-center">
                      <Square className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{property.area_sqft.toLocaleString()} sq ft</span>
                    </div>
                  )}
                  {getCommunityDisplay() && (
                    <div key="community" className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{getCommunityDisplay()}</span>
                    </div>
                  )}
                </div>
                
                {property.message_body_raw && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {truncateDescription(property.message_body_raw)}
                  </p>
                )}
                
                {property.other_details && (
                  <p className="text-xs text-gray-500 mt-1">
                    {truncateDescription(property.other_details, 80)}
                  </p>
                )}
              </div>
              
              <div className="flex-shrink-0 text-right ml-4">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {getDisplayPrice()}
                </div>
                {property.area_sqft && property.price_aed && property.kind === 'listing' && (
                  <div className="text-sm text-gray-500">
                    {property.transaction_type === 'rent' ? 'per year' : formatPricePerSqft(property.price_aed, property.area_sqft)}
                  </div>
                )}
                {property.furnishing && (
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