'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Canvas, FabricText, FabricImage } from 'fabric';
import { useEditorStore } from '@/lib/store/editor';
import { initCanvas, setupCanvasEvents, loadImageToCanvas } from '@/lib/canvas/fabric';
import { generateId, readFileAsDataURL } from '@/lib/utils/helpers';
import { Button } from '@/components/ui/button';

export function CanvasComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    setCanvas,
    zoom,
    zoomIn,
    zoomOut,
    resetZoom,
    showGrid,
    gridSize,
    activeTool,
    setActiveTool,
    canvasWidth,
    canvasHeight,
    isDark,
    layers,
    addLayer,
    updateLayer,
    deleteLayer,
    toggleLayerVisibility,
    selectedLayerId,
    setSelectedLayerId,
    saveHistory,
  } = useEditorStore();
  
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);

  // Initialize canvas - fill container
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    const fabricCanvas = initCanvas(canvasRef.current, {
      width: rect.width,
      height: rect.height,
    });

    fabricCanvas.backgroundColor = isDark ? '#0a0a0a' : '#f5f5f5';
    fabricCanvas.renderAll();

    setupCanvasEvents(fabricCanvas);
    fabricCanvasRef.current = fabricCanvas;
    setCanvas(fabricCanvas as any);

    // Handle selection events
    fabricCanvas.on('selection:created', (e: any) => {
      const obj = e.selected?.[0];
      if (obj && (obj as any).layerId) {
        setSelectedLayerId((obj as any).layerId);
      }
    });

    fabricCanvas.on('selection:updated', (e: any) => {
      const obj = e.selected?.[0];
      if (obj && (obj as any).layerId) {
        setSelectedLayerId((obj as any).layerId);
      }
    });

    fabricCanvas.on('selection:cleared', () => {
      setSelectedLayerId(null);
    });

    return () => {
      fabricCanvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [setCanvas, canvasWidth, canvasHeight, setSelectedLayerId]);

  // Resize canvas to fill container on window resize
  useEffect(() => {
    const container = containerRef.current;
    const canvas = fabricCanvasRef.current;
    if (!container || !canvas) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      canvas.setDimensions({ width: rect.width, height: rect.height });
      canvas.renderAll();
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Update background on theme change
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.backgroundColor = isDark ? '#0a0a0a' : '#f5f5f5';
      canvas.renderAll();
    }
  }, [isDark]);

  // Handle zoom changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.setZoom(zoom);
      canvas.renderAll();
    }
  }, [zoom]);

  // Ctrl+Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl is held
      if (!e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();

      const delta = -e.deltaY;
      const { zoom: currentZoom, setZoom: storeSetZoom } = useEditorStore.getState();
      const factor = delta > 0 ? 1.1 : 1 / 1.1;
      const newZoom = Math.min(Math.max(currentZoom * factor, 0.1), 5);
      storeSetZoom(newZoom);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

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

  // Handle V key to attach image to text
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;
        
        const activeObject = canvas.getActiveObject();
        if (activeObject && activeObject.type === 'text') {
          fileInputRef.current?.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle middle mouse button pan (via Fabric viewport transform)
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button (button 1) or hand tool for panning
    if (e.button === 1 || (e.button === 0 && activeTool === 'hand')) {
      e.preventDefault();
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isPanningRef.current) return;
        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        const dx = moveEvent.clientX - panStartRef.current.x;
        const dy = moveEvent.clientY - panStartRef.current.y;
        panStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };

        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.setViewportTransform(vpt);
          canvas.renderAll();
        }
      };

      const handleMouseUp = () => {
        isPanningRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // Text tool click
    if (!fabricCanvasRef.current || activeTool !== 'text') return;

    const canvas = fabricCanvasRef.current;
    const pointer = canvas.getScenePoint(e.nativeEvent);

    const text = new FabricText('Double click to edit', {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Inter',
      fontSize: 24,
      fill: isDark ? '#ffffff' : '#000000',
      textAlign: 'left',
    });
    
    const layerId = generateId();
    (text as any).id = layerId;
    (text as any).layerId = layerId;
    
    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();

    addLayer({
      id: layerId,
      type: 'text',
      name: 'Text',
      x: pointer.x,
      y: pointer.y,
      width: 200,
      height: 30,
      text: 'Double click to edit',
      fontFamily: 'Inter',
      fontSize: 24,
      fill: isDark ? '#ffffff' : '#000000',
    });
    saveHistory('add_text');
    
    // Reset to select tool
    setActiveTool('select');
  }, [activeTool, isDark, addLayer, saveHistory, setActiveTool]);

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvasRef.current) return;

    const canvas = fabricCanvasRef.current;
    const activeObject = canvas.getActiveObject();
    
    if (!activeObject || activeObject.type !== 'text') return;

    try {
      const dataUrl = await readFileAsDataURL(file);
      const img = await loadImageToCanvas(canvas, dataUrl);
      
      // Position image at text location
      img.set({
        left: activeObject.left,
        top: activeObject.top,
      });
      
      // Link image to text layer
      (img as any).layerId = (activeObject as any).layerId;
      
      canvas.add(img);
      canvas.renderAll();
      
      // Update layer
      updateLayer((activeObject as any).layerId, {
        src: dataUrl,
        type: 'image',
      });
      
      saveHistory('attach_image');
    } catch (err) {
      console.error('Failed to attach image:', err);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      
      const layerId = generateId();
      (img as any).id = layerId;
      (img as any).layerId = layerId;
      
      addLayer({
        id: layerId,
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
    const strokeColor = isDark ? '#333333' : '#dddddd';

    for (let i = 0; i <= gridCount; i++) {
      const pos = i * gridSize * zoom;
      lines.push(<line key={`v-${i}`} x1={pos} y1={0} x2={pos} y2={canvasHeight * zoom} stroke={strokeColor} strokeWidth={0.5 / zoom} />);
      lines.push(<line key={`h-${i}`} x1={0} y1={pos} x2={canvasWidth * zoom} y2={pos} stroke={strokeColor} strokeWidth={0.5 / zoom} />);
    }
    return lines;
  };

  const handleLayerClick = (layerId: string) => {
    setSelectedLayerId(layerId);
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const objects = canvas.getObjects();
      const obj = objects.find((o: any) => o.layerId === layerId || o.id === layerId);
      if (obj) {
        canvas.setActiveObject(obj);
        canvas.renderAll();
      }
    }
  };

  const handleDeleteLayer = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      const objects = canvas.getObjects();
      const obj = objects.find((o: any) => o.layerId === layerId || o.id === layerId);
      if (obj) {
        canvas.remove(obj);
        canvas.renderAll();
      }
    }
    deleteLayer(layerId);
    saveHistory('delete_layer');
  };

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Hidden file input for image attach */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageAttach}
        className="hidden"
      />

      {/* Main Canvas - Endless with zoom controls */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
      >
        {/* Grid layer - infinite pattern */}
        {showGrid && (
          <svg
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{ width: '100%', height: '100%' }}
          >
            {renderGrid()}
          </svg>
        )}

        {/* Canvas element - fills entire container */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Zoom Controls - Floating on bottom right of board */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-50 bg-background/90 backdrop-blur-sm border rounded-lg shadow-lg p-1">
          {/* Zoom In */}
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            className="h-8 w-8 hover:bg-accent"
            title="Zoom In (Ctrl + Scroll Up)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </Button>
          
          {/* Zoom Level Indicator */}
          <div className="h-8 w-8 flex items-center justify-center text-[10px] font-medium text-muted-foreground border-y">
            {Math.round(zoom * 100)}%
          </div>
          
          {/* Zoom Out */}
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            className="h-8 w-8 hover:bg-accent"
            title="Zoom Out (Ctrl + Scroll Down)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8" />
            </svg>
          </Button>
          
          {/* Reset Zoom */}
          <Button
            variant="ghost"
            size="icon"
            onClick={resetZoom}
            className="h-8 w-8 hover:bg-accent border-t"
            title="Reset Zoom"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
              <path d="M3 3v9h9" />
            </svg>
          </Button>
        </div>

      </div>
    </div>
  );
}
