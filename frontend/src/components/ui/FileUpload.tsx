import { useRef, useState, DragEvent } from 'react';
import { Upload, X, FileText, Image, File } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onUpload: (file: File) => Promise<void>;
  accept?: string;
  label?: string;
  isUploading?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'application/pdf': FileText,
  'image/': Image,
};

function FileIcon({ mime }: { mime: string }) {
  const IconComp = Object.entries(ICON_MAP).find(([k]) => mime.startsWith(k))?.[1] ?? File;
  return <IconComp className="w-5 h-5 text-blue-500" />;
}

export const FileUpload = ({ onUpload, accept = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx', label = 'Upload file', isUploading }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [staged, setStaged] = useState<File | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setStaged(files[0]);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (!staged) return;
    await onUpload(staged);
    setStaged(null);
  };

  const fmtSize = (bytes: number) => bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="space-y-3">
      <div
        className={clsx(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-1">PDF, images, Word, Excel — up to 20 MB</p>
        <p className="text-xs text-blue-500 mt-1">Click to browse or drag & drop</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {staged && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <FileIcon mime={staged.type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{staged.name}</p>
            <p className="text-xs text-gray-500">{fmtSize(staged.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => setStaged(null)}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isUploading}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {isUploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      )}
    </div>
  );
};
