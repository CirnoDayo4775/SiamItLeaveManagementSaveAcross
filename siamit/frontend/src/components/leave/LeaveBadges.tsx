import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, XCircle, History } from "lucide-react";
import { TFunction } from "i18next";

/**
 * Get status badge component for leave requests
 * @param status - Leave request status
 * @param t - Translation function
 * @returns JSX Badge component
 */
export const getStatusBadge = (status: string, t: TFunction) => {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          {t('leave.approved')}
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          {t('history.pendingApproval')}
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <XCircle className="w-3 h-3 mr-1" />
          {t('leave.rejected')}
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-800 border-gray-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          {status}
        </Badge>
      );
  }
};

/**
 * Get retroactive badge component for leave requests
 * @param leave - Leave request object
 * @param t - Translation function
 * @returns JSX Badge component or null
 */
export const getRetroactiveBadge = (leave: any, t: TFunction) => {
  if (leave.backdated === true || leave.backdated === 1 || leave.backdated === "1") {
    return (
      <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 border-purple-200 shadow-sm hover:shadow-md transition-all duration-200">
        <History className="w-3 h-3 mr-1" />
        {t('history.retroactiveLeave')}
      </Badge>
    );
  }
  return null;
};
