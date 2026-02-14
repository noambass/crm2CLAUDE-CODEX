import React from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ErrorState from '@/components/shared/ErrorState';
import EmptyState from '@/components/shared/EmptyState';

export default function StatePanel({
  loading = false,
  error = '',
  onRetry,
  isEmpty = false,
  emptyProps,
  children,
}) {
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState {...emptyProps} />;
  return children;
}
