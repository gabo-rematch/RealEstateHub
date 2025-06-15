import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text, maxLines = 3, className }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Simple line estimation - split by common break points and estimate line count
  const estimatedLineCount = Math.ceil(text.length / 60); // Rough estimate: ~60 chars per line
  const needsExpansion = estimatedLineCount > maxLines;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking show more/less
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={className}>
      <div 
        className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap break-words"
        style={
          !isExpanded && needsExpansion 
            ? {
                display: '-webkit-box',
                WebkitLineClamp: maxLines,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden'
              }
            : {
                display: 'block'
              }
        }
      >
        {text}
      </div>
      
      {needsExpansion && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggle}
          className="h-auto p-0 mt-2 text-xs text-primary hover:text-primary/80 font-medium"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Show more
            </>
          )}
        </Button>
      )}
    </div>
  );
}