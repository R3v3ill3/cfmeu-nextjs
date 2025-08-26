import { useEffect, useState } from "react"
import { format, parse, isValid } from "date-fns"
import { Input } from "@/components/ui/input"

export type DateInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string
  onChange: (e: { target: { value: string } }) => void
}

export default function DateInput({ value, onChange, placeholder = "dd/MM/yyyy", ...rest }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState<string>("")

  useEffect(() => {
    if (!value) {
      setDisplayValue("")
      return
    }
    const parsed = parse(value, "yyyy-MM-dd", new Date())
    if (isValid(parsed)) {
      setDisplayValue(format(parsed, "dd/MM/yyyy"))
    } else {
      setDisplayValue("")
    }
  }, [value])

  const tryEmitIso = (nextDisplay: string) => {
    if (!nextDisplay) {
      onChange({ target: { value: "" } })
      return
    }
    const parsed = parse(nextDisplay, "dd/MM/yyyy", new Date())
    if (isValid(parsed)) {
      const iso = format(parsed, "yyyy-MM-dd")
      onChange({ target: { value: iso } })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setDisplayValue(next)
    if (!next) {
      onChange({ target: { value: "" } })
      return
    }
    if (next.length >= 10) {
      tryEmitIso(next)
    }
  }

  const handleBlur = () => {
    tryEmitIso(displayValue)
  }

  return (
    <Input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode="numeric"
      {...rest}
    />
  )
}