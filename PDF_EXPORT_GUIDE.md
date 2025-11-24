# TeamBuilderz PDF Export System - Complete Guide

## 🎯 Overview

The TeamBuilderz application now features a comprehensive PDF export system that allows users to generate professional reports for various data types. This system is fully integrated into the existing UI and provides real-time data export capabilities.

## 📋 Available Report Types

### 1. **Attendance Reports** (Admin Only)

- **Endpoint:** `/api/v1/pdf/attendance`
- **Data:** Attendance records with date ranges and employee filters
- **Features:**
  - Date range filtering
  - Individual employee filtering
  - Summary statistics (present, absent, leave counts)
  - Professional table layout with check-in/out times

### 2. **Candidates Pipeline** (All Users)

- **Endpoint:** `/api/v1/pdf/candidates`
- **Data:** Candidate information with stages and assignments
- **Features:**
  - Stage-based filtering (onboarding, marketing, interviewing, offered, placed)
  - Recruiter assignment filtering
  - Date range filtering
  - Pipeline visualization with stage counts

### 3. **Performance Analytics** (Admin Only)

- **Endpoint:** `/api/v1/pdf/performance`
- **Data:** Recruiter performance metrics and conversion rates
- **Features:**
  - Period-based analysis (weekly, monthly, quarterly, yearly)
  - Applications, interviews, and placements tracking
  - Conversion rate calculations
  - Performance categorization (excellent, good, average, poor)

### 4. **Applications Tracking** (All Users)

- **Endpoint:** `/api/v1/pdf/applications`
- **Data:** Application status and submission data
- **Features:**
  - Status filtering (sent, viewed, shortlisted, interviewing, offered, hired, rejected)
  - Recruiter filtering
  - Date range filtering
  - Application channel tracking

### 5. **Interviews Schedule** (All Users)

- **Endpoint:** `/api/v1/pdf/interviews`
- **Data:** Interview schedules and status tracking
- **Features:**
  - Status filtering (scheduled, completed, feedback_pending, advanced, rejected)
  - Interview type filtering (phone_screen, technical, behavioral, final)
  - Date range filtering
  - Upcoming vs completed interview tracking

## 🚀 How to Use

### Method 1: Quick Export Buttons

**Location:** Individual pages (Attendance, Candidates, etc.)

- Click the "Export PDF" button in the page header
- Uses current page filters automatically
- Generates PDF with current view data

### Method 2: Advanced Export Panel

**Location:** `/admin/reports` page

1. Navigate to Reports page from admin dashboard
2. Select desired report type from available cards
3. Configure advanced filters (optional)
4. Click "Export PDF" button
5. PDF automatically downloads with timestamp

### Method 3: Custom API Integration

**For developers:** Direct API access

```javascript
const token = localStorage.getItem("token");
const userRole = localStorage.getItem("userRole");
const userId = localStorage.getItem("userId");

const response = await fetch("http://localhost:3001/api/v1/pdf/attendance", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-user-role": userRole,
    "x-user-id": userId,
  },
  body: JSON.stringify({
    dateFrom: "2024-01-01",
    dateTo: "2024-12-31",
    userId: 123,
  }),
});

const pdfBlob = await response.blob();
// Handle PDF download
```

## 🎨 PDF Template Features

### Professional Design Elements

- **Branding:** TeamBuilderz LLC header with company information
- **Typography:** Clean, readable fonts optimized for printing
- **Color Scheme:** Professional color palette with clear hierarchy
- **Layout:** A4 format with proper margins and spacing

### Data Visualization

- **Summary Cards:** Key metrics displayed prominently
- **Tables:** Organized data with alternating row colors
- **Status Indicators:** Color-coded status badges
- **Charts:** Summary statistics in visual format

### Interactive Elements

- **Page Numbers:** Automatic pagination with page numbers
- **Timestamps:** Generation date and time on all reports
- **Watermarks:** "Generated automatically" footer text
- **Metadata:** Report type and filter information

## 🔧 Technical Implementation

### Backend Architecture

```
backend/
├── services/
│   └── pdfService.js          # Core PDF generation logic
├── routes/
│   └── pdfRoutes.js           # API endpoints for PDF export
└── server.js                  # Route integration
```

### Frontend Components

```
frontend/
├── components/ui/
│   ├── pdf-export-button.js   # Reusable export button
│   └── pdf-export-panel.js    # Advanced export configuration
└── pages/
    ├── admin/
    │   └── reports.js         # Dedicated reports page
    ├── admin/
    │   └── attendance.js      # Attendance with export
    └── recruiter/
        └── candidates.js      # Candidates with export
```

### Dependencies

- **Puppeteer:** Headless Chrome for PDF generation
- **Framer Motion:** Smooth animations for UI components
- **Lucide React:** Professional icons for export buttons

## 📊 Sample PDF Outputs

### Attendance Report Structure

```
┌─────────────────────────────────────┐
│ TeamBuilderz LLC - Attendance Report │
│ Period: Jan 1, 2024 to Dec 31, 2024 │
├─────────────────────────────────────┤
│ Summary Statistics                  │
│ ┌─────┬─────┬─────┬─────┐         │
│ │Total│Present│Absent│Leave│         │
│ ├─────┼─────┼─────┼─────┤         │
│ │ 245 │ 210  │ 25   │ 10  │         │
│ └─────┴─────┴─────┴─────┘         │
├─────────────────────────────────────┤
│ Detailed Attendance Records         │
│ ┌──────┬─────────┬──────┬─────────┐│
│ │Date  │Employee │Status│Check In ││
│ └──────┴─────────┴──────┴─────────┘│
└─────────────────────────────────────┘
```

### Candidates Pipeline Structure

```
┌─────────────────────────────────────┐
│ TeamBuilderz LLC - Candidates Report │
│ Generated: Nov 25, 2024             │
├─────────────────────────────────────┤
│ Pipeline Overview                   │
│ ┌─────┬─────┬─────┬─────┬─────┐    │
│ │Onbrd│Mktg│Intv│Offr│Plcd│    │
│ ├─────┼─────┼─────┼─────┼─────┤    │
│ │ 15  │ 32  │ 18  │ 8   │ 12  │    │
│ └─────┴─────┴─────┴─────┴─────┘    │
├─────────────────────────────────────┤
│ Candidate Details                   │
│ ┌──────┬─────────┬─────────┬──────┐│
│ │Name  │Email    │Stage    │Recruiter││
│ └──────┴─────────┴─────────┴──────┘│
└─────────────────────────────────────┘
```

## 🔐 Security & Permissions

### Role-Based Access Control

- **Admin:** Full access to all report types
- **Recruiter:** Limited to own data (candidates, applications, interviews)
- **Viewer:** Read-only access to assigned reports

### Authentication Requirements

- JWT token validation for all PDF endpoints
- User role verification in request headers
- Automatic data filtering based on user permissions

### Data Protection

- No sensitive data exposure in PDF filenames
- Filtered data based on user access level
- Audit logging for all PDF generation requests

## 🚀 Performance Considerations

### Optimization Features

- **Lazy Loading:** PDF generation only when requested
- **Caching:** Template caching for repeated requests
- **Streaming:** Direct browser download without server storage
- **Error Handling:** Comprehensive error messages with retry options

### Best Practices

- Use date range filters for large datasets
- Avoid exporting more than 1000 records at once
- Close PDF browser instances after generation
- Monitor server memory usage during peak usage

## 🐛 Troubleshooting

### Common Issues & Solutions

#### PDF Generation Fails

**Problem:** "Error generating PDF report"
**Solution:**

- Check Puppeteer installation
- Verify server memory availability
- Restart backend server

#### Authentication Errors

**Problem:** "Authentication required"
**Solution:**

- Verify user is logged in
- Check JWT token validity
- Ensure proper user role

#### Empty PDF Files

**Problem:** PDF downloads but appears empty
**Solution:**

- Check database connection
- Verify data exists for selected filters
- Review browser PDF viewer

#### Slow Performance

**Problem:** PDF generation takes too long
**Solution:**

- Reduce date range scope
- Apply more specific filters
- Check server resources

## 📈 Future Enhancements

### Planned Features

- **Scheduled Reports:** Automatic PDF generation and email delivery
- **Custom Templates:** User-defined PDF layouts
- **Batch Export:** Multiple reports in single request
- **Export History:** Track generated reports
- **Advanced Charts:** Graphical data visualization

### Integration Opportunities

- **Email Integration:** Send reports via email
- **Cloud Storage:** Save to Google Drive/Dropbox
- **API Webhooks:** Notify external systems
- **Mobile Support:** Optimized mobile PDF viewing

## 📞 Support

For issues or questions regarding PDF export functionality:

1. Check this documentation first
2. Review browser console for JavaScript errors
3. Check server logs for backend errors
4. Contact system administrator with details

---

**Last Updated:** November 25, 2024  
**Version:** 1.0.0  
**Compatible with:** TeamBuilderz v2.0+
