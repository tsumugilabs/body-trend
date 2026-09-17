type Props = {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
};

/** スマートフォンで小数キーボードが出る数値入力 */
export function NumberField({ id, label, unit, value, onChange, error, required, placeholder }: Props) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
        <span className={required ? 'badge-required' : 'badge-optional'}>{required ? '必須' : '任意'}</span>
      </label>
      <div className={`input-unit ${error ? 'has-error' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          maxLength={6}
          value={value}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="unit" aria-hidden>
          {unit}
        </span>
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

type DateProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  min?: string;
  max?: string;
  hint?: string;
};

export function DateField({ id, label, value, onChange, error, min, max, hint }: DateProps) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className={`date-input ${error ? 'has-error' : ''}`}
        type="date"
        value={value}
        min={min}
        max={max}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}

type TextProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  placeholder,
  maxLength,
  hint,
}: TextProps) {
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
        <span className={required ? 'badge-required' : 'badge-optional'}>{required ? '必須' : '任意'}</span>
      </label>
      <input
        id={id}
        className={`text-input ${error ? 'has-error' : ''}`}
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : (
        hint && <p className="field-hint">{hint}</p>
      )}
    </div>
  );
}
