import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Breadcrumb Navigation Component
 * Shows the current page hierarchy
 */
const Breadcrumb = ({ items = null, className = '' }) => {
  const router = useRouter();

  // Auto-generate breadcrumbs from route
  const generateBreadcrumbs = () => {
    if (items) return items;

    const paths = router.asPath.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', href: '/' }];

    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      if (index === paths.length - 1) {
        // Last item - no link
        breadcrumbs.push({ label, href: null });
      } else {
        breadcrumbs.push({ label, href: currentPath });
      }
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumb on home page
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-1 text-sm text-muted-foreground ${className}`}
      aria-label="Breadcrumb"
    >
      {breadcrumbs.map((breadcrumb, index) => (
        <motion.div
          key={index}
          className="flex items-center gap-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.05 }}
        >
          {/* Separator */}
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 mx-1" />
          )}

          {/* Breadcrumb Item */}
          {breadcrumb.href ? (
            <Link href={breadcrumb.href}>
              <motion.a
                className="flex items-center gap-1 hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-muted/50"
                whileHover={{ x: 2 }}
              >
                {index === 0 && <Home className="h-4 w-4" />}
                <span>{breadcrumb.label}</span>
              </motion.a>
            </Link>
          ) : (
            <span className="flex items-center gap-1 py-1 px-2 text-foreground font-medium">
              {index === 0 && <Home className="h-4 w-4" />}
              {breadcrumb.label}
            </span>
          )}
        </motion.div>
      ))}
    </motion.nav>
  );
};

export default Breadcrumb;
