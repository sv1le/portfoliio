/**
 * PulseContacts - Contact Management Application Logic
 * Integrates Firebase Cloud Firestore with Resilient Local Database Fallback
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

// Firebase Modular References
let fbApp = null;
let fbDb = null;
let fbFirestore = null;

// Avatar Gradient Color Palettes
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #06b6d4, #3b82f6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #10b981, #059669)",
  "linear-gradient(135deg, #f59e0b, #d97706)",
  "linear-gradient(135deg, #8b5cf6, #d946ef)"
];

// Realistic Pre-seeded Sample Contacts
const SEED_CONTACTS = [
  {
    id: "ct-1",
    firstName: "Arun",
    lastName: "Verma",
    email: "arun.verma@techcorp.io",
    phone: "+91 98765 43210",
    company: "TechCorp Global",
    designation: "Principal Cloud Architect",
    category: "work",
    isFavorite: true,
    notes: "Lead on Kubernetes migration. Available on Slack and WhatsApp.",
    avatarBg: AVATAR_GRADIENTS[0],
    createdAt: "2024-01-10T10:00:00.000Z"
  },
  {
    id: "ct-2",
    firstName: "Maya",
    lastName: "Sengupta",
    email: "maya.sengupta@designstudio.net",
    phone: "+91 98450 12345",
    company: "PixelCraft Design",
    designation: "Creative Director",
    category: "client",
    isFavorite: true,
    notes: "Reviewing design system components and web brand guidelines.",
    avatarBg: AVATAR_GRADIENTS[2],
    createdAt: "2024-02-14T11:30:00.000Z"
  },
  {
    id: "ct-3",
    firstName: "Rohan",
    lastName: "Mehta",
    email: "rohan.mehta@finvest.com",
    phone: "+91 97110 56789",
    company: "FinVest Advisory",
    designation: "Portfolio Manager",
    category: "personal",
    isFavorite: false,
    notes: "College friend and investment consultant.",
    avatarBg: AVATAR_GRADIENTS[3],
    createdAt: "2024-03-01T09:15:00.000Z"
  },
  {
    id: "ct-4",
    firstName: "Sophia",
    lastName: "Chen",
    email: "sophia.chen@novasystems.org",
    phone: "+1 (555) 349-8812",
    company: "Nova Systems",
    designation: "VP of Product",
    category: "work",
    isFavorite: true,
    notes: "Key contact for quarterly product roadmaps and strategic API partnerships.",
    avatarBg: AVATAR_GRADIENTS[1],
    createdAt: "2024-03-18T14:20:00.000Z"
  },
  {
    id: "ct-5",
    firstName: "Kavita",
    lastName: "Patel",
    email: "kavita.patel@familygroup.org",
    phone: "+91 99201 88442",
    company: "Pondicherry Healthcare",
    designation: "Senior Physician",
    category: "family",
    isFavorite: false,
    notes: "Emergency medical contact. Available outside clinic hours.",
    avatarBg: AVATAR_GRADIENTS[4],
    createdAt: "2024-04-05T16:00:00.000Z"
  }
];

// App State
let contactsCache = [];
let currentCategory = "all";
let currentSearchTerm = "";
let currentSortBy = "name-asc";
let currentViewMode = "grid"; // or 'table'
let activeContactForAction = null;
let lastDeletedContact = null;

/* ==========================================================================
   Storage Service (Firestore + LocalStorage)
   ========================================================================== */

class ContactStorageService {
  constructor() {
    this.storageKey = "pulse_contacts_db_v1";
    this.initLocalStorage();
  }

  initLocalStorage() {
    if (!localStorage.getItem(this.storageKey)) {
      localStorage.setItem(this.storageKey, JSON.stringify(SEED_CONTACTS));
    }
  }

  async getAll() {
    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { collection, getDocs } = fbFirestore;
        const snapshot = await getDocs(collection(fbDb, "contacts"));
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
    return data ? JSON.parse(data) : SEED_CONTACTS;
  }

  async create(contactData) {
    const newContact = {
      id: "ct-" + Date.now(),
      createdAt: new Date().toISOString(),
      avatarBg: AVATAR_GRADIENTS[Math.floor(Math.random() * AVATAR_GRADIENTS.length)],
      ...contactData
    };

    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { doc, setDoc } = fbFirestore;
        await setDoc(doc(fbDb, "contacts", newContact.id), newContact);
      } catch (err) {
        console.warn("Firestore create error:", err);
      }
    }

    const current = await this.getAll();
    current.unshift(newContact);
    localStorage.setItem(this.storageKey, JSON.stringify(current));
    return newContact;
  }

  async update(id, updatedFields) {
    if (isFirebaseConfigured() && fbDb && fbFirestore) {
      try {
        const { doc, updateDoc } = fbFirestore;
        await updateDoc(doc(fbDb, "contacts", id), updatedFields);
      } catch (err) {
        console.warn("Firestore update error:", err);
      }
    }

    let current = await this.getAll();
    const index = current.findIndex(c => c.id === id);
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
        await deleteDoc(doc(fbDb, "contacts", id));
      } catch (err) {
        console.warn("Firestore delete error:", err);
      }
    }

    let current = await this.getAll();
    const removed = current.find(c => c.id === id);
    current = current.filter(c => c.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(current));
    return removed;
  }

  async resetSeed() {
    localStorage.setItem(this.storageKey, JSON.stringify(SEED_CONTACTS));
    return SEED_CONTACTS;
  }
}

const contactStorage = new ContactStorageService();

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

      statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--success);"></span> Cloud Firestore Connected`;
      statusEl.title = "Connected to live Google Cloud Firestore database";
    } catch (err) {
      console.warn("Firebase initialization failed, utilizing local fallback:", err);
      statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);"></span> Local Database Active`;
    }
  } else {
    statusEl.innerHTML = `<span class="pulse-dot" style="background:var(--secondary);"></span> Local Database Active (Ready for Firebase)`;
  }
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */

function showToast(message, type = "info", undoCallback = null) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = type === "success" ? "✓" : type === "error" ? "⚠" : "ℹ";
  
  let content = `
    <div style="display:flex; align-items:center; gap:0.6rem;">
      <strong>${icon}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  if (undoCallback) {
    content += `
      <button type="button" class="btn btn-outline btn-sm" id="toast-undo-btn" style="padding:0.2rem 0.6rem; font-size:0.75rem;">
        Undo
      </button>
    `;
  }

  toast.innerHTML = content;
  container.appendChild(toast);

  if (undoCallback) {
    toast.querySelector("#toast-undo-btn")?.addEventListener("click", () => {
      undoCallback();
      toast.remove();
    });
  }

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

/* ==========================================================================
   Contact Operations & Rendering
   ========================================================================== */

async function loadContacts() {
  contactsCache = await contactStorage.getAll();
  updateStats(contactsCache);
  filterAndRenderContacts();
}

function updateStats(contacts) {
  const totalEl = document.getElementById("stat-total");
  const favEl = document.getElementById("stat-favorites");
  const workEl = document.getElementById("stat-work");
  const clientEl = document.getElementById("stat-clients");

  if (totalEl) totalEl.textContent = contacts.length;
  if (favEl) favEl.textContent = contacts.filter(c => c.isFavorite).length;
  if (workEl) workEl.textContent = contacts.filter(c => c.category === "work").length;
  if (clientEl) clientEl.textContent = contacts.filter(c => c.category === "client").length;
}

function filterAndRenderContacts() {
  const gridContainer = document.getElementById("contacts-grid-view");
  const tableContainer = document.getElementById("contacts-table-view");
  const countBadge = document.getElementById("results-count-badge");

  let filtered = contactsCache.filter(contact => {
    // 1. Search Query
    const search = currentSearchTerm.toLowerCase();
    const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.toLowerCase();
    const matchesSearch = 
      !search ||
      fullName.includes(search) ||
      (contact.email && contact.email.toLowerCase().includes(search)) ||
      (contact.phone && contact.phone.includes(search)) ||
      (contact.company && contact.company.toLowerCase().includes(search)) ||
      (contact.notes && contact.notes.toLowerCase().includes(search));

    // 2. Category Tab Filter
    let matchesCategory = true;
    if (currentCategory === "favorites") {
      matchesCategory = contact.isFavorite === true;
    } else if (currentCategory !== "all") {
      matchesCategory = contact.category === currentCategory;
    }

    return matchesSearch && matchesCategory;
  });

  // 3. Sorting
  filtered.sort((a, b) => {
    const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
    const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();

    if (currentSortBy === "name-asc") return nameA.localeCompare(nameB);
    if (currentSortBy === "name-desc") return nameB.localeCompare(nameA);
    if (currentSortBy === "company") return (a.company || "").localeCompare(b.company || "");
    if (currentSortBy === "recent") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return 0;
  });

  if (countBadge) countBadge.textContent = `${filtered.length} Contacts Found`;

  if (currentViewMode === "grid") {
    if (gridContainer) gridContainer.style.display = "grid";
    if (tableContainer) tableContainer.style.display = "none";
    renderCards(filtered);
  } else {
    if (gridContainer) gridContainer.style.display = "none";
    if (tableContainer) tableContainer.style.display = "block";
    renderTable(filtered);
  }
}

function getInitials(first, last) {
  const f = first ? first[0] : "";
  const l = last ? last[0] : "";
  return (f + l).toUpperCase() || "C";
}

function renderCards(contacts) {
  const container = document.getElementById("contacts-grid-view");
  if (!container) return;

  if (contacts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📇</div>
        <h3>No contacts found</h3>
        <p>Try clearing your search or add a new contact to get started.</p>
        <button type="button" class="btn btn-primary" style="margin-top: 1rem;" onclick="window.openAddContactModal()">
          + Add First Contact
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = contacts.map(contact => {
    const fullName = `${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}`.trim();
    const initials = getInitials(contact.firstName, contact.lastName);
    const bg = contact.avatarBg || AVATAR_GRADIENTS[0];

    return `
      <article class="contact-card">
        <div class="card-top">
          <div class="card-user-info" onclick="window.viewContactDetails('${contact.id}')" style="cursor: pointer;" title="View Contact Details">
            <div class="contact-avatar" style="background: ${bg};">
              ${initials}
            </div>
            <div class="card-names">
              <h3>${fullName}</h3>
              <div class="card-company">${escapeHtml(contact.designation || '')}${contact.designation && contact.company ? ' • ' : ''}${escapeHtml(contact.company || 'Personal Contact')}</div>
            </div>
          </div>

          <div class="card-badges">
            <button type="button" class="btn-icon btn-favorite ${contact.isFavorite ? 'active' : ''}" onclick="window.toggleFavorite('${contact.id}')" title="${contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
              ★
            </button>
            <span class="tag-badge tag-${contact.category || 'work'}">${escapeHtml(contact.category || 'work')}</span>
          </div>
        </div>

        <div class="card-meta-list" onclick="window.viewContactDetails('${contact.id}')" style="cursor: pointer;">
          <div class="meta-row">
            <span class="meta-icon">📞</span>
            <span class="meta-text"><a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone || 'No phone provided')}</a></span>
          </div>
          <div class="meta-row">
            <span class="meta-icon">✉️</span>
            <span class="meta-text"><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email || 'No email provided')}</a></span>
          </div>
          ${contact.notes ? `
            <div class="meta-row" style="font-size: 0.8rem; color: var(--text-muted);">
              <span class="meta-icon">📝</span>
              <span class="meta-text">${escapeHtml(contact.notes)}</span>
            </div>
          ` : ''}
        </div>

        <div class="card-footer">
          <div class="card-actions-left">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.viewContactDetails('${contact.id}')" title="View Full Details">
              View
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.openEditContactModal('${contact.id}')" title="Edit Contact">
              ✏️ Edit
            </button>
          </div>

          <button type="button" class="btn btn-danger btn-sm" onclick="window.promptDeleteContact('${contact.id}', '${fullName}')" title="Delete Contact">
            🗑️
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderTable(contacts) {
  const tbody = document.getElementById("contacts-table-body");
  if (!tbody) return;

  if (contacts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state" style="padding: 4rem 1rem;">
          <div class="empty-state-icon">📇</div>
          <h3>No contacts matching criteria</h3>
          <p>Try refining your search or add a new entry.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = contacts.map(contact => {
    const fullName = `${escapeHtml(contact.firstName)} ${escapeHtml(contact.lastName)}`.trim();
    const initials = getInitials(contact.firstName, contact.lastName);
    const bg = contact.avatarBg || AVATAR_GRADIENTS[0];

    return `
      <tr>
        <td>
          <button type="button" class="btn-icon btn-favorite ${contact.isFavorite ? 'active' : ''}" style="width: 28px; height: 28px; font-size: 1rem;" onclick="window.toggleFavorite('${contact.id}')">
            ★
          </button>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;" onclick="window.viewContactDetails('${contact.id}')">
            <div class="contact-avatar" style="width: 38px; height: 38px; font-size: 0.9rem; background: ${bg};">
              ${initials}
            </div>
            <div>
              <strong>${fullName}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(contact.designation || '')}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="tag-badge tag-${contact.category || 'work'}">${escapeHtml(contact.category || 'work')}</span>
          <span style="font-size: 0.85rem; color: var(--text-muted); margin-left: 0.5rem;">${escapeHtml(contact.company || '—')}</span>
        </td>
        <td><a href="mailto:${escapeHtml(contact.email)}" style="color: var(--secondary);">${escapeHtml(contact.email || '—')}</a></td>
        <td><a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone || '—')}</a></td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.viewContactDetails('${contact.id}')" title="View details">
              View
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.openEditContactModal('${contact.id}')" title="Edit contact">
              ✏️
            </button>
            <button type="button" class="btn btn-danger btn-sm" onclick="window.promptDeleteContact('${contact.id}', '${fullName}')" title="Delete contact">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

/* ==========================================================================
   Global Window Handlers for Modals & Actions
   ========================================================================== */

window.toggleFavorite = async function(id) {
  const contact = contactsCache.find(c => c.id === id);
  if (!contact) return;

  const newStatus = !contact.isFavorite;
  await contactStorage.update(id, { isFavorite: newStatus });
  contact.isFavorite = newStatus;
  updateStats(contactsCache);
  filterAndRenderContacts();
  showToast(`${contact.firstName} ${newStatus ? 'starred as favorite ⭐' : 'removed from favorites'}.`, "info");
};

window.openAddContactModal = function() {
  document.getElementById("contact-modal-title").textContent = "Add New Contact";
  document.getElementById("contact-form-subtitle").textContent = "Enter details to create a new contact in the database.";
  document.getElementById("contact-form-id").value = "";
  document.getElementById("contact-form").reset();
  document.getElementById("contact-form-category").value = "work";
  document.getElementById("contact-form-favorite").checked = false;

  openModal("contact-form-modal");
};

window.openEditContactModal = function(id) {
  const contact = contactsCache.find(c => c.id === id);
  if (!contact) return;

  document.getElementById("contact-modal-title").textContent = "Edit Contact Entry";
  document.getElementById("contact-form-subtitle").textContent = `Updating contact information for ${contact.firstName} ${contact.lastName}.`;
  document.getElementById("contact-form-id").value = contact.id;
  document.getElementById("contact-form-first").value = contact.firstName || "";
  document.getElementById("contact-form-last").value = contact.lastName || "";
  document.getElementById("contact-form-email").value = contact.email || "";
  document.getElementById("contact-form-phone").value = contact.phone || "";
  document.getElementById("contact-form-company").value = contact.company || "";
  document.getElementById("contact-form-designation").value = contact.designation || "";
  document.getElementById("contact-form-category").value = contact.category || "work";
  document.getElementById("contact-form-notes").value = contact.notes || "";
  document.getElementById("contact-form-favorite").checked = !!contact.isFavorite;

  closeModal("contact-details-modal");
  openModal("contact-form-modal");
};

window.viewContactDetails = function(id) {
  const contact = contactsCache.find(c => c.id === id);
  if (!contact) return;

  activeContactForAction = contact;
  const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

  document.getElementById("view-avatar").textContent = getInitials(contact.firstName, contact.lastName);
  document.getElementById("view-avatar").style.background = contact.avatarBg || AVATAR_GRADIENTS[0];
  document.getElementById("view-name").textContent = fullName;
  document.getElementById("view-company-dept").textContent = `${contact.designation || 'Contact'}${contact.company ? ' • ' + contact.company : ''}`;
  document.getElementById("view-tag").textContent = contact.category || "General";
  document.getElementById("view-tag").className = `tag-badge tag-${contact.category || 'work'}`;

  document.getElementById("view-phone-value").innerHTML = `<a href="tel:${escapeHtml(contact.phone)}">${escapeHtml(contact.phone || 'None')}</a>`;
  document.getElementById("view-email-value").innerHTML = `<a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email || 'None')}</a>`;
  document.getElementById("view-company-value").textContent = contact.company || "Not specified";
  document.getElementById("view-notes-value").textContent = contact.notes || "No additional notes recorded.";

  // Communication buttons
  document.getElementById("btn-call-direct").onclick = () => window.location.href = `tel:${contact.phone}`;
  document.getElementById("btn-email-direct").onclick = () => window.location.href = `mailto:${contact.email}`;
  document.getElementById("btn-edit-from-view").onclick = () => window.openEditContactModal(contact.id);
  document.getElementById("btn-delete-from-view").onclick = () => {
    closeModal("contact-details-modal");
    window.promptDeleteContact(contact.id, fullName);
  };

  openModal("contact-details-modal");
};

window.promptDeleteContact = function(id, name) {
  if (confirm(`Are you sure you want to delete "${name}" from your contact book?`)) {
    deleteContactConfirmed(id);
  }
};

async function deleteContactConfirmed(id) {
  const deleted = await contactStorage.delete(id);
  if (deleted) {
    lastDeletedContact = deleted;
    showToast(`Deleted "${deleted.firstName} ${deleted.lastName}".`, "info", async () => {
      // Undo callback
      await contactStorage.create(lastDeletedContact);
      await loadContacts();
      showToast(`Restored "${lastDeletedContact.firstName} ${lastDeletedContact.lastName}"!`, "success");
    });
    await loadContacts();
  }
}

window.copyContactInfo = function() {
  if (!activeContactForAction) return;
  const c = activeContactForAction;
  const text = `${c.firstName} ${c.lastName}\nPhone: ${c.phone}\nEmail: ${c.email}\nCompany: ${c.company || 'N/A'}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Contact details copied to clipboard!", "success");
  }).catch(() => {
    showToast("Failed to copy to clipboard.", "error");
  });
};

/* ==========================================================================
   Modal Helpers
   ========================================================================== */

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
   Data Export Functions
   ========================================================================== */

function exportToJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contactsCache, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `pulse_contacts_${new Date().toISOString().split("T")[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Contacts exported successfully to JSON!", "success");
}

function exportToCSV() {
  if (contactsCache.length === 0) {
    showToast("No contacts to export.", "error");
    return;
  }

  const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Designation", "Category", "Favorite", "Notes"];
  const rows = contactsCache.map(c => [
    `"${(c.firstName || '').replace(/"/g, '""')}"`,
    `"${(c.lastName || '').replace(/"/g, '""')}"`,
    `"${(c.email || '').replace(/"/g, '""')}"`,
    `"${(c.phone || '').replace(/"/g, '""')}"`,
    `"${(c.company || '').replace(/"/g, '""')}"`,
    `"${(c.designation || '').replace(/"/g, '""')}"`,
    `"${(c.category || '').replace(/"/g, '""')}"`,
    c.isFavorite ? "Yes" : "No",
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `pulse_contacts_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showToast("Contacts exported successfully to CSV!", "success");
}

/* ==========================================================================
   DOM Setup & Event Listeners
   ========================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Setup Firebase & Load Contacts
  await setupFirebase();
  await loadContacts();

  // 2. Search input listener
  const searchInput = document.getElementById("contacts-search");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value.trim();
      filterAndRenderContacts();
    });
  }

  // 3. Category Filter Tabs
  document.querySelectorAll(".pill-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".pill-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentCategory = tab.dataset.category;
      filterAndRenderContacts();
    });
  });

  // 4. Sort selection
  const sortSelect = document.getElementById("contacts-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSortBy = e.target.value;
      filterAndRenderContacts();
    });
  }

  // 5. View Mode Toggle (Grid vs Table)
  document.getElementById("btn-view-grid")?.addEventListener("click", () => {
    currentViewMode = "grid";
    document.getElementById("btn-view-grid").classList.add("active");
    document.getElementById("btn-view-table").classList.remove("active");
    filterAndRenderContacts();
  });

  document.getElementById("btn-view-table")?.addEventListener("click", () => {
    currentViewMode = "table";
    document.getElementById("btn-view-table").classList.add("active");
    document.getElementById("btn-view-grid").classList.remove("active");
    filterAndRenderContacts();
  });

  // 6. Add Contact Modal Triggers
  document.getElementById("btn-add-contact-main")?.addEventListener("click", window.openAddContactModal);
  document.getElementById("btn-add-contact-nav")?.addEventListener("click", window.openAddContactModal);
  document.getElementById("btn-close-form-modal")?.addEventListener("click", () => closeModal("contact-form-modal"));
  document.getElementById("btn-cancel-form")?.addEventListener("click", () => closeModal("contact-form-modal"));

  // 7. View Details Modal Triggers
  document.getElementById("btn-close-view-modal")?.addEventListener("click", () => closeModal("contact-details-modal"));
  document.getElementById("btn-copy-contact")?.addEventListener("click", window.copyContactInfo);

  // 8. Contact Form Submit (Add or Edit)
  document.getElementById("contact-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("contact-form-id").value;
    const firstName = document.getElementById("contact-form-first").value.trim();
    const lastName = document.getElementById("contact-form-last").value.trim();
    const email = document.getElementById("contact-form-email").value.trim();
    const phone = document.getElementById("contact-form-phone").value.trim();
    const company = document.getElementById("contact-form-company").value.trim();
    const designation = document.getElementById("contact-form-designation").value.trim();
    const category = document.getElementById("contact-form-category").value;
    const notes = document.getElementById("contact-form-notes").value.trim();
    const isFavorite = document.getElementById("contact-form-favorite").checked;

    if (!firstName) {
      showToast("First name is required.", "error");
      return;
    }

    const payload = {
      firstName,
      lastName,
      email,
      phone,
      company,
      designation,
      category,
      notes,
      isFavorite
    };

    if (id) {
      // Edit existing
      await contactStorage.update(id, payload);
      showToast(`Updated contact details for ${firstName} ${lastName}!`, "success");
    } else {
      // Add new
      await contactStorage.create(payload);
      showToast(`Added ${firstName} ${lastName} to your contacts!`, "success");
    }

    closeModal("contact-form-modal");
    await loadContacts();
  });

  // 9. Export Triggers
  document.getElementById("btn-export-csv")?.addEventListener("click", exportToCSV);
  document.getElementById("btn-export-json")?.addEventListener("click", exportToJSON);

  // 10. Reset Seed Data Trigger
  document.getElementById("btn-reset-contacts")?.addEventListener("click", async () => {
    if (confirm("Reset contact book with sample enterprise contacts?")) {
      await contactStorage.resetSeed();
      await loadContacts();
      showToast("Contacts restored to initial sample dataset.", "info");
    }
  });

  // 11. Theme Switcher
  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      localStorage.setItem("pulse_contacts_theme", isLight ? "light" : "dark");
    });
  }

  if (localStorage.getItem("pulse_contacts_theme") === "light") {
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
