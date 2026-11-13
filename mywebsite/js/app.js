/**
 * CampusCare - Main Application Controller & UI Helpers
 */

const UI = {
  toast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle"
    };

    const toast = document.createElement("div");
    toast.className = `toast-item toast-${type} animate-slide-in`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("toast-fade-out");
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("active");
      document.body.classList.add("modal-open");
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modal.getAttribute("data-force-lock") === "true") {
        UI.toast("Please complete the required setup first.", "warning");
        return;
      }
      modal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }
  },

  setLoading(buttonId, isLoading, text) {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute("data-orig-text", btn.innerHTML);
      btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${text || 'Processing...'}`;
    } else {
      btn.disabled = false;
      btn.innerHTML = text || btn.getAttribute("data-orig-text") || 'Submit';
    }
  }
};

const APP = {
  async init() {
    console.log("Initializing CampusCare Portal...");

    // Seed helpful initial demo complaints if in demo mode and clean
    this.seedDemoDataIfEmpty();

    // Setup global modal dismissals
    document.querySelectorAll(".modal-backdrop, .modal-close-btn").forEach(el => {
      el.addEventListener("click", (e) => {
        const modal = el.closest(".modal-wrapper");
        if (modal) {
          if (modal.getAttribute("data-force-lock") === "true") {
            UI.toast("First-time setup must be completed.", "warning");
            return;
          }
          modal.classList.remove("active");
          document.body.classList.remove("modal-open");
        }
      });
    });

    // Close on Escape key (unless locked)
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const openModals = document.querySelectorAll(".modal-wrapper.active");
        openModals.forEach(modal => {
          if (modal.getAttribute("data-force-lock") !== "true") {
            modal.classList.remove("active");
            document.body.classList.remove("modal-open");
          }
        });
      }
    });

    // Navigation View Switching
    document.querySelectorAll("[data-navigate]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const targetView = btn.getAttribute("data-navigate");
        this.navigateTo(targetView);
      });
    });

    // Connect Google Sheet settings button
    const settingsBtn = document.getElementById("openSheetSettingsBtn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.openGoogleSheetSettings());
    }

    // Google Sheet URL Save Form
    const sheetConfigForm = document.getElementById("sheetConfigForm");
    if (sheetConfigForm) {
      sheetConfigForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveGoogleSheetConfig();
      });
    }

    // Test Sheet Connection button
    const testSheetBtn = document.getElementById("testSheetConnectionBtn");
    if (testSheetBtn) {
      testSheetBtn.addEventListener("click", () => this.testGoogleSheetConnection());
    }

    // Initialize Subsystems
    await AUTH.init();
    STUDENT.init();
    
    // Check which view to display
    if (AUTH.isAdmin()) {
      this.showAdminView();
    } else if (AUTH.isStudent()) {
      this.showStudentView();
    } else {
      this.showHomeView();
    }

    this.updateBackendConnectionBadge();
  },

  navigateTo(viewName) {
    if (viewName === "student") {
      if (AUTH.isStudent()) {
        this.showStudentView();
      } else {
        UI.openModal("studentAuthModal");
      }
    } else if (viewName === "admin") {
      if (AUTH.isAdmin()) {
        this.showAdminView();
      } else {
        UI.openModal("adminLoginModal");
      }
    } else if (viewName === "home") {
      this.showHomeView();
    }
  },

  showHomeView() {
    document.getElementById("viewHome").style.display = "block";
    document.getElementById("viewStudent").style.display = "none";
    document.getElementById("viewAdmin").style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async showStudentView() {
    if (!AUTH.isStudent()) {
      UI.openModal("studentAuthModal");
      return;
    }
    document.getElementById("viewHome").style.display = "none";
    document.getElementById("viewStudent").style.display = "block";
    document.getElementById("viewAdmin").style.display = "none";
    
    const user = AUTH.getStudentUser();
    document.getElementById("studentWelcomeName").textContent = user.fullName;
    document.getElementById("studentWelcomeRoll").textContent = user.rollNumber;
    document.getElementById("studentWelcomeDept").textContent = user.department || "Student";
    
    await STUDENT.loadMyComplaints();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async showAdminView() {
    if (!AUTH.isAdmin()) {
      UI.openModal("adminLoginModal");
      return;
    }
    document.getElementById("viewHome").style.display = "none";
    document.getElementById("viewStudent").style.display = "none";
    document.getElementById("viewAdmin").style.display = "block";
    
    await ADMIN.init();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  openGoogleSheetSettings() {
    const input = document.getElementById("sheetUrlInput");
    if (input) input.value = CONFIG.getScriptUrl();
    UI.openModal("sheetSettingsModal");
  },

  saveGoogleSheetConfig() {
    const input = document.getElementById("sheetUrlInput");
    const val = input.value.trim();
    CONFIG.setScriptUrl(val);
    UI.toast("Google Sheets Web App URL updated successfully!", "success");
    UI.closeModal("sheetSettingsModal");
    this.updateBackendConnectionBadge();
  },

  async testGoogleSheetConnection() {
    const input = document.getElementById("sheetUrlInput");
    const url = input.value.trim();

    if (!url) {
      UI.toast("Please enter a Google Apps Script Web App URL first.", "warning");
      return;
    }

    UI.setLoading("testSheetConnectionBtn", true, "Testing...");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "check_admin_setup" })
      });
      const data = await response.json();
      UI.setLoading("testSheetConnectionBtn", false, '<i class="fas fa-plug"></i> Test Connection');

      if (data && data.status === "success") {
        UI.toast("Success! Google Sheet backend is connected & responding.", "success");
      } else {
        UI.toast("Received response from Sheet, but returned status: " + (data.message || "Unknown"), "info");
      }
    } catch (e) {
      UI.setLoading("testSheetConnectionBtn", false, '<i class="fas fa-plug"></i> Test Connection');
      UI.toast("Connection test failed. Check if Web App is deployed with 'Who has access: Anyone'.", "error");
    }
  },

  updateBackendConnectionBadge() {
    const badge = document.getElementById("backendStatusBadge");
    if (!badge) return;

    if (CONFIG.isLiveBackendConfigured()) {
      badge.className = "backend-pill live";
      badge.innerHTML = `<span class="dot"></span> <span>Google Sheets: Live</span>`;
      badge.title = "Connected to Google Apps Script Web App";
    } else {
      badge.className = "backend-pill local";
      badge.innerHTML = `<span class="dot"></span> <span>Storage: Browser / Ready for Sheet</span>`;
      badge.title = "Click to connect Google Sheets Web App";
    }
  },

  seedDemoDataIfEmpty() {
    // Only seed sample complaints if completely clean
    const existingComplaints = localStorage.getItem(CONFIG.STORAGE_KEYS.COMPLAINTS);
    if (!existingComplaints) {
      const sampleComplaints = [
        {
          ticketId: "CC-2026-1042",
          timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
          studentRollNumber: "23CS101",
          studentName: "Rahul Sharma",
          category: "Hostel",
          title: "Geyser not working in 2nd Floor Washroom",
          description: "The water geyser in B-Block 2nd floor bathroom has stopped heating water since yesterday morning. It is causing extreme inconvenience during winter.",
          locationDetails: "Hostel Block / Name: Boys Hostel B | Room Number: Room 214 | Issue Type: Plumbing / Water Supply",
          urgency: "High",
          status: "In Progress",
          imageUrl: "",
          adminRemarks: "Maintenance team dispatched. Electrician is replacing the heating element today by 4 PM.",
          updatedAt: new Date(Date.now() - 3600000 * 6).toISOString()
        },
        {
          ticketId: "CC-2026-1088",
          timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
          studentRollNumber: "23EC204",
          studentName: "Priya Patel",
          category: "Mess",
          title: "Dinner food quality and cold chapatis served",
          description: "Food was served completely cold at 8:30 PM in Girls Hostel Mess. Chapatis were uncooked and vegetables had excessive oil.",
          locationDetails: "Mess / Canteen Name: Girls Central Mess | Meal Affected: Dinner | Issue Type: Food Quality / Taste",
          urgency: "Medium",
          status: "Resolved",
          imageUrl: "",
          adminRemarks: "Spoke with Mess Vendor Manager Mr. Saxena. Fresh warmer installed and kitchen supervisor penalized for cold serving.",
          updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
        },
        {
          ticketId: "CC-2026-1120",
          timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
          studentRollNumber: "24IT055",
          studentName: "Amit Verma",
          category: "Classroom",
          title: "Projector lamp flickering in LT-2 Hall",
          description: "The ceiling projector in Lecture Theatre 2 flickers continuously, making presentations completely unreadable during Data Structures class.",
          locationDetails: "Academic Block / Department: Academic Block 1 | Room / Hall / Lab No.: LT-2 | Issue Type: Projector / Smartboard Defect",
          urgency: "High",
          status: "Under Review",
          imageUrl: "",
          adminRemarks: "IT AV technician has been notified to inspect LT-2.",
          updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          ticketId: "CC-2026-1145",
          timestamp: new Date(Date.now() - 3600000 * 1).toISOString(),
          studentRollNumber: "23CS101",
          studentName: "Rahul Sharma",
          category: "Transport",
          title: "Bus Route 12 missed college gate stop",
          description: "Morning Bus Route 12 arrived 20 minutes late and did not stop at Metro Station gate, leaving 15 students stranded.",
          locationDetails: "Bus Route No. / Name: Route 12 (City Metro) | Bus Vehicle No.: DL-1P-9021 | Issue Type: Bus Delayed / Skipped Stop",
          urgency: "Emergency",
          status: "Pending",
          imageUrl: "",
          adminRemarks: "",
          updatedAt: new Date().toISOString()
        }
      ];

      localStorage.setItem(CONFIG.STORAGE_KEYS.COMPLAINTS, JSON.stringify(sampleComplaints));
    }

    // Seed sample student if empty
    const existingStudents = localStorage.getItem(CONFIG.STORAGE_KEYS.STUDENTS);
    if (!existingStudents) {
      const sampleStudents = [
        {
          rollNumber: "23CS101",
          fullName: "Rahul Sharma",
          email: "rahul.sharma@campus.edu",
          phone: "9876543210",
          department: "Computer Science",
          hostelOrDayScholar: "Hosteller",
          password: "student123",
          createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem(CONFIG.STORAGE_KEYS.STUDENTS, JSON.stringify(sampleStudents));
    }
  }
};

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  APP.init();
});
