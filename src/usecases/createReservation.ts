import { idempotencyStore } from "../utils/idempotencyStore";
import { globalMutex } from "../utils/mutex";
import { assignTable } from "../domain/services/tableAssigner";
import { v4 as uuidv4 } from "uuid";
import { DateTime } from "luxon";
import { IRepository, Reservation } from "../domain/models";

const DURATION_MINUTES = 90;

interface CreateReservationPayload {
  restaurantId: string;
  sectorId: string;
  partySize: number;
  startDateTimeISO: string;
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  notes?: string;
}

export async function createReservationUseCase(
  repo: IRepository,
  payload: CreateReservationPayload,
  idempotencyKey?: string
) {
  if (idempotencyKey) {
    const prior = idempotencyStore.get(idempotencyKey);
    if (prior) return { fromCache: true, reservation: prior };
  }

  const restaurant = await repo.getRestaurant(payload.restaurantId);
  if (!restaurant) throw { status: 404, error: "restaurant_not_found" };

  const startDateTime = DateTime.fromISO(payload.startDateTimeISO, {
    zone: restaurant.timezone,
  });
  if (!startDateTime.isValid) throw { status: 400, error: "invalid_datetime" };

  if (restaurant.shifts && restaurant.shifts.length > 0) {
    const isWithinShift = restaurant.shifts.some((shift) => {
      const [shiftStartHour, shiftStartMinute] = shift.start
        .split(":")
        .map(Number);
      const [shiftEndHour, shiftEndMinute] = shift.end.split(":").map(Number);

      const shiftStart = startDateTime.set({
        hour: shiftStartHour,
        minute: shiftStartMinute,
        second: 0,
        millisecond: 0,
      });
      const shiftEnd = startDateTime.set({
        hour: shiftEndHour,
        minute: shiftEndMinute,
        second: 0,
        millisecond: 0,
      });

      return startDateTime >= shiftStart && startDateTime < shiftEnd;
    });

    if (!isWithinShift) {
      throw {
        status: 422,
        error: "outside_service_window",
        detail: "Requested time is outside defined shifts",
      };
    }
  }

  const end = startDateTime.plus({ minutes: DURATION_MINUTES });
  const startISO = startDateTime.toISO();
  const endISO = end.toISO();

  const lockKey = `${payload.sectorId}|${startISO}`;

  return await globalMutex.runExclusive(lockKey, async () => {
    const table = await assignTable(
      repo,
      payload.sectorId,
      payload.partySize,
      startISO,
      endISO
    );
    if (!table)
      throw {
        status: 409,
        error: "no_capacity",
        detail: "No available table fits party size at requested time",
      };

    const now = new Date().toISOString();
    const reservation: Reservation = {
      id: `RES_${uuidv4()}`,
      restaurantId: payload.restaurantId,
      sectorId: payload.sectorId,
      tableIds: [table.id],
      partySize: payload.partySize,
      startDateTimeISO: startISO,
      endDateTimeISO: endISO,
      status: "CONFIRMED",
      customer: { ...payload.customer, createdAt: now, updatedAt: now },
      notes: payload.notes,
      createdAt: now,
      updatedAt: now,
    };

    await repo.createReservation(reservation);
    if (idempotencyKey) idempotencyStore.set(idempotencyKey, reservation);
    return { fromCache: false, reservation };
  });
}
