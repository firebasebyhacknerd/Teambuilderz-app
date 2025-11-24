# Sidebar Issues & Fixes

## 🔴 Issues Identified

### 1. **Inconsistent Sidebar Links Across Pages**

**Problem:** Different pages have different sidebar link configurations

- `recruiter/candidates.js` has custom links with Admin role check
- `recruiter/index.js` has static links
- `recruiter/candidate/[id].js` has static links
- `admin/index.js` uses `getAdminSidebarLinks()`

**Impact:** Users see different navigation depending on page

### 2. **Sidebar Links Missing Important Items**

**Problem:** Missing key navigation items

- Recruiter sidebar missing "Leaderboard"
- Recruiter sidebar missing "Interviews" (exists in mobile nav but not desktop)
- Admin sidebar has inconsistent link order

### 3. **Sidebar Not Responsive on Small Screens**

**Problem:** Sidebar doesn't adapt properly on tablets (768px-1024px)

- Fixed width `w-72` too wide for tablets
- No medium screen breakpoint

### 4. **Logo Missing or Broken**

**Problem:** `/logo.svg` may not exist or load properly

- Line 191: `<Image src="/logo.svg" alt="TeamBuilderz logo" width={42} height={42} priority />`

### 5. **Sidebar Collapse State Not Working on Mobile**

**Problem:** Collapse button hidden on mobile (line 204: `className="hidden lg:flex"`)

- Mobile users can't collapse/expand sidebar
- Sidebar always takes full width on mobile

### 6. **Active Link Detection Inconsistent**

**Problem:** Line 136: `router.pathname.startsWith(`${href}/")` may match wrong pages

- `/admin/candidates` matches `/admin/candidate/[id]` incorrectly

---

## ✅ Fixes

### Fix 1: Standardize Sidebar Links

**Create:** `frontend/lib/sidebarLinks.js`

```javascript
import {
  Home,
  Users,
  UserCheck,
  TrendingUp,
  BarChart3,
  FileText,
  AlertTriangle,
  CircleUser,
  CalendarCheck,
  Briefcase,
} from "lucide-react";

export const getSidebarLinks = (userRole, currentPath) => {
  if (userRole === "Admin") {
    return [
      { href: "/admin", label: "Dashboard", icon: Home },
      { href: "/admin/candidates", label: "Candidates", icon: Users },
      { href: "/admin/recruiters", label: "Team Management", icon: UserCheck },
      { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
      { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
      {
        href: "/admin/application-activity",
        label: "Application Activity",
        icon: BarChart3,
      },
      { href: "/admin/reports", label: "Reports", icon: FileText },
      { href: "/alerts", label: "Alerts", icon: AlertTriangle },
      { href: "/profile", label: "My Profile", icon: CircleUser },
    ];
  }

  // Recruiter links
  return [
    { href: "/recruiter", label: "Dashboard", icon: Home },
    { href: "/recruiter/candidates", label: "Candidates", icon: Users },
    {
      href: "/recruiter/candidates-kanban",
      label: "Kanban Board",
      icon: Briefcase,
    },
    { href: "/recruiter/applications", label: "Applications", icon: FileText },
    { href: "/leaderboard", label: "Leaderboard", icon: TrendingUp },
    { href: "/alerts", label: "Alerts", icon: AlertTriangle },
    { href: "/profile", label: "My Profile", icon: CircleUser },
  ];
};
```

### Fix 2: Update All Pages to Use Standard Links

**Replace sidebarLinks in all pages:**

```javascript
// recruiter/candidates.js
import { getSidebarLinks } from "../../lib/sidebarLinks";

const sidebarLinks = useMemo(() => getSidebarLinks(userRole), [userRole]);

// recruiter/index.js
import { getSidebarLinks } from "../../lib/sidebarLinks";

const sidebarLinks = getSidebarLinks(userRole);

// recruiter/candidate/[id].js
import { getSidebarLinks } from "../../lib/sidebarLinks";

// admin/index.js
import { getSidebarLinks } from "../../lib/sidebarLinks";

const sidebarLinks = getSidebarLinks("Admin");
```

### Fix 3: Improve Sidebar Responsiveness

**File:** `frontend/components/Layout/DashboardLayout.js`

**Change line 65:**

```javascript
// BEFORE
const sidebarWidth = sidebarCollapsed ? "w-20" : "w-72";
const mainOffset = sidebarCollapsed ? "lg:ml-20" : "lg:ml-72";

// TO
const sidebarWidth = sidebarCollapsed ? "w-16 md:w-20" : "w-64 md:w-72";
const mainOffset = sidebarCollapsed ? "lg:ml-16 xl:ml-20" : "lg:ml-64 xl:ml-72";
```

**Change line 183:**

```javascript
// BEFORE
className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-card border-r border-border shadow-lg transform transition-all duration-200 ease-in-out lg:translate-x-0 ${
  sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
}`}

// TO
className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-card border-r border-border shadow-lg transform transition-all duration-200 ease-in-out md:translate-x-0 ${
  sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
}`}
```

### Fix 4: Fix Active Link Detection

**Change line 136:**

```javascript
// BEFORE
const isActive =
  router.pathname === href || router.pathname.startsWith(`${href}/`);

// TO
const isActive =
  router.pathname === href ||
  (href !== "/" && router.pathname.startsWith(`${href}/`)) ||
  (href === "/" && router.pathname === "/");
```

### Fix 5: Add Fallback Logo

**Change line 191:**

```javascript
// BEFORE
<Image src="/logo.svg" alt="TeamBuilderz logo" width={42} height={42} priority />

// TO
<div className="relative h-12 w-12 rounded-xl bg-secondary/60 flex items-center justify-center ring-2 ring-primary/20">
  {typeof window !== 'undefined' && window.location.origin ? (
    <Image
      src="/logo.svg"
      alt="TeamBuilderz logo"
      width={42}
      height={42}
      priority
      onError={(e) => {
        e.target.style.display = 'none';
        e.target.nextSibling.style.display = 'flex';
      }}
    />
  ) : null}
  <div className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
    <span className="text-lg font-bold text-primary">TB</span>
  </div>
</div>
```

### Fix 6: Show Collapse Button on Tablets

**Change line 204:**

```javascript
// BEFORE
className = "hidden lg:flex";

// TO
className = "hidden md:flex";
```

### Fix 7: Add Mobile Collapse Option

**Add after line 213:**

```javascript
{
  sidebarOpen && (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden absolute top-5 right-5"
      onClick={() => setSidebarCollapsed((prev) => !prev)}
      aria-label={
        sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
      }
    >
      {sidebarCollapsed ? (
        <ChevronRight size={18} />
      ) : (
        <ChevronLeft size={18} />
      )}
    </Button>
  );
}
```

---

## 📋 Implementation Steps

1. **Create standardized sidebar links** (5 min)

   - Create `frontend/lib/sidebarLinks.js`
   - Copy the code from Fix 1

2. **Update all pages** (10 min)

   - Replace sidebarLinks in 6+ pages
   - Use the new standardized function

3. **Fix responsiveness** (5 min)

   - Update DashboardLayout.js lines 65, 183
   - Add tablet breakpoints

4. **Fix active detection** (2 min)

   - Update line 136 in DashboardLayout.js

5. **Fix logo fallback** (3 min)

   - Update line 191 in DashboardLayout.js

6. **Show collapse on tablets** (2 min)

   - Update line 204 in DashboardLayout.js

7. **Add mobile collapse** (3 min)
   - Add mobile collapse button

---

## 🧪 Testing Checklist

After applying fixes:

- [ ] All pages show same sidebar links for same role
- [ ] Recruiter sees "Kanban Board" and "Leaderboard"
- [ ] Admin sees all admin links in correct order
- [ ] Tablet (768px): Sidebar fits properly
- [ ] Mobile: Can collapse/expand sidebar
- [ ] Active link highlighting works correctly
- [ ] Logo shows or fallback appears
- [ ] Dark mode: Sidebar looks good
- [ ] Light mode: Sidebar looks good

---

## 📊 Expected Results

**Before:**

- Inconsistent navigation across pages
- Missing important links
- Poor tablet responsiveness
- Logo may be broken
- Active link detection buggy

**After:**

- Consistent navigation everywhere
- Complete link set for both roles
- Responsive on all screen sizes
- Logo with fallback
- Proper active highlighting

---

**Status:** Ready to implement
**Time:** 30-40 minutes
**Difficulty:** Easy to Medium
