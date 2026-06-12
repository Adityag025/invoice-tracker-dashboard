import { clsx } from 'clsx';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner = ({ size = 'md', className }: Props) => {
  const sizeClass = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' }[size];
  return (
    <div className={clsx('animate-spin rounded-full border-2 border-gray-200 border-t-blue-600', sizeClass, className)} />
  );
};

export const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <LoadingSpinner size="lg" />
  </div>
);
