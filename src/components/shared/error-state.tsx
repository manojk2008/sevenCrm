import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"> {
  title?: string;
  description?: string;
  onRetry?: () => void;
  showDetails?: boolean;
  errorMessage?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We encountered an error while trying to load this data. Please try again.',
  onRetry,
  showDetails,
  errorMessage,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-destructive/20 bg-destructive/5',
        className
      )}
      {...props}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-destructive">
        {title}
      </h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      
      {showDetails && errorMessage && (
        <div className="mb-6 w-full max-w-md rounded-md bg-muted p-3 text-left text-xs font-mono text-muted-foreground overflow-auto">
          {errorMessage}
        </div>
      )}

      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Retry
        </Button>
      )}
    </motion.div>
  );
}