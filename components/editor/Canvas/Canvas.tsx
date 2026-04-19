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
      
      {/* Left: Layers Panel Toggle */}
      <div className="absolute left-3 top-3 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setLayersPanelOpen(!layersPanelOpen)}
          className="shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 mr-1">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Layers
        </Button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-lg border bg-background/90 backdrop-blur p-1 shadow-lg">
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={zoomOut}
          title="Zoom Out"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M5 12h14" strokeLinecap="round" />
          </svg>
        </Button>
        <span className="text-xs font-medium w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={zoomIn}
          title="Zoom In"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={resetZoom}
          title="Reset Zoom"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12" />
          </svg>
        </Button>
      </div>

      {/* Layers Panel */}
      {layersPanelOpen && (
        <div className="w-56 border-r bg-background flex flex-col shrink-0 z-20">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-semibold">Layers</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setLayersPanelOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[...layers].reverse().map((layer) => (
              <div
                key={layer.id}
                onClick={() => handleLayerClick(layer.id)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  selectedLayerId === layer.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                {/* Visibility Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLayerVisibility(layer.id);
                  }}
                  className="p-1 rounded hover:bg-white/20"
                >
                  {layer.visible ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  )}
                </button>

                {/* Layer Icon */}
                {layer.type === 'text' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <path d="M4 7V4h16v3M9 20h6M12 4v16" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                )}

                {/* Layer Name */}
                <span className="flex-1 truncate text-xs">{layer.name}</span>

                {/* Delete Button */}
                <button
                  onClick={(e) => handleDeleteLayer(layer.id, e)}
                  className="p-1 rounded hover:bg-white/20 opacity-0 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ))}
            {layers.length === 0 && (
              <div className="text-center text-muted-foreground text-xs py-4">
                No layers yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas - Fixed, fills container, no scroll */}
      <div 
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ backgroundColor: isDark ? '#0a0a0a' : '#f5f5f5' }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
      >
        {/* Grid layer */}
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
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
}
