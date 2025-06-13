import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface FloatingActionButtonProps {
  selectedCount: number;
  onClick: () => void;
  isVisible: boolean;
}

export function FloatingActionButton({ selectedCount, onClick, isVisible }: FloatingActionButtonProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 lg:bottom-6 lg:left-6 z-50">
      <Button
        onClick={onClick}
        className="relative w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl"
        size="icon"
      >
        <Mail className="h-5 w-5" />
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
          {selectedCount}
        </div>
      </Button>
    </div>
  );
}
