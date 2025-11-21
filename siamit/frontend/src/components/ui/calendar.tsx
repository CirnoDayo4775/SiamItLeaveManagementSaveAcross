import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { CaptionProps, DayPicker, useDayPicker, useNavigation } from "react-day-picker";
import { useTranslation } from "react-i18next";

import { buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const { t, i18n } = useTranslation();
  
  function DropdownCaption({ displayMonth }: CaptionProps) {
    const dayPicker = useDayPicker();
    const { goToMonth } = useNavigation();
    const currentYear = displayMonth.getFullYear();
    const currentMonth = displayMonth.getMonth();
    const fromYear = dayPicker.fromYear ?? currentYear - 100;
    const toYear = dayPicker.toYear ?? currentYear;
    const years: number[] = [];
    for (let y = toYear; y >= fromYear; y--) years.push(y);
    const months = Array.from({ length: 12 }, (_, m) => {
      const d = new Date(2020, m, 1);
      return d.toLocaleString(dayPicker.locale?.code ?? undefined, { month: "long" });
    });

    const handleYearChange = (value: string) => {
      const newDate = new Date(Number(value), currentMonth, 1);
      goToMonth(newDate);
    };
    const handleMonthChange = (value: string) => {
      const newDate = new Date(currentYear, Number(value), 1);
      goToMonth(newDate);
    };

    return (
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select onValueChange={handleMonthChange} value={String(currentMonth)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-44 overflow-auto">
              {months.map((label, idx) => (
                <SelectItem key={idx} value={String(idx)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select onValueChange={handleYearChange} value={String(currentYear)}>
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-44 overflow-auto">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {i18n.language.startsWith('th') ? y + 543 : y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }
  
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex items-center justify-between pt-1",
        caption_label: "sr-only",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => (
          <ChevronLeft 
            className="h-4 w-4" 
            aria-label={t('calendar.previousMonth')}
          />
        ),
        IconRight: ({ ..._props }) => (
          <ChevronRight 
            className="h-4 w-4" 
            aria-label={t('calendar.nextMonth')}
          />
        ),
        Caption: DropdownCaption,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };

