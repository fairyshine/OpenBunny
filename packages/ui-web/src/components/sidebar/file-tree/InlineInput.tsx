import { useState, useRef, useEffect } from 'react';

/** Stable inline input — manages its own local state so parent re-renders don't destroy the DOM node */
export function InlineInput({ initialValue, placeholder, className, onSubmit, onCancel, onClick }: {
  initialValue: string;
  placeholder?: string;
  className?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);
  useEffect(() => { inputRef.current?.focus(); if (initialValue) inputRef.current?.select(); }, []);
  const submit = () => { if (doneRef.current) return; doneRef.current = true; onSubmit(value); };
  const cancel = () => { if (doneRef.current) return; doneRef.current = true; onCancel(); };
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') cancel(); }}
      onBlur={submit}
      placeholder={placeholder}
      className={className}
      onClick={onClick}
    />
  );
}
