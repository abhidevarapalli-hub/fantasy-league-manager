import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value
 * 
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns The debounced value
 * 
 * @example
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedSearchQuery = useDebounce(searchQuery, 300);
 * 
 * // Use debouncedSearchQuery in expensive computations
 * const filteredResults = useMemo(() => {
 *   return items.filter(item => item.name.includes(debouncedSearchQuery));
 * }, [items, debouncedSearchQuery]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        // Set up the timeout to update debounced value after delay
        const timeoutId = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        // Clean up the timeout if value changes before delay completes
        return () => {
            clearTimeout(timeoutId);
        };
    }, [value, delay]);

    return debouncedValue;
}
