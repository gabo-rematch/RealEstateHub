import { SearchProgress } from "@/types/property";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Database } from "lucide-react";

interface SearchProgressProps {
  progress: SearchProgress;
  isSmartFiltering?: boolean;
  className?: string;
}

export function SearchProgressComponent({ progress, isSmartFiltering = false, className }: SearchProgressProps) {
  const percentage = progress.percentage || 0;
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            {isSmartFiltering ? (
              <>
                <Zap className="h-4 w-4 text-green-500" />
                <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                  Smart Filtering
                </Badge>
              </>
            ) : (
              <>
                <Database className="h-4 w-4 text-blue-500" />
                <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                  Database Search
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {percentage}%
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700">{progress.phase}</span>
          <span className="text-gray-500">
            {progress.current} / {progress.total}
          </span>
        </div>
        
        <Progress value={percentage} className="h-2" />
        
        {isSmartFiltering && (
          <div className="flex items-center space-x-1 text-xs text-green-600">
            <Zap className="h-3 w-3" />
            <span>Using previous results for faster filtering</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface SearchLoadingIndicatorProps {
  isLoading: boolean;
  progress?: SearchProgress;
  isSmartFiltering?: boolean;
  className?: string;
}

export function SearchLoadingIndicator({ 
  isLoading, 
  progress, 
  isSmartFiltering = false, 
  className 
}: SearchLoadingIndicatorProps) {
  if (!isLoading) {
    return null;
  }

  if (progress) {
    return (
      <SearchProgressComponent 
        progress={progress} 
        isSmartFiltering={isSmartFiltering}
        className={className}
      />
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center space-x-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
        <div>
          <div className="text-sm font-medium text-gray-900">
            {isSmartFiltering ? 'Smart Filtering Properties...' : 'Searching Properties...'}
          </div>
          <div className="text-xs text-gray-500">
            {isSmartFiltering 
              ? 'Using previous results for faster filtering' 
              : 'Initializing database search...'}
          </div>
        </div>
      </div>
    </div>
  );
} 