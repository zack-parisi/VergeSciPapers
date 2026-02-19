import { useState, useEffect, useMemo } from 'react';

export interface Subfield {
  id: number;
  name: string;
}

export function useSubfieldAutocomplete(prefetchedSubfields?: Subfield[]) {
  const [allSubfields, setAllSubfields] = useState<Subfield[]>(prefetchedSubfields || []);
  const [loading, setLoading] = useState(!prefetchedSubfields);
  const [inputValue, setInputValue] = useState('');
  const [selectedSubfields, setSelectedSubfields] = useState<Subfield[]>([]);

  useEffect(() => {
    if (prefetchedSubfields) {
      setAllSubfields(prefetchedSubfields);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/subfields')
      .then(res => res.json())
      .then((data: Subfield[]) => {
        setAllSubfields(data);
        setLoading(false);
      });
  }, [prefetchedSubfields]);

  // Filter options for autocomplete (case-insensitive, not already selected)
  const filteredOptions = useMemo(() => {
    const lower = inputValue.toLowerCase();
    return allSubfields.filter(
      (s) =>
        s.name.toLowerCase().includes(lower) &&
        !selectedSubfields.some(sel => sel.id === s.id)
    );
  }, [allSubfields, inputValue, selectedSubfields]);

  // Add a subfield to selected
  const addSubfield = (subfield: Subfield) => {
    if (!selectedSubfields.some(s => s.id === subfield.id)) {
      setSelectedSubfields([...selectedSubfields, subfield]);
      setInputValue('');
    }
  };

  // Remove a subfield from selected
  const removeSubfield = (subfieldId: number) => {
    setSelectedSubfields(selectedSubfields.filter(s => s.id !== subfieldId));
  };

  return {
    inputValue,
    setInputValue,
    filteredOptions,
    selectedSubfields,
    addSubfield,
    removeSubfield,
    loading,
    allSubfields,
  };
} 