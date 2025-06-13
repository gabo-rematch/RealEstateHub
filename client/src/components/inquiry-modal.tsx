import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { SearchFilters, InquiryFormData, InquiryPayload } from "@/types/property";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const inquirySchema = z.object({
  whatsappNumber: z.string()
    .min(1, "WhatsApp number is required")
    .regex(/^\+[1-9]\d{1,14}$/, "Please enter a valid WhatsApp number with country code (e.g., +971 50 123 4567)"),
  notes: z.string().optional(),
  portalLink: z.string().url().optional().or(z.literal("")),
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

  const form = useForm<InquiryFormData>({
    resolver: zodResolver(inquirySchema),
    defaultValues: {
      whatsappNumber: "",
      notes: "",
      portalLink: "",
    },
  });

  // Load saved form data from sessionStorage
  useEffect(() => {
    if (isOpen) {
      const savedData = sessionStorage.getItem('inquiryFormData');
      if (savedData) {
        try {
          const formData = JSON.parse(savedData);
          form.reset(formData);
        } catch (error) {
          console.error('Error loading saved form data:', error);
        }
      }
    }
  }, [isOpen, form]);

  // Save form data to sessionStorage
  const saveFormData = (data: InquiryFormData) => {
    sessionStorage.setItem('inquiryFormData', JSON.stringify(data));
  };

  const onSubmit = async (data: InquiryFormData) => {
    setIsSubmitting(true);
    
    try {
      // Save form data for next inquiry
      saveFormData(data);

      // Prepare payload
      const payload: InquiryPayload = {
        selectedUnitIds: selectedPropertyIds,
        formData: {
          ...data,
          searchCriteria: searchFilters,
        },
        timestamp: new Date().toISOString(),
      };

      // Send to webhook or simulate in demo mode
      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;
      
      if (!webhookUrl) {
        // Demo mode - simulate webhook submission
        console.log('Demo mode: Inquiry payload:', payload);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
      } else {
        // Production mode - send to actual webhook
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      toast({
        title: "Inquiry sent successfully!",
        description: `Your inquiry for ${selectedPropertyIds.length} properties has been sent.`,
      });

      onClose();
    } catch (error) {
      console.error('Error sending inquiry:', error);
      toast({
        title: "Error sending inquiry",
        description: "Please try again later.",
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
      { label: "Property Type", value: filters.property_type },
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

                  <FormField
                    control={form.control}
                    name="portalLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Portal Link / Image URL</FormLabel>
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
