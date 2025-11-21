
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { th, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface DateRangePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  disabled?: boolean;
  minDate?: Date;
  submitted?: boolean;
}

export const DateRangePicker = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  disabled = false,
  minDate,
  submitted = false,
}: DateRangePickerProps) => {
  const { t, i18n } = useTranslation();
  // ไม่จำกัดวันที่ - สามารถเลือกได้ทั้งย้อนหลังและล่วงหน้า
  const minDateToUse = minDate; // ใช้ minDate ที่ส่งมาเท่านั้น
  // Dynamic locale
  const currentLocale = i18n.language === 'th' ? th : enUS;
  
  // วันที่ปัจจุบันสำหรับแสดงในปฏิทิน
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('leave.startDate')}{submitted && !startDate && <span className="text-red-500">*</span>}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? (
                format(startDate, "dd MMMM yyyy", { locale: currentLocale })
              ) : (
                <span>{t('leave.selectDate')}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={onStartDateChange}
              initialFocus
              disabled={minDateToUse ? (date => date < minDateToUse) : undefined}
              className="rounded-md border"
              locale={currentLocale}
              modifiers={{
                today: today
              }}
              modifiersStyles={{
                today: { backgroundColor: '#e5e7eb', color: '#374151' }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">{t('leave.endDate')}{submitted && !endDate && <span className="text-red-500">*</span>}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start text-left font-normal"
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? (
                format(endDate, "dd MMMM yyyy", { locale: currentLocale })
              ) : (
                <span>{t('leave.selectDate')}</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={onEndDateChange}
              initialFocus
              // ปรับ logic: endDate เลือกได้ไม่น้อยกว่า startDate
              disabled={startDate ? (date => date < startDate) : undefined}
              className="rounded-md border"
              locale={currentLocale}
              modifiers={{
                today: today
              }}
              modifiersStyles={{
                today: { backgroundColor: '#e5e7eb', color: '#374151' }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
