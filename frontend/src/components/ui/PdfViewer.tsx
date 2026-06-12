import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import api from '../../lib/api';
import { LoadingSpinner } from './LoadingSpinner';

interface Props {
  url: string;
  className?: string;
}

export const PdfViewer = ({ url, className = '' }: Props) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string;
    setLoading(true);
    setError(false);
    setBlobUrl(null);

    api.get(url, { responseType: 'arraybuffer' })
      .then(res => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 ${className}`}>
        <LoadingSpinner size="md" />
        <p className="text-sm text-gray-400 mt-3">Generating PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-50 ${className}`}>
        <FileText className="w-10 h-10 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">Failed to load PDF</p>
      </div>
    );
  }

  return (
    <iframe
      src={blobUrl!}
      className={className}
      title="PDF Preview"
      style={{ border: 'none' }}
    />
  );
};
