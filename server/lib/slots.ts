/**
 * Booking slot utilities for the KSA availability calendar.
 */

/**
 * Return the bookable hour slots for a given KSA day of week.
 *
 * Rules:
 *   Friday (5): slots start at 17:00 (shortened working hours)
 *   All other days: slots start at 07:00
 *   Last slot is always "00:00" (midnight = next calendar day 00:00 KSA)
 *
 * "00:00" is stored as h=24 in UTC conversion math — see meetings.routes.ts.
 */
export function getSlotsForDay(ksaDayOfWeek: number): string[] {
  const start = ksaDayOfWeek === 5 ? 17 : 7; // 5 = Friday
  const slots: string[] = [];
  for (let h = start; h <= 23; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
  }
  slots.push('00:00'); // midnight slot — treated as h=24 in UTC math
  return slots;
}
