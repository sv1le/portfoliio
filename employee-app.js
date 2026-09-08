/**
 * Employee Management System - Form Controller & Firestore Database Engine
 * Integrates Google Firebase Cloud Firestore with Resilient Local Fallback
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

// Firebase Modular References
let fbApp = null;
let fbDb = null;
let fbFirestore = null;

// Initial Pre-seeded Corporate Employee Records
const SEED_EMPLOYEES = [
  {
    id: "EMP-1001",
    fullName: "Alex Rivera",
    email: "alex.rivera@company.org",
    phone: "+91 98765 01001",
    department: "Engineering",
    designation: "Senior Cloud Engineer",
    employmentType: "Full-Time",
    joiningDate: "2023-01-15",
    salary: 85000,
    office: "HQ - Tech Tower 4B",
    notes: "Lead engineer for cloud infrastructure and microservices."
  },
  {
    id: "EMP-1002",
    fullName: "Elena Rostova",
    email: "elena.rostova@company.org",
    phone: "+91 98765 01002",
    department: "Product & Design",
    designation: "Lead UX Researcher",
    employmentType: "Hybrid",
    joiningDate: "2023-03-20",
    salary: 78000,
    office: "HQ - Innovation Lab 2A",
    notes: "Oversees enterprise design system and accessibility validation."
  },
  {
    id: "EMP-1003",
    fullName: "David Kim",
    email: "david.kim@company.org",
    phone: "+91 98765 01003",
    department: "Finance",
    designation: "Financial Controller",
    employmentType: "Full-Time",
    joiningDate: "2023-06-10",
    salary: 92000,
    office: "HQ - Executive Tower 3",
    notes: "Manages fiscal audits, budget allocations, and payroll."
  },
  {
    id: "EMP-1004",
    fullName: "Zainab Al-Mansoor",
    email: "zainab.m@company.org",
    phone: "+91 98765 01004",
    department: "Engineering",
    designation: "Full Stack Developer",
    employmentType: "Remote",
    joiningDate: "2023-09-01",
    salary: 72000,
    office: "Remote - Bangalore",
    notes: "Core developer for employee and admin web portals."
  },
  {
    id: "EMP-1005",
    fullName: "Karthik Raja",
    email: "karthik.raja@company.org",
    phone: "+91 98765 01005",
    department: "Human Resources",
    designation: "HR Operations Lead",
    employmentType: "Full-Time",
    joiningDate: "2024-01-08",
    salary: 68000,
    office: "HQ - People Operations Suite",
    notes: "Talent acquisition, onboarding, and compliance management."
  }
];

// App State
let employeesCache = [];
let currentSearch = "";
let currentDeptFilter = "all";
let activeEmployeeForModal = null;

/* ==========================================================================
   Database & Storage Service
   ========================================================================== */

class EmployeeDatabaseService {
  constructor() {
    this.storageKey = "employee_registry_v1";
    this.initLocalStorage();
  }

  initLocalStorage() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify(SEED_EMPLOYEES));
    }
  }

  async getAll() {
    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { collection, getDocs } = fbFirestore;
        const snapshot = await getDocs(collection(fbDb, "employees"));
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        if (list.length > 0) return list;
      } catch (err) {
        console.warn("Firestore fetch warning, reading local storage:", err);
      }
    }
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : SEED_EMPLOYEES;
  }

  async create(employeeData) {
    const newEmp = {
      ...employeeData,
      createdAt: new Date().toISOString()
    };

    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { doc, setDoc } = fbFirestore;
        await setDoc(doc(fbDb, "employees", newEmp.id), newEmp);
      } catch (err) {
        console.warn("Firestore save error, saving to local storage:", err);
      }
    }

    const current = await this.getAll();
    current.unshift(newEmp);
    localStorage.setItem(this.storageKey, JSON.stringify(current));
    return newEmp;
  }

  async update(id, updatedFields) {
    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { doc, updateDoc } = fbFirestore;
        await updateDoc(doc(fbDb, "employees", id), updatedFields);
      } catch (err) {
        console.warn("Firestore update error:", err);
      }
    }

    let current = await this.getAll();
    const index = current.findIndex(e => e.id === id);
    if (index !== -1) {
      current[index] = { ...current[index], ...updatedFields };
      localStorage.setItem(this.storageKey, JSON.stringify(current));
      return current[index];
    }
    return null;
  }

  async delete(id) {
    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { doc, deleteDoc } = fbFirestore;
        await deleteDoc(doc(fbDb, "employees", id));
      } catch (err) {
        console.warn("Firestore delete error:", err);
      }
    }

    let current = await this.getAll();
    const removed = current.find(e => e.id === id);
    current = current.filter(e => e.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(current));
    return removed;
  }

  async resetSeed() {
    localStorage.setItem(this.storageKey, JSON.stringify(SEED_EMPLOYEES));
    return SEED_EMPLOYEES;
  }
}

const employeeDB = new EmployeeDatabaseService();

/* ==========================================================================
   Firebase Initialization
   ========================================================================== */

async function setupFirebase() {
  const statusEl = document.getElementById("db-status-badge");
  if (!statusEl) return;

  if (isFirebaseConfigured()) {
    try {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
      fbFirestore = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");
      fbApp = initializeApp(firebaseConfig);
      fbDb = fbFirestore.getFirestore(fbApp);

      statusEl.innerHTML = `<span class="pulse-dot"></span> Cloud Firestore Connected`;
      statusEl.title = "Connected to live Google Cloud Firestore employees table";
    } catch (err) {
      console.warn("Firebase setup failed, using local database:", err);
      statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);box-shadow:0 0 8px var(--secondary);"></span> Local Database Active`;
    }
  } else {
    statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);box-shadow:0 0 8px var(--secondary);"></span> Local Database Active (Ready for Firebase)`;
  }
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";

  toast.innerHTML = `<strong>${icon}</strong> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

/* ==========================================================================
   Data Rendering & Business Logic
   ========================================================================== */

async function refreshEmployeeData() {
  employeesCache = await employeeDB.getAll();
  updateKPIs(employeesCache);
  filterAndRenderTable();
  generateNextEmployeeId();
}

function generateNextEmployeeId() {
  const idInput = document.getElementById("emp-id");
  if (!idInput || idInput.dataset.manualEdit === "true") return;

  // Find max numeric suffix
  let maxId = 1000;
  employeesCache.forEach(e => {
    const num = parseInt(e.id.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxId) maxId = num;
  });

  idInput.value = `EMP-${maxId + 1}`;
}

function updateKPIs(employees) {
  const totalEl = document.getElementById("kpi-total");
  const fulltimeEl = document.getElementById("kpi-fulltime");
  const deptsEl = document.getElementById("kpi-depts");
  const payrollEl = document.getElementById("kpi-payroll");

  const total = employees.length;
  const fulltime = employees.filter(e => e.employmentType === "Full-Time").length;
  const depts = new Set(employees.map(e => e.department)).size;
  const totalSalary = employees.reduce((sum, e) => sum + (parseFloat(e.salary) || 0), 0);

  if (totalEl) totalEl.textContent = total;
  if (fulltimeEl) fulltimeEl.textContent = fulltime;
  if (deptsEl) deptsEl.textContent = depts;
  if (payrollEl) payrollEl.textContent = `₹${totalSalary.toLocaleString()}`;
}

function filterAndRenderTable() {
  const tbody = document.getElementById("employee-table-body");
  const countBadge = document.getElementById("records-count-badge");
  if (!tbody) return;

  const search = currentSearch.toLowerCase();
  const filtered = employeesCache.filter(e => {
    const matchesSearch = 
      !search ||
      e.fullName.toLowerCase().includes(search) ||
      e.id.toLowerCase().includes(search) ||
      e.email.toLowerCase().includes(search) ||
      (e.phone && e.phone.includes(search)) ||
      (e.designation && e.designation.toLowerCase().includes(search));

    const matchesDept = currentDeptFilter === "all" || e.department === currentDeptFilter;

    return matchesSearch && matchesDept;
  });

  if (countBadge) countBadge.textContent = `${filtered.length} Employee Records`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-state">
          <div class="empty-state-icon">👥</div>
          <h3>No employee records found</h3>
          <p>Try clearing your search or add a new employee using the form on the left.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(emp => {
    const initials = emp.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "EM";
    const typeClass = (emp.employmentType || "Full-Time").toLowerCase().replace(/[^a-z]/g, "");

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div class="user-avatar-sm">${initials}</div>
            <div>
              <strong style="color: var(--secondary); font-size: 0.85rem;">${escapeHtml(emp.id)}</strong>
              <div style="font-weight: 600;">${escapeHtml(emp.fullName)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge badge-dept">${escapeHtml(emp.department)}</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${escapeHtml(emp.designation || 'Staff')}</div>
        </td>
        <td>
          <div><a href="mailto:${escapeHtml(emp.email)}" style="color: var(--secondary);">${escapeHtml(emp.email)}</a></div>
          <div style="font-size: 0.75rem; color: var(--text-muted);"><a href="tel:${escapeHtml(emp.phone)}">${escapeHtml(emp.phone || '—')}</a></div>
        </td>
        <td>
          <span class="badge badge-${typeClass}">${escapeHtml(emp.employmentType || 'Full-Time')}</span>
        </td>
        <td>${escapeHtml(emp.joiningDate || '—')}</td>
        <td style="font-weight: 600; color: var(--text-primary);">
          ₹${(parseFloat(emp.salary) || 0).toLocaleString()}
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.viewEmployee('${emp.id}')" title="View details">
              👁️
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.editEmployee('${emp.id}')" title="Edit employee">
              ✏️
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.deleteEmployeePrompt('${emp.id}', '${escapeHtml(emp.fullName)}')" title="Delete employee">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   Window Global Handlers for Modals & Actions
   ========================================================================== */

window.viewEmployee = function(id) {
  const emp = employeesCache.find(e => e.id === id);
  if (!emp) return;

  activeEmployeeForModal = emp;
  const initials = emp.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  document.getElementById("view-modal-avatar").textContent = initials;
  document.getElementById("view-modal-name").textContent = emp.fullName;
  document.getElementById("view-modal-id-badge").textContent = emp.id;
  document.getElementById("view-modal-dept-title").textContent = `${emp.designation} • ${emp.department}`;
  document.getElementById("view-modal-email").innerHTML = `<a href="mailto:${escapeHtml(emp.email)}">${escapeHtml(emp.email)}</a>`;
  document.getElementById("view-modal-phone").innerHTML = `<a href="tel:${escapeHtml(emp.phone)}">${escapeHtml(emp.phone)}</a>`;
  document.getElementById("view-modal-type").textContent = emp.employmentType;
  document.getElementById("view-modal-joining").textContent = emp.joiningDate || "Not recorded";
  document.getElementById("view-modal-salary").textContent = `₹${(parseFloat(emp.salary) || 0).toLocaleString()}`;
  document.getElementById("view-modal-office").textContent = emp.office || "Main Corporate Tower";
  document.getElementById("view-modal-notes").textContent = emp.notes || "No additional notes.";

  openModal("employee-view-modal");
};

window.editEmployee = function(id) {
  const emp = employeesCache.find(e => e.id === id);
  if (!emp) return;

  // Pre-fill edit modal
  document.getElementById("edit-emp-id").value = emp.id;
  document.getElementById("edit-emp-name").value = emp.fullName;
  document.getElementById("edit-emp-email").value = emp.email;
  document.getElementById("edit-emp-phone").value = emp.phone || "";
  document.getElementById("edit-emp-dept").value = emp.department;
  document.getElementById("edit-emp-designation").value = emp.designation || "";
  document.getElementById("edit-emp-type").value = emp.employmentType || "Full-Time";
  document.getElementById("edit-emp-joining").value = emp.joiningDate || "";
  document.getElementById("edit-emp-salary").value = emp.salary || "";
  document.getElementById("edit-emp-office").value = emp.office || "";
  document.getElementById("edit-emp-notes").value = emp.notes || "";

  closeModal("employee-view-modal");
  openModal("employee-edit-modal");
};

window.deleteEmployeePrompt = function(id, name) {
  if (confirm(`Are you sure you want to permanently remove employee "${name}" (${id}) from the database?`)) {
    deleteEmployeeConfirmed(id, name);
  }
};

async function deleteEmployeeConfirmed(id, name) {
  await employeeDB.delete(id);
  showToast(`Employee "${name}" was deleted successfully.`, "info");
  await refreshEmployeeData();
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

/* ==========================================================================
   Quick Fill Sample Employee Data (1-Click Testing)
   ========================================================================== */

const SAMPLE_ENTRIES = [
  {
    name: "Siddhartha Saha",
    email: "siddhartha.saha@company.org",
    phone: "+91 98765 12345",
    department: "Engineering",
    designation: "Full Stack Engineer",
    type: "Full-Time",
    salary: 82000,
    office: "Innovation Bay 3",
    notes: "MCA Project developer specializing in web technologies & cloud architecture."
  },
  {
    name: "Ananya Deshmukh",
    email: "ananya.d@company.org",
    phone: "+91 98220 54321",
    department: "Product & Design",
    designation: "Senior UI/UX Designer",
    type: "Hybrid",
    salary: 76000,
    office: "Design Studio Room 4",
    notes: "Conducting user experience evaluations and UI design prototyping."
  },
  {
    name: "Vikram Malhotra",
    email: "vikram.m@company.org",
    phone: "+91 97110 99887",
    department: "Finance",
    designation: "Accounts Analyst",
    type: "Full-Time",
    salary: 69000,
    office: "Finance Wing - Floor 2",
    notes: "Corporate accounts, quarterly balancing, and internal payroll."
  }
];

let sampleIndex = 0;

function quickFillSample() {
  const sample = SAMPLE_ENTRIES[sampleIndex % SAMPLE_ENTRIES.length];
  sampleIndex++;

  document.getElementById("emp-name").value = sample.name;
  document.getElementById("emp-email").value = sample.email;
  document.getElementById("emp-phone").value = sample.phone;
  document.getElementById("emp-dept").value = sample.department;
  document.getElementById("emp-designation").value = sample.designation;
  document.getElementById("emp-type").value = sample.type;
  document.getElementById("emp-joining").value = new Date().toISOString().split("T")[0];
  document.getElementById("emp-salary").value = sample.salary;
  document.getElementById("emp-office").value = sample.office;
  document.getElementById("emp-notes").value = sample.notes;

  showToast(`Sample data loaded for ${sample.name}.`, "info");
}

/* ==========================================================================
   Export to CSV
   ========================================================================== */

function exportToCSV() {
  if (employeesCache.length === 0) {
    showToast("No employee records to export.", "error");
    return;
  }

  const headers = ["Employee ID", "Full Name", "Department", "Designation", "Email", "Phone", "Employment Type", "Joining Date", "Salary", "Office", "Notes"];
  const rows = employeesCache.map(e => [
    `"${(e.id || '').replace(/"/g, '""')}"`,
    `"${(e.fullName || '').replace(/"/g, '""')}"`,
    `"${(e.department || '').replace(/"/g, '""')}"`,
    `"${(e.designation || '').replace(/"/g, '""')}"`,
    `"${(e.email || '').replace(/"/g, '""')}"`,
    `"${(e.phone || '').replace(/"/g, '""')}"`,
    `"${(e.employmentType || '').replace(/"/g, '""')}"`,
    `"${(e.joiningDate || '').replace(/"/g, '""')}"`,
    parseFloat(e.salary) || 0,
    `"${(e.office || '').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const encoded = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encoded);
  link.setAttribute("download", `employee_directory_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Employee table exported to CSV!", "success");
}

/* ==========================================================================
   DOM Setup & Event Listeners
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize Firebase & Storage
  await setupFirebase();
  await refreshEmployeeData();

  // 2. Employee Entry Form Submission (Create new employee)
  document.getElementById("employee-entry-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("emp-id").value.trim();
    const fullName = document.getElementById("emp-name").value.trim();
    const email = document.getElementById("emp-email").value.trim();
    const phone = document.getElementById("emp-phone").value.trim();
    const department = document.getElementById("emp-dept").value;
    const designation = document.getElementById("emp-designation").value.trim();
    const employmentType = document.getElementById("emp-type").value;
    const joiningDate = document.getElementById("emp-joining").value;
    const salary = parseFloat(document.getElementById("emp-salary").value) || 0;
    const office = document.getElementById("emp-office").value.trim();
    const notes = document.getElementById("emp-notes").value.trim();

    if (!id || !fullName || !email) {
      showToast("Employee ID, Full Name, and Email are required.", "error");
      return;
    }

    // Check for ID collision
    if (employeesCache.some(emp => emp.id.toUpperCase() === id.toUpperCase())) {
      showToast(`Employee with ID ${id} already exists. Please choose a unique ID.`, "error");
      return;
    }

    const newRecord = {
      id: id.toUpperCase(),
      fullName,
      email,
      phone: phone || "+91 98000 00000",
      department,
      designation: designation || "Staff Associate",
      employmentType,
      joiningDate: joiningDate || new Date().toISOString().split("T")[0],
      salary,
      office: office || "Headquarters",
      notes
    };

    await employeeDB.create(newRecord);
    showToast(`Employee "${fullName}" saved to Firebase Database!`, "success");

    // Reset Form
    document.getElementById("employee-entry-form").reset();
    document.getElementById("emp-id").dataset.manualEdit = "false";
    await refreshEmployeeData();
  });

  // Manual edit flag on employee ID
  document.getElementById("emp-id")?.addEventListener("input", (e) => {
    e.target.dataset.manualEdit = "true";
  });

  // 3. Quick Fill Button
  document.getElementById("btn-quick-fill")?.addEventListener("click", quickFillSample);

  // 4. Reset Form Button
  document.getElementById("btn-form-reset")?.addEventListener("click", () => {
    document.getElementById("employee-entry-form").reset();
    document.getElementById("emp-id").dataset.manualEdit = "false";
    generateNextEmployeeId();
  });

  // 5. Edit Modal Form Submission (Update employee)
  document.getElementById("employee-edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = document.getElementById("edit-emp-id").value;
    const fullName = document.getElementById("edit-emp-name").value.trim();
    const email = document.getElementById("edit-emp-email").value.trim();
    const phone = document.getElementById("edit-emp-phone").value.trim();
    const department = document.getElementById("edit-emp-dept").value;
    const designation = document.getElementById("edit-emp-designation").value.trim();
    const employmentType = document.getElementById("edit-emp-type").value;
    const joiningDate = document.getElementById("edit-emp-joining").value;
    const salary = parseFloat(document.getElementById("edit-emp-salary").value) || 0;
    const office = document.getElementById("edit-emp-office").value.trim();
    const notes = document.getElementById("edit-emp-notes").value.trim();

    await employeeDB.update(id, {
      fullName,
      email,
      phone,
      department,
      designation,
      employmentType,
      joiningDate,
      salary,
      office,
      notes
    });

    showToast(`Updated details for ${fullName} (${id})!`, "success");
    closeModal("employee-edit-modal");
    await refreshEmployeeData();
  });

  // 6. Modal Close Buttons
  document.getElementById("btn-close-view-modal")?.addEventListener("click", () => closeModal("employee-view-modal"));
  document.getElementById("btn-close-edit-modal")?.addEventListener("click", () => closeModal("employee-edit-modal"));
  document.getElementById("btn-cancel-edit")?.addEventListener("click", () => closeModal("employee-edit-modal"));

  // 7. Search & Filter
  document.getElementById("emp-search-input")?.addEventListener("input", (e) => {
    currentSearch = e.target.value.trim();
    filterAndRenderTable();
  });

  document.getElementById("emp-dept-filter")?.addEventListener("change", (e) => {
    currentDeptFilter = e.target.value;
    filterAndRenderTable();
  });

  // 8. Export to CSV
  document.getElementById("btn-export-csv")?.addEventListener("click", exportToCSV);

  // 9. Reset to Sample
  document.getElementById("btn-reset-sample")?.addEventListener("click", async () => {
    if (confirm("Restore employee database to initial sample records?")) {
      await employeeDB.resetSeed();
      await refreshEmployeeData();
      showToast("Employee database restored to sample records.", "info");
    }
  });

  // 10. Theme Switcher
  document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    localStorage.setItem("emp_theme_mode", isLight ? "light" : "dark");
  });

  if (localStorage.getItem("emp_theme_mode") === "light") {
    document.body.classList.add("light-theme");
  }
});

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
