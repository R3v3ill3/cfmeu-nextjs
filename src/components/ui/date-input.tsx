"use client"
import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"

type DateInputProps = {
  value?: string | null
  onChange?: (value: string) => void
  id?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * DateInput displays and accepts dates in dd/MM/yyyy while emitting ISO yyyy-MM-dd strings.
 */
export function DateInput({ value, onChange, id, placeholder, className, disabled }: DateInputProps) {
  const [open, setOpen] = React.useState(false)
  const [textValue, setTextValue] = React.useState("")

  React.useEffect(() => {
    if (!value) {
      setTextValue("")
      return
    }
    const dt = new Date(value)
    if (isNaN(dt.getTime())) {
      setTextValue("")
    } else {
      setTextValue(format(dt, "dd/MM/yyyy"))
    }
  }, [value])

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setTextValue(v)
    const parsed = parse(v, "dd/MM/yyyy", new Date())
    if (isValid(parsed) && onChange) {
      const iso = format(parsed, "yyyy-MM-dd")
      onChange(iso)
    }
  }

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined as Date | undefined
    const d = new Date(value)
    return isNaN(d.getTime()) ? undefined : d
  }, [value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          id={id}
          value={textValue}
          onChange={handleTextChange}
          placeholder={placeholder ?? "dd/MM/yyyy"}
          className={className}
          disabled={disabled}
          onFocus={() => setOpen(true)}
        />
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (!date || !onChange) return
            const iso = format(date, "yyyy-MM-dd")
            onChange(iso)
            setTextValue(format(date, "dd/MM/yyyy"))
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

