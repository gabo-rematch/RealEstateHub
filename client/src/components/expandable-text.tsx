import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text, maxLines = 3, className }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  
  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(window.getComputedStyle(textRef.current).lineHeight);
      const height = textRef.current.scrollHeight;
      const lines = Math.round(height / lineHeight);
      setNeedsExpansion(lines > maxLines);
    }
  }, [text, maxLines]);
  
  if (!text) return null;

  if (!needsExpansion) {
    return (
      <p ref={textRef} className={cn("text-sm text-gray-600 dark:text-gray-300 leading-relaxed", className)}>
        {text}
      </p>
    );
  }

  return (
    <div className={className}>
      <p 
        ref={textRef}
        className={cn(
          "text-sm text-gray-600 dark:text-gray-300 leading-relaxed transition-all duration-300 ease-in-out",
          !isExpanded && `line-clamp-${maxLines}`
        )}
        style={{
          WebkitLineClamp: !isExpanded ? maxLines : 'unset',
          display: !isExpanded ? '-webkit-box' : 'block',
          WebkitBoxOrient: 'vertical',
          overflow: !isExpanded ? 'hidden' : 'visible'
        }}
      >
        {text}
      </p>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsExpanded(!isExpanded);
          
          // Haptic feedback on mobile
          if ('vibrate' in navigator) {
            navigator.vibrate(30);
          }
        }}
        className="mt-1 h-8 px-1 text-primary hover:text-primary/80 font-medium text-xs touch-target"
      >
        <span className="mr-1">
          {isExpanded ? "Show less" : "Show more"}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3 transition-transform duration-200" />
        ) : (
          <ChevronDown className="h-3 w-3 transition-transform duration-200" />
        )}
      </Button>
    </div>
  );
}