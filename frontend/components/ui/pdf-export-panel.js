import React, { useState } from 'react';
import { Calendar, Filter, Download, Loader2, FileText } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Card } from './card';
import PDFExportButton from './pdf-export-button';
import { motion, AnimatePresence } from 'framer-motion';

const PDFExportPanel = ({ 
  reportType, 
  availableFilters = {},
  className = '' 
}) => {
  const [filters, setFilters] = useState({});
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  const getReportTypeName = (type) => {
    const names = {
      attendance: 'Attendance Report',
      candidates: 'Candidates Pipeline',
      performance: 'Performance Analytics',
      applications: 'Applications Tracking',
      interviews: 'Interviews Schedule'
    };
    return names[type] || 'Report';
  };

  const renderFilterInputs = () => {
    const filterConfigs = {
      attendance: [
        { key: 'dateFrom', label: 'From Date', type: 'date', icon: Calendar },
        { key: 'dateTo', label: 'To Date', type: 'date', icon: Calendar },
        { key: 'userId', label: 'Employee ID', type: 'number', icon: Filter }
      ],
      candidates: [
        { key: 'stage', label: 'Stage', type: 'select', options: ['onboarding', 'marketing', 'interviewing', 'offered', 'placed'] },
        { key: 'recruiterId', label: 'Recruiter ID', type: 'number', icon: Filter },
        { key: 'dateFrom', label: 'From Date', type: 'date', icon: Calendar },
        { key: 'dateTo', label: 'To Date', type: 'date', icon: Calendar }
      ],
      performance: [
        { key: 'period', label: 'Period', type: 'select', options: ['weekly', 'monthly', 'quarterly', 'yearly'] },
        { key: 'dateFrom', label: 'From Date', type: 'date', icon: Calendar },
        { key: 'dateTo', label: 'To Date', type: 'date', icon: Calendar }
      ],
      applications: [
        { key: 'status', label: 'Status', type: 'select', options: ['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected'] },
        { key: 'recruiterId', label: 'Recruiter ID', type: 'number', icon: Filter },
        { key: 'dateFrom', label: 'From Date', type: 'date', icon: Calendar },
        { key: 'dateTo', label: 'To Date', type: 'date', icon: Calendar }
      ],
      interviews: [
        { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'completed', 'feedback_pending', 'advanced', 'rejected'] },
        { key: 'type', label: 'Type', type: 'select', options: ['phone_screen', 'technical', 'behavioral', 'final'] },
        { key: 'dateFrom', label: 'From Date', type: 'date', icon: Calendar },
        { key: 'dateTo', label: 'To Date', type: 'date', icon: Calendar }
      ]
    };

    const configs = filterConfigs[reportType] || [];

    return configs.map(config => {
      const Icon = config.icon || Filter;
      return (
        <div key={config.key} className="space-y-2">
          <Label htmlFor={config.key} className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {config.label}
          </Label>
          
          {config.type === 'select' ? (
            <select
              id={config.key}
              value={filters[config.key] || ''}
              onChange={(e) => handleFilterChange(config.key, e.target.value)}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All</option>
              {config.options?.map(option => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1).replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id={config.key}
              type={config.type}
              value={filters[config.key] || ''}
              onChange={(e) => handleFilterChange(config.key, e.target.value)}
              placeholder={`Enter ${config.label.toLowerCase()}`}
            />
          )}
        </div>
      );
    });
  };

  return (
    <Card className={`p-6 space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">{getReportTypeName(reportType)}</h3>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdvancedMode(!isAdvancedMode)}
          className="text-primary"
        >
          <Filter className="h-4 w-4 mr-2" />
          {isAdvancedMode ? 'Simple' : 'Advanced'}
        </Button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {isAdvancedMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderFilterInputs()}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetFilters} size="sm">
                Reset Filters
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Options */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Download className="h-4 w-4" />
          <span>Export Options</span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <PDFExportButton
            reportType={reportType}
            data={filters}
            filename={`${reportType}-report`}
            className="flex-1"
          />
          
          {!isAdvancedMode && (
            <Button variant="outline" onClick={() => setIsAdvancedMode(true)}>
              <Filter className="h-4 w-4 mr-2" />
              Add Filters
            </Button>
          )}
        </div>
        
        {/* Active filters display */}
        {Object.keys(filters).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {Object.entries(filters).map(([key, value]) => (
              value && (
                <div
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs"
                >
                  {key}: {value}
                  <button
                    onClick={() => handleFilterChange(key, '')}
                    className="ml-1 hover:text-primary/70"
                  >
                    ×
                  </button>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PDFExportPanel;



