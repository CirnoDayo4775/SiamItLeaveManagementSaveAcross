
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";

interface ApprovalConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (rejectionReason?: string) => void;
  action: 'approve' | 'reject';
  employeeName: string;
}

export const ApprovalConfirmDialog = ({ open, onOpenChange, onConfirm, action, employeeName }: ApprovalConfirmDialogProps) => {
  const [rejectionReason, setRejectionReason] = useState("");
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm(action === 'reject' ? rejectionReason : undefined);
    setRejectionReason("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setRejectionReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {action === 'approve'
              ? t('admin.approveConfirmTitle', 'Confirm Approval')
              : t('admin.rejectConfirmTitle', 'Confirm Rejection')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === 'approve'
              ? t('admin.approveConfirmDesc', { name: employeeName })
              : t('admin.rejectConfirmDesc', { name: employeeName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {action === 'reject' && (
          <div className="space-y-2">
            <Label htmlFor="rejection-reason">{t('admin.rejectReasonTitle')}</Label>
            <Textarea
              id="rejection-reason"
              placeholder={t('admin.rejectReasonPlaceholder')}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="break-all overflow-wrap-anywhere whitespace-pre-wrap"
              required
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={action === 'reject' && !rejectionReason.trim()}
            className={action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          >
            {action === 'approve'
              ? t('admin.approve', 'Approve')
              : t('admin.reject', 'Reject')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
