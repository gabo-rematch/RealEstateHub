import { Button } from "@/components/ui/button";
import { RotateCcw, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface NewSearchFabProps {
  onClick: () => void;
  isVisible: boolean;
}

export function NewSearchFab({ onClick, isVisible }: NewSearchFabProps) {
  const isMobile = useIsMobile();

  if (!isVisible) return null;

  return (
    <div className={cn(
      "fixed z-40 transition-all duration-300",
      isMobile 
        ? "bottom-6 right-6" // Mobile: bottom-right corner
        : "top-24 right-6"   // Desktop: top-right, below header
    )}>
      <Button
        onClick={onClick}
        className={cn(
          "shadow-lg hover:shadow-xl transition-all duration-200 bg-secondary hover:bg-secondary/90 text-secondary-foreground",
          isMobile 
            ? "h-12 px-4 rounded-full" 
            : "h-10 px-4 rounded-full"
        )}
        size={isMobile ? "default" : "sm"}
      >
        {isMobile ? (
          <>
            <Plus className="h-4 w-4 mr-2" />
            <span className="font-medium">New Search</span>
          </>
        ) : (
          <>
            <RotateCcw className="h-4 w-4 mr-2" />
            <span className="text-sm">New Search</span>
          </>
        )}
      </Button>
    </div>
  );
}