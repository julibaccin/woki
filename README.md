# WokiLite — Node + TypeScript + Express (DDD + Clean)

Proyecto mínimo que implementa el CORE del enunciado: DDD + Clean Architecture, repositorio en memoria, idempotencia, mutex por sector+slot y endpoints requeridos.

## Run (local)

1. `npm install`
2. `npm run dev` — servidor en http://localhost:3000
3. Tests: `npm test`
4. To run Front -> npx serve front

Endpoints (base `/api`):
- GET `/availability?restaurantId=R1&sectorId=S1&date=2025-09-08&partySize=4`
- POST `/reservations` header `Idempotency-Key`, body según enunciado
- DELETE `/reservations/:id`
- GET `/reservations/day?restaurantId=R1&date=2025-09-08[&sectorId=S1]`

Seed incluido en `seed.json`.
