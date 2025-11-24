import React, { useState } from 'react';
import { Download, Loader2, CheckCircle } from 'lucide-react';
import { Button } from './button';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import API_URL from '../../lib/api';

const PDFExportButton = ({ 
  reportType, 
  data = {}, 
  filename = 'report',
  className = '',
  disabled = false,
  size = 'default',
  variant = 'default'
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const handleExport = async () => {
    if (isExporting || disabled) return;

    setIsExporting(true);
    setError('');
    setProgress(0);
    const toastId = toast.loading('Generating PDF...');

    try {
      // Get user info from localStorage
      const token = localStorage.getItem('token');
      const userRole = localStorage.getItem('userRole');
      const userId = localStorage.getItem('userId');

      if (!token) {
        throw new Error('Authentication required');
      }

      // Prepare request headers
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-user-role': userRole || '',
        'x-user-id': userId || ''
      };

      // Update progress
      setProgress(30);

      // Make API request to generate PDF
      const response = await fetch(`${API_URL}/api/v1/pdf/${reportType}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      setProgress(60);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate PDF');
      }

      // Get the PDF blob
      const pdfBlob = await response.blob();
      setProgress(80);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const finalFilename = `${filename}-${timestamp}.pdf`;
      link.download = finalFilename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
      setProgress(100);
      toast.success('PDF exported successfully!', { id: toastId });
      
      // Reset progress after a moment
      setTimeout(() => setProgress(0), 1000);
      
    } catch (err) {
      console.error('PDF export error:', err);
      setError(err.message || 'Failed to export PDF');
      toast.error(err.message || 'Failed to export PDF', { id: toastId });
      
      // Show error for 3 seconds
      setTimeout(() => setError(''), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative">
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <Button
          onClick={handleExport}
          disabled={isExporting || disabled}
          className={`gap-2 ${className}`}
          size={size}
          variant={variant}
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>Export PDF</span>
            </>
          )}
        </Button>
      </motion.div>

      {/* Progress Bar */}
      {isExporting && progress > 0 && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          exit={{ opacity: 0, scaleX: 0 }}
          className="absolute top-full left-0 right-0 mt-2 h-1 bg-gray-200 rounded-full overflow-hidden"
          style={{ originX: 0 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>
      )}
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm whitespace-nowrap z-10"
        >
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default PDFExportButton;



