import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SessionExpiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SessionExpiredDialog({ open, onOpenChange }: SessionExpiredDialogProps) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to root (login page for unauthenticated users)
      navigate('/', { replace: true });
      onOpenChange(false);
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error('Logout error:', error);
      }
      // Force redirect even if logout fails
      navigate('/', { replace: true });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-red-600">
                {t('auth.sessionExpired')}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-1">
                {t('auth.sessionExpiredDesc')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-700">
            {t('auth.pleaseLoginAgain')}
          </p>
        </div>

        <DialogFooter>
          <Button
            onClick={handleLogout}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
          >
            {t('auth.loginAgain')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 
