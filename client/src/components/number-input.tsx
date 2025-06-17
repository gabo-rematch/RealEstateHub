import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
  onBlur?: () => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  ({ onBlur, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="text"
        onBlur={onBlur}
        {...props}
      />
    );
  }
);

NumberInput.displayName = "NumberInput";