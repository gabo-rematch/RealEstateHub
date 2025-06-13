import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search } from "lucide-react";
import { SearchFilters } from "@/types/property";

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export function SearchFiltersComponent({ filters, onFiltersChange, onSearch, isLoading }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <Card className="sticky top-24">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Search Filters</h2>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-500">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="lg:block">
              <div className="space-y-6 mt-4 lg:mt-0">
                {/* Required Filters */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                    <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                    Required Filters
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="unit-kind" className="block text-sm font-medium text-gray-700 mb-2">
                        Kind
                      </Label>
                      <Select value={filters.unit_kind} onValueChange={(value) => updateFilter('unit_kind', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select kind" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="listing">Listing</SelectItem>
                          <SelectItem value="client_request">Client Request</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="transaction-type" className="block text-sm font-medium text-gray-700 mb-2">
                        Transaction Type
                      </Label>
                      <Select value={filters.transaction_type} onValueChange={(value) => updateFilter('transaction_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select transaction" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sale">Sale</SelectItem>
                          <SelectItem value="rent">Rent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Optional Filters */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Optional Filters</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="property-type" className="block text-sm font-medium text-gray-700 mb-2">
                        Property Type
                      </Label>
                      <Select value={filters.property_type || "any"} onValueChange={(value) => updateFilter('property_type', value === "any" ? undefined : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any property type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any property type</SelectItem>
                          <SelectItem value="residential">Residential</SelectItem>
                          <SelectItem value="commercial">Commercial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="beds" className="block text-sm font-medium text-gray-700 mb-2">
                        Bedrooms
                      </Label>
                      <Select value={filters.beds || "any"} onValueChange={(value) => updateFilter('beds', value === "any" ? undefined : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any bedrooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any bedrooms</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                          <SelectItem value="1">1 Bedroom</SelectItem>
                          <SelectItem value="2">2 Bedrooms</SelectItem>
                          <SelectItem value="3">3 Bedrooms</SelectItem>
                          <SelectItem value="4">4 Bedrooms</SelectItem>
                          <SelectItem value="5+">5+ Bedrooms</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Area (sq ft)
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min"
                          value={filters.area_sqft_min || ""}
                          onChange={(e) => updateFilter('area_sqft_min', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                        <Input
                          type="number"
                          placeholder="Max"
                          value={filters.area_sqft_max || ""}
                          onChange={(e) => updateFilter('area_sqft_max', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="block text-sm font-medium text-gray-700 mb-2">
                        Price Range (AED)
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Min price"
                          value={filters.price_min || ""}
                          onChange={(e) => updateFilter('price_min', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                        <Input
                          type="number"
                          placeholder="Max price"
                          value={filters.price_max || ""}
                          onChange={(e) => updateFilter('price_max', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="community" className="block text-sm font-medium text-gray-700 mb-2">
                        Community
                      </Label>
                      <Select value={filters.community || "any"} onValueChange={(value) => updateFilter('community', value === "any" ? undefined : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any community" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any community</SelectItem>
                          <SelectItem value="downtown">Downtown Dubai</SelectItem>
                          <SelectItem value="marina">Dubai Marina</SelectItem>
                          <SelectItem value="jbr">JBR</SelectItem>
                          <SelectItem value="business-bay">Business Bay</SelectItem>
                          <SelectItem value="palm">Palm Jumeirah</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="off-plan"
                          checked={filters.off_plan || false}
                          onCheckedChange={(checked) => updateFilter('off_plan', checked)}
                        />
                        <Label htmlFor="off-plan" className="text-sm text-gray-700">
                          Off Plan Properties
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="distressed"
                          checked={filters.distressed || false}
                          onCheckedChange={(checked) => updateFilter('distressed', checked)}
                        />
                        <Label htmlFor="distressed" className="text-sm text-gray-700">
                          Distressed Properties
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={onSearch}
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isLoading || !filters.unit_kind || !filters.transaction_type}
                >
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading ? "Searching..." : "Search Properties"}
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
