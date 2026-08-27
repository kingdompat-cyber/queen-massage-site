const DB_NAME = "SereneTouchDB";
const STORE_NAME = "appointments";
let db;
let selectedSlotData = null;

// 1. Initialize IndexedDB
const request = indexedDB.open(DB_NAME, 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
    store.createIndex("phone", "phone", { unique: false });
    store.createIndex("date", "date", { unique: false });
  }
};

request.onsuccess = (e) => {
  db = e.target.result;
};

// 2. Navigation
function showSection(sectionId) {
  document.querySelectorAll(".page-section").forEach((sec) => sec.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"));

  const target = document.getElementById(sectionId);
  if (target) target.classList.add("active");

  const activeBtn = Array.from(document.querySelectorAll(".nav-btn")).find((btn) =>
    btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(sectionId)
  );
  if (activeBtn) activeBtn.classList.add("active");
}

// 3. Dynamic Slot Calculation
function renderAvailableTimeSlots(selectedDate) {
  const container = document.getElementById("availableSlots");
  if (!selectedDate) {
    container.innerHTML = '<p class="helper-text">Select a date above to view open slots.</p>';
    return;
  }

  const tx = db.transaction([STORE_NAME], "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    const dayBookings = req.result.filter((r) => r.date === selectedDate);
    container.innerHTML = "";

    const startHour = 9;  // 9:00 AM
    const endHour = 17;   // 5:00 PM
    const duration = 60;  // 60-minute blocks

    for (let hour = startHour; hour < endHour; hour++) {
      const slotStart = hour * 60;
      const slotEnd = slotStart + duration;

      const isTaken = dayBookings.some(
        (b) => slotStart < b.endMinutes && slotEnd > b.startMinutes
      );

      const timeLabel = `${String(hour).padStart(2, "0")}:00`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `slot-pill ${isTaken ? "disabled" : ""}`;
      btn.textContent = timeLabel;
      btn.disabled = isTaken;

      if (!isTaken) {
        btn.onclick = () => {
          document.querySelectorAll(".slot-pill").forEach((p) => p.classList.remove("selected"));
          btn.classList.add("selected");
          document.getElementById("selectedTime").value = timeLabel;
          selectedSlotData = { start: slotStart, end: slotEnd };
        };
      }
      container.appendChild(btn);
    }
  };
}

// 4. Booking Form Submit
document.getElementById("bookingForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const timeValue = document.getElementById("selectedTime").value;
  if (!timeValue || !selectedSlotData) {
    alert("Please select an available time slot pill.");
    return;
  }

  const record = {
    name: document.getElementById("clientName").value.trim(),
    phone: document.getElementById("clientPhone").value.trim(),
    service: document.getElementById("serviceType").value,
    date: document.getElementById("bookDate").value,
    time: timeValue,
    startMinutes: selectedSlotData.start,
    endMinutes: selectedSlotData.end,
    notes: document.getElementById("notes").value.trim(),
    createdAt: new Date().toISOString()
  };

  const tx = db.transaction([STORE_NAME], "readwrite");
  tx.objectStore(STORE_NAME).add(record);

  tx.oncomplete = () => {
    alert(`Appointment confirmed for ${record.name} on ${record.date} at ${record.time}!`);
    document.getElementById("bookingForm").reset();
    document.getElementById("selectedTime").value = "";
    selectedSlotData = null;
    document.getElementById("availableSlots").innerHTML = '<p class="helper-text">Select a date above to view open slots.</p>';
    showSection("home");
  };
});

// 5. Customer Booking Lookup
function lookupAppointments() {
  const phone = document.getElementById("lookupPhone").value.trim();
  const container = document.getElementById("customerResults");

  if (!phone) {
    container.innerHTML = '<p class="helper-text">Please enter a phone number.</p>';
    return;
  }

  const tx = db.transaction([STORE_NAME], "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    const userAppointments = req.result.filter((r) => r.phone === phone);
    if (userAppointments.length === 0) {
      container.innerHTML = '<p class="helper-text">No bookings found for this number.</p>';
      return;
    }

    container.innerHTML = userAppointments.map((item) => `
      <div class="appointment-item">
        <div>
          <h4>${escapeHtml(item.service)}</h4>
          <p>📅 ${item.date} at ${item.time}</p>
          <small>Client: ${escapeHtml(item.name)}</small>
        </div>
      </div>
    `).join("");
  };
}

// 6. Admin Panel
function loginAdmin() {
  const pass = document.getElementById("adminPass").value;
  if (pass === "mom123") {
    document.getElementById("adminLoginCard").classList.add("hidden");
    document.getElementById("adminDashboard").classList.remove("hidden");
    loadAdminAppointments();
  } else {
    alert("Incorrect passcode.");
  }
}

function logoutAdmin() {
  document.getElementById("adminPass").value = "";
  document.getElementById("adminLoginCard").classList.remove("hidden");
  document.getElementById("adminDashboard").classList.add("hidden");
}

function loadAdminAppointments() {
  const tx = db.transaction([STORE_NAME], "readonly");
  const store = tx.objectStore(STORE_NAME);
  const req = store.getAll();

  req.onsuccess = () => {
    const list = document.getElementById("allAppointmentsList");
    const records = req.result;

    if (records.length === 0) {
      list.innerHTML = "<p class='helper-text'>No appointments found.</p>";
      return;
    }

    records.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    list.innerHTML = records.map((item) => `
      <div class="appointment-item">
        <div>
          <h4>${escapeHtml(item.name)} — <span style="font-weight:normal;">${escapeHtml(item.service)}</span></h4>
          <p>📞 ${escapeHtml(item.phone)} | 📅 ${item.date} @ ${item.time}</p>
          ${item.notes ? `<p style="font-size:0.85rem; color:#555;"><strong>Notes:</strong> ${escapeHtml(item.notes)}</p>` : ""}
        </div>
        <button type="button" class="btn-secondary btn-sm" onclick="cancelAppointment(${item.id})">Cancel</button>
      </div>
    `).join("");
  };
}

function cancelAppointment(id) {
  if (confirm("Cancel this appointment?")) {
    const tx = db.transaction([STORE_NAME], "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => loadAdminAppointments();
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}