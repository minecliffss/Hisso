// Hisso AI - Fabric.js Canvas Setup and Utilities

import {
  Canvas,
  Rect,
  Circle,
  FabricText,
  FabricImage,
  PencilBrush,
  Object as FabricObject,
} from 'fabric';
import { generateId } from '@/lib/utils/helpers';
import { useEditorStore } from '@/lib/store/editor';
import type { Layer } from '@/types';

// Re-export for convenience
export { Canvas as FabricCanvas, PencilBrush };

// Initialize Fabric Canvas
export const initCanvas = (
  canvasElement: HTMLCanvasElement,
  options: { width: number; height: number }
): Canvas => {
  const canvas = new Canvas(canvasElement, {
    width: options.width,
    height: options.height,
    backgroundColor: '#1a1a1a',
    selection: true,
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    stateful: false,
  });

  // Configure fabric defaults
  FabricObject.prototype.set({
    borderColor: '#6366f1',
    cornerColor: '#6366f1',
    cornerStrokeColor: '#ffffff',
    cornerSize: 10,
    transparentCorners: false,
    cornerStyle: 'circle',
    selectionBackgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderScaleFactor: 2,
  });

  return canvas;
};

// Setup Canvas Event Handlers
export const setupCanvasEvents = (canvas: Canvas): void => {
  const store = useEditorStore.getState();

  // Object selection
  canvas.on('selection:created', (e) => {
    const obj = e.selected?.[0];
    if (obj) {
      store.setSelectedObject(obj as any);
      const layerId = obj.get('id') as string;
      store.setSelectedLayerId(layerId);
    }
  });

  canvas.on('selection:updated', (e) => {
    const obj = e.selected?.[0];
    if (obj) {
      store.setSelectedObject(obj as any);
      const layerId = obj.get('id') as string;
      store.setSelectedLayerId(layerId);
    }
  });

  canvas.on('selection:cleared', () => {
    store.setSelectedObject(null);
    store.setSelectedLayerId(null);
  });

  // Object modification
  canvas.on('object:modified', (e) => {
    const obj = e.target;
    if (obj) {
      const layerId = obj.get('id') as string;
      store.updateLayer(layerId, {
        x: obj.left,
        y: obj.top,
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
        rotation: obj.angle,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
        flipX: obj.flipX,
        flipY: obj.flipY,
      });
      store.saveHistory('object_modified');
    }
  });

  // Object moving (for real-time updates)
  canvas.on('object:moving', (e) => {
    const obj = e.target;
    if (obj) {
      const layerId = obj.get('id') as string;
      store.updateLayer(layerId, {
        x: obj.left,
        y: obj.top,
      });
    }
  });

  // Object scaling
  canvas.on('object:scaling', (e) => {
    const obj = e.target;
    if (obj) {
      const layerId = obj.get('id') as string;
      store.updateLayer(layerId, {
        width: (obj.width || 0) * (obj.scaleX || 1),
        height: (obj.height || 0) * (obj.scaleY || 1),
        scaleX: obj.scaleX,
        scaleY: obj.scaleY,
      });
    }
  });

  // Object rotating
  canvas.on('object:rotating', (e) => {
    const obj = e.target;
    if (obj) {
      const layerId = obj.get('id') as string;
      store.updateLayer(layerId, {
        rotation: obj.angle,
      });
    }
  });
};

// Create Fabric object from layer data
export const createFabricObject = (layer: Layer): FabricObject | null => {
  const baseProps = {
    id: layer.id,
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    angle: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    flipX: layer.flipX,
    flipY: layer.flipY,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
  };

  switch (layer.type) {
    case 'shape':
      // Default shapes to rectangle
      return new Rect({
        ...baseProps,
        fill: layer.fill || '#6366f1',
        stroke: layer.stroke,
        strokeWidth: layer.strokeWidth,
      });

    case 'text':
      return new FabricText(layer.text || 'Text', {
        ...baseProps,
        fill: layer.fill || '#ffffff',
        fontFamily: layer.fontFamily || 'Inter',
        fontSize: layer.fontSize || 24,
        textAlign: 'left',
      });

    case 'image':
      if (!layer.src) return null;
      // Image creation is async, handled separately via loadImageToCanvas
      return null;

    default:
      return null;
  }
};

// Sync layer data to fabric object
export const syncLayerToObject = (
  layer: Layer,
  object: FabricObject
): void => {
  object.set({
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    angle: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    flipX: layer.flipX,
    flipY: layer.flipY,
    opacity: layer.opacity,
    visible: layer.visible,
    selectable: !layer.locked,
    evented: !layer.locked,
  });
};

// Export canvas as image
export const exportCanvas = (
  canvas: Canvas,
  options: { format?: 'png' | 'jpeg' | 'webp'; quality?: number; multiplier?: number } = {}
): string => {
  const { format = 'png', quality = 1, multiplier = 1 } = options;

  return canvas.toDataURL({
    format,
    quality,
    multiplier,
  });
};

// Load image from URL to canvas
export const loadImageToCanvas = async (
  canvas: Canvas,
  url: string,
  options: Partial<Layer> = {}
): Promise<FabricImage> => {
  const img = await FabricImage.fromURL(url, {
    crossOrigin: 'anonymous',
  });
  img.set({
    left: options.x ?? (canvas.width || 0) / 2 - ((img.width || 0) * (img.scaleX || 1)) / 2,
    top: options.y ?? (canvas.height || 0) / 2 - ((img.height || 0) * (img.scaleY || 1)) / 2,
  } as any);
  (img as any).id = generateId();
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.renderAll();
  return img;
};
