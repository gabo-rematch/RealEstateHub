import { forwardRef, useCallback } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  onBlur?: () => void;
  defaultValue?: string | number;
}

// Format number with thousand separators
const formatNumber = (value: string): string => {
  // Remove all non-digit characters
  const numericValue = value.replace(/[^\d]/g, '');
  
  // Add commas for thousands
  if (numericValue === '') return '';
  return parseInt(numericValue).toLocaleString();
};

// Get numeric value without commas
const getNumericValue = (value: string): string => {
  return value.replace(/[^\d]/g, '');
};

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ onBlur, onChange, defaultValue, ...props }, ref) => {
    
    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formattedValue = formatNumber(inputValue);
      
      // Update the input with formatted value
      e.target.value = formattedValue;
      
      if (onChange) {
        onChange(e);
      }
    }, [onChange]);

    const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
      // Ensure value is properly formatted on blur
      const formattedValue = formatNumber(e.target.value);
      e.target.value = formattedValue;
      
      if (onBlur) {
        onBlur();
      }
    }, [onBlur]);

    // Format default value if provided
    const formattedDefaultValue = defaultValue ? formatNumber(defaultValue.toString()) : undefined;

    return (
      <Input
        ref={ref}
        type="text"
        defaultValue={formattedDefaultValue}
        onChange={handleChange}
        onBlur={handleBlur}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";