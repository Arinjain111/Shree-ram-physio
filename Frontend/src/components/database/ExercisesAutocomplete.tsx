import { useState, useEffect, useRef, useCallback } from 'react';
import { ipcRenderer } from '@/lib/ipc';

interface ExerciseSuggestion {
  id?: number;
  name: string;
  frequency?: number;
  score?: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export default function ExercisesAutocomplete({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([]);
  const [recent, setRecent] = useState<ExerciseSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showRecent, setShowRecent] = useState(false);
  const [predictMode, setPredictMode] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const getLastToken = useCallback((text: string, pos: number): string => {
    const textBeforeCursor = text.slice(0, pos);
    let lastSepIndex = -1;
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      if (/[,\n]/.test(textBeforeCursor[i])) {
        lastSepIndex = i;
        break;
      }
    }
    return textBeforeCursor.slice(lastSepIndex + 1).trim();
  }, []);

  const getTextBeforeToken = useCallback((text: string, pos: number): string => {
    const textBeforeCursor = text.slice(0, pos);
    let lastSepIndex = -1;
    for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
      if (/[,\n]/.test(textBeforeCursor[i])) {
        lastSepIndex = i;
        break;
      }
    }
    return textBeforeCursor.slice(0, lastSepIndex + 1);
  }, []);

  const loadRecent = useCallback(async () => {
    const result = await ipcRenderer.invoke('get-recent-clinical', 'exercise', 10);
    if (result.success) {
      setRecent(result.items);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleInputChange = useCallback(async (text: string, cursorPosition: number) => {
    onChange(text);
    setActiveIndex(-1);
    setCursorPos(cursorPosition);

    const token = getLastToken(text, cursorPosition);
    const trimmedToken = token.trim();

    if (trimmedToken.length === 0) {
      setSuggestions([]);
      setShowRecent(false);
      setOpen(false);
      setPredictMode(false);
      return;
    }

    const endsWithSpace = token.endsWith(' ');

    if (endsWithSpace && trimmedToken.includes(' ')) {
      const ngramResult = await ipcRenderer.invoke('get-next-clinical-predictions', trimmedToken, 15);
      if (ngramResult.success && ngramResult.suggestions.length > 0) {
        setSuggestions(ngramResult.suggestions);
        setPredictMode(true);
        setShowRecent(false);
        setOpen(true);
        return;
      }
    }

    setPredictMode(false);
    const result = await ipcRenderer.invoke('get-clinical-suggestions', 'exercise', trimmedToken, 20);
    if (result.success) {
      const items = result.suggestions;
      setSuggestions(items);
      setShowRecent(false);
      setOpen(items.length > 0);
    }
  }, [onChange, getLastToken]);

  const handleFocus = useCallback(async () => {
    if (!value.trim()) {
      await loadRecent();
      setShowRecent(true);
      setOpen(recent.length > 0);
      setPredictMode(false);
    }
  }, [value, recent.length, loadRecent]);

  const selectPredictionWord = useCallback((word: string) => {
    const textBeforeToken = getTextBeforeToken(value, cursorPos);
    const currentToken = getLastToken(value, cursorPos);
    const words = currentToken.trim().split(/\s+/);
    const baseWords = words.slice(0, -1).join(' ');
    const newToken = baseWords ? `${baseWords} ${word}` : word;
    const before = textBeforeToken.trimEnd();
    const separator = before ? (before.endsWith('\n') ? '' : ', ') : '';
    const afterCursor = value.slice(cursorPos);
    const newValue = `${before}${separator}${newToken} ${afterCursor}`;
    onChange(newValue);
    setOpen(false);
    setActiveIndex(-1);

    setTimeout(() => {
      const newPos = before.length + separator.length + newToken.length + 1;
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  }, [value, cursorPos, onChange, getTextBeforeToken, getLastToken]);

  const selectItem = useCallback((name: string) => {
    const textBeforeToken = getTextBeforeToken(value, cursorPos);
    const before = textBeforeToken.trimEnd();
    const separator = before ? (before.endsWith('\n') ? '' : ', ') : '';
    const afterCursor = value.slice(cursorPos);
    const newValue = `${before}${separator}${name}${afterCursor}`;
    onChange(newValue);
    setOpen(false);
    setActiveIndex(-1);

    if (!predictMode) {
      ipcRenderer.invoke('increment-clinical-frequency', 'exercise', name).catch(() => {});
    }

    const newPos = before.length + separator.length + name.length;
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  }, [value, cursorPos, onChange, predictMode, getTextBeforeToken]);

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
        if (activeIndex >= 0 && activeIndex < items.length) {
          e.preventDefault();
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
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart)}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all resize-none outline-none"
        placeholder="e.g. Quadriceps sets, Hamstring curls, Straight leg raises..."
        rows={2}
        autoComplete="off"
      />
      {open && items.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200/60 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar"
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
              {item.frequency !== undefined && item.frequency > 0 && !predictMode && (
                <span className="ml-2 text-[10px] text-slate-400 font-medium">({item.frequency}x)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
