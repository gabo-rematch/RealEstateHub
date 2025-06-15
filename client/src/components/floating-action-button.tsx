import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, ChevronUp, ChevronDown, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  selectedCount: number;
  onClick: () => void;
  isVisible: boolean;
  selectedProperties?: { id: string; title: string }[];
  onDeselectProperty?: (propertyId: string) => void;
}

export function FloatingActionButton({ 
  selectedCount, 
  onClick, 
  isVisible, 
  selectedProperties = [],
  onDeselectProperty 
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isMobile = useIsMobile();

  if (!isVisible) return null;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleMainClick = () => {
    if (isMobile && selectedCount <= 3) {
      // On mobile with few selections, go directly to inquiry
      onClick();
    } else if (isExpanded) {
      // If expanded, close and open inquiry
      setIsExpanded(false);
      onClick();
    } else {
      // Otherwise, expand to show preview
      setIsExpanded(true);
    }
  };

  const handleDeselectProperty = (e: React.MouseEvent, propertyId: string) => {
    e.stopPropagation();
    onDeselectProperty?.(propertyId);
  };

  // Mobile-optimized FAB positioning (bottom center)
  const fabPosition = isMobile 
    ? "fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50"
    : "fixed bottom-6 right-6 z-50";

  return (
    <div className={fabPosition}>
      {/* Expanded preview */}
      {isExpanded && selectedProperties.length > 0 && (
        <Card className="mb-4 max-w-sm animate-in slide-in-from-bottom-2 duration-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Selected Properties</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleExpand}
                className="h-8 w-8 p-0"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedProperties.slice(0, 5).map((property) => (
                <div key={property.id} className="flex items-center justify-between text-sm bg-gray-50 rounded p-2">
                  <span className="truncate flex-1 mr-2">{property.title}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeselectProperty(e, property.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {selectedCount > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  +{selectedCount - 5} more properties
                </div>
              )}
            </div>
            <Button 
              onClick={onClick} 
              className="w-full mt-3"
              size="sm"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Inquiry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main FAB */}
      <Button
        onClick={handleMainClick}
        className={cn(
          "relative shadow-lg hover:shadow-xl transition-all duration-200",
          isMobile 
            ? "h-14 px-6 rounded-full bg-primary hover:bg-primary/90" 
            : "w-14 h-14 rounded-full bg-primary hover:bg-primary/90",
          isExpanded && "scale-105"
        )}
        size={isMobile ? "default" : "icon"}
      >
        {isMobile ? (
          <>
            <Mail className="h-5 w-5 mr-2" />
            <span className="font-medium">
              {selectedCount === 1 ? "1 Property" : `${selectedCount} Properties`}
            </span>
          </>
        ) : (
          <>
            <Mail className="h-5 w-5" />
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {selectedCount}
            </div>
          </>
        )}
        
        {/* Expand indicator for desktop */}
        {!isMobile && selectedCount > 1 && (
          <div className="absolute -bottom-1 -right-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleExpand}
              className="h-6 w-6 p-0 rounded-full"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </Button>
    </div>
  );
}
