
import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

interface ImagePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  title?: string;
}

export default function ImagePreviewDialog({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  title = "รูปภาพ"
}: ImagePreviewDialogProps) {
  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl, { credentials: 'omit' });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = imageName || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      // fallback
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = imageName;
      link.click();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none p-0 bg-black/40 backdrop-blur-sm border-0">
        <div className="absolute top-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
            aria-label="download"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
            aria-label="close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-center h-full p-4">
          <img 
            src={imageUrl} 
            alt={imageName}
            style={{ maxWidth: '100vw', maxHeight: '100vh' }}
            className="object-contain rounded-lg shadow-2xl"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
