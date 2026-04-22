import { useEffect, useRef, useState } from "react";
import { searchAddress } from "../services/geocode";

export default function AddressSearch({
  value,
  onChange,
  placeholder = "Search for a place…",
  dotColor = "#A5513A",
  inputClass = "address-input",
  confirmClass = "address-confirmed",
}) {
  const isConfirmed = typeof value === "object" && value?.lat;
  const [inputValue, setInputValue] = useState(isConfirmed ? value.name : "");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof value === "object" && value?.lat) { setInputValue(value.name || ""); setSuggestions([]); }
    else if (!value) { setInputValue(""); setSuggestions([]); }
  }, [value]);

  useEffect(() => {
    if (!inputValue || inputValue.length < 2) { setSuggestions([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try { setSuggestions((await searchAddress(inputValue)).slice(0, 5)); }
      catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [inputValue]);

  function handleSelect(s) {
    setInputValue(s.shortName);
    setSuggestions([]);
    onChange({ name: s.shortName, lat: s.lat, lng: s.lng });
  }

  function handleClear() { setInputValue(""); setSuggestions([]); onChange(null); }

  if (isConfirmed) {
    return (
      <div className={confirmClass}>
        <span className="address-confirmed-dot" style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotColor}22` }} />
        <span className="address-confirmed-name">{value.name}</span>
        <button type="button" className="address-change-btn" onClick={handleClear}>Change</button>
      </div>
    );
  }

  return (
    <div className="address-search-wrap">
      <input
        className={inputClass}
        type="text"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => { setInputValue(e.target.value); onChange(null); }}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
      />
      {searching && <span className="address-spinner" />}
      {suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((s, i) => (
            <li key={i} style={{ listStyle: "none" }}>
              <button type="button" className="address-suggestion-item" onClick={() => handleSelect(s)}>
                <span className="suggestion-primary">{s.shortName}</span>
                <span className="suggestion-secondary">{s.displayName.split(",").slice(1, 3).join(",")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
