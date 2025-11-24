const { z } = require('zod');

const stringDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format.' });

const isoDateTimeString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), { message: 'Invalid date format.' });

const positiveInt = z.number({ coerce: true }).int().positive();
const nonNegativeInt = z.number({ coerce: true }).int().nonnegative();

const stageEnum = z.enum(['onboarding', 'marketing', 'interviewing', 'offered', 'placed', 'inactive']);
const attendanceStatuses = z.enum(['present', 'half-day', 'absent', 'leave']);
const attendanceApprovalStatuses = z.enum(['pending', 'approved', 'rejected']);

const optionalString = (max) => z.string().max(max).trim().optional().or(z.literal('')).transform((v) => (v ? v : null));
const skillArray = z
  .array(z.string().max(120).trim())
  .optional()
  .default([])
  .transform((skills) => skills.filter(Boolean));

const candidateBase = {
  name: z.string().min(1).max(200).trim(),
  email: z.string().email().max(320).trim(),
  phone: optionalString(50),
  visa_status: optionalString(120),
  skills: skillArray,
  experience_years: nonNegativeInt.optional().or(z.literal('').transform(() => null)),
  current_stage: stageEnum.optional().default('onboarding'),
  assigned_recruiter_id: positiveInt.optional().or(z.literal('').transform(() => null)),
  marketing_start_date: optionalString(20),
};

const applicationStatuses = z.enum(['sent', 'viewed', 'shortlisted', 'interviewing', 'offered', 'hired', 'rejected']);

const applicationBase = {
  company_name: z.string().min(1).max(200).trim(),
  job_title: z.string().min(1).max(200).trim(),
  job_description: optionalString(2000),
  channel: optionalString(120),
  status: applicationStatuses.optional(),
  applications_count: positiveInt.optional().default(1),
  application_date: stringDate.optional(),
};

const interviewStatuses = z.enum(['scheduled', 'completed', 'feedback_pending', 'rejected', 'advanced']);
const assessmentStatuses = z.enum(['assigned', 'submitted', 'passed', 'failed', 'waived']);

const bulkActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  recruiterId: positiveInt.optional().or(z.null()),
  types: z.array(z.enum(['applications', 'interviews', 'assessments'])).nonempty(),
  applicationIds: z.array(positiveInt).optional(),
  interviewIds: z.array(positiveInt).optional(),
  assessmentIds: z.array(positiveInt).optional(),
});

const approvalToggle = z.object({
  approved: z.boolean().optional(),
});

const userRoles = z.enum(['Admin', 'Recruiter', 'Viewer']);
const reviewerNoteField = z
  .string()
  .max(2000)
  .trim()
  .optional()
  .or(z.literal(''))
  .or(z.null())
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }
    return value;
  });

const followUpSchema = z
  .object({
    dueDate: isoDateTimeString,
    title: optionalString(200),
    description: optionalString(2000),
    priority: z.number({ coerce: true }).int().min(1).max(5).optional(),
    assigneeId: positiveInt.optional(),
  })
  .partial()
  .refine((val) => Object.keys(val).length === 0 || Boolean(val.dueDate), {
    message: 'followUp.dueDate is required when scheduling a follow-up.',
    path: ['dueDate'],
  });

const validateBody =
  (schema) =>
  (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: 'Validation failed.',
        errors: result.error.flatten(),
      });
    }
    req.body = result.data;
    return next();
  };

module.exports = {
  validateBody,
  schemas: {
    login: z.object({
      email: z.string().email().trim(),
      password: z.string().min(1).max(200),
    }),
    candidateUpsert: z.object(candidateBase),
    bulkPendingApprovals: bulkActionSchema,
    applicationCreate: z.object({
      candidate_id: positiveInt,
      ...applicationBase,
    }),
    applicationUpdate: z
      .object({
        status: applicationStatuses.optional(),
        channel: optionalString(120),
        application_date: stringDate.optional(),
        applications_count: nonNegativeInt.optional(),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one application field must be provided.',
      }),
    approvalToggle,
    interviewCreate: z.object({
      candidate_id: positiveInt,
      application_id: positiveInt.optional().or(z.literal('').transform(() => null)),
      company_name: z.string().min(1).max(200).trim(),
      interview_type: z.string().min(1).max(120).trim(),
      round_number: positiveInt.optional().default(1),
      scheduled_date: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
      timezone: optionalString(60),
    }),
    interviewUpdate: z
      .object({
        status: interviewStatuses.optional(),
        scheduled_date: z.preprocess((val) => (val ? new Date(val) : val), z.date().nullable()).optional(),
        round_number: positiveInt.optional(),
        timezone: optionalString(60),
        notes: optionalString(2000),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one interview field must be provided.',
      }),
    assessmentCreate: z.object({
      candidate_id: positiveInt,
      application_id: positiveInt.optional().or(z.literal('').transform(() => null)),
      assessment_platform: z.string().min(1).max(120).trim(),
      assessment_type: z.string().min(1).max(120).trim(),
      due_date: z.preprocess((val) => (val ? new Date(val) : val), z.date()),
      notes: optionalString(2000),
    }),
    assessmentUpdate: z
      .object({
        status: assessmentStatuses.optional(),
        due_date: z.preprocess((val) => (val ? new Date(val) : val), z.date().nullable()).optional(),
        score: z
          .union([z.number({ coerce: true }), z.null(), z.literal('')])
          .optional()
          .transform((value) => {
            if (value === undefined) return undefined;
            if (value === '' || value === null) return null;
            return Number(value);
          }),
        notes: optionalString(2000),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one assessment field must be provided.',
      }),
    noteCreate: z.object({
      content: z.string().min(1).max(4000).trim(),
      is_private: z.boolean().optional().default(false),
      followUp: followUpSchema.optional(),
    }),
    noteUpdate: z
      .object({
        content: z.string().min(1).max(4000).trim().optional(),
        is_private: z.boolean().optional(),
        followUp: followUpSchema.optional(),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'At least one note field must be provided.',
      }),
    userCreate: z.object({
      name: z.string().min(1).max(200).trim(),
      email: z.string().email().max(320).trim(),
      password: z.string().min(8).max(200),
      role: userRoles,
      daily_quota: positiveInt.optional().default(60),
    }),
    userUpdate: z
      .object({
        name: z.string().min(1).max(200).trim().optional(),
        email: z.string().email().max(320).trim().optional(),
        role: userRoles.optional(),
        daily_quota: positiveInt.optional(),
        is_active: z.boolean().optional(),
        password: z.string().min(8).max(200).optional(),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'No user fields provided for update.',
      }),
    attendanceCreate: z.object({
      attendance_date: stringDate.optional(),
      status: attendanceStatuses.optional(),
      approval_status: attendanceApprovalStatuses.optional(),
      reviewer_note: reviewerNoteField.optional(),
      user_id: positiveInt.optional(),
    }),
    attendanceUpdate: z
      .object({
        status: attendanceStatuses.optional(),
        approval_status: attendanceApprovalStatuses.optional(),
        reviewer_note: reviewerNoteField.optional(),
      })
      .refine((data) => Object.values(data).some((value) => value !== undefined), {
        message: 'No attendance fields provided for update.',
      }),
  },
};
