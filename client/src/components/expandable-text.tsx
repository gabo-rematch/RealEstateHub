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

  // Format text to be more human-readable
  const formatText = (rawText: string) => {
    return rawText
      // Remove quotes at the beginning and end
      .replace(/^["']|["']$/g, '')
      // Convert literal \n to actual line breaks
      .replace(/\\n/g, '\n')
      // Clean up excessive whitespace and normalize line breaks
      .replace(/\n\s*\n/g, '\n\n')
      // Remove excessive spaces but preserve single spaces
      .replace(/[ \t]+/g, ' ')
      // Ensure proper spacing around phone numbers
      .replace(/(\+\d{12})/g, '\n$1')
      // Add spacing before bullet points or lists
      .replace(/([^\n])(Size|BUA|Height|Use|Budget|Preferred)/g, '$1\n$2')
      .trim();
  };

  const formattedText = formatText(text);
  
  // Parse text with bold formatting
  const parseTextWithBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };
  
  // More accurate line count estimation based on actual line breaks and content length
  const lines = formattedText.split('\n');
  const estimatedLineCount = lines.reduce((total, line) => {
    // Estimate wrapped lines based on character count (assuming ~50 chars per line for mobile)
    const wrappedLines = Math.max(1, Math.ceil(line.length / 50));
    return total + wrappedLines;
  }, 0);
  
  // Always show "Show more" if content is longer than maxLines, regardless of length
  const needsExpansion = estimatedLineCount > maxLines || formattedText.length > 150;

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
        {parseTextWithBold(formattedText)}
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