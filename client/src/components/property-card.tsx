import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Property } from "@shared/schema";
import { Bed, Bath, Square, MapPin } from "lucide-react";

interface PropertyCardProps {
  property: Property;
  isSelected: boolean;
  onSelectionChange: (selected: boolean) => void;
}

export function PropertyCard({ property, isSelected, onSelectionChange }: PropertyCardProps) {
  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    if (numPrice >= 1000000) {
      return `AED ${(numPrice / 1000000).toFixed(1)}M`;
    } else if (numPrice >= 1000) {
      return `AED ${(numPrice / 1000).toFixed(0)}K`;
    }
    return `AED ${numPrice.toLocaleString()}`;
  };

  const formatPricePerSqft = (price: string, area: number | null) => {
    if (!area) return null;
    const numPrice = parseFloat(price);
    const pricePerSqft = numPrice / area;
    return `~AED ${pricePerSqft.toLocaleString(undefined, { maximumFractionDigits: 0 })}/sq ft`;
  };

  const getTransactionBadgeColor = (type: string) => {
    return type === 'sale' ? 'bg-primary-100 text-primary-800' : 'bg-green-100 text-green-800';
  };

  const truncateDescription = (text: string | null, maxLength: number = 120) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

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
                    {property.unit_kind.charAt(0).toUpperCase() + property.unit_kind.slice(1)}
                  </Badge>
                  {property.off_plan && (
                    <Badge className="bg-orange-100 text-orange-800">
                      Off Plan
                    </Badge>
                  )}
                  {property.distressed && (
                    <Badge className="bg-red-100 text-red-800">
                      Distressed
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {property.title}
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                  {property.beds && (
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{property.beds} Bed{property.beds !== '1' ? 's' : ''}</span>
                    </div>
                  )}
                  {property.baths && (
                    <div className="flex items-center">
                      <Bath className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{property.baths} Bath{property.baths !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {property.area_sqft && (
                    <div className="flex items-center">
                      <Square className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{property.area_sqft.toLocaleString()} sq ft</span>
                    </div>
                  )}
                  {property.community && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      <span>{property.community}</span>
                    </div>
                  )}
                </div>
                
                {property.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {truncateDescription(property.description)}
                  </p>
                )}
              </div>
              
              <div className="flex-shrink-0 text-right ml-4">
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatPrice(property.price)}
                </div>
                {property.area_sqft && (
                  <div className="text-sm text-gray-500">
                    {property.transaction_type === 'rent' ? 'per year' : formatPricePerSqft(property.price, property.area_sqft)}
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
          <span>ID: #{property.property_id || property.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}
