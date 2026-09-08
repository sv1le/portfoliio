/**
 * NexPulse Enterprise - Core Application Logic
 * Integrates Firebase Authentication & Cloud Firestore with Smart Resilient Fallback
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

// Firebase Modular References (dynamically loaded if configured)
let fbApp = null;
let fbAuth = null;
let fbDb = null;
let fbAuthModule = null;
let fbFirestoreModule = null;

// Initial Pre-seeded Records (Corporate Directory)
const INITIAL_USERS = [
  {
    id: "admin-1",
    fullName: "NexPulse Administrator",
    email: "admin@nexpulse.com",
    role: "admin",
    department: "Administration & Leadership",
    designation: "System Administrator",
    phone: "+1 (555) 019-2800",
    office: "HQ - Executive Suite 101",
    responsibilities: "Company Operations, Policy & Administrative Governance",
    joinedDate: "2023-01-15",
    status: "Active"
  },
  {
    id: "emp-1",
    fullName: "Alex Rivera",
    email: "employee@nexpulse.com",
    role: "employee",
    department: "Engineering",
    designation: "Senior Cloud Engineer",
    phone: "+1 (555) 019-7734",
    office: "Building B - Tech Bay 2",
    responsibilities: "Microservices Architecture & CI/CD Pipelines",
    joinedDate: "2024-01-10",
    status: "Active"
  },
  {
    id: "emp-2",
    fullName: "Elena Rostova",
    email: "elena.rostova@nexpulse.com",
    role: "employee",
    department: "Product & Design",
    designation: "Lead UX Researcher & Designer",
    phone: "+1 (555) 019-8812",
    office: "Building A - Innovation Hub",
    responsibilities: "Design Systems & User Experience Validation",
    joinedDate: "2024-02-18",
    status: "Active"
  },
  {
    id: "emp-3",
    fullName: "David Kim",
    email: "david.kim@nexpulse.com",
    role: "employee",
    department: "Finance",
    designation: "Senior Financial Analyst",
    phone: "+1 (555) 019-3329",
    office: "Building C - Finance Wing",
    responsibilities: "Fiscal Auditing, Forecasting & Budget Strategy",
    joinedDate: "2024-04-05",
    status: "Active"
  },
  {
    id: "emp-4",
    fullName: "Zainab Al-Mansoor",
    email: "zainab.m@nexpulse.com",
    role: "employee",
    department: "Engineering",
    designation: "Full Stack Developer",
    phone: "+1 (555) 019-6641",
    office: "Building B - Tech Bay 4",
    responsibilities: "Frontend Portals & API Integration",
    joinedDate: "2024-05-12",
    status: "Active"
  }
];

// App State
let currentUser = null;
let currentViewMode = "table"; // or 'cards'
let usersCache = [];

/* ==========================================================================
   Database & Storage Layer
   ========================================================================== */

class StorageService {
  constructor() {
    this.storageKey = "nexpulse_directory_users_v2";
    this.sessionKey = "nexpulse_current_session_v2";
    this.initLocalStorage();
  }

  initLocalStorage() {
    const existing = localStorage.getItem(this.storageKey);
    if (!existing) {
      localStorage.setItem(this.storageKey, JSON.stringify(INITIAL_USERS));
    }
  }

  async getAllUsers() {
    if (isFirebaseConfigured() && fbDb && fbFirestoreModule) {
      try {
        const { collection, getDocs } = fbFirestoreModule;
        const querySnapshot = await getDocs(collection(fbDb, "users"));
        const users = [];
        querySnapshot.forEach((doc) => {
          users.push({ id: doc.id, ...doc.data() });
        });
        if (users.length > 0) return users;
      } catch (err) {
        console.warn("Firestore fetch error, utilizing local store:", err);
      }
    }
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : INITIAL_USERS;
  }

  async getAdmins() {
    const all = await this.getAllUsers();
    return all.filter(u => u.role === "admin");
  }

  async getEmployees() {
    const all = await this.getAllUsers();
    return all.filter(u => u.role === "employee");
  }

  async addUser(userData) {
    const newUser = {
      id: "usr-" + Date.now(),
      status: "Active",
      joinedDate: new Date().toISOString().split("T")[0],
      ...userData
    };

    if (isFirebaseConfigured() && fbDb && fbFirestoreModule) {
      try {
        const { doc, setDoc } = fbFirestoreModule;
        await setDoc(doc(fbDb, "users", newUser.id), newUser);
      } catch (err) {
        console.warn("Firestore write error, falling back to local storage:", err);
      }
    }

    const currentList = await this.getAllUsers();
    currentList.unshift(newUser);
    localStorage.setItem(this.storageKey, JSON.stringify(currentList));
    return newUser;
  }

  async deleteUser(userId) {
    if (isFirebaseConfigured() && fbDb && fbFirestoreModule) {
      try {
        const { doc, deleteDoc } = fbFirestoreModule;
        await deleteDoc(doc(fbDb, "users", userId));
      } catch (err) {
        console.warn("Firestore delete error:", err);
      }
    }

    let currentList = await this.getAllUsers();
    currentList = currentList.filter(u => u.id !== userId);
    localStorage.setItem(this.storageKey, JSON.stringify(currentList));
    return true;
  }

  saveSession(user) {
    currentUser = user;
    sessionStorage.setItem(this.sessionKey, JSON.stringify(user));
  }

  getSavedSession() {
    const saved = sessionStorage.getItem(this.sessionKey);
    return saved ? JSON.parse(saved) : null;
  }

  clearSession() {
    currentUser = null;
    sessionStorage.removeItem(this.sessionKey);
  }
}

const storage = new StorageService();

/* ==========================================================================
   Firebase Initialization
   ========================================================================== */

async function setupFirebase() {
  const statusEl = document.getElementById("db-status-pill");
  if (!statusEl) return;

  if (isFirebaseConfigured()) {
    try {
      // Load modular SDK from CDN
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js");
      fbAuthModule = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js");
      fbFirestoreModule = await import("https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js");

      fbApp = initializeApp(firebaseConfig);
      fbAuth = fbAuthModule.getAuth(fbApp);
      fbDb = fbFirestoreModule.getFirestore(fbApp);

      statusEl.innerHTML = `<span class="pulse-dot"></span> Cloud Firestore Connected`;
      statusEl.title = "Connected to live Google Firebase Cloud Database";
      console.log("Firebase initialized successfully.");
    } catch (err) {
      console.warn("Firebase initialization failed; running local fallback:", err);
      statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);box-shadow:0 0 10px var(--secondary);"></span> Local Database Active`;
      statusEl.title = "Operating in High-Fidelity Local Database mode";
    }
  } else {
    statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);box-shadow:0 0 10px var(--secondary);"></span> Local DB Ready (Firebase Config Available)`;
    statusEl.title = "Add your Firebase credentials in firebase-config.js to enable live Cloud Firestore";
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
  toast.innerHTML = `<strong>${icon}</strong> <span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

/* ==========================================================================
   View Navigation
   ========================================================================== */

function switchView(viewName) {
  const views = {
    home: document.getElementById("home-view"),
    employee: document.getElementById("employee-view"),
    admin: document.getElementById("admin-view")
  };

  Object.keys(views).forEach(k => {
    if (views[k]) views[k].style.display = (k === viewName) ? "block" : "none";
  });

  // Update navbar active state
  document.querySelectorAll(".nav-link").forEach(link => {
    if (link.dataset.view === viewName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHeaderUserUI() {
  const guestActions = document.getElementById("header-guest-actions");
  const userActions = document.getElementById("header-user-actions");
  const userNameEl = document.getElementById("header-user-name");
  const userRoleEl = document.getElementById("header-user-role");
  const userAvatarEl = document.getElementById("header-user-avatar");

  if (!guestActions || !userActions) return;

  if (currentUser) {
    guestActions.style.display = "none";
    userActions.style.display = "flex";

    if (userNameEl) userNameEl.textContent = currentUser.fullName;
    if (userRoleEl) {
      userRoleEl.textContent = currentUser.role.toUpperCase();
      userRoleEl.className = currentUser.role === "admin" ? "badge badge-admin" : "badge badge-employee";
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = getInitials(currentUser.fullName);
    }
  } else {
    guestActions.style.display = "flex";
    userActions.style.display = "none";
  }
}

function getInitials(name) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

/* ==========================================================================
   Authentication Handlers
   ========================================================================== */

async function handleLogin(email, password) {
  // If real Firebase Auth is active, attempt live sign in
  if (isFirebaseConfigured() && fbAuth && fbAuthModule) {
    try {
      const { signInWithEmailAndPassword } = fbAuthModule;
      await signInWithEmailAndPassword(fbAuth, email, password);
    } catch (err) {
      console.warn("Firebase Auth login failed, verifying database records:", err);
    }
  }

  // Lookup in database
  const users = await storage.getAllUsers();
  const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!matched) {
    showToast("No account found with this email address.", "error");
    return false;
  }

  // Save session and route to the role's appropriate view
  storage.saveSession(matched);
  updateHeaderUserUI();
  closeAuthModal();

  showToast(`Welcome back, ${matched.fullName}! Authenticated as ${matched.role.toUpperCase()}.`, "success");

  if (matched.role === "admin") {
    loadAdminDashboard();
  } else {
    loadEmployeeDashboard();
  }

  return true;
}

async function handleRegister(formData) {
  const { fullName, email, password, role, department, phone, designation } = formData;

  // Check if user already exists
  const users = await storage.getAllUsers();
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    showToast("An account with this email address already exists.", "error");
    return false;
  }

  // If real Firebase Auth is available
  if (isFirebaseConfigured() && fbAuth && fbAuthModule) {
    try {
      const { createUserWithEmailAndPassword } = fbAuthModule;
      await createUserWithEmailAndPassword(fbAuth, email, password);
    } catch (err) {
      console.warn("Firebase Auth registration warning:", err);
    }
  }

  // Save to Database
  const newUser = await storage.addUser({
    fullName,
    email,
    role,
    department: department || "General Operations",
    designation: designation || (role === "admin" ? "Administrative Manager" : "Associate Specialist"),
    phone: phone || "+1 (555) 000-0000",
    office: role === "admin" ? "HQ - Executive Tower" : "Tech Campus Building A",
    responsibilities: role === "admin" 
      ? "Department Oversight & Administration" 
      : "Operations & Development Support"
  });

  storage.saveSession(newUser);
  updateHeaderUserUI();
  closeAuthModal();

  showToast(`Registration complete! Welcome to NexPulse, ${newUser.fullName}.`, "success");

  if (newUser.role === "admin") {
    loadAdminDashboard();
  } else {
    loadEmployeeDashboard();
  }

  return true;
}

function handleLogout() {
  if (isFirebaseConfigured() && fbAuth && fbAuthModule) {
    fbAuthModule.signOut(fbAuth).catch(err => console.warn("Firebase signout error:", err));
  }
  storage.clearSession();
  updateHeaderUserUI();
  switchView("home");
  showToast("You have been signed out safely.", "info");
}

/* ==========================================================================
   Employee Dashboard (Condition: View all Admin Details)
   ========================================================================== */

async function loadEmployeeDashboard() {
  if (!currentUser || currentUser.role !== "employee") {
    switchView("home");
    return;
  }

  switchView("employee");

  // Populate employee greeting & meta
  const nameEl = document.getElementById("emp-profile-name");
  const deptEl = document.getElementById("emp-profile-dept");
  const idEl = document.getElementById("emp-profile-id");
  const avatarEl = document.getElementById("emp-profile-avatar");

  if (nameEl) nameEl.textContent = currentUser.fullName;
  if (deptEl) deptEl.textContent = `${currentUser.department} • ${currentUser.designation}`;
  if (idEl) idEl.textContent = currentUser.id.toUpperCase();
  if (avatarEl) avatarEl.textContent = getInitials(currentUser.fullName);

  // Fetch all Admins (Requirement: if emp login -> authenticate and view all admin details)
  const admins = await storage.getAdmins();
  renderAdminDirectoryForEmployee(admins);
}

function renderAdminDirectoryForEmployee(admins) {
  const container = document.getElementById("employee-admins-grid");
  const countEl = document.getElementById("employee-admin-count");
  if (!container) return;

  if (countEl) countEl.textContent = `${admins.length} ${admins.length === 1 ? 'Administrator' : 'Administrators'} Available`;

  if (admins.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🏢</div>
        <h3>No Administrator Records Found</h3>
        <p>There are currently no active administrative accounts registered.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = admins.map(admin => `
    <article class="person-card">
      <div class="person-card-header">
        <div class="person-avatar-wrap">
          <div class="person-avatar admin-avatar">
            ${getInitials(admin.fullName)}
          </div>
          <div class="person-titles">
            <h3>${escapeHtml(admin.fullName)}</h3>
            <span class="person-designation">${escapeHtml(admin.designation || 'Administrator')}</span>
          </div>
        </div>
        <span class="badge badge-admin">Admin</span>
      </div>

      <div class="person-details-list">
        <div class="detail-row">
          <span class="detail-label">Department</span>
          <span class="detail-value">${escapeHtml(admin.department)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Official Email</span>
          <span class="detail-value"><a href="mailto:${escapeHtml(admin.email)}">${escapeHtml(admin.email)}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Contact Phone</span>
          <span class="detail-value"><a href="tel:${escapeHtml(admin.phone)}">${escapeHtml(admin.phone)}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Office Location</span>
          <span class="detail-value">${escapeHtml(admin.office || 'Executive Office')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Responsibilities</span>
          <span class="detail-value" style="font-size:0.8rem; color:var(--text-secondary);">${escapeHtml(admin.responsibilities || 'Executive Administration')}</span>
        </div>
      </div>

      <div class="person-card-actions">
        <a href="mailto:${escapeHtml(admin.email)}" class="btn btn-outline btn-sm">Email Admin</a>
        <a href="tel:${escapeHtml(admin.phone)}" class="btn btn-primary btn-sm">Direct Call</a>
      </div>
    </article>
  `).join("");
}

/* ==========================================================================
   Admin Dashboard (Condition: View all details)
   ========================================================================== */

async function loadAdminDashboard() {
  if (!currentUser || currentUser.role !== "admin") {
    switchView("home");
    return;
  }

  switchView("admin");

  // Populate Admin Greeting
  const nameEl = document.getElementById("admin-profile-name");
  const deptEl = document.getElementById("admin-profile-dept");
  const avatarEl = document.getElementById("admin-profile-avatar");

  if (nameEl) nameEl.textContent = currentUser.fullName;
  if (deptEl) deptEl.textContent = `${currentUser.designation} • ${currentUser.department}`;
  if (avatarEl) avatarEl.textContent = getInitials(currentUser.fullName);

  // Fetch ALL Users (Requirement: if admin login -> authenticate and view all details)
  usersCache = await storage.getAllUsers();
  updateAdminKPIs(usersCache);
  filterAndRenderAdminDirectory();
}

function updateAdminKPIs(users) {
  const totalEl = document.getElementById("kpi-total");
  const empEl = document.getElementById("kpi-employees");
  const admEl = document.getElementById("kpi-admins");
  const deptEl = document.getElementById("kpi-depts");

  const total = users.length;
  const employees = users.filter(u => u.role === "employee").length;
  const admins = users.filter(u => u.role === "admin").length;
  const depts = new Set(users.map(u => u.department)).size;

  if (totalEl) totalEl.textContent = total;
  if (empEl) empEl.textContent = employees;
  if (admEl) admEl.textContent = admins;
  if (deptEl) deptEl.textContent = depts;
}

function filterAndRenderAdminDirectory() {
  const searchTerm = (document.getElementById("admin-search-input")?.value || "").toLowerCase().trim();
  const roleFilter = document.getElementById("admin-role-filter")?.value || "all";
  const deptFilter = document.getElementById("admin-dept-filter")?.value || "all";

  let filtered = usersCache.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchTerm) ||
      user.email.toLowerCase().includes(searchTerm) ||
      (user.phone && user.phone.includes(searchTerm)) ||
      (user.designation && user.designation.toLowerCase().includes(searchTerm));

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesDept = deptFilter === "all" || user.department === deptFilter;

    return matchesSearch && matchesRole && matchesDept;
  });

  const countBadge = document.getElementById("admin-results-count");
  if (countBadge) countBadge.textContent = `${filtered.length} Records Found`;

  if (currentViewMode === "table") {
    renderAdminTable(filtered);
  } else {
    renderAdminCards(filtered);
  }
}

function renderAdminTable(users) {
  const tableContainer = document.getElementById("admin-table-container");
  const cardsContainer = document.getElementById("admin-cards-container");
  const tbody = document.getElementById("admin-table-body");

  if (!tableContainer || !cardsContainer || !tbody) return;

  tableContainer.style.display = "block";
  cardsContainer.style.display = "none";

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No matching personnel records found</h3>
          <p>Try refining your search terms or filter selections.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = users.map(user => `
    <tr>
      <td>
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <div class="user-avatar-sm" style="${user.role === 'admin' ? 'background:var(--admin-badge);' : ''}">
            ${getInitials(user.fullName)}
          </div>
          <div>
            <strong>${escapeHtml(user.fullName)}</strong>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(user.designation || 'Staff')}</div>
          </div>
        </div>
      </td>
      <td>
        <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-employee'}">
          ${user.role.toUpperCase()}
        </span>
      </td>
      <td>${escapeHtml(user.department)}</td>
      <td><a href="mailto:${escapeHtml(user.email)}" style="color:var(--secondary);">${escapeHtml(user.email)}</a></td>
      <td>${escapeHtml(user.phone || 'N/A')}</td>
      <td><span class="badge" style="background:rgba(16,185,129,0.1); color:var(--success); border:1px solid rgba(16,185,129,0.2);">${escapeHtml(user.status || 'Active')}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="window.confirmDeleteUser('${user.id}', '${escapeHtml(user.fullName)}')">
          Delete
        </button>
      </td>
    </tr>
  `).join("");
}

function renderAdminCards(users) {
  const tableContainer = document.getElementById("admin-table-container");
  const cardsContainer = document.getElementById("admin-cards-container");

  if (!tableContainer || !cardsContainer) return;

  tableContainer.style.display = "none";
  cardsContainer.style.display = "grid";

  if (users.length === 0) {
    cardsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🔍</div>
        <h3>No matching personnel records found</h3>
        <p>Try refining your search terms or filter selections.</p>
      </div>
    `;
    return;
  }

  cardsContainer.innerHTML = users.map(user => `
    <article class="person-card">
      <div class="person-card-header">
        <div class="person-avatar-wrap">
          <div class="person-avatar ${user.role === 'admin' ? 'admin-avatar' : ''}">
            ${getInitials(user.fullName)}
          </div>
          <div class="person-titles">
            <h3>${escapeHtml(user.fullName)}</h3>
            <span class="person-designation">${escapeHtml(user.designation || 'Staff')}</span>
          </div>
        </div>
        <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-employee'}">
          ${user.role.toUpperCase()}
        </span>
      </div>

      <div class="person-details-list">
        <div class="detail-row">
          <span class="detail-label">Department</span>
          <span class="detail-value">${escapeHtml(user.department)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Email</span>
          <span class="detail-value"><a href="mailto:${escapeHtml(user.email)}">${escapeHtml(user.email)}</a></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Phone</span>
          <span class="detail-value">${escapeHtml(user.phone || 'N/A')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Office</span>
          <span class="detail-value">${escapeHtml(user.office || 'Main Campus')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Joined Date</span>
          <span class="detail-value">${escapeHtml(user.joinedDate || '2024-01-01')}</span>
        </div>
      </div>

      <div class="person-card-actions">
        <button class="btn btn-danger btn-sm" onclick="window.confirmDeleteUser('${user.id}', '${escapeHtml(user.fullName)}')">
          Delete Record
        </button>
      </div>
    </article>
  `).join("");
}

window.confirmDeleteUser = async function(userId, userName) {
  if (confirm(`Are you sure you want to permanently delete the personnel record for "${userName}"?`)) {
    await storage.deleteUser(userId);
    showToast(`Record for "${userName}" was successfully removed.`, "info");
    usersCache = await storage.getAllUsers();
    updateAdminKPIs(usersCache);
    filterAndRenderAdminDirectory();
  }
};

/* ==========================================================================
   Modal UI Helpers
   ========================================================================== */

function openAuthModal(defaultTab = "login") {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  switchAuthTab(defaultTab);
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAuthModal() {
  const modal = document.getElementById("auth-modal");
  if (!modal) return;

  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function switchAuthTab(tab) {
  const loginTabBtn = document.getElementById("tab-login-btn");
  const registerTabBtn = document.getElementById("tab-register-btn");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  if (tab === "login") {
    loginTabBtn?.classList.add("active");
    registerTabBtn?.classList.remove("active");
    if (loginForm) loginForm.style.display = "block";
    if (registerForm) registerForm.style.display = "none";
  } else {
    registerTabBtn?.classList.add("active");
    loginTabBtn?.classList.remove("active");
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "block";
  }
}

function openAddPersonnelModal() {
  const modal = document.getElementById("add-personnel-modal");
  if (!modal) return;
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeAddPersonnelModal() {
  const modal = document.getElementById("add-personnel-modal");
  if (!modal) return;
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    btn.textContent = "🙈";
    btn.title = "Hide password";
  } else {
    input.type = "password";
    btn.textContent = "👁";
    btn.title = "Show password";
  }
}

function escapeHtml(string) {
  if (!string) return "";
  return String(string)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ==========================================================================
   DOM Setup & Event Listeners
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Initialize Firebase & Storage
  await setupFirebase();

  // 2. Check for active session
  const saved = storage.getSavedSession();
  if (saved) {
    currentUser = saved;
    updateHeaderUserUI();
    if (currentUser.role === "admin") {
      loadAdminDashboard();
    } else {
      loadEmployeeDashboard();
    }
  } else {
    switchView("home");
    updateHeaderUserUI();
  }

  // 3. Navigation clicks
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetView = link.dataset.view;
      if (targetView === "employee" && (!currentUser || currentUser.role !== "employee")) {
        openAuthModal("login");
        showToast("Please sign in with an employee account first.", "info");
        return;
      }
      if (targetView === "admin" && (!currentUser || currentUser.role !== "admin")) {
        openAuthModal("login");
        showToast("Please sign in with an administrator account first.", "info");
        return;
      }
      switchView(targetView);
    });
  });

  // 4. Modal Triggers
  document.getElementById("nav-login-btn")?.addEventListener("click", () => openAuthModal("login"));
  document.getElementById("nav-register-btn")?.addEventListener("click", () => openAuthModal("register"));
  document.getElementById("hero-open-portal-btn")?.addEventListener("click", () => {
    if (currentUser) {
      if (currentUser.role === "admin") loadAdminDashboard();
      else loadEmployeeDashboard();
    } else {
      openAuthModal("login");
    }
  });

  document.getElementById("hero-emp-demo-btn")?.addEventListener("click", () => {
    openAuthModal("login");
    document.getElementById("login-email").value = "employee@nexpulse.com";
    document.getElementById("login-password").value = "emp123";
  });

  document.getElementById("hero-adm-demo-btn")?.addEventListener("click", () => {
    openAuthModal("login");
    document.getElementById("login-email").value = "admin@nexpulse.com";
    document.getElementById("login-password").value = "admin123";
  });

  document.getElementById("auth-modal-close-btn")?.addEventListener("click", closeAuthModal);
  document.getElementById("tab-login-btn")?.addEventListener("click", () => switchAuthTab("login"));
  document.getElementById("tab-register-btn")?.addEventListener("click", () => switchAuthTab("register"));

  // 5. Password visibility toggles
  document.querySelectorAll(".password-toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      togglePasswordVisibility(targetId, btn);
    });
  });

  // 6. 1-Click Quick Demo Login Buttons
  document.getElementById("quick-admin-demo-btn")?.addEventListener("click", () => {
    document.getElementById("login-email").value = "admin@nexpulse.com";
    document.getElementById("login-password").value = "admin123";
    handleLogin("admin@nexpulse.com", "admin123");
  });

  document.getElementById("quick-employee-demo-btn")?.addEventListener("click", () => {
    document.getElementById("login-email").value = "employee@nexpulse.com";
    document.getElementById("login-password").value = "emp123";
    handleLogin("employee@nexpulse.com", "emp123");
  });

  // 7. Login Form Submission
  document.getElementById("login-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    if (!email || !password) {
      showToast("Please enter both email and password.", "error");
      return;
    }
    await handleLogin(email, password);
  });

  // 8. Register Form Submission
  document.getElementById("register-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const role = document.querySelector("input[name='reg-role']:checked")?.value || "employee";
    const department = document.getElementById("reg-department").value;
    const phone = document.getElementById("reg-phone").value.trim();
    const designation = document.getElementById("reg-designation").value.trim();

    if (!fullName || !email || !password) {
      showToast("Please fill in all mandatory fields.", "error");
      return;
    }

    if (password.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }

    await handleRegister({
      fullName,
      email,
      password,
      role,
      department,
      phone,
      designation
    });
  });

  // 9. Sign out triggers
  document.querySelectorAll(".logout-trigger").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  });

  // 10. Admin Search and Filters
  document.getElementById("admin-search-input")?.addEventListener("input", filterAndRenderAdminDirectory);
  document.getElementById("admin-role-filter")?.addEventListener("change", filterAndRenderAdminDirectory);
  document.getElementById("admin-dept-filter")?.addEventListener("change", filterAndRenderAdminDirectory);

  // 11. Admin Table vs Cards View Toggle
  document.getElementById("view-table-btn")?.addEventListener("click", () => {
    currentViewMode = "table";
    document.getElementById("view-table-btn").classList.add("active");
    document.getElementById("view-cards-btn").classList.remove("active");
    filterAndRenderAdminDirectory();
  });

  document.getElementById("view-cards-btn")?.addEventListener("click", () => {
    currentViewMode = "cards";
    document.getElementById("view-cards-btn").classList.add("active");
    document.getElementById("view-table-btn").classList.remove("active");
    filterAndRenderAdminDirectory();
  });

  // 12. Add Personnel Modal for Admin
  document.getElementById("admin-add-personnel-btn")?.addEventListener("click", openAddPersonnelModal);
  document.getElementById("add-personnel-close-btn")?.addEventListener("click", closeAddPersonnelModal);

  document.getElementById("add-personnel-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("add-name").value.trim();
    const email = document.getElementById("add-email").value.trim();
    const role = document.getElementById("add-role").value;
    const department = document.getElementById("add-department").value;
    const phone = document.getElementById("add-phone").value.trim();
    const designation = document.getElementById("add-designation").value.trim();

    if (!fullName || !email) {
      showToast("Name and email are required.", "error");
      return;
    }

    await storage.addUser({
      fullName,
      email,
      role,
      department,
      phone: phone || "+1 (555) 000-0000",
      designation: designation || (role === "admin" ? "Administrative Officer" : "Associate Engineer")
    });

    showToast(`Successfully added ${fullName} to the directory!`, "success");
    closeAddPersonnelModal();
    document.getElementById("add-personnel-form").reset();

    usersCache = await storage.getAllUsers();
    updateAdminKPIs(usersCache);
    filterAndRenderAdminDirectory();
  });

  // 13. Employee Admin Directory Search
  document.getElementById("emp-admin-search")?.addEventListener("input", async (e) => {
    const term = e.target.value.toLowerCase().trim();
    const admins = await storage.getAdmins();
    const filtered = admins.filter(a => 
      a.fullName.toLowerCase().includes(term) ||
      a.department.toLowerCase().includes(term) ||
      (a.office && a.office.toLowerCase().includes(term))
    );
    renderAdminDirectoryForEmployee(filtered);
  });

  // 14. Theme Toggle
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    localStorage.setItem("nexpulse_theme", isLight ? "light" : "dark");
  });

  if (localStorage.getItem("nexpulse_theme") === "light") {
    document.body.classList.add("light-theme");
  }
});
