import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchFilters, InquiryFormData, InquiryPayload } from "@/types/property";
import { Send, X, Phone, MessageSquare, Link2, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { env } from "@/lib/env";

const inquirySchema = z.object({
  whatsappNumber: z.string()
    .min(1, "WhatsApp number is required")
    .regex(/^\+[1-9]\d{1,14}$/, "Please enter a valid WhatsApp number with country code (e.g., +971 50 123 4567)"),
  lookingFor: z.string().min(1, "Looking for is required"),
  transactionType: z.string().min(1, "Transaction type is required"),
  propertyType: z.array(z.string()).min(1, "Property type is required"),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  listingPrice: z.number().optional(),
  bedrooms: z.array(z.string()).min(1, "Bedrooms selection is required"),
  communities: z.array(z.string()).min(1, "Communities selection is required"),
  notes: z.string().optional(),
  portalLink: z.string().optional(),
  isOffPlan: z.boolean().optional(),
  isDistressed: z.boolean().optional(),
});

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPropertyIds: string[];
  searchFilters: SearchFilters;
}

export function InquiryModal({ isOpen, onClose, selectedPropertyIds, searchFilters }: InquiryModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isMobile = useIsMobile();

  // Extract keywords from searchFilters.keyword_search
  const keywords = searchFilters.keyword_search ? searchFilters.keyword_search.split(' ').filter(k => k.trim()) : [];
  
  // Prepare initial notes with keywords
  const initialNotes = keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : '';

  const form = useForm({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      whatsappNumber: "",
      lookingFor: searchFilters.unit_kind || "listing",
      transactionType: searchFilters.transaction_type || "",
      propertyType: searchFilters.property_type || [],
      priceMin: searchFilters.budget_min || undefined,
      priceMax: searchFilters.budget_max || undefined,
      listingPrice: searchFilters.price_aed || undefined,
      bedrooms: searchFilters.bedrooms || [],
      communities: searchFilters.communities || [],
      notes: initialNotes,
      portalLink: "",
      isOffPlan: searchFilters.is_off_plan || false,
      isDistressed: searchFilters.is_distressed_deal || false,
    },
  });

  // Load saved form data from sessionStorage
  useEffect(() => {
    if (isOpen) {
      const savedData = sessionStorage.getItem('inquiryFormData');
      if (savedData) {
        try {
          const formData = JSON.parse(savedData);
          // Append keywords to saved notes
          if (keywords.length > 0) {
            const keywordText = `Keywords: ${keywords.join(', ')}`;
            formData.notes = formData.notes ? `${formData.notes}\n${keywordText}` : keywordText;
          }
          form.reset(formData);
        } catch (error) {
          console.error('Error loading saved form data:', error);
        }
      } else {
        // If no saved data, just set keywords in notes
        form.setValue('notes', initialNotes);
      }
    }
  }, [isOpen, form, keywords, initialNotes]);

  // Save form data to sessionStorage
  const saveFormData = (data: InquiryFormData) => {
    // Save without the keywords part for persistence
    const dataToSave = {
      ...data,
      notes: data.notes?.replace(/Keywords: [^\n]+\n?/, '').trim()
    };
    sessionStorage.setItem('inquiryFormData', JSON.stringify(dataToSave));
  };

  const onSubmit = async (data: InquiryFormData) => {
    setIsSubmitting(true);
    
    try {
      // Save form data for next inquiry
      saveFormData(data);

      // Check for required environment variables
      if (!env.INVENTORY_UNIT_URL || !env.INVENTORY_PREFERENCE_URL || !env.MATCH_URL) {
        throw new Error('API URLs not configured. Please check your environment variables.');
      }

      const headers = {
        'Content-Type': 'application/json',
        ...(env.API_KEY ? { 'X-API-Key': env.API_KEY } : {})
      };

      // Step 1: Create inventory unit
      const inventoryUnitPayload = {
        agentWhatsApp: data.whatsappNumber,
        unitKind: data.lookingFor,
        transactionType: data.transactionType,
        propertyType: data.propertyType,
        // Include only the appropriate price fields based on lookingFor
        ...(data.lookingFor === 'listing' 
          ? { 
              budgetMinAed: data.priceMin,
              budgetMaxAed: data.priceMax 
            }
          : {
              priceAed: data.listingPrice
            }
        ),
        beds: data.bedrooms,
        communities: data.communities,
        distressed: data.isDistressed,
        offPlan: data.isOffPlan,
        notes: data.notes,
        portalLink: data.portalLink
      };

      const inventoryResponse = await fetch(env.INVENTORY_UNIT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(inventoryUnitPayload),
      });

      if (!inventoryResponse.ok) {
        const errorText = await inventoryResponse.text();
        throw new Error(`Failed to create inventory unit: ${errorText}`);
      }

      const { inventoryUnitId } = await inventoryResponse.json();

      // Step 2: Create inventory preference
      const preferencePayload = {
        inventoryUnitId,
        transactionType: data.transactionType,
        propertyType: data.propertyType,
        beds: data.bedrooms,
        communities: data.communities,
        // Include price fields based on unit kind
        ...(data.lookingFor === 'listing' 
          ? { 
              budgetMinAed: data.priceMin,
              budgetMaxAed: data.priceMax 
            }
          : {
              priceAed: data.listingPrice
            }
        ),
      };

      const preferenceResponse = await fetch(env.INVENTORY_PREFERENCE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(preferencePayload),
      });

      if (!preferenceResponse.ok) {
        const errorText = await preferenceResponse.text();
        throw new Error(`Failed to create inventory preference: ${errorText}`);
      }

      const { preferenceId } = await preferenceResponse.json();

      // Step 3: Create matches for each selected property
      const matchPromises = selectedPropertyIds.map(propertyId => 
        fetch(env.MATCH_URL!, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            preferenceId,
            propertyId
          }),
        })
      );

      const matchResults = await Promise.allSettled(matchPromises);
      const failedMatches = matchResults.filter(result => result.status === 'rejected');

      if (failedMatches.length > 0) {
        console.error('Some matches failed:', failedMatches);
        toast({
          title: "Partial Success",
          description: `Inquiry sent, but ${failedMatches.length} matches failed to process.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Inquiry sent successfully!",
          description: `Your inquiry for ${selectedPropertyIds.length} properties has been sent.`,
        });
      }

      onClose();
    } catch (error) {
      console.error('Error sending inquiry:', error);
      toast({
        title: "Error sending inquiry",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFiltersDisplay = (filters: SearchFilters) => {
    return [
      { label: "Unit Kind", value: filters.unit_kind },
      { label: "Transaction", value: filters.transaction_type },
      { label: "Bedrooms", value: filters.bedrooms?.join(', ') || 'Any' },
      { label: "Communities", value: filters.communities?.join(', ') || 'Any' },
      { label: "Property Type", value: filters.property_type?.join(', ') || 'Any' },
    ].filter(item => item.value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Inquiry</DialogTitle>
          <p className="text-sm text-gray-500">
            Send inquiry for {selectedPropertyIds.length} selected properties
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Search Criteria Display */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Search Criteria</h4>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              {formatFiltersDisplay(searchFilters).map((item, index) => (
                <div key={index} className="flex justify-between">
                  <span className="text-gray-600">{item.label}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inquiry Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Agent Contact */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Agent Contact Details</h4>
                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        WhatsApp Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+971 50 123 4567"
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-500">
                        Include country code (e.g., +971 for UAE)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Client Requirements */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Client Requirements</h4>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="lookingFor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Looking For <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select what you're looking for" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="listing">Listing</SelectItem>
                            <SelectItem value="client_request">Client Request</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="transactionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Transaction Type <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select transaction type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="sale">Sale</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="propertyType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Property Type <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Apartment, Villa, Townhouse"
                            value={field.value?.join(', ') || ''}
                            onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price fields - conditional based on lookingFor */}
                  {form.watch('lookingFor') === 'listing' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="priceMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Price Min (AED) <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="500000"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priceMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Price Max (AED) <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="1000000"
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="listingPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Listing Price (AED) <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="750000"
                              value={field.value || ''}
                              onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="bedrooms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Bedrooms <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., 1, 2, 3"
                            value={field.value?.join(', ') || ''}
                            onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="communities"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Communities <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g., Downtown Dubai, Marina, JBR"
                            value={field.value?.join(', ') || ''}
                            onChange={(e) => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Optional Fields */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Additional Information</h4>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional requirements or notes..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch('lookingFor') === 'client_request' && (
                    <FormField
                      control={form.control}
                      name="portalLink"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Portal Link / Picture</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/portal-link"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="flex items-center space-x-4">
                    <FormField
                      control={form.control}
                      name="isOffPlan"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Off Plan</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch('lookingFor') === 'client_request' && (
                      <FormField
                        control={form.control}
                        name="isDistressed"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Distressed</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {isSubmitting ? "Sending..." : "Send Inquiry"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
