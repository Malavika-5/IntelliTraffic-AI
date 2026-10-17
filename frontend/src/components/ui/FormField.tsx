import type { UseFormRegister, FieldError } from 'react-hook-form'

interface FormFieldProps {
  label: string
  name: string
  register: UseFormRegister<any>
  error?: FieldError
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
  className?: string
  options?: { value: string; label: string }[]
}

export function FormField({
  label, name, register, error, type = 'text', placeholder,
  required, disabled, hint, className, options
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {type === 'select' ? (
        <select
          id={name}
          {...register(name)}
          disabled={disabled}
          className="input-field"
        >
          {options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={name}
          {...register(name)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="input-field resize-none"
        />
      ) : (
        <input
          id={name}
          type={type}
          {...register(name)}
          placeholder={placeholder}
          disabled={disabled}
          className="input-field"
        />
      )}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error.message}</p>}
    </div>
  )
}
