# Local App Improvements (No External Services)

## 🎯 Top 5 Priorities (This Week)

### 1. ✅ Search & Filter Persistence

**Impact:** 10/10 | **Effort:** 2/10 | **Time:** 1-2 hours

Users lose their filters when they refresh the page.

**Implementation:**

```javascript
// frontend/pages/recruiter/candidates.js
import { useRouter } from 'next/router';

export default function CandidatesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({});

  // Load filters from URL on mount
  useEffect(() => {
    if (router.isReady) {
      const urlFilters = Object.fromEntries(
        new URLSearchParams(router.query)
      );
      setFilters(urlFilters);
    }
  }, [router.isReady, router.query]);

  // Save filters to URL
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    const query = new URLSearchParams(newFilters).toString();
    router.push(`?${query}`, undefined, { shallow: true });
  };

  return (
    // ... existing UI with handleFilterChange
  );
}
```

**Files to Update:**

- `frontend/pages/recruiter/candidates.js`
- `frontend/pages/recruiter/applications.js`
- `frontend/pages/admin/candidates.js`
- `frontend/pages/admin/application-activity.js`

**Benefits:**

- Users can bookmark filtered views
- Filters persist on refresh
- Can share URLs with specific filters

---

### 2. ✅ Bulk Actions for Candidates

**Impact:** 8/10 | **Effort:** 3/10 | **Time:** 2-3 hours

Users need to update multiple candidates at once (change stage, assign recruiter, etc).

**Backend Endpoint:**

```javascript
// backend/server.js
app.post("/api/v1/candidates/bulk-update", verifyToken, async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "No IDs provided" });
    }

    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      setClauses.push(`${key} = $${paramIndex++}`);
      params.push(value);
    });

    params.push(ids);

    const result = await pool.query(
      `UPDATE candidates 
       SET ${setClauses.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($${paramIndex})
       RETURNING *`,
      params
    );

    res.json({
      message: `Updated ${result.rows.length} candidates`,
      updated: result.rows,
    });
  } catch (error) {
    console.error("Error bulk updating candidates:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
```

**Frontend Component:**

```javascript
// frontend/components/BulkActionsBar.jsx
import { Button } from "./ui/button";

export function BulkActionsBar({ selectedIds, onUpdate, onClose }) {
  const [stage, setStage] = useState("");
  const [recruiterId, setRecruiterId] = useState("");

  const handleBulkUpdate = async () => {
    const updates = {};
    if (stage) updates.current_stage = stage;
    if (recruiterId) updates.assigned_recruiter_id = recruiterId;

    const response = await fetch("/api/v1/candidates/bulk-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, updates }),
    });

    if (response.ok) {
      onUpdate();
      onClose();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {selectedIds.length} selected
        </span>

        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="px-3 py-2 border border-input rounded-md"
        >
          <option value="">Change Stage...</option>
          <option value="onboarding">Onboarding</option>
          <option value="screening">Screening</option>
          <option value="interview">Interview</option>
          <option value="offer">Offer</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>

        <Button onClick={handleBulkUpdate}>Apply</Button>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

**Use in Table:**

```javascript
// In candidates.js - already have advanced-table.jsx with row selection
const [selectedRows, setSelectedRows] = useState([]);
const [showBulkActions, setShowBulkActions] = useState(false);

return (
  <>
    <AdvancedTable
      data={candidates}
      onSelectionChange={setSelectedRows}
      // ... other props
    />
    {selectedRows.length > 0 && (
      <BulkActionsBar
        selectedIds={selectedRows}
        onUpdate={() => refetch()}
        onClose={() => setSelectedRows([])}
      />
    )}
  </>
);
```

**Benefits:**

- Update 50+ candidates in seconds
- Change stages, assign recruiters in bulk
- Save hours of manual work

---

### 3. ✅ Better Form Validation & Error Messages

**Impact:** 7/10 | **Effort:** 2/10 | **Time:** 1-2 hours

Users get cryptic error messages from the API.

**Install Dependencies:**

```bash
npm install --prefix frontend zod react-hook-form
```

**Create Validation Schema:**

```javascript
// frontend/lib/validation.js
import { z } from "zod";

export const candidateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .regex(/^\+?1?\d{9,15}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  skills: z.array(z.string()).min(1, "At least one skill required"),
  experience_years: z
    .number()
    .min(0, "Experience cannot be negative")
    .max(70, "Experience seems too high"),
  visa_status: z
    .enum(["authorized", "sponsorship_needed", "unknown"])
    .optional(),
});

export const applicationSchema = z.object({
  candidate_id: z.number().positive("Candidate required"),
  company_name: z.string().min(2, "Company name required"),
  job_title: z.string().min(2, "Job title required"),
  channel: z.string().min(1, "Channel required"),
  status: z.enum([
    "sent",
    "viewed",
    "shortlisted",
    "interviewing",
    "offered",
    "hired",
    "rejected",
  ]),
});
```

**Use in Form:**

```javascript
// frontend/components/CandidateForm.jsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { candidateSchema } from "../lib/validation";

export function CandidateForm({ onSubmit }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(candidateSchema),
    mode: "onBlur", // Validate on blur
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          {...register("name")}
          className="w-full px-3 py-2 border border-input rounded-md"
        />
        {errors.name && (
          <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          {...register("email")}
          type="email"
          className="w-full px-3 py-2 border border-input rounded-md"
        />
        {errors.email && (
          <p className="text-sm text-destructive mt-1">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Skills</label>
        <input
          {...register("skills")}
          placeholder="Comma-separated"
          className="w-full px-3 py-2 border border-input rounded-md"
        />
        {errors.skills && (
          <p className="text-sm text-destructive mt-1">
            {errors.skills.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Save
      </button>
    </form>
  );
}
```

**Benefits:**

- Catch errors before sending to API
- Clear, user-friendly error messages
- Better UX with real-time validation

---

### 4. ✅ Pagination for Large Lists

**Impact:** 8/10 | **Effort:** 3/10 | **Time:** 2-3 hours

Currently loading all candidates/applications at once (slow with 1000+ records).

**Backend Pagination:**

```javascript
// backend/server.js - Update existing GET endpoints
app.get("/api/v1/candidates", verifyToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { stage, recruiter_id, search } = req.query;
    let query = `SELECT c.*, u.name AS recruiter_name FROM candidates c
                 LEFT JOIN users u ON c.assigned_recruiter_id = u.id
                 WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (req.user.role === "Recruiter") {
      query += ` AND c.assigned_recruiter_id = $${paramCount++}`;
      params.push(req.user.userId);
    }

    if (stage) {
      query += ` AND c.current_stage = $${paramCount++}`;
      params.push(stage);
    }

    if (search) {
      query += ` AND (c.name ILIKE $${paramCount++} OR c.email ILIKE $${paramCount++})`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM (${query}) as t`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    query += ` ORDER BY c.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
```

**Frontend Pagination:**

```javascript
// frontend/pages/recruiter/candidates.js
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function CandidatesPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const { data, isLoading } = useQuery(
    ["candidates", page, limit],
    () =>
      fetch(`/api/v1/candidates?page=${page}&limit=${limit}`).then((r) =>
        r.json()
      ),
    { keepPreviousData: true }
  );

  return (
    <>
      {/* Table */}
      <CandidatesTable data={data?.data} isLoading={isLoading} />

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {(page - 1) * limit + 1} to{" "}
          {Math.min(page * limit, data?.pagination.total)}
          of {data?.pagination.total} candidates
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-input rounded-md disabled:opacity-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-2">
            {Array.from({ length: data?.pagination.pages }, (_, i) => i + 1)
              .slice(
                Math.max(0, page - 2),
                Math.min(data?.pagination.pages, page + 1)
              )
              .map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-md ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "border border-input"
                  }`}
                >
                  {p}
                </button>
              ))}
          </div>

          <button
            onClick={() =>
              setPage((p) => Math.min(data?.pagination.pages, p + 1))
            }
            disabled={!data?.pagination.hasMore}
            className="px-3 py-1 border border-input rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(parseInt(e.target.value));
            setPage(1);
          }}
          className="px-2 py-1 border border-input rounded-md"
        >
          <option value={25}>25 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>
    </>
  );
}
```

**Benefits:**

- Faster initial page load
- Better performance with large datasets
- Smoother user experience

---

### 5. ✅ Real-time Local Updates (Optimistic UI)

**Impact:** 7/10 | **Effort:** 2/10 | **Time:** 1-2 hours

Show changes immediately without waiting for API response.

**Implementation:**

```javascript
// frontend/hooks/useOptimisticUpdate.js
import { useQueryClient } from "@tanstack/react-query";

export function useOptimisticUpdate(queryKey) {
  const queryClient = useQueryClient();

  const updateOptimistic = async (id, updates, apiCall) => {
    // Get current data
    const previousData = queryClient.getQueryData(queryKey);

    // Update UI immediately
    queryClient.setQueryData(queryKey, (old) => {
      if (Array.isArray(old?.data)) {
        return {
          ...old,
          data: old.data.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        };
      }
      return old;
    });

    try {
      // Make API call
      const result = await apiCall();

      // Confirm with server data
      queryClient.setQueryData(queryKey, (old) => {
        if (Array.isArray(old?.data)) {
          return {
            ...old,
            data: old.data.map((item) => (item.id === id ? result : item)),
          };
        }
        return old;
      });

      return result;
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(queryKey, previousData);
      throw error;
    }
  };

  return { updateOptimistic };
}
```

**Use in Component:**

```javascript
// frontend/pages/recruiter/candidates.js
import { useOptimisticUpdate } from '../hooks/useOptimisticUpdate';

export default function CandidatesPage() {
  const { updateOptimistic } = useOptimisticUpdate(['candidates']);

  const handleStageChange = async (candidateId, newStage) => {
    try {
      await updateOptimistic(
        candidateId,
        { current_stage: newStage },
        () => fetch(`/api/v1/candidates/${candidateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_stage: newStage })
        }).then(r => r.json())
      );
    } catch (error) {
      console.error('Failed to update:', error);
    }
  };

  return (
    // ... use handleStageChange in UI
  );
}
```

**Benefits:**

- Instant UI feedback
- Feels faster and more responsive
- Better user experience

---

## 📋 Implementation Checklist

### Week 1

- [ ] Search & filter persistence (all list pages)
- [ ] Bulk actions for candidates
- [ ] Form validation with Zod
- [ ] Pagination for candidates, applications
- [ ] Optimistic UI updates

### Testing

- [ ] Test filters persist on refresh
- [ ] Test bulk update with 10+ candidates
- [ ] Test form validation errors
- [ ] Test pagination with 100+ records
- [ ] Test optimistic updates with slow network

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install --prefix frontend zod react-hook-form

# Update backend (no new dependencies needed)
# Just add the new endpoints to server.js

# Test locally
npm run dev --prefix frontend
npm run dev --prefix backend

# Check browser console for errors
# Test each feature in DevTools
```

---

## 📊 Expected Improvements

| Metric                     | Before  | After   |
| -------------------------- | ------- | ------- |
| Page Load (100 candidates) | 3-5s    | 0.5-1s  |
| Update Feedback            | 1-2s    | Instant |
| User Clicks to Update      | 5+      | 1-2     |
| Data Loss on Refresh       | Yes     | No      |
| Form Error Clarity         | Cryptic | Clear   |

---

## 🎯 Success Criteria

✅ Filters persist when user refreshes page
✅ Can select and bulk update 50+ candidates
✅ Form shows clear validation errors
✅ Page loads with 50 items, not all 1000+
✅ UI updates immediately on change

---

**Status:** Ready to implement
**Total Time:** 8-12 hours
**Complexity:** Low to Medium
