declare module 'react-easy-crop' {
  import * as React from 'react';
  export interface Area { x: number; y: number; width: number; height: number }
  export interface Point { x: number; y: number }
  export interface CropperProps {
    image: string
    crop: Point
    zoom: number
    aspect?: number
    cropShape?: 'rect' | 'round'
    showGrid?: boolean
    onCropChange: (crop: Point) => void
    onZoomChange: (zoom: number) => void
    onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void
    classes?: Partial<Record<string, string>>
  }
  const Cropper: React.FC<CropperProps>;
  export default Cropper;
}


