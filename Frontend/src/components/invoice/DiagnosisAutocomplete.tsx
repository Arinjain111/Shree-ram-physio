import { useState, useEffect, useRef, useCallback } from 'react';
import { ipcRenderer } from '@/lib/ipc';

interface DiagnosisSuggestion {
  id?: number;
  name: string;
  frequency?: number;
  score?: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function DiagnosisAutocomplete({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [recent, setRecent] = useState<DiagnosisSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  const [predictMode, setPredictMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const loadRecent = useCallback(async () => {
    const result = await ipcRenderer.invoke('get-recent-diagnoses', 10);
    if (result.success) {
      setRecent(result.diagnoses);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleInputChange = useCallback(async (text: string) => {
    onChange(text);
    setActiveIndex(-1);

    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setSuggestions([]);
      setShowRecent(false);
      setOpen(false);
      setPredictMode(false);
      return;
    }

    const endsWithSpace = text.endsWith(' ');

    if (endsWithSpace) {
      const ngramResult = await ipcRenderer.invoke('get-next-word-predictions', text, 15);
      if (ngramResult.success && ngramResult.suggestions.length > 0) {
        setSuggestions(ngramResult.suggestions);
        setPredictMode(true);
        setShowRecent(false);
        setOpen(true);
        return;
      }
    }

    setPredictMode(false);
    const result = await ipcRenderer.invoke('get-diagnosis-suggestions', trimmed, 20);
    if (result.success) {
      const items = result.resolvedShortcut
        ? [{ name: result.resolvedShortcut, score: 0 }]
        : result.suggestions;
      setSuggestions(items);
      setShowRecent(false);
      setOpen(items.length > 0);
    }
  }, [onChange]);

  const handleFocus = useCallback(async () => {
    if (!value.trim()) {
      await loadRecent();
      setShowRecent(true);
      setOpen(recent.length > 0);
      setPredictMode(false);
    } else {
      handleInputChange(value);
    }
  }, [value, recent.length, loadRecent, handleInputChange]);

  const selectPredictionWord = useCallback((word: string) => {
    const newValue = value.trimEnd() + ' ' + word;
    onChange(newValue);
    setOpen(false);
    setActiveIndex(-1);
  }, [value, onChange]);

  const selectItem = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
    if (!predictMode) {
      ipcRenderer.invoke('increment-diagnosis-frequency', name).catch(() => {});
    }
  }, [onChange, predictMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;

    const items = showRecent ? recent : suggestions;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % items.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + items.length) % items.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < items.length) {
          if (predictMode) {
            selectPredictionWord(items[activeIndex].name);
          } else {
            selectItem(items[activeIndex].name);
          }
        }
        break;
      case 'Escape':
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  }, [open, showRecent, recent, suggestions, activeIndex, predictMode, selectPredictionWord, selectItem]);

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  const items = showRecent ? recent : suggestions;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        id="diagnosis"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 placeholder-slate-400 font-medium text-slate-800 bg-white transition-all outline-none"
        placeholder="e.g., Left Knee ACL Grade 2 Tear"
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200/60 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar"
        >
          {showRecent && !predictMode && (
            <li className="px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-50 sticky top-0">
              Recently Used
            </li>
          )}
          {predictMode && (
            <li className="px-3 py-1.5 text-xs font-semibold text-indigo-500 bg-indigo-50 sticky top-0">
              Next word
            </li>
          )}
          {items.map((item, index) => (
            <li
              key={item.name + index}
              onMouseDown={() => {
                if (predictMode) {
                  selectPredictionWord(item.name);
                } else {
                  selectItem(item.name);
                }
              }}
              onMouseEnter={() => setActiveIndex(index)}
              className={`px-3 py-2 cursor-pointer text-sm font-medium transition-colors border-b border-slate-50 last:border-0 ${
                index === activeIndex
                  ? 'bg-indigo-50/80 text-indigo-900'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{item.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
