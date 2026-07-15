export type ScheduleShape = {
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  slotTimes: string;
  maxBookings: number;
  maxGuests: number;
  enabled: number | boolean;
};

export function weekdayFromDate(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return false;
  return true;
}

export function addMinutes(time: string, minutes: number) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function slotsFromSchedule(schedule: ScheduleShape) {
  if (!schedule.enabled) return [];

  try {
    const explicit = JSON.parse(schedule.slotTimes) as unknown;
    if (Array.isArray(explicit)) {
      const slots = explicit.filter((slot): slot is string => typeof slot === "string" && isTime(slot));
      if (slots.length) return [...new Set(slots)].sort();
    }
  } catch {
    // Fall through to interval generation.
  }

  if (!isTime(schedule.startTime) || !isTime(schedule.endTime)) return [];
  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (end <= start || schedule.intervalMinutes < 5) return [];

  const slots: string[] = [];
  for (let cursor = start; cursor < end; cursor += schedule.intervalMinutes) {
    slots.push(`${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`);
  }
  return slots;
}

export function isWithinBookingWindow(date: string, advanceDays: number, cutoffHours: number) {
  const now = new Date();
  const target = new Date(`${date}T23:59:59+08:00`);
  const earliest = new Date(now.getTime() + cutoffHours * 60 * 60 * 1000);
  const latest = new Date(now.getTime() + advanceDays * 24 * 60 * 60 * 1000);
  return target >= earliest && target <= latest;
}

export function isSlotWithinBookingWindow(
  date: string,
  time: string,
  advanceDays: number,
  cutoffHours: number,
) {
  if (!isIsoDate(date) || !isTime(time)) return false;
  const now = new Date();
  const target = new Date(`${date}T${time}:00+08:00`);
  const earliest = new Date(now.getTime() + cutoffHours * 60 * 60 * 1000);
  const latest = new Date(now.getTime() + advanceDays * 24 * 60 * 60 * 1000);
  return target >= earliest && target <= latest;
}
