import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
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