const API_BASE = "http://localhost:3000/api";

// --- Helpers ---
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Load calendar ---
async function loadCalendar() {
  const date = document.getElementById("date").value;
  const sectorId = document.getElementById("sector").value;
  const partySize = Number(document.getElementById("partySize").value);

  if (!date) return alert("Select a date");

  // Fetch availability
  const res = await fetch(`${API_BASE}/availability?restaurantId=R1&sectorId=${sectorId}&date=${date}&partySize=${partySize}`);
  const availability = await res.json();

  // Fetch existing reservations
  const res2 = await fetch(`${API_BASE}/reservations/day?restaurantId=R1&date=${date}`);
  const reservationsData = await res2.json();
  const reservedSlots = {};
  reservationsData.items
  .filter(r => r.status === "CONFIRMED") // solo confirmadas
  .forEach(r => reservedSlots[r.startDateTimeISO] = r);

  const container = document.getElementById("calendar-grid");
  container.innerHTML = "";

  availability.slots.forEach(slot => {
    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = formatTime(slot.start);

    // Mostrar mesas disponibles
    if (slot.tables) {
      const tablesDiv = document.createElement("div");
      tablesDiv.textContent = "Tables: " + slot.tables.join(",");
      div.appendChild(tablesDiv);
    }

    if (reservedSlots[slot.start]) {
      div.classList.add("reserved");
      div.addEventListener("click", async () => {
        if (confirm(`Cancel reservation for ${reservedSlots[slot.start].customer.name}?`)) {
          const del = await fetch(`${API_BASE}/reservations/${reservedSlots[slot.start].id}`, { method: "DELETE" });
          if (del.status === 204) {
            alert("Cancelled");
            loadCalendar();
            loadReservations(); // actualizar lista
          } else {
            alert("Error cancelling");
          }
        }
      });
    } else if (slot.available) {
      div.classList.add("available");
      div.addEventListener("click", async () => {
        const name = prompt("Customer name:");
        if (!name) return;
        const phone = prompt("Phone:") || "";
        const email = prompt("Email:") || "";

        const createRes = await fetch(`${API_BASE}/reservations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": Math.random().toString(36).slice(2,9)
          },
          body: JSON.stringify({
            restaurantId: "R1",
            sectorId,
            partySize,
            startDateTimeISO: slot.start,
            customer: { name, phone, email }
          })
        });
        const result = await createRes.json();
        if (createRes.status === 201) {
          alert("Reservation created!");
          loadCalendar();
          loadReservations(); // actualizar lista
        } else {
          alert("Error: " + JSON.stringify(result));
        }
      });
    } else {
      div.classList.add("unavailable");
    }

    container.appendChild(div);
  });
}

// --- Load reservations list ---
async function loadReservations() {
  const date = document.getElementById("date").value;
  const filterSector = document.getElementById("filterSector").value;

  if (!date) return;

  const res = await fetch(`${API_BASE}/reservations/day?restaurantId=R1&date=${date}`);
  const data = await res.json();
  const container = document.getElementById("reservations-list");
  container.innerHTML = "";

  data.items
    .filter(r => !filterSector || r.sectorId === filterSector)
    .forEach(r => {
      const div = document.createElement("div");
      div.textContent = `${formatTime(r.startDateTimeISO)} - ${r.customer.name} (${r.partySize}) in ${r.sectorId} tables: ${r.tableIds.join(",")}`;
      container.appendChild(div);
    });
}

// --- Event listeners ---
document.getElementById("loadSlots").addEventListener("click", async () => {
  await loadCalendar();
  await loadReservations();
});

document.getElementById("filterSector").addEventListener("change", loadReservations);
