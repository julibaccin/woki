// domain/usecases/getAvailabilityUseCase.ts
import { DateTime } from "luxon";
import { IRepository } from "../domain/models";
import { generateSlotsForDay } from "../utils/slots";

const SLOT_MINUTES = 15;
const DURATION_MINUTES = 90;

export interface AvailabilityRequest {
  restaurantId: string;
  sectorId: string;
  date: string;
  partySize: number;
}

export interface AvailabilitySlot {
  start: string;
  available: boolean;
  tables?: string[];
  reason?: string;
}

export interface AvailabilityResponse {
  slotMinutes: number;
  durationMinutes: number;
  slots: AvailabilitySlot[];
}

export async function getAvailabilityUseCase(
  repo: IRepository,
  request: AvailabilityRequest
): Promise<AvailabilityResponse> {
  const { restaurantId, sectorId, date, partySize } = request;

  if (!restaurantId || !sectorId || !date || !partySize) {
    throw { status: 400, error: "missing_params" };
  }

  const restaurant = await repo.getRestaurant(restaurantId);
  if (!restaurant) throw { status: 404, error: "restaurant_not_found" };

  const day = DateTime.fromISO(date, { zone: restaurant.timezone });
  if (!day.isValid) throw { status: 400, error: "invalid_date" };

  const slotStartTimes = generateSlotsForDay(
    SLOT_MINUTES,
    day,
    restaurant.shifts
  );

  const tables = await repo.getTablesBySector(sectorId);
  const reservations = await repo.getReservationsBySectorAndDate(
    sectorId,
    date
  );

  const slots: AvailabilitySlot[] = slotStartTimes.map((slotStart) => {
    const startISO = slotStart.toISO();
    const endISO = slotStart.plus({ minutes: DURATION_MINUTES }).toISO();

    try {
      const fittingTables = tables.filter(
        (t) => t.minSize <= partySize && t.maxSize >= partySize
      );

      const availableTables = fittingTables.filter(
        (t) =>
          !reservations.some(
            (r) =>
              r.tableIds.includes(t.id) &&
              r.status === "CONFIRMED" &&
              DateTime.fromISO(r.startDateTimeISO) <
                DateTime.fromISO(endISO!) &&
              DateTime.fromISO(r.endDateTimeISO) > DateTime.fromISO(startISO!)
          )
      );

      if (availableTables.length === 0) {
        return { start: startISO, available: false, reason: "no_capacity" };
      }

      return {
        start: startISO,
        available: true,
        tables: availableTables.map((t) => t.id),
      };
    } catch (error) {
      return { start: startISO, available: false, reason: "error" };
    }
  });

  return {
    slotMinutes: SLOT_MINUTES,
    durationMinutes: DURATION_MINUTES,
    slots,
  };
}
