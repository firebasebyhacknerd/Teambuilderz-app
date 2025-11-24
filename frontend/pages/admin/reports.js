import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Users, Calendar, TrendingUp, Briefcase, Phone } from 'lucide-react';
import { Card } from '../../components/ui/card';
import PDFExportPanel from '../../components/ui/pdf-export-panel';
import DashboardLayout from '../../components/Layout/DashboardLayout';
import { getAdminSidebarLinks } from '../../lib/adminSidebarLinks';

const ReportsPage = () => {
  const [selectedReport, setSelectedReport] = useState(null);

  const reportTypes = [
    {
      id: 'attendance',
      name: 'Attendance Reports',
      description: 'Export attendance records with date ranges and employee filters',
      icon: Calendar,
      color: 'bg-tbz-blue',
      adminOnly: true
    },
    {
      id: 'candidates',
      name: 'Candidates Pipeline',
      description: 'Export candidate data with stages and recruiter assignments',
      icon: Users,
      color: 'bg-success',
      adminOnly: false
    },
    {
      id: 'performance',
      name: 'Performance Analytics',
      description: 'Export recruiter performance metrics and conversion rates',
      icon: TrendingUp,
      color: 'bg-tbz-orange',
      adminOnly: true
    },
    {
      id: 'applications',
      name: 'Applications Tracking',
      description: 'Export application status and submission data',
      icon: Briefcase,
      color: 'bg-warning',
      adminOnly: false
    },
    {
      id: 'interviews',
      name: 'Interviews Schedule',
      description: 'Export interview schedules and status tracking',
      icon: Phone,
      color: 'bg-destructive',
      adminOnly: false
    }
  ];

  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'Recruiter';
  const availableReports = userRole === 'Admin' 
    ? reportTypes 
    : reportTypes.filter(report => !report.adminOnly);

  return (
    <DashboardLayout 
      title="Reports"
      subtitle="Generate and export system reports"
      links={getAdminSidebarLinks()}
    >
      <div className="space-y-6">
        {/* Report Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableReports.map((report, index) => {
            const Icon = report.icon;
            const isSelected = selectedReport === report.id;
            
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`p-6 cursor-pointer transition-all duration-300 hover:shadow-lg ${
                    isSelected 
                      ? 'ring-2 ring-primary border-primary' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedReport(isSelected ? null : report.id)}
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${report.color} text-white`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{report.name}</h3>
                        {report.adminOnly && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-100 text-amber-800 mt-1">
                            Admin Only
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-muted-foreground text-sm">
                      {report.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {isSelected ? 'Click to deselect' : 'Click to configure'}
                      </span>
                      <motion.div
                        animate={{ 
                          rotate: isSelected ? 180 : 0,
                          scale: isSelected ? 1.1 : 1
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <FileText className="h-4 w-4 text-primary" />
                      </motion.div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Export Panel */}
        {selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <PDFExportPanel 
              reportType={selectedReport}
              className="max-w-2xl mx-auto"
            />
          </motion.div>
        )}

        {/* Quick Actions */}
        {!selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center py-12"
          >
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Select a Report Type</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Choose a report type above to configure filters and export your data as PDF documents.
            </p>
          </motion.div>
        )}

        {/* Usage Tips */}
        {!selectedReport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="p-6 bg-muted/30">
              <h4 className="font-semibold mb-4">Quick Tips</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
                    <div>
                      <strong>Advanced Filters:</strong> Use advanced mode to filter by date ranges, status, and specific users.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
                    <div>
                      <strong>Performance Reports:</strong> Track recruiter metrics and conversion rates over time.
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
                    <div>
                      <strong>Real-time Data:</strong> Reports are generated with the latest data from the system.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-1.5"></div>
                    <div>
                      <strong>PDF Format:</strong> All reports are exported as professionally formatted PDF documents.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;



