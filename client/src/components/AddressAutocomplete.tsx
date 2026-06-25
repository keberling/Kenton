import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { searchAddresses } from "../lib/api";
import type { AddressSuggestion } from "../types";
import { TechStatusChip } from "./TechMeta";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  disabled = false,
  id: idProp,
}: AddressAutocompleteProps) {
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const listId = `${inputId}-suggestions`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (disabled || value.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      setSearchError(null);
      return;
    }

    const query = value;
    setLoading(true);
    setSearchError(null);

    const timer = window.setTimeout(() => {
      searchAddresses(query)
        .then((result) => {
          if (query !== value) return;
          setSuggestions(result.suggestions);
          setOpen(result.suggestions.length > 0);
          setActiveIndex(-1);
        })
        .catch(() => {
          if (query !== value) return;
          setSuggestions([]);
          setSearchError("Search unavailable — you can still enter the address manually.");
        })
        .finally(() => {
          if (query === value) setLoading(false);
        });
    }, 320);

    return () => window.clearTimeout(timer);
  }, [disabled, value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const pick = (suggestion: AddressSuggestion) => {
    onChange(suggestion.label);
    onSelect?.(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 t-faint"
        />
        <input
          id={inputId}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              pick(suggestions[activeIndex]!);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className="input-field w-full rounded-xl py-3 pl-10 pr-10 text-sm"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="street-address"
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin t-faint"
          />
        )}
      </div>

      {searchError && (
        <p className="mt-1.5 font-mono text-[10px] text-amber-400/80">{searchError}</p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="panel window absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-xl p-1.5 shadow-2xl"
        >
          {suggestions.map((suggestion, index) => (
            <li key={suggestion.id} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(suggestion)}
                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition ${
                  index === activeIndex ? "neu-inset t-accent" : "hover:bg-[color:var(--neu-highlight-soft)]"
                }`}
              >
                <MapPin size={14} className="mt-0.5 shrink-0 t-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm t-fg">{suggestion.label}</span>
                  {suggestion.shortLabel !== suggestion.label && (
                    <span className="mt-0.5 block font-mono text-[10px] t-faint">
                      {suggestion.shortLabel}
                    </span>
                  )}
                </span>
                <TechStatusChip
                  code="SRC"
                  label={suggestion.source === "photon" ? "photon" : "osm"}
                  tone="muted"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loading && value.trim().length >= 3 && open && suggestions.length === 0 && !searchError && (
        <p className="mt-1.5 font-mono text-[10px] t-faint">
          No matches — keep typing or enter the full address manually.
        </p>
      )}
    </div>
  );
}