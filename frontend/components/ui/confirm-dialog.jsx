import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

const ConfirmDialog = ({
  open,
  onOpenChange,
  title = 'Confirm Action',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // default, destructive
  onConfirm,
  onCancel,
  loading = false,
  icon = AlertTriangle,
  children,
}) => {
  const Icon = icon;

  const handleConfirm = () => {
    if (onConfirm && !loading) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel && !loading) {
      onCancel();
    }
    onOpenChange(false);
  };

  const variantStyles = {
    default: {
      confirm: 'bg-primary text-primary-foreground hover:bg-primary/90',
      icon: 'text-primary',
    },
    destructive: {
      confirm: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      icon: 'text-destructive',
    },
  };

  const styles = variantStyles[variant];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-full bg-muted ${styles.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
            )}
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </div>
        </DialogHeader>
        
        {description && (
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        )}

        {children && (
          <div className="py-4">
            {children}
          </div>
        )}

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className={`w-full sm:w-auto ${styles.confirm}`}
          >
            {loading ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export { ConfirmDialog };
