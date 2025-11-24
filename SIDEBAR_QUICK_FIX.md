# Sidebar Quick Fix (30 minutes)

## 🎯 What's Wrong

1. **Different sidebar links on different pages** - Confusing navigation
2. **Missing important links** - No "Leaderboard", "Kanban Board" for recruiters
3. **Sidebar too wide on tablets** - Takes too much space
4. **Logo may be broken** - Shows empty space
5. **Active link highlighting wrong** - Wrong page highlighted

---

## ⚡ Quick Fixes

### Step 1: Create Standard Sidebar Links (5 min)

**Create new file:** `frontend/lib/sidebarLinks.js`

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

export const getSidebarLinks = (userRole) => {
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

---

### Step 2: Update All Pages (10 min)

**File:** `frontend/pages/recruiter/candidates.js`

**Find lines 111-129:**

```javascript
const sidebarLinks = useMemo(() => {
  if (userRole === "Admin") {
    return [
      { href: "/admin", label: "Dashboard", icon: Home },
      // ... all the links
    ];
  }
  return [
    // ... more links
  ];
}, [userRole]);
```

**Replace with:**

```javascript
import { getSidebarLinks } from "../../lib/sidebarLinks";

const sidebarLinks = useMemo(() => getSidebarLinks(userRole), [userRole]);
```

**Do the same for:**

- `frontend/pages/recruiter/index.js` (line 536)
- `frontend/pages/recruiter/applications.js` (line 249)
- `frontend/pages/recruiter/candidate/[id].js` (line 47)
- `frontend/pages/admin/index.js` (line 655)

---

### Step 3: Fix Tablet Responsiveness (5 min)

**File:** `frontend/components/Layout/DashboardLayout.js`

**Find line 65:**

```javascript
const sidebarWidth = sidebarCollapsed ? "w-20" : "w-72";
const mainOffset = sidebarCollapsed ? "lg:ml-20" : "lg:ml-72";
```

**Replace with:**

```javascript
const sidebarWidth = sidebarCollapsed ? "w-16 md:w-20" : "w-64 md:w-72";
const mainOffset = sidebarCollapsed ? "lg:ml-16 xl:ml-20" : "lg:ml-64 xl:ml-72";
```

---

### Step 4: Fix Active Link Detection (2 min)

**Find line 136:**

```javascript
const isActive =
  router.pathname === href || router.pathname.startsWith(`${href}/`);
```

**Replace with:**

```javascript
const isActive =
  router.pathname === href ||
  (href !== "/" && router.pathname.startsWith(`${href}/`));
```

---

### Step 5: Fix Logo Fallback (3 min)

**Find line 191:**

```javascript
<Image
  src="/logo.svg"
  alt="TeamBuilderz logo"
  width={42}
  height={42}
  priority
/>
```

**Replace with:**

```javascript
<div className="relative h-12 w-12 rounded-xl bg-secondary/60 flex items-center justify-center ring-2 ring-primary/20">
  <Image
    src="/logo.svg"
    alt="TeamBuilderz logo"
    width={42}
    height={42}
    priority
    onError={(e) => {
      e.target.style.display = "none";
      e.target.nextSibling.style.display = "flex";
    }}
  />
  <div
    className="absolute inset-0 flex items-center justify-center"
    style={{ display: "none" }}
  >
    <span className="text-lg font-bold text-primary">TB</span>
  </div>
</div>
```

---

### Step 6: Show Collapse on Tablets (2 min)

**Find line 204:**

```javascript
className = "hidden lg:flex";
```

**Replace with:**

```javascript
className = "hidden md:flex";
```

---

### Step 7: Fix Mobile Sidebar (3 min)

**Find line 183:**

```javascript
className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-card border-r border-border shadow-lg transform transition-all duration-200 ease-in-out lg:translate-x-0 ${
  sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
}`}
```

**Replace with:**

```javascript
className={`fixed inset-y-0 left-0 z-30 ${sidebarWidth} bg-card border-r border-border shadow-lg transform transition-all duration-200 ease-in-out md:translate-x-0 ${
  sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
}`}
```

---

## ✅ Testing

After fixes:

```
✓ All recruiter pages show same sidebar
✓ Admin pages show complete admin sidebar
✓ Tablet (768px): Sidebar fits properly
✓ Mobile: Sidebar works correctly
✓ Active link highlights correctly
✓ Logo shows or "TB" fallback appears
✓ Dark mode: Looks good
✓ Light mode: Looks good
```

---

## 📊 Before vs After

**Before:**

- 6 different sidebar configurations
- Missing "Kanban Board", "Leaderboard" for recruiters
- Sidebar too wide on tablets
- Logo may be broken

**After:**

- 1 standard sidebar for each role
- Complete navigation for both roles
- Responsive on all screen sizes
- Logo with "TB" fallback

---

**Total Time:** 30 minutes
**Difficulty:** Easy
**Impact:** High (consistent navigation everywhere)

---

## 🚀 Quick Test

1. Open recruiter dashboard
2. Check all 7 links are there
3. Open admin dashboard
4. Check all 9 links are there
5. Resize browser to tablet size
6. Sidebar should fit properly
7. Click each link - correct page should highlight
