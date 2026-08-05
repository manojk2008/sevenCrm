"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerWithRangeProps {
  date?: DateRange
  setDate: React.Dispatch<React.SetStateAction<DateRange | undefined>>
}

function DatePickerWithRange({ date, setDate }: DatePickerWithRangeProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id="report-date-range"
          variant="outline"
          className={cn(
            "w-[250px] justify-start rounded-xl text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {date?.from ? (
            date.to ? (
              <>{format(date.from, "LLL dd, y")} – {format(date.to, "LLL dd, y")}</>
            ) : (
              format(date.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePickerWithRange }
