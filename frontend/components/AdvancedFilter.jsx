import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';

/**
 * Advanced Filter Component
 * Features:
 * - Multi-field filtering
 * - Saved filter presets
 * - Date range pickers
 * - Tag-based filtering
 * - Filter history
 */
const AdvancedFilter = ({
  fields = [],
  onFilterChange = null,
  onSavePreset = null,
  savedPresets = [],
  onLoadPreset = null,
  onDeletePreset = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState({});
  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Handle filter change
  const handleFilterChange = useCallback(
    (fieldKey, value) => {
      const newFilters = { ...filters, [fieldKey]: value };
      setFilters(newFilters);
      onFilterChange?.(newFilters);
    },
    [filters, onFilterChange]
  );

  // Handle clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({});
    onFilterChange?.({});
  }, [onFilterChange]);

  // Handle save preset
  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }
    onSavePreset?.(presetName, filters);
    setPresetName('');
    setShowSavePreset(false);
  }, [presetName, filters, onSavePreset]);

  // Handle load preset
  const handleLoadPreset = useCallback(
    (preset) => {
      setFilters(preset.filters);
      onLoadPreset?.(preset.filters);
    },
    [onLoadPreset]
  );

  // Count active filters
  const activeFilterCount = Object.values(filters).filter((v) => v !== '' && v !== null).length;

  return (
    <>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
      >
        <Filter className="h-4 w-4" />
        <span className="text-sm font-medium">Filters</span>
        {activeFilterCount > 0 && (
          <span className="ml-1 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full font-semibold">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-full right-0 mt-2 w-96 max-h-96 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50"
            >
              {/* Header */}
              <div className="border-b border-border p-4 flex items-center justify-between bg-muted/30">
                <h3 className="font-semibold text-foreground">Advanced Filters</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-80 p-4 space-y-4">
                {/* Filter Fields */}
                {fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-sm font-medium">{field.label}</Label>

                    {field.type === 'text' && (
                      <Input
                        type="text"
                        placeholder={field.placeholder || `Filter by ${field.label}`}
                        value={filters[field.key] || ''}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        className="text-sm"
                      />
                    )}

                    {field.type === 'select' && (
                      <select
                        value={filters[field.key] || ''}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
                      >
                        <option value="">All {field.label}</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'date' && (
                      <Input
                        type="date"
                        value={filters[field.key] || ''}
                        onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        className="text-sm"
                      />
                    )}

                    {field.type === 'daterange' && (
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          placeholder="From"
                          value={filters[`${field.key}_from`] || ''}
                          onChange={(e) => handleFilterChange(`${field.key}_from`, e.target.value)}
                          className="text-sm flex-1"
                        />
                        <Input
                          type="date"
                          placeholder="To"
                          value={filters[`${field.key}_to`] || ''}
                          onChange={(e) => handleFilterChange(`${field.key}_to`, e.target.value)}
                          className="text-sm flex-1"
                        />
                      </div>
                    )}

                    {field.type === 'checkbox' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={field.key}
                          checked={filters[field.key] || false}
                          onChange={(e) => handleFilterChange(field.key, e.target.checked)}
                          className="rounded border-border"
                        />
                        <label htmlFor={field.key} className="text-sm cursor-pointer">
                          {field.label}
                        </label>
                      </div>
                    )}
                  </div>
                ))}

                {/* Saved Presets */}
                {savedPresets.length > 0 && (
                  <div className="border-t border-border pt-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Saved Presets
                    </p>
                    <div className="space-y-2">
                      {savedPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <button
                            onClick={() => handleLoadPreset(preset)}
                            className="flex-1 text-left text-sm font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {preset.name}
                          </button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeletePreset?.(preset.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-border p-4 bg-muted/30 space-y-2">
                {/* Save Preset */}
                {showSavePreset ? (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Preset name..."
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      className="text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      onClick={handleSavePreset}
                      className="gap-1"
                    >
                      <Save className="h-3 w-3" />
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowSavePreset(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-xs"
                      onClick={() => setShowSavePreset(true)}
                      disabled={activeFilterCount === 0}
                    >
                      <Save className="h-3 w-3" />
                      Save as Preset
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1 text-xs"
                      onClick={handleClearFilters}
                      disabled={activeFilterCount === 0}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Clear All
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default AdvancedFilter;
