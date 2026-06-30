
import React, { useState, useEffect, useRef } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder: string;
  suggestions: string[];
  autoFocus?: boolean;
  className?: string;
  error?: boolean;
  strict?: boolean;
  disabled?: boolean;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  suggestions,
  autoFocus,
  className,
  error,
  strict,
  disabled
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const val = String(value || '');
    if (val.length > 0) {
      const search = val.toLowerCase();
      const matches = suggestions.filter(s =>
        String(s || '').toLowerCase().includes(search)
      );
      setFiltered(matches.slice(0, 10));
    } else {
      setFiltered(suggestions.slice(0, 20));
    }
  }, [value, suggestions]);

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    if (onBlur) onBlur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && filtered[activeIndex]) {
        handleSelect(filtered[activeIndex]);
      } else {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        onBlur={(e) => {
          if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
            return;
          }
          
          // Strict mode: clear invalid value SYNCHRONOUSLY so save button validates correctly
          if (strict && value && value.trim() !== '') {
            const exists = suggestions.some(s => String(s).toLowerCase() === String(value).toLowerCase());
            if (!exists) {
              onChange('');
            }
          }
          
          setTimeout(() => {
            setIsOpen(false);
            if (onBlur) onBlur();
          }, 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full border ${error ? 'border-red-500 ring-1 ring-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'} rounded px-2 py-1 text-[11px]  h-[32px] focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all shadow-sm text-slate-800 ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''} ${className}`}
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-[9999] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[200px] overflow-y-auto ring-1 ring-black ring-opacity-5">
          {filtered.map((name, idx) => (
            <div
              key={idx}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={(e) => {
                e.preventDefault();
                e.nativeEvent.stopPropagation();
                handleSelect(name);
              }}
              className={`px-3 py-2 text-[10px] cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${activeIndex === idx ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-blue-50'
                }`}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput;
