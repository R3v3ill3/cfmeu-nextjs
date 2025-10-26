"use client";

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mobileTokens, device } from '@/styles/mobile-design-tokens';
import {
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  Shield,
  Star,
  Filter,
  Check,
  Search
} from 'lucide-react';

// Filter option interfaces
interface FilterOption {
  value: string;
  label: string;
  count?: number;
  color?: string;
}

interface FilterSection {
  id: string;
  title: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'search' | 'toggle';
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  enabled?: boolean;
  searchable?: boolean;
}

interface MobileFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: Record<string, any>) => void;
  onReset: () => void;
  initialFilters?: Record<string, any>;
  sections: FilterSection[];
  activeFiltersCount?: number;
  showSearch?: boolean;
  searchPlaceholder?: string;
  className?: string;
}

interface FilterRangeProps {
  min: number;
  max: number;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
  step?: number;
  unit?: string;
  className?: string;
}

// Range slider component for mobile
const FilterRange: React.FC<FilterRangeProps> = ({
  min,
  max,
  value,
  onChange,
  step = 1,
  unit = '',
  className,
}) => {
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const getPercentage = (value: number) => {
    return ((value - min) / (max - min)) * 100;
  };

  const getValueFromPosition = (clientX: number) => {
    if (!sliderRef.current) return min;

    const rect = sliderRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return min + Math.round((percentage * (max - min)) / step) * step;
  };

  const handleMouseDown = (type: 'min' | 'max') => (e: React.MouseEvent) => {
    setIsDragging(type);
    updateValue(e.clientX, type);
  };

  const handleTouchStart = (type: 'min' | 'max') => (e: React.TouchEvent) => {
    setIsDragging(type);
    updateValue(e.touches[0].clientX, type);
  };

  const updateValue = (clientX: number, type: 'min' | 'max') => {
    const newValue = getValueFromPosition(clientX);
    onChange({
      ...value,
      [type]: type === 'min' ? Math.min(newValue, value.max) : Math.max(newValue, value.min),
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e.clientX, isDragging);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging) {
        updateValue(e.touches[0].clientX, isDragging);
      }
    };

    const handleEnd = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, min, max, value, step]);

  const minPercentage = getPercentage(value.min);
  const maxPercentage = getPercentage(value.max);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Value display */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">
          {min}{unit} - {max}{unit}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ min: min, max: max })}
          className="h-6 px-2 text-xs text-gray-500"
        >
          Reset
        </Button>
      </div>

      {/* Slider */}
      <div className="relative py-4" ref={sliderRef}>
        {/* Track */}
        <div className="absolute inset-y-0 left-0 right-0 bg-gray-200 rounded-full h-2 top-1/2 transform -translate-y-1/2" />

        {/* Active range */}
        <div
          className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-blue-500 rounded-full"
          style={{
            left: `${minPercentage}%`,
            right: `${100 - maxPercentage}%`,
          }}
        />

        {/* Min handle */}
        <button
          className={cn(
            'absolute w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 top-1/2 -translate-y-1/2',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            isDragging === 'min' && 'scale-125',
            'touch-manipulation'
          )}
          style={{ left: `${minPercentage}%` }}
          onMouseDown={handleMouseDown('min')}
          onTouchStart={handleTouchStart('min')}
          aria-label="Minimum value"
        />

        {/* Max handle */}
        <button
          className={cn(
            'absolute w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 top-1/2 -translate-y-1/2',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            isDragging === 'max' && 'scale-125',
            'touch-manipulation'
          )}
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={handleMouseDown('max')}
          onTouchStart={handleTouchStart('max')}
          aria-label="Maximum value"
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};

// Date range component
const FilterDateRange: React.FC<{
  value: { start?: string; end?: string };
  onChange: (value: { start?: string; end?: string }) => void;
  className?: string;
}> = ({ value, onChange, className }) => {
  return (
    <div className={cn('space-y-3', className)}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Start Date
        </label>
        <input
          type="date"
          value={value.start || ''}
          onChange={(e) => onChange({ ...value, start: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          End Date
        </label>
        <input
          type="date"
          value={value.end || ''}
          onChange={(e) => onChange({ ...value, end: e.target.value || undefined })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        />
      </div>
    </div>
  );
};

export const MobileFilterPanel: React.FC<MobileFilterPanelProps> = ({
  isOpen,
  onClose,
  onApply,
  onReset,
  initialFilters = {},
  sections,
  activeFiltersCount = 0,
  showSearch = false,
  searchPlaceholder = "Search filters...",
  className,
}) => {
  const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(sections.map(s => s.id))
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Update local filters when initial filters change
  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  // Filter sections based on search
  const filteredSections = React.useMemo(() => {
    if (!searchTerm.trim()) return sections;

    return sections.filter(section => {
      const searchLower = searchTerm.toLowerCase();
      return (
        section.title.toLowerCase().includes(searchLower) ||
        section.options?.some(option =>
          option.label.toLowerCase().includes(searchLower)
        )
      );
    });
  }, [sections, searchTerm]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // Handle filter value changes
  const handleFilterChange = useCallback((sectionId: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [sectionId]: value,
    }));
  }, []);

  // Handle multiselect option toggle
  const handleMultiselectToggle = useCallback((sectionId: string, optionValue: string) => {
    setFilters(prev => {
      const currentValues = prev[sectionId] || [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((v: string) => v !== optionValue)
        : [...currentValues, optionValue];
      return {
        ...prev,
        [sectionId]: newValues,
      };
    });
  }, []);

  // Handle toggle switch
  const handleToggle = useCallback((sectionId: string) => {
    setFilters(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  }, []);

  // Apply filters
  const handleApply = useCallback(() => {
    onApply(filters);
    onClose();
  }, [filters, onApply, onClose]);

  // Reset filters
  const handleReset = useCallback(() => {
    setFilters({});
    onReset();
    onClose();
  }, [onReset, onClose]);

  // Render filter content based on type
  const renderFilterContent = useCallback((section: FilterSection) => {
    const currentValue = filters[section.id];

    switch (section.type) {
      case 'select': {
        return (
          <select
            value={currentValue || ''}
            onChange={(e) => handleFilterChange(section.id, e.target.value || undefined)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
          >
            <option value="">{section.placeholder || 'Select...'}</option>
            {section.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.count !== undefined && ` (${option.count})`}
              </option>
            ))}
          </select>
        );
      }

      case 'multiselect': {
        return (
          <div className="space-y-2">
            {section.options?.map(option => {
              const isSelected = currentValue?.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => handleMultiselectToggle(section.id, option.value)}
                  className={cn(
                    'w-full px-3 py-3 text-left rounded-lg border-2 transition-colors min-h-[44px] touch-manipulation flex items-center justify-between',
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="flex-1">{option.label}</span>
                  {option.count !== undefined && (
                    <Badge variant="outline" className="text-xs ml-2">
                      {option.count}
                    </Badge>
                  )}
                  {isSelected && (
                    <Check className="w-5 h-5 text-blue-500 ml-2 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        );
      }

      case 'range': {
        const rangeValue = currentValue || { min: section.min || 0, max: section.max || 100 };
        return (
          <FilterRange
            min={section.min || 0}
            max={section.max || 100}
            value={rangeValue}
            onChange={(value) => handleFilterChange(section.id, value)}
            step={section.step}
            unit={section.unit}
          />
        );
      }

      case 'date': {
        const dateValue = currentValue || {};
        return (
          <FilterDateRange
            value={dateValue}
            onChange={(value) => handleFilterChange(section.id, value)}
          />
        );
      }

      case 'toggle': {
        return (
          <button
            onClick={() => handleToggle(section.id)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-[44px] min-h-[44px] touch-manipulation',
              currentValue ? 'bg-blue-500' : 'bg-gray-300'
            )}
            aria-pressed={currentValue}
          >
            <div
              className={cn(
                'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
                currentValue ? 'translate-x-6' : 'translate-x-0.5'
              )}
            />
          </button>
        );
      }

      case 'search': {
        return (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={currentValue || ''}
              onChange={(e) => handleFilterChange(section.id, e.target.value)}
              placeholder={section.placeholder || 'Search...'}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
            />
          </div>
        );
      }

      default:
        return null;
    }
  }, [filters, handleFilterChange, handleMultiselectToggle, handleToggle]);

  // Get section icon
  const getSectionIcon = useCallback((section: FilterSection) => {
    switch (section.type) {
      case 'range':
        if (section.unit?.includes('$')) return <DollarSign className="w-5 h-5" />;
        if (section.unit?.includes('people')) return <Users className="w-5 h-5" />;
        return <TrendingUp className="w-5 h-5" />;
      case 'date':
        return <Calendar className="w-5 h-5" />;
      case 'toggle':
        if (section.id.includes('eba')) return <Shield className="w-5 h-5" />;
        if (section.id.includes('star')) return <Star className="w-5 h-5" />;
        break;
      case 'search':
        return <Search className="w-5 h-5" />;
      case 'multiselect':
        return <Filter className="w-5 h-5" />;
    }
    return <Filter className="w-5 h-5" />;
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white w-full max-h-[85vh] rounded-t-2xl shadow-xl flex flex-col">
        {/* Handle */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-10 h-1 bg-gray-300 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Filters</h2>
            {activeFiltersCount > 0 && (
              <Badge variant="default" className="text-xs">
                {activeFiltersCount} active
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] touch-manipulation"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search filters */}
        {showSearch && (
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] touch-manipulation"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter sections */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredSections.length === 0 ? (
            <div className="text-center py-8">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No filters found matching "{searchTerm}"</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="mt-2"
              >
                Clear search
              </Button>
            </div>
          ) : (
            filteredSections.map(section => {
              const isExpanded = expandedSections.has(section.id);
              const hasValue = filters[section.id] !== undefined &&
                             (Array.isArray(filters[section.id]) ?
                              filters[section.id].length > 0 :
                              filters[section.id] !== '');

              return (
                <div
                  key={section.id}
                  className={cn(
                    'bg-gray-50 rounded-xl overflow-hidden',
                    hasValue && 'ring-2 ring-blue-500 ring-opacity-20'
                  )}
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors min-h-[44px] touch-manipulation"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-gray-600">
                        {getSectionIcon(section)}
                      </div>
                      <span className="font-medium text-gray-900">
                        {section.title}
                      </span>
                      {hasValue && (
                        <Badge variant="default" className="text-xs">
                          {Array.isArray(filters[section.id])
                            ? filters[section.id].length
                            : 1}
                        </Badge>
                      )}
                    </div>
                    <div className="text-gray-400">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {renderFilterContent(section)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 min-h-[44px] touch-manipulation"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 min-h-[44px] touch-manipulation"
            >
              Apply Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileFilterPanel;