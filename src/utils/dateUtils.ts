/**
 * Safely convert Firestore Timestamp, Date, string, or number to Date.
 * Firestore Timestamps have a .toDate() method; other values are passed to new Date().
 */
export function toDateSafe(val: unknown): Date {
  if (val == null) return new Date();
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return new Date(val as string | number | Date);
}
