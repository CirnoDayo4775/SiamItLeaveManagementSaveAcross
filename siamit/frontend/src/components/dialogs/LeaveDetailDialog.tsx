import ImagePreviewDialog from '@/components/dialogs/ImagePreviewDialog';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiEndpoints } from '@/constants/api';
import { Calendar, CheckCircle, Clock, FileText, History, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiService, fetchAuthenticatedFile } from '../../lib/api';
import { calcHours, getLeaveTypeDisplay, getTypeColor, isRetroactiveLeave } from '../../lib/leaveUtils';
import { formatDateLocalized } from '../../lib/utils';
import { getRetroactiveBadge, getStatusBadge } from '../leave/LeaveBadges';
import { logger } from '@/lib/logger';

interface LeaveRequest {
  id: string;
  type?: string;
  leaveTypeName?: string;
  user?: { name?: string; department?: string; position?: string; department_name_th?: string; position_name_th?: string };
  startDate: string;
  endDate: string;
  days?: number;
  reason: string;
  status: string;
  createdAt?: string;
  statusBy?: string;
  approvedBy?: string;
  rejectedBy?: string;
  approvedTime?: string;
  startTime?: string;
  endTime?: string;
  personalLeaveType?: string;
  imgLeave?: string;
  contact?: string;
  rejectedReason?: string;
  // Added for new API
  employeeName?: string;
  leaveType?: string;
  submittedDate?: string;
  name?: string;
  leaveDate?: string;
  leaveTypeEn?: string;
  backdated?: boolean;
  durationType?: string;
  durationHours?: number;
  attachments?: string[];
}

interface LeaveDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest: LeaveRequest | null;
}

export const LeaveDetailDialog = ({ open, onOpenChange, leaveRequest }: LeaveDetailDialogProps) => {
  const { t, i18n } = useTranslation();
  const [leaveDetail, setLeaveDetail] = useState<LeaveRequest | null>(leaveRequest);
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; leave_type: string; leave_type_th: string; leave_type_en: string }[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(false);
  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  // State for securely loaded attachment URLs (using Authorization header instead of token in URL)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});

  // Use centralized API service and endpoints (avoid hard-coded URLs)

  useEffect(() => {
    if (open && leaveRequest?.id) {
      setLoading(true);
      apiService.get(apiEndpoints.leave.detail(leaveRequest.id))
        .then((data: any) => {
          if (data.success) {
            if (import.meta.env.DEV) {
              logger.debug('Leave Detail Data:', data.data);
              logger.debug('Days from API:', data.data.days);
              logger.debug('StartDate:', data.data.startDate);
              logger.debug('EndDate:', data.data.endDate);
            }
            setLeaveDetail(data.data);
          } else {
            // Fallback to leaveRequest if API call fails
            setLeaveDetail(leaveRequest);
          }
          setLoading(false);
        })
        .catch(() => {
          // Fallback to leaveRequest if API call fails
          setLeaveDetail(leaveRequest);
          setLoading(false);
        });
    } else if (open && leaveRequest) {
      // If no ID but we have leaveRequest data, use it directly
      setLeaveDetail(leaveRequest);
    } else {
      setLeaveDetail(null);
    }
  }, [open, leaveRequest]);

  useEffect(() => {
    const fetchLeaveTypes = async () => {
      setLeaveTypesLoading(true);
      setLeaveTypesError(null);
      try {
        const data = await apiService.get(apiEndpoints.leaveTypes);
        if (data.success) {
          setLeaveTypes(data.data);
        } else {
          setLeaveTypes([]);
          setLeaveTypesError(data.message || 'Failed to fetch leave types');
        }
      } catch (err: any) {
        setLeaveTypes([]);
        setLeaveTypesError(err.message || 'Failed to fetch leave types');
      } finally {
        setLeaveTypesLoading(false);
      }
    };
    fetchLeaveTypes();
  }, []);

  // Securely load attachment URLs using Authorization header (not exposing token in URL)
  useEffect(() => {
    const loadAttachments = async () => {
      if (!leaveDetail?.attachments || leaveDetail.attachments.length === 0) return;

      const urls: Record<string, string> = {};
      await Promise.all(
        leaveDetail.attachments.map(async (attachment: string) => {
          const filePath = attachment.startsWith('/leave-uploads/') ? attachment : `/leave-uploads/${attachment}`;
          try {
            const secureUrl = await fetchAuthenticatedFile(filePath);
            urls[attachment] = secureUrl;
          } catch (error) {
            if (import.meta.env.DEV) {
              logger.error('Failed to load attachment:', attachment, error);
            }
          }
        })
      );
      setAttachmentUrls(urls);
    };
    loadAttachments();

    // Cleanup blob URLs on unmount
    return () => {
      Object.values(attachmentUrls).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [leaveDetail?.attachments]);

  // Note: getStatusBadge, getRetroactiveBadge, getTypeColor, calcHours functions moved to src/lib/leaveUtils.ts

  // Note: getLeaveTypeLabel and getLeaveTypeDisplay functions moved to src/lib/leaveUtils.ts

  // Note: isRetroactiveLeave function moved to src/lib/leaveUtils.ts

  // ฟังก์ชันคำนวณจำนวนวันที่ถูกต้อง
  const calculateDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 1;

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);

      // ตรวจสอบว่าเป็นวันเดียวกันหรือไม่
      if (start.toDateString() === end.toDateString()) {
        return 1;
      }

      // คำนวณจำนวนวัน
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.error('Error calculating days:', error);
      }
      return 1;
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const response = await fetch(fileUrl, { credentials: 'omit' });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    }
  };

  if (loading) return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('leave.details')}</DialogTitle>
          <DialogDescription>
            {t('leave.detailDescription')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-500">{t('common.loading')}</div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle>
              {t('common.viewDetails')}
            </DialogTitle>
            <DialogDescription>
              {t('leave.detailDescription')}
            </DialogDescription>
          </DialogHeader>

          {leaveDetail ? (
            <div className="space-y-6">
              {/* Header Section */}
              <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`text-3xl font-bold ${getTypeColor(leaveDetail.leaveTypeName || leaveDetail.leaveType || leaveDetail.type)}`}>
                        {getLeaveTypeDisplay(leaveDetail, leaveTypes, i18n, t)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">{t('history.submittedOn')}</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {formatDateLocalized(leaveDetail.createdAt || leaveDetail.submittedDate || '', i18n.language)}
                      </div>
                    </div>
                  </div>
                  {/* Status badges moved here */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {getStatusBadge(leaveDetail.status, t)}
                    {getRetroactiveBadge(leaveDetail, t)}
                  </div>
                </CardContent>
              </Card>

              {/* Main Information Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Date Information */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      <h3 className="text-lg font-semibold">{t('leave.dateInformation')}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-600">{t('leave.startDate')}</Label>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-blue-900">
                            {formatDateLocalized(leaveDetail.startDate || leaveDetail.leaveDate, i18n.language)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-600">{t('leave.endDate')}</Label>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                          <Calendar className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-blue-900">
                            {formatDateLocalized(leaveDetail.endDate || leaveDetail.startDate, i18n.language)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* แสดงผลตามประเภทการลา */}
                    {(() => {
                      // ตรวจสอบว่าเป็นการลาเป็นชั่วโมงหรือวัน
                      const isHourlyLeave = leaveDetail.durationType === 'hour' ||
                        leaveDetail.durationHours ||
                        (leaveDetail.startTime && leaveDetail.endTime);

                      if (isHourlyLeave) {
                        // แสดงแค่ชั่วโมงถ้าลาเป็นชั่วโมง
                        return (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-600">{t('leave.duration')}</Label>
                            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                              <Clock className="w-4 h-4 text-blue-500" />
                              <span className="font-medium text-blue-900">
                                {(() => {
                                  // ถ้ามี durationHours ในฐานข้อมูลให้ใช้ค่านั้น
                                  if (leaveDetail.durationHours) {
                                    return `${leaveDetail.durationHours} ${t('leave.hours')}`;
                                  }
                                  // ถ้ามี startTime และ endTime ให้คำนวณจากนั้น
                                  if (leaveDetail.startTime && leaveDetail.endTime) {
                                    return `${calcHours(leaveDetail.startTime, leaveDetail.endTime)} ${t('leave.hours')}`;
                                  }
                                  // ถ้าเป็น durationType = 'hour' และมี days ให้ใช้ days
                                  if (leaveDetail.durationType === 'hour' && leaveDetail.days) {
                                    return `${leaveDetail.days} ${t('leave.hours')}`;
                                  }
                                  // ค่าเริ่มต้น
                                  return `1 ${t('leave.hours')}`;
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      } else {
                        // แสดงแค่วันถ้าลาเป็นวัน
                        return (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-600">{t('leave.duration')}</Label>
                            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                              <Clock className="w-4 h-4 text-green-500" />
                              <span className="font-medium text-green-900">
                                {(() => {
                                  // ใช้ข้อมูล days จากฐานข้อมูลเป็นหลัก
                                  if (leaveDetail.days !== null && leaveDetail.days !== undefined) {
                                    if (import.meta.env.DEV) {
                                      logger.debug('Using days from database:', leaveDetail.days);
                                    }
                                    return `${leaveDetail.days} ${t('leave.days')}`;
                                  }

                                  // ถ้าไม่มี days ในฐานข้อมูล ให้คำนวณจากวันที่
                                  if (leaveDetail.startDate && leaveDetail.endDate) {
                                    const calculatedDays = calculateDays(leaveDetail.startDate, leaveDetail.endDate);
                                    if (import.meta.env.DEV) {
                                      logger.debug('Calculated days from dates:', calculatedDays);
                                    }
                                    return `${calculatedDays} ${t('leave.days')}`;
                                  }

                                  // ถ้ามีแค่ startDate ให้เป็น 1 วัน
                                  if (leaveDetail.startDate) {
                                    if (import.meta.env.DEV) {
                                      logger.debug('Only startDate available, returning 1 day');
                                    }
                                    return `1 ${t('leave.days')}`;
                                  }

                                  if (import.meta.env.DEV) {
                                    logger.debug('No date information, returning 1 day');
                                  }
                                  return `1 ${t('leave.days')}`;
                                })()}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    })()}
                    {isRetroactiveLeave(leaveDetail) && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-purple-600">{t('history.retroactiveLeave')}</Label>
                        <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                          <History className="w-4 h-4 text-purple-500" />
                          <span className="text-purple-700">{t('history.retroactiveLeaveDesc')}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right Column - Status & Approval */}
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-semibold">{t('leave.statusAndApproval')}</h3>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-600">{t('leave.status')}</Label>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(leaveDetail.status, t)}
                      </div>
                    </div>

                    {leaveDetail.status === "approved" && leaveDetail.approvedBy && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-gray-600">{t('leave.approvedBy')}</Label>
                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-green-900">{leaveDetail.approvedBy}</span>
                        </div>
                      </div>
                    )}

                    {leaveDetail.status === "rejected" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-gray-600">{t('leave.rejectedBy')}</Label>
                          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="font-medium text-red-900">{leaveDetail.rejectedBy || '-'}</span>
                          </div>
                        </div>
                        {leaveDetail.rejectedReason && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-gray-600">{t('leave.rejectionReason')}</Label>
                            <div className="flex items-start gap-2 p-3 bg-red-50 rounded-lg">
                              <FileText className="w-4 h-4 text-red-500 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-red-900 leading-relaxed break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">{leaveDetail.rejectedReason}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Reason Section */}
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    <h3 className="text-lg font-semibold">{t('leave.reason')}</h3>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-orange-50 rounded-lg">
                    <p className="text-orange-900 leading-relaxed break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">
                      {leaveDetail.reason || t('leave.noReasonProvided')}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              {leaveDetail.contact && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-teal-600" />
                      <h3 className="text-lg font-semibold">{t('leave.contactInformation')}</h3>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-teal-50 rounded-lg">
                      <p className="text-teal-900 font-medium break-all overflow-wrap-anywhere whitespace-pre-wrap max-w-full">{leaveDetail.contact}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Attachments Section */}
              {leaveDetail.attachments && leaveDetail.attachments.length > 0 && (
                <Card className="border-0 shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-lg font-semibold">{t('leave.attachments')}</h3>
                      <Badge variant="secondary" className="ml-2">
                        {leaveDetail.attachments.length} {t('leave.files')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {leaveDetail.attachments.map((attachment: string, index: number) => {
                        // Handle both cases: just filename or full path
                        const fileName = attachment.split('/').pop() || attachment;
                        const fileExtension = fileName.split('.').pop()?.toLowerCase();
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');

                        // Use securely loaded URL from state (loaded via Authorization header)
                        const secureUrl = attachmentUrls[attachment];

                        // Show loading state if URL not yet loaded
                        if (!secureUrl) {
                          return (
                            <div key={index} className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center h-32">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            </div>
                          );
                        }

                        return (
                          <div key={index} className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                            {isImage ? (
                              <div className="space-y-3">
                                <img
                                  src={secureUrl}
                                  alt={fileName}
                                  className="w-full h-32 object-cover rounded-lg border cursor-zoom-in"
                                  onClick={() => setPreview({ url: secureUrl, name: fileName })}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm text-gray-600 truncate flex-1">{fileName}</span>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setPreview({ url: secureUrl, name: fileName })}
                                    >
                                      {t('common.view')}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDownload(secureUrl, fileName)}
                                    >
                                      {t('common.download')}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition group">
                                <FileText className="w-8 h-8 text-indigo-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span
                                    className="block text-base font-medium text-gray-800 truncate cursor-pointer hover:underline"
                                    title={fileName}
                                    onClick={() => window.open(secureUrl, '_blank')}
                                  >
                                    {fileName}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="ml-2"
                                  onClick={() => handleDownload(secureUrl, fileName)}
                                >
                                  {t('common.download')}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">{t('leave.noDetailFound')}</div>
          )}
        </DialogContent>
      </Dialog>
      {preview && (
        <ImagePreviewDialog
          isOpen={!!preview}
          onClose={() => setPreview(null)}
          imageUrl={preview.url}
          imageName={preview.name}
          title={t('leave.attachmentPreview')}
        />
      )}
    </>
  );
};

export default LeaveDetailDialog;
