'use client';

import { useState, useRef } from 'react';
import { useLayers, useEditorStore } from '@/lib/store/editor';
import { Eye, EyeOff, Lock, Unlock, Trash2, GripVertical } from 'lucide-react';

// Helper: find a fabric object on the canvas by its layerId
function findCanvasObject(canvas: any, layerId: string) {
  if (!canvas) return null;
  const objects = canvas.getObjects();
  return objects.find((o: any) => o.id === layerId || o.layerId === layerId) || null;
}

export function LayersSection() {
  const layers = useLayers();
  const canvas = useEditorStore((state) => state.canvas);
  const selectedLayerId = useEditorStore((state) => state.selectedLayerId);
  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const toggleLayerVisibility = useEditorStore((state) => state.toggleLayerVisibility);
  const toggleLayerLock = useEditorStore((state) => state.toggleLayerLock);
  const deleteLayer = useEditorStore((state) => state.deleteLayer);
  const reorderLayers = useEditorStore((state) => state.reorderLayers);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const handleSelectLayer = (layerId: string) => {
    setSelectedLayerId(layerId);
    const obj = findCanvasObject(canvas, layerId);
    if (obj && canvas) {
      canvas.setActiveObject(obj);
      canvas.renderAll();
    }
  };

  const handleToggleVisibility = (layerId: string) => {
    toggleLayerVisibility(layerId);
    const obj = findCanvasObject(canvas, layerId);
    if (obj && canvas) {
      const layer = layers.find(l => l.id === layerId);
      obj.visible = !(layer?.visible ?? true);
      canvas.renderAll();
    }
  };

  const handleToggleLock = (layerId: string) => {
    toggleLayerLock(layerId);
    const obj = findCanvasObject(canvas, layerId);
    if (obj && canvas) {
      const layer = layers.find(l => l.id === layerId);
      const newLocked = !(layer?.locked ?? false);
      obj.selectable = !newLocked;
      obj.evented = !newLocked;
      if (newLocked) canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  const handleDeleteLayer = (layerId: string) => {
    const obj = findCanvasObject(canvas, layerId);
    if (obj && canvas) {
      canvas.remove(obj);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    deleteLayer(layerId);
  };

  const syncCanvasZOrder = () => {
    if (!canvas) return;
    const updatedLayers = useEditorStore.getState().layers;
    const objects = canvas.getObjects();
    for (const layer of updatedLayers) {
      const obj = objects.find((o: any) => o.id === layer.id || o.layerId === layer.id);
      if (obj) canvas.bringObjectToFront(obj);
    }
    canvas.renderAll();
  };

  // ── Drag & Drop handlers ──
  const handleDragStart = (e: React.DragEvent, layerId: string) => {
    setDraggedId(layerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layerId);
    // Make drag preview semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId === layerId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';

    setDragOverId(layerId);
    setDragOverPosition(position);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetLayerId) return;

    const fromIndex = layers.findIndex(l => l.id === draggedId);
    const toIndex = layers.findIndex(l => l.id === targetLayerId);

    if (fromIndex === -1 || toIndex === -1) return;

    reorderLayers(fromIndex, toIndex);
    syncCanvasZOrder();

    setDraggedId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h3 className="text-sm font-semibold">Layers</h3>
        <span className="text-xs text-muted-foreground">{layers.length} total</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sortedLayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-xs">No layers yet</p>
            <p className="text-[10px] mt-1">Import an image to get started</p>
          </div>
        ) : (
          sortedLayers.map((layer) => (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, layer.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, layer.id)}
              onClick={() => handleSelectLayer(layer.id)}
              className={`
                flex items-center gap-1.5 p-1.5 rounded-md transition-all cursor-pointer group relative
                ${selectedLayerId === layer.id ? 'bg-accent border border-primary/30' : 'hover:bg-accent/50 border border-transparent'}
                ${draggedId === layer.id ? 'opacity-40' : ''}
              `}
            >
              {/* Drop indicator line */}
              {dragOverId === layer.id && dragOverPosition === 'above' && (
                <div className="absolute -top-[2px] left-2 right-2 h-[3px] bg-primary rounded-full z-10" />
              )}
              {dragOverId === layer.id && dragOverPosition === 'below' && (
                <div className="absolute -bottom-[2px] left-2 right-2 h-[3px] bg-primary rounded-full z-10" />
              )}

              {/* Drag Handle */}
              <div className="shrink-0 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                <GripVertical className="w-3.5 h-3.5" />
              </div>

              {/* Thumbnail */}
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {layer.type === 'image' && layer.src ? (
                  <img src={layer.src} alt={layer.name} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    {layer.type === 'text' ? 'T' : layer.type[0]}
                  </span>
                )}
              </div>

              {/* Name & Type */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{layer.name}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{layer.type}</p>
              </div>

              {/* Action buttons */}
              <div className={`flex items-center gap-0.5 transition-opacity ${
                selectedLayerId === layer.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleVisibility(layer.id); }}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                  title={layer.visible ? 'Hide' : 'Show'}
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleLock(layer.id); }}
                  className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                  title={layer.locked ? 'Unlock' : 'Lock'}
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id); }}
                  className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
