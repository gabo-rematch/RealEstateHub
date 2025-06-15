import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X, SlidersHorizontal } from "lucide-react";
import { SearchFilters } from "@/types/property";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
}

// Searchable Select Component (Single Select)
interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}

function SearchableSelect({ value, onValueChange, options, placeholder, searchPlaceholder, emptyText }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? options.find((option) => option === value) || placeholder
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Searchable Multi-Select Component
interface SearchableMultiSelectProps {
  values: string[];
  onValuesChange: (values: string[]) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}

function SearchableMultiSelect({ values, onValuesChange, options, placeholder, searchPlaceholder, emptyText }: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (selectedValue: string) => {
    const newValues = values.includes(selectedValue)
      ? values.filter(value => value !== selectedValue)
      : [...values, selectedValue];
    onValuesChange(newValues);
  };

  const displayText = values.length === 0 
    ? placeholder 
    : values.length === 1 
    ? values[0] 
    : `${values.length} selected`;

  // Sort options: selected items first, then remaining options alphabetically
  const sortedOptions = [...options].sort((a, b) => {
    const aSelected = values.includes(a);
    const bSelected = values.includes(b);
    
    if (aSelected && !bSelected) return -1;
    if (!aSelected && bSelected) return 1;
    return a.localeCompare(b);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {sortedOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      values.includes(option) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Helper functions for number formatting
const formatNumberWithCommas = (value: number | string): string => {
  const num = typeof value === 'string' ? value : value.toString();
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parseNumberFromFormatted = (value: string): number | undefined => {
  const cleaned = value.replace(/,/g, '');
  const num = parseInt(cleaned);
  return isNaN(num) ? undefined : num;
};

// Quick Filter Chips Component
interface FilterChipsProps {
  filters: SearchFilters;
  onRemoveFilter: (key: keyof SearchFilters, value?: string) => void;
  onClearAll: () => void;
}

function FilterChips({ filters, onRemoveFilter, onClearAll }: FilterChipsProps) {
  const activeFilters = [];

  if (filters.unit_kind) {
    activeFilters.push({ key: 'unit_kind', label: filters.unit_kind, value: filters.unit_kind });
  }
  if (filters.transaction_type) {
    activeFilters.push({ key: 'transaction_type', label: filters.transaction_type, value: filters.transaction_type });
  }
  if (filters.bedrooms?.length) {
    filters.bedrooms.forEach(bedroom => {
      const label = bedroom === '0' ? 'Studio' : `${bedroom} Bed${bedroom !== '1' ? 's' : ''}`;
      activeFilters.push({ key: 'bedrooms', label, value: bedroom });
    });
  }
  if (filters.communities?.length) {
    filters.communities.forEach(community => {
      activeFilters.push({ key: 'communities', label: community, value: community });
    });
  }
  if (filters.property_type?.length) {
    filters.property_type.forEach(type => {
      activeFilters.push({ key: 'property_type', label: type, value: type });
    });
  }

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-gray-50 border-b">
      {activeFilters.map((filter, index) => (
        <Badge 
          key={`${filter.key}-${filter.value}-${index}`} 
          variant="secondary" 
          className="cursor-pointer hover:bg-gray-300 transition-colors"
          onClick={() => onRemoveFilter(filter.key as keyof SearchFilters, filter.value)}
        >
          {filter.label}
          <X className="h-3 w-3 ml-1" />
        </Badge>
      ))}
      {activeFilters.length > 1 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearAll}
          className="h-6 text-xs text-gray-500 hover:text-gray-700"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

export function SearchFiltersComponent({ filters, onFiltersChange, onSearch, isLoading }: SearchFiltersProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch dynamic filter options from the database
  const { data: filterOptions = {} } = useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const response = await fetch('/api/filter-options');
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      return response.json();
    },
  });

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const removeFilter = (key: keyof SearchFilters, value?: string) => {
    if (key === 'bedrooms' && value) {
      const newBedrooms = filters.bedrooms?.filter(b => b !== value);
      updateFilter('bedrooms', newBedrooms?.length ? newBedrooms : undefined);
    } else if (key === 'communities' && value) {
      const newCommunities = filters.communities?.filter(c => c !== value);
      updateFilter('communities', newCommunities?.length ? newCommunities : undefined);
    } else if (key === 'property_type' && value) {
      const newTypes = filters.property_type?.filter(t => t !== value);
      updateFilter('property_type', newTypes?.length ? newTypes : undefined);
    } else {
      updateFilter(key, '');
    }
  };

  const clearAllFilters = () => {
    onFiltersChange({
      unit_kind: '',
      transaction_type: '',
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.unit_kind) count++;
    if (filters.transaction_type) count++;
    if (filters.bedrooms?.length) count += filters.bedrooms.length;
    if (filters.communities?.length) count += filters.communities.length;
    if (filters.property_type?.length) count += filters.property_type.length;
    if (filters.budget_min || filters.budget_max) count++;
    if (filters.area_sqft_min || filters.area_sqft_max) count++;
    if (filters.is_off_plan !== undefined) count++;
    if (filters.is_distressed_deal !== undefined) count++;
    return count;
  };

  const FilterContent = () => (
    <div className="space-y-6">
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
            <SearchableSelect
              value={filters.unit_kind || ""}
              onValueChange={(value) => updateFilter('unit_kind', value)}
              options={filterOptions.kinds || []}
              placeholder="Search and select kind..."
              searchPlaceholder="Search kinds..."
              emptyText="No kinds found."
            />
          </div>
          
          <div>
            <Label htmlFor="transaction-type" className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </Label>
            <SearchableSelect
              value={filters.transaction_type || ""}
              onValueChange={(value) => updateFilter('transaction_type', value)}
              options={filterOptions.transactionTypes || []}
              placeholder="Search and select transaction type..."
              searchPlaceholder="Search transaction types..."
              emptyText="No transaction types found."
            />
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
            <SearchableMultiSelect
              values={filters.property_type || []}
              onValuesChange={(values) => updateFilter('property_type', values.length === 0 ? undefined : values)}
              options={filterOptions.propertyTypes || []}
              placeholder="Search and select property types..."
              searchPlaceholder="Search property types..."
              emptyText="No property types found."
            />
          </div>
          
          <div>
            <Label htmlFor="beds" className="block text-sm font-medium text-gray-700 mb-2">
              Bedrooms
            </Label>
            <SearchableMultiSelect
              values={filters.bedrooms?.map((b) => {
                const num = parseInt(b);
                return num === 0 ? "Studio" : `${num} Bedroom${num !== 1 ? "s" : ""}`;
              }) || []}
              onValuesChange={(values) => {
                const convertedValues = values.map(v => {
                  if (v === "Studio") return "0";
                  return v.split(" ")[0]; // Extract number from "X Bedroom(s)"
                });
                updateFilter('bedrooms', convertedValues.length === 0 ? undefined : convertedValues);
              }}
              options={Array.from(new Set((filterOptions.bedrooms as number[])?.map((bedroom: number) => 
                bedroom === 0 ? "Studio" : `${bedroom} Bedroom${bedroom !== 1 ? "s" : ""}`
              ))).sort() || []}
              placeholder="Search and select bedrooms..."
              searchPlaceholder="Search bedrooms..."
              emptyText="No bedroom options found."
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Area (sq ft)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="text"
                placeholder="Min (e.g., 1,000)"
                value={filters.area_sqft_min ? formatNumberWithCommas(filters.area_sqft_min) : ""}
                onChange={(e) => updateFilter('area_sqft_min', parseNumberFromFormatted(e.target.value))}
              />
              <Input
                type="text"
                placeholder="Max (e.g., 5,000)"
                value={filters.area_sqft_max ? formatNumberWithCommas(filters.area_sqft_max) : ""}
                onChange={(e) => updateFilter('area_sqft_max', parseNumberFromFormatted(e.target.value))}
              />
            </div>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Communities
            </Label>
            <SearchableMultiSelect
              values={filters.communities || []}
              onValuesChange={(values) => updateFilter('communities', values.length === 0 ? undefined : values)}
              options={filterOptions.communities || []}
              placeholder="Search and select communities..."
              searchPlaceholder="Search communities..."
              emptyText="No communities found."
            />
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Range (AED)
            </Label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                type="text"
                placeholder="Min (e.g., 100,000)"
                value={filters.budget_min ? formatNumberWithCommas(filters.budget_min) : ""}
                onChange={(e) => updateFilter('budget_min', parseNumberFromFormatted(e.target.value))}
              />
              <Input
                type="text"
                placeholder="Max (e.g., 1,000,000)"
                value={filters.budget_max ? formatNumberWithCommas(filters.budget_max) : ""}
                onChange={(e) => updateFilter('budget_max', parseNumberFromFormatted(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="off-plan"
                  checked={filters.is_off_plan === true}
                  onCheckedChange={(checked) => updateFilter('is_off_plan', checked ? true : undefined)}
                />
                <Label htmlFor="off-plan" className="text-sm">Off-plan properties</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="distressed"
                  checked={filters.is_distressed_deal === true}
                  onCheckedChange={(checked) => updateFilter('is_distressed_deal', checked ? true : undefined)}
                />
                <Label htmlFor="distressed" className="text-sm">Distressed deals</Label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Mobile drawer version
  if (isMobile) {
    return (
      <>
        {/* Filter Chips */}
        <FilterChips 
          filters={filters}
          onRemoveFilter={removeFilter}
          onClearAll={clearAllFilters}
        />
        
        {/* Filter Button */}
        <div className="sticky top-16 z-30 bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => setIsDrawerOpen(true)}
              className="flex-1 mr-3 justify-center"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {getActiveFilterCount() > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
            <Button 
              onClick={onSearch}
              disabled={isLoading}
              className="px-8"
            >
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>

        {/* Drawer */}
        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle>Search Filters</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4 overflow-y-auto">
              <FilterContent />
            </div>
            <DrawerFooter>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={clearAllFilters}
                  className="flex-1"
                >
                  Clear All
                </Button>
                <Button 
                  onClick={() => {
                    onSearch();
                    setIsDrawerOpen(false);
                  }}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? "Searching..." : "Apply Filters"}
                </Button>
              </div>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop version
  return (
    <Card className="sticky top-24">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Search Filters</h2>
        </div>
        <FilterContent />
        <div className="mt-6 pt-4 border-t">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={clearAllFilters}
              className="flex-1"
            >
              Clear All
            </Button>
            <Button 
              onClick={onSearch}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}