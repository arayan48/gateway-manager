import { useState, useEffect, useCallback } from 'react'

const MAX_STORAGE_SIZE = 5 * 1024 * 1024 // 5MB limit

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      // Validate key
      if (!key || typeof key !== 'string' || key.length > 50) {
        console.warn('Invalid storage key')
        return initialValue
      }

      const item = window.localStorage.getItem(key)
      if (!item) return initialValue
      
      // Validate JSON size before parsing
      if (item.length > MAX_STORAGE_SIZE) {
        console.warn('Storage item exceeds size limit')
        return initialValue
      }
      
      return JSON.parse(item) as T
    } catch (error) {
      console.warn(`Failed to parse localStorage item for key "${key}"`, error)
      return initialValue
    }
  })

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const next = value instanceof Function ? value(prev) : value
          const serialized = JSON.stringify(next)
          
          // Check size before storing
          if (serialized.length > MAX_STORAGE_SIZE) {
            console.error('Storage item exceeds size limit')
            return prev
          }
          
          window.localStorage.setItem(key, serialized)
          return next
        })
      } catch (error) {
        console.error(`Failed to store value for key "${key}"`, error)
      }
    },
    [key]
  )

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T)
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [key])

  return [storedValue, setValue]
}
