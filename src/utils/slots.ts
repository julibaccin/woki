import { DateTime } from "luxon";
import { Shift } from "../domain/models";

export function generateSlotsForDay(
  slotMinutes: number,
  day: DateTime,
  shifts?: Shift[]
): DateTime[] {
  const slots: DateTime[] = [];

  const addSlots = (start: DateTime, end: DateTime) => {
    let current = start;
    while (current < end) {
      slots.push(current);
      current = current.plus({ minutes: slotMinutes });
    }
  };

  if (shifts?.length) {
    for (const shift of shifts) {
      const [startHour, startMinute] = shift.start.split(":").map(Number);
      const [endHour, endMinute] = shift.end.split(":").map(Number);

      const shiftStart = day.set({
        hour: startHour,
        minute: startMinute,
        second: 0,
        millisecond: 0,
      });
      const shiftEnd = day.set({
        hour: endHour,
        minute: endMinute,
        second: 0,
        millisecond: 0,
      });

      addSlots(shiftStart, shiftEnd);
    }
  } else {
    addSlots(day.startOf("day"), day.endOf("day"));
  }

  return slots;
}
