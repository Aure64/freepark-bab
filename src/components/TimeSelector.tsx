import { useRef } from 'react';
import './TimeSelector.css';

interface TimeSelectorProps {
  /** null = « maintenant » */
  when: Date | null;
  onChange: (when: Date | null) => void;
}

const formatWhen = (d: Date): string => {
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const h = `${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`;
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return `Aujourd’hui ${h}`;
  return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} ${h}`;
};

/** Valeur pour <input type="datetime-local"> en heure locale. */
const toLocalInputValue = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function TimeSelector({ when, onChange }: TimeSelectorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const input = inputRef.current;
    if (!input) return;
    input.showPicker?.();
    input.focus();
  };

  return (
    <div className="time" role="group" aria-label="Moment du stationnement">
      <button
        className={`time__chip${when === null ? ' time__chip--active' : ''}`}
        onClick={() => onChange(null)}
      >
        Maintenant
      </button>
      <button
        className={`time__chip${when !== null ? ' time__chip--active' : ''}`}
        onClick={openPicker}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.8V8l2.2 1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {when ? formatWhen(when) : 'Choisir un moment'}
      </button>
      <input
        ref={inputRef}
        className="time__input"
        type="datetime-local"
        aria-label="Date et heure"
        value={toLocalInputValue(when ?? new Date())}
        onChange={(e) => {
          if (e.target.value) onChange(new Date(e.target.value));
        }}
      />
    </div>
  );
}
