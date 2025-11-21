import React, { useCallback, useMemo, useState } from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  onOpenChange: (open: boolean) => void;
  onCropped: (file: File) => void;
  // When true, we only preview crop for GIF but upload original to keep animation
  isGif?: boolean;
  originalFile?: File | null;
}

// Utility: create File from canvas blob
async function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas is empty'));
      resolve(new File([blob], fileName, { type: blob.type }));
    }, 'image/jpeg', 0.9);
  });
}

// Utility: crop image to a square from given pixel area
async function getCroppedCanvas(imageSrc: string, crop: Area): Promise<HTMLCanvasElement> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );
  return canvas;
}

export default function AvatarCropDialog({ open, imageSrc, onOpenChange, onCropped, isGif = false, originalFile = null }: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPx: Area) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (isGif && originalFile) {
      onCropped(originalFile);
      onOpenChange(false);
      return;
    }
    if (!imageSrc || !croppedAreaPixels) return;
    const canvas = await getCroppedCanvas(imageSrc, croppedAreaPixels);
    // Make square canvas and round mask for avatar look
    const size = Math.min(canvas.width, canvas.height);
    const squareCanvas = document.createElement('canvas');
    squareCanvas.width = size;
    squareCanvas.height = size;
    const ctx = squareCanvas.getContext('2d');
    if (!ctx) return;
    // White background for JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(canvas, 0, 0, size, size);
    ctx.restore();
    const file = await canvasToFile(squareCanvas, 'avatar.jpg');
    onCropped(file);
    onOpenChange(false);
  }, [croppedAreaPixels, imageSrc, onCropped, onOpenChange]);

  const content = useMemo(() => (
    imageSrc ? (
      <div className="relative w-full h-[50vh] bg-black/20 rounded-lg overflow-hidden">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
    ) : (
      <div className="w-full h-[50vh] flex items-center justify-center text-sm text-gray-500">
        No image selected
      </div>
    )
  ), [imageSrc, crop, zoom, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>ปรับครอปรูปโปรไฟล์</DialogTitle>
        </DialogHeader>
        {content}
        <div className="pt-4">
          <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={(v) => setZoom(v[0])} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleConfirm}>บันทึก</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


