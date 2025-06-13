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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Search, Check, ChevronsUpDown } from "lucide-react";
import { SearchFilters } from "@/types/property";
import { cn } from "@/lib/utils";

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

export function SearchFiltersComponent({ filters, onFiltersChange, onSearch, isLoading }: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

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
                        options={filterOptions.bedrooms?.map((bedroom: number) => 
                          bedroom === 0 ? "Studio" : `${bedroom} Bedroom${bedroom !== 1 ? "s" : ""}`
                        ) || []}
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
                          value={filters.budget_min || ""}
                          onChange={(e) => updateFilter('budget_min', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                        <Input
                          type="number"
                          placeholder="Max price"
                          value={filters.budget_max || ""}
                          onChange={(e) => updateFilter('budget_max', e.target.value ? parseInt(e.target.value) : undefined)}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="community" className="block text-sm font-medium text-gray-700 mb-2">
                        Community
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
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="off-plan"
                          checked={filters.is_off_plan || false}
                          onCheckedChange={(checked) => updateFilter('is_off_plan', checked)}
                        />
                        <Label htmlFor="off-plan" className="text-sm text-gray-700">
                          Off Plan Properties
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="distressed"
                          checked={filters.is_distressed_deal || false}
                          onCheckedChange={(checked) => updateFilter('is_distressed_deal', checked)}
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
