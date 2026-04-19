'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Canvas, FabricText, PencilBrush } from 'fabric';
import { useEditorStore } from '@/lib/store/editor';
import { initCanvas, setupCanvasEvents, loadImageToCanvas } from '@/lib/canvas/fabric';
import { generateId, readFileAsDataURL } from '@/lib/utils/helpers';

export function CanvasComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);

  const {
    setCanvas,
    zoom,
    showGrid,
    gridSize,
    activeTool,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    addLayer,
    saveHistory,
  } = useEditorStore();

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const fabricCanvas = initCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
    });

    fabricCanvas.backgroundColor = backgroundColor;
    fabricCanvas.renderAll();

    setupCanvasEvents(fabricCanvas);
    fabricCanvasRef.current = fabricCanvas;
    setCanvas(fabricCanvas as any);

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [setCanvas, canvasWidth, canvasHeight, backgroundColor]);

  // Handle zoom changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.setZoom(zoom);
      canvas.renderAll();
    }
  }, [zoom]);

  // Handle tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.isDrawingMode = false;
    canvas.selection = true;
    canvas.defaultCursor = 'default';

    switch (activeTool) {
      case 'hand':
        canvas.selection = false;
        canvas.defaultCursor = 'grab';
        break;

      case 'text':
        canvas.defaultCursor = 'text';
        break;

      case 'select':
      default:
        canvas.selection = true;
        break;
    }
  }, [activeTool]);

  // Handle click to add text
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!fabricCanvasRef.current || activeTool !== 'text') return;

    const canvas = fabricCanvasRef.current;
    const pointer = canvas.getScenePoint(e.nativeEvent);

    const text = new FabricText('Double click to edit', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#ffffff',
      textAlign: 'left',
    });
    (text as any).id = generateId();
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    addLayer({
      type: 'text',
      name: 'Text',
      x: pointer.x,
      y: pointer.y,
      width: 200,
      height: 30,
      text: 'Double click to edit',
      fontFamily: 'Inter',
      fontSize: 24,
      fill: '#ffffff',
    });
    saveHistory('add_text');
  }, [activeTool, addLayer, saveHistory]);

  // Handle drag-and-drop image import
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    try {
      const dataUrl = await readFileAsDataURL(file);
      const img = await loadImageToCanvas(canvas, dataUrl);
      addLayer({
        type: 'image',
        name: file.name.replace(/\.[^/.]+$/, ''),
        src: dataUrl,
        width: (img.width || 0) * (img.scaleX || 1),
        height: (img.height || 0) * (img.scaleY || 1),
        x: img.left || 0,
        y: img.top || 0,
      });
      saveHistory('import_image');
    } catch (err) {
      console.error('Failed to import dropped image:', err);
    }
  }, [addLayer, saveHistory]);

  // Render grid
  const renderGrid = () => {
    if (!showGrid) return null;

    const lines = [];
    const gridCount = Math.max(canvasWidth, canvasHeight) / gridSize;

    for (let i = 0; i <= gridCount; i++) {
      const pos = i * gridSize * zoom;

      lines.push(
        <line key={`v-${i}`} x1={pos} y1={0} x2={pos} y2={canvasHeight * zoom} stroke="#333333" strokeWidth={0.5 / zoom} />
      );
      lines.push(
        <line key={`h-${i}`} x1={0} y1={pos} x2={canvasWidth * zoom} y2={pos} stroke="#333333" strokeWidth={0.5 / zoom} />
      );
    }

    return lines;
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-[#1a1a1a] overflow-hidden"
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {showGrid && (
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}
        >
          {renderGrid()}
        </svg>
      )}

      <div
        className="absolute inset-0 flex items-center justify-center overflow-auto"
        style={{ minWidth: canvasWidth * zoom, minHeight: canvasHeight * zoom }}
      >
        <canvas
          ref={canvasRef}
          className="shadow-2xl"
          style={{ width: canvasWidth, height: canvasHeight }}
        />
      </div>
    </div>
  );
}
