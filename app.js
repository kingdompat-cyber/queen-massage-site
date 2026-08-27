// 1. Initialize Supabase Client
const SUPABASE_URL = "https://thmmlrxkyugdsatanlkr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobW1scnhreXVnZHNhdGFubGtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3OTg4OTYsImV4cCI6MjEwMzM3NDg5Nn0.ckxTRNO5icZh_QbsA_XnJlaNzHvDWbhNYs2hZjD_P70";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let selectedSlotData = null;

// 2. Navigation Routing
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

// 3. Dynamic Slot Calculation (Queries Supabase)
async function renderAvailableTimeSlots(selectedDate) {
  const container = document.getElementById("availableSlots");
  if (!selectedDate) {
    container.innerHTML = '<p class="helper-text">Select a date above to view open slots.</p>';
    return;
  }

  container.innerHTML = '<p class="helper-text">Checking open slots...</p>';

  const { data: dayBookings, error } = await supabase
    .from("appointments")
    .select("start_minutes, end_minutes")
    .eq("date", selectedDate);

  if (error) {
    console.error("Error fetching slots:", error);
    container.innerHTML = '<p class="helper-text">Error checking availability.</p>';
    return;
  }

  container.innerHTML = "";
  const startHour = 9;  // 9:00 AM
  const endHour = 17;   // 5:00 PM
  const duration = 60;  // 60-minute blocks

  for (let hour = startHour; hour < endHour; hour++) {
    const slotStart = hour * 60;
    const slotEnd = slotStart + duration;

    const isTaken = dayBookings.some(
      (b) => slotStart < b.end_minutes && slotEnd > b.start_minutes
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
}

// 4. Save Appointment to Supabase Cloud
document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const timeValue = document.getElementById("selectedTime").value;
  if (!timeValue || !selectedSlotData) {
    alert("Please select an available time slot.");
    return;
  }

  const newBooking = {
    name: document.getElementById("clientName").value.trim(),
    phone: document.getElementById("clientPhone").value.trim(),
    service: document.getElementById("serviceType").value,
    date: document.getElementById("bookDate").value,
    time: timeValue,
    start_minutes: selectedSlotData.start,
    end_minutes: selectedSlotData.end,
    notes: document.getElementById("notes").value.trim()
  };

  const { error } = await supabase.from("appointments").insert([newBooking]);

  if (error) {
    alert("Error booking appointment: " + error.message);
    return;
  }

  alert(`Appointment confirmed for ${newBooking.name} on ${newBooking.date} at ${newBooking.time}!`);
  document.getElementById("bookingForm").reset();
  document.getElementById("selectedTime").value = "";
  selectedSlotData = null;
  document.getElementById("availableSlots").innerHTML = '<p class="helper-text">Select a date above to view open slots.</p>';
  showSection("home");
});

// 5. Customer Booking Lookup by Phone
async function lookupAppointments() {
  const phone = document.getElementById("lookupPhone").value.trim();
  const container = document.getElementById("customerResults");

  if (!phone) {
    container.innerHTML = '<p class="helper-text">Please enter a phone number.</p>';
    return;
  }

  container.innerHTML = '<p class="helper-text">Searching...</p>';

  const { data: userAppointments, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("phone", phone)
    .order("date", { ascending: true });

  if (error) {
    container.innerHTML = '<p class="helper-text">Error loading bookings.</p>';
    return;
  }

  if (!userAppointments || userAppointments.length === 0) {
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
}

// 6. Admin Panel with Live Sync
function loginAdmin() {
  const pass = document.getElementById("adminPass").value;
  if (pass === "mom123") {
    document.getElementById("adminLoginCard").classList.add("hidden");
    document.getElementById("adminDashboard").classList.remove("hidden");
    loadAdminAppointments();
    subscribeToRealtimeChanges();
  } else {
    alert("Incorrect passcode.");
  }
}

function logoutAdmin() {
  document.getElementById("adminPass").value = "";
  document.getElementById("adminLoginCard").classList.remove("hidden");
  document.getElementById("adminDashboard").classList.add("hidden");
}

async function loadAdminAppointments() {
  const list = document.getElementById("allAppointmentsList");
  
  const { data: records, error } = await supabase
    .from("appointments")
    .select("*")
    .order("date", { ascending: true })
    .order("time", { ascending: true });

  if (error) {
    list.innerHTML = "<p class='helper-text'>Error loading appointments.</p>";
    return;
  }

  if (!records || records.length === 0) {
    list.innerHTML = "<p class='helper-text'>No appointments found.</p>";
    return;
  }

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
}

async function cancelAppointment(id) {
  if (confirm("Cancel this appointment?")) {
    const { error } = await supabase.from("appointments").delete().eq("id", id);
    if (error) {
      alert("Error deleting appointment: " + error.message);
    } else {
      loadAdminAppointments();
    }
  }
}

// 7. Supabase Realtime Listener (Updates admin screen automatically)
function subscribeToRealtimeChanges() {
  supabase
    .channel("public:appointments")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "appointments" },
      () => {
        loadAdminAppointments();
      }
    )
    .subscribe();
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}