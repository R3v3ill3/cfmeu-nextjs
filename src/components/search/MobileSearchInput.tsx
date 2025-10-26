"use client";

import {  useState, useRef, useEffect, useCallback  } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { mobileTokens, device } from '@/styles/mobile-design-tokens';
import {
  Search,
  Mic,
  MicOff,
  X,
  History,
  TrendingUp,
  ChevronRight,
  Loader2
} from 'lucide-react';

// Voice search interface
interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

// Search suggestion interface
interface SearchSuggestion {
  id: string;
  text: string;
  type: 'history' | 'trending' | 'suggestion';
  category?: string;
  count?: number;
}

export interface MobileSearchInputProps {
  // Basic input props
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;

  // Voice search props
  enableVoiceSearch?: boolean;
  onVoiceResult?: (result: VoiceRecognitionResult) => void;
  voiceLanguage?: string;

  // Search suggestions
  suggestions?: SearchSuggestion[];
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  showSuggestions?: boolean;
  maxSuggestions?: number;

  // Search history
  enableHistory?: boolean;
  searchHistory?: string[];
  onHistorySelect?: (query: string) => void;
  onHistoryClear?: () => void;

  // Mobile-specific props
  autoFocus?: boolean;
  showCancelButton?: boolean;
  onCancel?: () => void;
  debouncedSearch?: boolean;
  debounceMs?: number;

  // Styling
  className?: string;
  inputClassName?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  size?: 'sm' | 'md' | 'lg';
}

export const MobileSearchInput: React.FC<MobileSearchInputProps> = ({
  value = '',
  onChange,
  onSubmit,
  placeholder = 'Search employers, projects, or workers...',
  disabled = false,
  loading = false,
  enableVoiceSearch = true,
  onVoiceResult,
  voiceLanguage = 'en-AU',
  suggestions = [],
  onSuggestionSelect,
  showSuggestions = true,
  maxSuggestions = 8,
  enableHistory = true,
  searchHistory = [],
  onHistorySelect,
  onHistoryClear,
  autoFocus = false,
  showCancelButton = true,
  onCancel,
  debouncedSearch = true,
  debounceMs = 300,
  className,
  inputClassName,
  variant = 'default',
  size = 'md',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && enableVoiceSearch && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = voiceLanguage;
        recognitionRef.current.maxAlternatives = 1;

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setVoiceError(null);
        };

        recognitionRef.current.onresult = (event: any) => {
          const result = event.results[0][0];
          const voiceResult: VoiceRecognitionResult = {
            transcript: result.transcript,
            confidence: result.confidence,
            isFinal: event.results[0].isFinal,
          };

          if (event.results[0].isFinal) {
            onChange?.(result.transcript);
            onVoiceResult?.(voiceResult);
            stopVoiceRecognition();
          }
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('Voice recognition error:', event.error);
          setVoiceError(getVoiceErrorMessage(event.error));
          stopVoiceRecognition();
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [enableVoiceSearch, voiceLanguage, onChange, onVoiceResult]);

  // Debounced search
  useEffect(() => {
    if (!debouncedSearch) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debouncedSearch, debounceMs]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Handle voice recognition
  const startVoiceRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      setVoiceError('Voice search not supported in this browser');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
      setVoiceError('Failed to start voice search');
    }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const getVoiceErrorMessage = (error: string): string => {
    switch (error) {
      case 'not-allowed':
        return 'Microphone access denied. Please enable microphone permissions.';
      case 'no-speech':
        return 'No speech detected. Please try again.';
      case 'network':
        return 'Network error. Please check your connection.';
      case 'service-not-allowed':
        return 'Voice recognition service not available.';
      default:
        return 'Voice search error. Please try again.';
    }
  };

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    setShowSuggestionsPanel(true);
  }, [onChange]);

  // Handle submit
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim()) {
      onSubmit?.(value.trim());
      setShowSuggestionsPanel(false);
      setActiveSuggestionIndex(-1);
    }
  }, [value, onSubmit]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const filteredSuggestions = getFilteredSuggestions();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && filteredSuggestions[activeSuggestionIndex]) {
          handleSuggestionSelect(filteredSuggestions[activeSuggestionIndex]);
        } else {
          handleSubmit();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestionsPanel(false);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [activeSuggestionIndex, handleSubmit]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: SearchSuggestion | string) => {
    const suggestionText = typeof suggestion === 'string' ? suggestion : suggestion.text;
    onChange?.(suggestionText);

    if (typeof suggestion === 'object') {
      onSuggestionSelect?.(suggestion);
    } else if (enableHistory && searchHistory.includes(suggestion)) {
      onHistorySelect?.(suggestion);
    }

    setShowSuggestionsPanel(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  }, [onChange, onSuggestionSelect, enableHistory, searchHistory, onHistorySelect]);

  // Get filtered suggestions
  const getFilteredSuggestions = useCallback((): SearchSuggestion[] => {
    if (!showSuggestionsPanel || !value.trim()) return [];

    const filtered = suggestions.filter(suggestion =>
      suggestion.text.toLowerCase().includes(value.toLowerCase())
    );

    // Add history suggestions if enabled and no value is entered
    if (!value.trim() && enableHistory && searchHistory.length > 0) {
      const historySuggestions: SearchSuggestion[] = searchHistory.slice(0, 3).map((item, index) => ({
        id: `history-${index}`,
        text: item,
        type: 'history' as const,
      }));

      return [...historySuggestions, ...filtered].slice(0, maxSuggestions);
    }

    return filtered.slice(0, maxSuggestions);
  }, [showSuggestionsPanel, value, suggestions, enableHistory, searchHistory, maxSuggestions]);

  const filteredSuggestions = getFilteredSuggestions();

  // Variant styling
  const variantClasses = {
    default: 'bg-white border-gray-200',
    elevated: 'bg-white border-gray-200 shadow-md',
    outlined: 'bg-white border-2 border-gray-300',
  };

  // Size styling
  const sizeClasses = {
    sm: 'min-h-[44px] text-sm',
    md: 'min-h-[48px] text-base',
    lg: 'min-h-[52px] text-lg',
  };

  return (
    <div className={cn('relative w-full', className)}>
      {/* Search input container */}
      <div className={cn(
        'relative flex items-center border rounded-xl transition-all duration-200',
        variantClasses[variant],
        sizeClasses[size],
        isFocused && 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20',
        disabled && 'opacity-50 cursor-not-allowed',
        'touch-manipulation'
      )}>
        {/* Search icon */}
        <div className="absolute left-4 flex items-center pointer-events-none">
          {loading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-gray-400" />
          )}
        </div>

        {/* Input field */}
        <Input
          ref={inputRef}
          type="search"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestionsPanel(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            // Delay hiding suggestions to allow click events
            setTimeout(() => setShowSuggestionsPanel(false), 150);
          }}
          onSubmit={handleSubmit}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-12 pr-24 border-0 shadow-none focus-visible:ring-0 bg-transparent',
            'touch-manipulation',
            inputClassName
          )}
          autoComplete="off"
          enterKeyHint="search"
        />

        {/* Action buttons */}
        <div className="absolute right-2 flex items-center gap-1">
          {/* Voice search button */}
          {enableVoiceSearch && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
              className={cn(
                'w-10 h-10 min-w-[44px] min-h-[44px]',
                'text-gray-400 hover:text-gray-600',
                isListening && 'text-red-500 hover:text-red-600 animate-pulse',
                'touch-manipulation'
              )}
              aria-label={isListening ? 'Stop voice search' : 'Start voice search'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>
          )}

          {/* Clear button */}
          {value && !disabled && !loading && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                onChange?.('');
                setActiveSuggestionIndex(-1);
                inputRef.current?.focus();
              }}
              className="w-10 h-10 min-w-[44px] min-h-[44px] text-gray-400 hover:text-gray-600 touch-manipulation"
              aria-label="Clear search"
            >
              <X className="w-5 h-5" />
            </Button>
          )}

          {/* Cancel button */}
          {showCancelButton && value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="px-3 h-8 text-sm text-gray-600 hover:text-gray-900 touch-manipulation"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Voice error message */}
      {voiceError && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg z-50">
          <p className="text-sm text-red-600">{voiceError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVoiceError(null)}
            className="mt-2 text-red-600 hover:text-red-700"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Suggestions panel */}
      {showSuggestionsPanel && filteredSuggestions.length > 0 && (
        <div className={cn(
          'absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-40',
          'max-h-[80vh] overflow-y-auto',
          'touch-manipulation'
        )}>
          {/* Suggestions header */}
          {!value.trim() && enableHistory && searchHistory.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Recent Searches</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onHistoryClear}
                className="text-xs text-gray-500 hover:text-gray-700 touch-manipulation"
              >
                Clear
              </Button>
            </div>
          )}

          {/* Suggestions list */}
          <div className="py-1">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestionSelect(suggestion)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3 text-left transition-colors',
                  'hover:bg-gray-50 focus:bg-gray-50 focus:outline-none',
                  index === activeSuggestionIndex && 'bg-gray-50',
                  'touch-manipulation min-h-[44px]'
                )}
              >
                {/* Suggestion icon */}
                <div className="flex-shrink-0">
                  {suggestion.type === 'history' && (
                    <History className="w-4 h-4 text-gray-400" />
                  )}
                  {suggestion.type === 'trending' && (
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                  )}
                  {suggestion.type === 'suggestion' && (
                    <Search className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Suggestion text */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {suggestion.text}
                  </div>
                  {suggestion.category && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      in {suggestion.category}
                    </div>
                  )}
                </div>

                {/* Suggestion metadata */}
                <div className="flex items-center gap-2">
                  {suggestion.count && (
                    <span className="text-xs text-gray-400">
                      {suggestion.count.toLocaleString()}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </button>
            ))}
          </div>

          {/* Suggestions footer */}
          {value.trim() && (
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium touch-manipulation min-h-[44px] flex items-center"
              >
                Search for "{value}"
              </button>
            </div>
          )}
        </div>
      )}

      {/* Voice search feedback overlay */}
      {isListening && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-xl z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <Mic className="w-8 h-8 text-red-500 animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Listening...</h3>
            <p className="text-sm text-gray-600 mb-4">Speak clearly into your device</p>
            <Button
              type="button"
              onClick={stopVoiceRecognition}
              variant="outline"
              size="sm"
              className="touch-manipulation"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileSearchInput;