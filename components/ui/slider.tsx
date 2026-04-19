'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  label,
  showValue = true,
  className,
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-xs font-medium text-zinc-400">{label}</span>
          )}
          {showValue && (
            <span className="text-xs text-zinc-500">{value}</span>
          )}
        </div>
      )}
      <div className="relative h-5 flex items-center">
        <div className="absolute w-full h-1.5 bg-zinc-700 rounded-full" />
        <div
          className="absolute h-1.5 bg-indigo-500 rounded-full"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute w-4 h-4 bg-white rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
}
