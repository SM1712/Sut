interface Props {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ colors, value, onChange }: Props) {
  return (
    <div className="color-picker">
      {colors.map(c => (
        <button
          key={c}
          type="button"
          className={`color-swatch${c === value ? ' is-selected' : ''}`}
          style={{ '--c': c } as React.CSSProperties}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          title={c}
        />
      ))}
    </div>
  );
}
