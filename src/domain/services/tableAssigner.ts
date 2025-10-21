import { IRepository, Table } from "../models";

export async function assignTable(
  repo: IRepository,
  sectorId: string,
  partySize: number,
  startISO: string,
  endISO: string
): Promise<Table | null> {
  const tables = await repo.getTablesBySector(sectorId);
  const candidates = tables.filter(
    (t) => t.minSize <= partySize && partySize <= t.maxSize
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const rangeA = a.maxSize - a.minSize;
    const rangeB = b.maxSize - b.minSize;
    if (rangeA !== rangeB) {
      return rangeA - rangeB;
    }
    return a.minSize - b.minSize;
  });
  const reservations = await repo.getReservationsForSectorBetween(
    sectorId,
    startISO,
    endISO
  );
  for (const table of candidates) {
    const conflict = reservations.some((r) => r.tableIds.includes(table.id));
    if (!conflict) return table;
  }
  return null;
}
