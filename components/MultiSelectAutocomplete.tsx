
import React, { useState, useEffect, useRef } from 'react';

interface MultiSelectAutocompleteProps {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    suggestions: string[];
    className?: string;
    error?: boolean;
}

const MultiSelectAutocomplete: React.FC<MultiSelectAutocompleteProps> = ({
    value,
    onChange,
    placeholder,
    suggestions,
    className = "",
    error
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filtered, setFiltered] = useState<string[]>([]);
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Parse current selected values - Ensure value is a string before splitting
    const selectedValues = value ? String(value).split(',').map(v => v.trim()).filter(Boolean) : [];

    useEffect(() => {
        const lowerCaseSearchTerm = String(searchTerm).toLowerCase();
        const matches = suggestions.filter(s =>
            String(s).toLowerCase().includes(lowerCaseSearchTerm) &&
            !selectedValues.includes(s)
        );
        setFiltered(matches.slice(0, 15));
    }, [searchTerm, suggestions, value]);

    const toggleValue = (val: string) => {
        let newValues;
        if (selectedValues.includes(val)) {
            newValues = selectedValues.filter(v => v !== val);
        } else {
            newValues = [...selectedValues, val];
        }
        onChange(newValues.join(', '));
        setSearchTerm('');
    };

    const removeValue = (val: string) => {
        const newValues = selectedValues.filter(v => v !== val);
        onChange(newValues.join(', '));
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
            e.preventDefault();
            if (activeIndex >= 0 && filtered[activeIndex]) {
                toggleValue(filtered[activeIndex]);
                setActiveIndex(-1);
            } else if (searchTerm.trim()) {
                toggleValue(searchTerm.trim());
                setActiveIndex(-1);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        } else if (e.key === 'Backspace' && searchTerm === '' && selectedValues.length > 0) {
            removeValue(selectedValues[selectedValues.length - 1]);
        }
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                className={`flex flex-wrap items-center gap-1 min-h-[28px] p-1 border rounded bg-white shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500 ${error ? 'border-red-600 ring-1 ring-red-100' : 'border-slate-300'
                    } ${className}`}
                onClick={() => containerRef.current?.querySelector('input')?.focus()}
            >
                {selectedValues.map(v => (
                    <span
                        key={v}
                        className="flex items-center gap-1 bg-blue-100 text-[#004b93] text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border border-blue-200 leading-none"
                    >
                        <span className="translate-y-[0.5px]">{v}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); removeValue(v); }}
                            className="hover:text-red-600 transition-colors flex items-center"
                        >
                            <span className="material-symbols-outlined text-[11px] leading-none">close</span>
                        </button>
                    </span>
                ))}
                <input
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsOpen(true)}
                    onBlur={(e) => {
                        if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
                            return;
                        }
                        setTimeout(() => setIsOpen(false), 200);
                    }}
                    placeholder={selectedValues.length === 0 ? placeholder : ""}
                    className="flex-1 min-w-[30px] bg-transparent border-none outline-none text-[11px] font-medium text-slate-800 p-0 h-full"
                />
            </div>

            {isOpen && filtered.length > 0 && (
                <div className="absolute z-[9999] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-2xl max-h-[200px] overflow-y-auto ring-1 ring-black ring-opacity-5">
                    {filtered.map((name, idx) => (
                        <div
                            key={idx}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                toggleValue(name);
                            }}
                            className={`px-3 py-1.5 text-[10px] font-bold cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${activeIndex === idx ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-blue-50'
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

export default MultiSelectAutocomplete;
