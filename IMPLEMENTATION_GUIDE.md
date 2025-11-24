# Quick Implementation Guide

## 🚀 Start Here

Pick ONE feature and implement it completely before moving to the next.

---

## Feature 1: Search & Filter Persistence (1-2 hours)

### What to do:

1. Open `frontend/pages/recruiter/candidates.js`
2. Add this code after imports:

```javascript
useEffect(() => {
  if (router.isReady) {
    const urlFilters = Object.fromEntries(new URLSearchParams(router.query));
    setFilters(urlFilters);
  }
}, [router.isReady, router.query]);

const handleFilterChange = (newFilters) => {
  setFilters(newFilters);
  const query = new URLSearchParams(newFilters).toString();
  router.push(`?${query}`, undefined, { shallow: true });
};
```

3. Replace existing `handleFilterChange` with the new one
4. Test: Apply filters → Refresh page → Filters should persist
5. Repeat for `applications.js` and `admin/candidates.js`

### Test:

```
✓ Apply stage filter
✓ Refresh page
✓ Filter still applied
✓ URL contains filter params
```

---

## Feature 2: Bulk Actions (2-3 hours)

### Backend:

1. Open `backend/server.js`
2. Add this endpoint after other candidate endpoints:

```javascript
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

3. Test with curl:

```bash
curl -X POST http://localhost:3001/api/v1/candidates/bulk-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"ids": [1, 2, 3], "updates": {"current_stage": "interview"}}'
```

### Frontend:

1. Create `frontend/components/BulkActionsBar.jsx` (see LOCAL_APP_IMPROVEMENTS.md)
2. Add to `frontend/pages/recruiter/candidates.js`:

```javascript
const [selectedRows, setSelectedRows] = useState([]);

return (
  <>
    <AdvancedTable data={candidates} onSelectionChange={setSelectedRows} />
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

### Test:

```
✓ Select multiple candidates
✓ See bulk actions bar
✓ Change stage for all
✓ Verify in database
```

---

## Feature 3: Form Validation (1-2 hours)

### Install:

```bash
npm install --prefix frontend zod react-hook-form
```

### Create validation schema:

1. Create `frontend/lib/validation.js`:

```javascript
import { z } from "zod";

export const candidateSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name too long"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional().or(z.literal("")),
  skills: z.array(z.string()).min(1, "At least one skill"),
  experience_years: z.number().min(0).max(70),
});
```

### Use in form:

1. Find the candidate form component
2. Replace with:

```javascript
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
    mode: "onBlur",
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("name")} />
      {errors.name && <p className="text-red-500">{errors.name.message}</p>}

      <input {...register("email")} />
      {errors.email && <p className="text-red-500">{errors.email.message}</p>}

      {/* ... more fields ... */}

      <button type="submit">Save</button>
    </form>
  );
}
```

### Test:

```
✓ Leave name empty → See error
✓ Enter invalid email → See error
✓ Enter valid data → No errors
✓ Submit works
```

---

## Feature 4: Pagination (2-3 hours)

### Backend:

1. Update GET `/api/v1/candidates` in `backend/server.js`:

```javascript
const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.min(100, parseInt(req.query.limit) || 50);
const offset = (page - 1) * limit;

// ... build query ...

// Add LIMIT and OFFSET
query += ` ORDER BY c.created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
params.push(limit, offset);

// Get total count
const countResult = await pool.query(
  `SELECT COUNT(*) as total FROM candidates`,
  []
);

res.json({
  data: result.rows,
  pagination: {
    page,
    limit,
    total: parseInt(countResult.rows[0].total),
    pages: Math.ceil(parseInt(countResult.rows[0].total) / limit),
  },
});
```

### Frontend:

1. Update `frontend/pages/recruiter/candidates.js`:

```javascript
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(50);

const { data } = useQuery(
  ["candidates", page, limit],
  () =>
    fetch(`/api/v1/candidates?page=${page}&limit=${limit}`).then((r) =>
      r.json()
    ),
  { keepPreviousData: true }
);

// Add pagination buttons (see LOCAL_APP_IMPROVEMENTS.md)
```

### Test:

```
✓ Load page → Shows 50 items
✓ Click next → Shows items 51-100
✓ Change limit → Shows different count
✓ Page load time faster
```

---

## Feature 5: Optimistic UI (1-2 hours)

### Create hook:

1. Create `frontend/hooks/useOptimisticUpdate.js` (see LOCAL_APP_IMPROVEMENTS.md)

### Use in component:

```javascript
import { useOptimisticUpdate } from "../hooks/useOptimisticUpdate";

const { updateOptimistic } = useOptimisticUpdate(["candidates"]);

const handleUpdate = async (id, updates) => {
  try {
    await updateOptimistic(id, updates, () =>
      fetch(`/api/v1/candidates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      }).then((r) => r.json())
    );
  } catch (error) {
    console.error("Failed:", error);
  }
};
```

### Test:

```
✓ Change stage → UI updates instantly
✓ Slow network (DevTools throttle) → Still instant
✓ API error → UI reverts
```

---

## 📝 Testing Checklist

After each feature:

- [ ] No console errors
- [ ] Feature works as described
- [ ] Works on slow network (DevTools throttle)
- [ ] Works in dark mode
- [ ] Works on mobile (responsive)
- [ ] No memory leaks (DevTools Performance)

---

## 🐛 Debugging Tips

### Check if feature is working:

```javascript
// Add to component
useEffect(() => {
  console.log("Current filters:", filters);
  console.log("URL query:", router.query);
}, [filters, router.query]);
```

### Check API response:

```javascript
// In browser DevTools Network tab
// Click request → Response tab
// Should see data with pagination info
```

### Check database:

```bash
# Connect to database
psql -U teambuilderz_user -d teambuilderz

# Check candidates table
SELECT id, name, current_stage FROM candidates LIMIT 5;
```

---

## ✅ Completion Checklist

- [ ] Feature 1: Search persistence working
- [ ] Feature 2: Bulk actions working
- [ ] Feature 3: Form validation working
- [ ] Feature 4: Pagination working
- [ ] Feature 5: Optimistic UI working
- [ ] All tested locally
- [ ] No console errors
- [ ] Ready to deploy

---

## 🚀 Next Steps

1. Pick Feature 1
2. Follow the steps
3. Test thoroughly
4. Move to Feature 2
5. Repeat

**Total Time:** 8-12 hours
**Difficulty:** Easy to Medium
**Impact:** High

---

**Questions?** Check LOCAL_APP_IMPROVEMENTS.md for detailed code examples.
