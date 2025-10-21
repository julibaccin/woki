import { Restaurant, Sector, Table, Reservation, IRepository } from "../domain/models";
import seed from "../../seed.json";
import { DateTime } from "luxon";

export class InMemoryRepository implements IRepository {
  restaurants: Map<string, Restaurant> = new Map();
  sectors: Map<string, Sector> = new Map();
  tables: Map<string, Table> = new Map();
  reservations: Map<string, Reservation> = new Map();

  constructor() {
    const r = seed.restaurant as Restaurant;
    this.restaurants.set(r.id, r);
    for (const s of seed.sectors as Sector[]) this.sectors.set(s.id, s);
    for (const t of seed.tables as Table[]) this.tables.set(t.id, t);
  }

  async getRestaurant(id: string) {
    return this.restaurants.get(id) ?? null;
  }

  async getSector(id: string) {
    return this.sectors.get(id) ?? null;
  }

  async getTablesBySector(sectorId: string) {
    return Array.from(this.tables.values()).filter(
      (t) => t.sectorId === sectorId
    );
  }

  async listReservationsForDay(
    restaurantId: string,
    dateISO: string,
    sectorId?: string
  ) {
    const items = Array.from(this.reservations.values()).filter(
      (r) =>
        r.restaurantId === restaurantId &&
        r.startDateTimeISO.startsWith(dateISO)
    );
    return sectorId ? items.filter((i) => i.sectorId === sectorId) : items;
  }

  async createReservation(res: Reservation) {
    this.reservations.set(res.id, res);
    return res;
  }

  async getReservationsForSectorBetween(
    sectorId: string,
    startISO: string,
    endISO: string
  ) {
    return Array.from(this.reservations.values()).filter(
      (r) =>
        r.sectorId === sectorId &&
        r.status === "CONFIRMED" &&
        !(r.endDateTimeISO <= startISO || r.startDateTimeISO >= endISO)
    );
  }

  async getReservationById(id: string) {
    return this.reservations.get(id) ?? null;
  }

  async cancelReservation(id: string) {
    const r = this.reservations.get(id);
    if (!r) return false;
    r.status = "CANCELLED";
    r.updatedAt = new Date().toISOString();
    this.reservations.set(id, r);
    return true;
  }

  async clear() {
    this.reservations.clear();
  } 

  async getReservationsBySectorAndDate(sectorId: string, date: string) {
    const dayStart = DateTime.fromISO(date).startOf("day");
    const dayEnd = DateTime.fromISO(date).endOf("day");

    return Array.from(this.reservations.values())
      .filter(
        (r) =>
          r.sectorId === sectorId &&
          DateTime.fromISO(r.startDateTimeISO) < dayEnd &&
          DateTime.fromISO(r.endDateTimeISO) > dayStart
      );
  }
}

export const defaultRepo = new InMemoryRepository();
