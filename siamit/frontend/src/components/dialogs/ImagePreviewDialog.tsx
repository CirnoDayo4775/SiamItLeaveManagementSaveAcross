
import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Loader2, AlertTriangle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(false);
    }
  }, [isOpen, imageUrl]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-screen h-screen max-w-none max-h-none p-0 bg-black/80 backdrop-blur-sm border-0">
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
          {loading && !error && (
            <div className="flex flex-col items-center gap-4 text-white">
              <Loader2 className="w-12 h-12 animate-spin text-white" />
              <p className="text-lg">กำลังโหลดรูปภาพ...</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-4 text-white bg-red-900/50 p-8 rounded-xl">
              <AlertTriangle className="w-12 h-12 text-yellow-400" />
              <p className="text-lg font-medium">ไม่สามารถโหลดรูปภาพได้</p>
              <p className="text-sm text-gray-300">กรุณาลองดาวน์โหลดไฟล์แทน</p>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="mt-2 bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลด
              </Button>
            </div>
          )}
          <img
            src={imageUrl}
            alt={imageName}
            style={{
              maxWidth: '100vw',
              maxHeight: '100vh',
              display: loading || error ? 'none' : 'block'
            }}
            className="object-contain rounded-lg shadow-2xl"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
