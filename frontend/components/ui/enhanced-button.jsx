import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './button';

export const EnhancedButton = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Button className={`transition-all duration-200 ${className}`} {...props}>
        {children}
      </Button>
    </motion.div>
  );
};

export const AnimatedCard = ({ children, className = '', delay = 0, ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`transition-all duration-300 hover:shadow-lg ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const HoverCard = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      whileHover={{ 
        scale: 1.02, 
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)"
      }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};



