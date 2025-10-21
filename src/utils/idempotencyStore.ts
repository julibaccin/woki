import { Reservation } from "../domain/models";

export class IdempotencyStore {
  private map = new Map<string, Reservation>();

  get(key: string) {
    return this.map.get(key) ?? null;
  }
  set(key: string, res: Reservation) {
    this.map.set(key, res);
  }
}

export const idempotencyStore = new IdempotencyStore();
