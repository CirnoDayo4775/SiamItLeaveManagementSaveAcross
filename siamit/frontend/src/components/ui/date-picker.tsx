import { format } from "date-fns"
import { enUS, th } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface DatePickerProps {
  date?: string
  onDateChange: (date: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({ 
  date, 
  onDateChange, 
  placeholder = "เลือกวันที่",
  disabled = false,
  className 
}: DatePickerProps) {
  const { t, i18n } = useTranslation()
  const currentLocale = i18n.language === 'th' ? th : enUS
  const [open, setOpen] = React.useState(false)
  
  // Convert string date to Date object for calendar
  const selectedDate = date ? new Date(date) : undefined
  
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Format date as YYYY-MM-DD for input compatibility
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      onDateChange(formattedDate)
      setOpen(false)
    }
  }

  return (
    <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            i18n.language === 'th' 
              ? format(selectedDate!, "dd/MM/yyyy", { locale: currentLocale }).replace(/\/(\d{4})$/, (_, y) => `/${String(Number(y) + 543)}`)
              : format(selectedDate!, "dd/MM/yyyy", { locale: currentLocale })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={disabled ? undefined : handleDateSelect}
          initialFocus
          locale={currentLocale}
          captionLayout="dropdown"
          fromYear={new Date().getFullYear() - 100}
          toYear={new Date().getFullYear() + 10}
          defaultMonth={selectedDate || new Date()}
        />
      </PopoverContent>
    </Popover>
  )
}
