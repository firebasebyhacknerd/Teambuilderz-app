# TeamBuilderz - Comprehensive Feature Documentation

## 🚀 Phase 2 Implementation Complete

This document outlines all the features implemented in the TeamBuilderz recruitment management system based on the comprehensive blueprint provided.

## 📊 Database Schema

### Core Tables

- **users** - User management with roles (Admin/Recruiter/Viewer) and daily quotas
- **candidates** - Complete candidate profiles with lifecycle stages
- **applications** - Job application tracking with status management
- **interviews** - Interview scheduling and feedback system
- **assessments** - Technical assessment assignment and tracking
- **documents** - File storage for resumes and documents
- **notes** - Notes system for candidates, applications, interviews, and assessments
- **reminders** - Task reminders for recruiters
- **alerts** - Automated alert system
- **daily_activity** - Daily activity tracking for performance metrics
- **audit_logs** - Complete audit trail for all actions
- **export_logs** - Export tracking and approval system

### Enums

- `user_role` - Admin, Recruiter, Viewer
- `candidate_stage` - onboarding, marketing, interviewing, offered, placed, inactive
- `application_status` - sent, viewed, shortlisted, interviewing, offered, hired, rejected
- `interview_status` - scheduled, completed, feedback_pending, rejected, advanced
- `assessment_status` - assigned, submitted, passed, failed, waived
- `reminder_status` - pending, sent, snoozed, dismissed
- `alert_status` - open, acknowledged, resolved
- `interview_type` - phone, video, in_person, technical, hr, final

## 🔐 User Management & Roles

### Admin Role

- Full access to all modules and data
- Create and manage recruiters
- Set daily quotas for recruiters
- Approve or deny large exports
- View comprehensive reports and analytics

### Recruiter Role

- Manage assigned candidates
- Log applications, interviews, and assessments
- Monitor personal performance (daily/weekly)
- View alerts and reminders
- Track candidate journey through all stages

### Viewer Role

- Read-only access to all data
- View reports and analytics
- No modification permissions

## 👥 Candidate Management

### Features

- **Complete Profile Management**: Name, contact info, visa status, skills, experience
- **Lifecycle Stages**: Onboarding → Marketing → Interviewing → Offered → Placed → Inactive
- **Marketing Start Date**: Enforced once candidate enters marketing stage
- **Document Upload**: Resume and document storage
- **Recruiter Assignment**: Assign candidates to specific recruiters
- **Skills Tracking**: Array-based skills management
- **Search & Filtering**: By name, email, stage, recruiter, skills

### API Endpoints

- `GET /api/v1/candidates` - List candidates with filtering
- `POST /api/v1/candidates` - Create new candidate
- `PUT /api/v1/candidates/:id` - Update candidate

## 📝 Application Management

### Features

- **Application Logging**: Track all job applications
- **Status Management**: Complete application lifecycle tracking
- **Company & Job Details**: Company name, job title, description
- **Channel Tracking**: Source of application (LinkedIn, Indeed, etc.)
- **Daily Quota Integration**: Applications count toward recruiter quotas
- **Comprehensive Filtering**: By candidate, recruiter, status, date range

### Application Statuses

1. **Sent** - Application submitted
2. **Viewed** - Application viewed by employer
3. **Shortlisted** - Candidate shortlisted
4. **Interviewing** - In interview process
5. **Offered** - Job offer received
6. **Hired** - Successfully placed
7. **Rejected** - Application rejected

### API Endpoints

- `GET /api/v1/applications` - List applications with filtering
- `POST /api/v1/applications` - Log new application

## 📅 Interview Management

### Features

- **Interview Scheduling**: Complete scheduling system
- **Multiple Rounds**: Track interview rounds
- **Interview Types**: Phone, video, in-person, technical, HR, final
- **Timezone Support**: Handle different timezones
- **Feedback System**: Store interview feedback and files
- **Status Tracking**: Scheduled → Completed → Feedback Pending → Rejected → Advanced
- **Reminder System**: Automated interview reminders

### API Endpoints

- `GET /api/v1/interviews` - List interviews with filtering
- `POST /api/v1/interviews` - Schedule new interview

## 🧪 Assessment Management

### Features

- **Assessment Assignment**: Assign technical assessments
- **Platform Integration**: Support for HackerRank, Codility, etc.
- **Due Date Tracking**: Track assessment deadlines
- **Score Management**: Store assessment scores
- **Status Tracking**: Assigned → Submitted → Passed/Failed/Waived
- **Alert System**: 24-hour deadline alerts

### API Endpoints

- `GET /api/v1/assessments` - List assessments with filtering
- `POST /api/v1/assessments` - Assign new assessment

## 📋 Notes & Reminders

### Notes System

- **Multi-Entity Notes**: Attach notes to candidates, applications, interviews, or assessments
- **Private Notes**: Option for private notes
- **Author Tracking**: Track who created each note
- **Timestamp Management**: Automatic timestamping

### Reminders System

- **Task Reminders**: Create reminders for recruiters
- **Priority Levels**: Set reminder priority
- **Status Management**: Pending → Sent → Snoozed → Dismissed
- **Due Date Tracking**: Track reminder deadlines

## 🚨 Alert System

### Automated Alerts

1. **Daily Quota Breach**: Alert when recruiter below daily quota (<60 apps)
2. **Assessment Due Soon**: 24-hour deadline alerts
3. **Interview Reminders**: Day-of and day-before reminders
4. **Backup Failure**: System backup failure alerts

### Alert Management

- **Status Tracking**: Open → Acknowledged → Resolved
- **Priority Levels**: 1 (High), 2 (Medium), 3 (Low)
- **User-Specific**: Alerts targeted to specific users
- **Timestamp Tracking**: Creation, acknowledgment, and resolution times

### API Endpoints

- `GET /api/v1/alerts` - List user alerts with filtering

## 📊 Reports & Analytics

### Performance Reports

- **Daily Activity Reports**: Recruiter-wise applications, interviews, assessments
- **Weekly Scorecards**: Totals and efficiency index
- **Candidate Journey Reports**: Pipeline from marketing to placement
- **Quota Tracking**: Daily quota performance monitoring

### Export System

- **Small Exports**: Direct download for small datasets
- **Large Exports**: Admin approval required for large datasets
- **Export Logging**: Track all exports with filters and row counts
- **Approval Workflow**: Admin approval for sensitive exports

### API Endpoints

- `GET /api/v1/reports/performance` - Get performance reports

## 🔒 Security & Compliance

### Audit Logging

- **Complete Audit Trail**: Every create/update/delete action logged
- **Actor Tracking**: Who performed each action
- **Timestamp Recording**: When each action occurred
- **Change Tracking**: Old and new values for updates
- **IP Address Logging**: Track source IP addresses

### Role-Based Access Control

- **Granular Permissions**: Different access levels for each role
- **API Protection**: All endpoints protected with JWT authentication
- **Data Filtering**: Recruiters only see their assigned data

## 🤖 Automation

### Scheduled Tasks

- **Daily Quota Checks**: Every hour
- **Assessment Deadline Alerts**: Every 6 hours
- **Interview Reminders**: Every 2 hours
- **Daily Activity Rollup**: Automatic daily activity tracking

### Background Jobs

- **Automated Alerts**: System-generated alerts based on rules
- **Performance Tracking**: Automatic performance metric calculation
- **Data Cleanup**: Automated data maintenance

## 🎨 Frontend Features

### Modern UI Components

- **Responsive Design**: Mobile-first responsive design
- **Tailwind CSS**: Modern styling with Tailwind CSS
- **Interactive Dashboards**: Real-time data visualization
- **Modal Forms**: Clean modal-based forms for data entry
- **Search & Filtering**: Advanced search and filtering capabilities

### Key Pages

1. **Admin Dashboard**: Comprehensive overview with quick actions
2. **Candidate Management**: Full CRUD operations for candidates
3. **Application Tracking**: Complete application management
4. **Alerts & Notifications**: Alert management interface
5. **Performance Reports**: Analytics and reporting dashboard

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- PostgreSQL 15+
- Docker (optional)

### Installation

1. Clone the repository
2. Create `.env` file with database credentials
3. Install dependencies: `npm install`
4. Start with Docker: `docker-compose up --build`
5. Or run locally: `npm run dev`

### Default Credentials

- **Admin**: admin@tbz.us / admin123
- **Recruiter**: sarthi@tbz.us / recruit123

## 📈 Performance Features

### Database Optimization

- **Indexed Queries**: All major queries optimized with indexes
- **Efficient Joins**: Optimized database joins for performance
- **Connection Pooling**: PostgreSQL connection pooling
- **Query Optimization**: Efficient SQL queries

### Caching Strategy

- **Client-Side Caching**: React state management
- **API Response Caching**: Efficient API responses
- **Database Query Caching**: Optimized database queries

## 🔧 Technical Stack

### Backend

- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **PostgreSQL**: Primary database
- **JWT**: Authentication
- **bcryptjs**: Password hashing

### Frontend

- **Next.js**: React framework
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **Responsive Design**: Mobile-first approach

### Infrastructure

- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **PostgreSQL**: Database with full-text search
- **File Storage**: Local file storage for documents

## 📝 API Documentation

### Authentication

All API endpoints require JWT authentication via Bearer token in the Authorization header.

### Response Format

```json
{
  "data": [...],
  "message": "Success",
  "status": 200
}
```

### Error Handling

```json
{
  "message": "Error description",
  "status": 400
}
```

## 🎯 Future Enhancements

### Planned Features

- **Email Notifications**: Email alerts and reminders
- **Calendar Integration**: Google Calendar/Outlook integration
- **Advanced Analytics**: More detailed reporting and analytics
- **Mobile App**: Native mobile application
- **API Rate Limiting**: Enhanced API security
- **Data Backup**: Automated backup system
- **Multi-tenancy**: Support for multiple organizations

## 📞 Support

For technical support or feature requests, please contact the development team.

---

**TeamBuilderz** - Comprehensive Recruitment Management System
_Built with modern technologies and best practices for enterprise-grade recruitment management._
