import { getDay } from "date-fns";

export const FRIDAY_SLOTS = ["21:00", "21:30", "22:00", "22:30", "23:00"];
export const WEEKEND_SLOTS = ["10:30", "13:00", "15:30", "18:00", "20:30"];

export type PersonalBookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export function getBaseSlotsForDate(date: Date | string) {
  const day = typeof date === "string" ? getDay(new Date(`${date}T12:00:00`)) : getDay(date);
  if (day === 5) return [...FRIDAY_SLOTS];
  if (day === 0 || day === 6) return [...WEEKEND_SLOTS];
  return [];
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}
