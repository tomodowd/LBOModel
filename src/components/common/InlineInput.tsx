import { useState, useRef, useEffect } from 'react';

interface InlineInputProps {
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  prefix?: string;
  width?: number;
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function InlineInput({
  value, onChange, suffix = '', prefix = '', width = 80,
  decimals = 1, min, max, step = 1, className = '',
}: InlineInputProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && ref.current) ref.current.select();
  }, [editing]);

  const displayValue = `${prefix}${value.toFixed(decimals)}${suffix}`;

  const commit = () => {
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      onChange(clamped);
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <span
        className={`inline-input cursor-pointer ${className}`}
        style={{ width }}
        onClick={() => { setText(value.toFixed(decimals)); setEditing(true); }}
        title="Click to edit"
      >
        {displayValue}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      className={`inline-input ${className}`}
      style={{ width }}
      type="number"
      value={text}
      step={step}
      onChange={e => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      autoFocus
    />
  );
}

// Simple display cell for computed values
export function FormulaCell({ value, negative }: { value: string; negative?: boolean }) {
  return (
    <span className={`cell-formula ${negative ? 'cell-negative' : ''}`}>
      {value}
    </span>
  );
}
