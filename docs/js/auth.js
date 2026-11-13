/**
 * CampusCare - Authentication & Session Management
 * Handles Master Admin First-Time Setup & Lock, Student Login/Signup, and Role-Based Access
 */

const AUTH = {
  currentSession: null, // { role: 'admin'|'student', user: {...} }

  async init() {
    // 1. Check if Master Admin is configured
    await this.verifyAdminSetupStatus();

    // 2. Restore active session if any
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
    if (saved) {
      try {
        this.currentSession = JSON.parse(saved);
        this.updateNavUI();
      } catch (e) {
        this.currentSession = null;
      }
    }

    this.bindEvents();
  },

  /**
   * Checks if admin is setup. If not, prompts setup wizard.
   */
  async verifyAdminSetupStatus() {
    try {
      const res = await API.checkAdminSetup();
      const setupModal = document.getElementById("adminSetupModal");
      const adminNavStatus = document.getElementById("adminSetupNavStatus");

      if (!res.isConfigured) {
        // Master Admin NOT configured yet!
        if (setupModal) {
          setupModal.classList.add("active");
          // Prevent backdrop clicking out
          setupModal.setAttribute("data-force-lock", "true");
        }
        if (adminNavStatus) {
          adminNavStatus.innerHTML = `<span class="badge badge-warning"><i class="fas fa-exclamation-triangle"></i> Admin Setup Pending</span>`;
        }
        return false;
      } else {
        // Admin already locked & set up
        if (setupModal) setupModal.classList.remove("active");
        if (adminNavStatus) {
          adminNavStatus.innerHTML = `<span class="badge badge-success"><i class="fas fa-lock"></i> Master Admin Configured</span>`;
        }
        if (res.collegeName) {
          document.querySelectorAll(".college-name-text").forEach(el => el.textContent = res.collegeName);
        }
        return true;
      }
    } catch (err) {
      console.error("Error verifying admin setup:", err);
      return false;
    }
  },

  bindEvents() {
    // Master Admin Setup Form Submit
    const setupForm = document.getElementById("adminSetupForm");
    if (setupForm) {
      setupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleAdminSetupSubmit();
      });
    }

    // Admin Login Form Submit
    const adminLoginForm = document.getElementById("adminLoginForm");
    if (adminLoginForm) {
      adminLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleAdminLoginSubmit();
      });
    }

    // Student Login Form Submit
    const studentLoginForm = document.getElementById("studentLoginForm");
    if (studentLoginForm) {
      studentLoginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleStudentLoginSubmit();
      });
    }

    // Student Register Form Submit
    const studentRegisterForm = document.getElementById("studentRegisterForm");
    if (studentRegisterForm) {
      studentRegisterForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleStudentRegisterSubmit();
      });
    }

    // Logout
    const logoutBtns = document.querySelectorAll(".btn-logout");
    logoutBtns.forEach(btn => btn.addEventListener("click", () => this.logout()));
  },

  /**
   * Handle first-time admin setup and permanent lock
   */
  async handleAdminSetupSubmit() {
    const collegeName = document.getElementById("setupCollegeName").value.trim();
    const adminName = document.getElementById("setupAdminName").value.trim();
    const email = document.getElementById("setupAdminEmail").value.trim();
    const username = document.getElementById("setupUsername").value.trim();
    const password = document.getElementById("setupPassword").value.trim();
    const confirmPassword = document.getElementById("setupConfirmPassword").value.trim();
    const acknowledgeLock = document.getElementById("setupLockAck").checked;

    if (!acknowledgeLock) {
      UI.toast("Please check the acknowledgment box confirming you understand this setup will be locked permanently.", "warning");
      return;
    }

    if (password !== confirmPassword) {
      UI.toast("Passwords do not match! Please recheck.", "error");
      return;
    }

    if (password.length < 5) {
      UI.toast("Password must be at least 5 characters long for security.", "error");
      return;
    }

    UI.setLoading("adminSetupSubmitBtn", true, "Locking Master Admin...");

    const res = await API.setupAdmin({
      collegeName,
      adminName,
      email,
      username,
      password
    });

    UI.setLoading("adminSetupSubmitBtn", false, "Initialize Master Admin & Lock");

    if (res.status === "success") {
      UI.toast("Master Admin created and locked permanently! Log in now.", "success");
      const setupModal = document.getElementById("adminSetupModal");
      if (setupModal) setupModal.classList.remove("active");
      
      // Auto open Admin login modal
      UI.openModal("adminLoginModal");
      // Update displayed college name
      document.querySelectorAll(".college-name-text").forEach(el => el.textContent = collegeName);
      await this.verifyAdminSetupStatus();
    } else {
      UI.toast(res.message || "Admin setup failed.", "error");
    }
  },

  /**
   * Handle Admin Login
   */
  async handleAdminLoginSubmit() {
    const user = document.getElementById("adminUser").value.trim();
    const pass = document.getElementById("adminPass").value.trim();

    UI.setLoading("adminLoginBtn", true, "Verifying Admin...");
    const res = await API.adminLogin(user, pass);
    UI.setLoading("adminLoginBtn", false, "Sign In to Admin Dashboard");

    if (res.status === "success") {
      this.currentSession = {
        role: "admin",
        user: {
          ...res.admin,
          // keep credentials in session for authorized API calls
          adminUsername: user,
          adminPassword: pass
        }
      };
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(this.currentSession));
      UI.toast(`Welcome back, Administrator ${res.admin.name || ""}!`, "success");
      UI.closeModal("adminLoginModal");
      this.updateNavUI();
      APP.showAdminView();
    } else {
      UI.toast(res.message || "Invalid Admin credentials.", "error");
    }
  },

  /**
   * Handle Student Login
   */
  async handleStudentLoginSubmit() {
    const roll = document.getElementById("studentLoginRoll").value.trim();
    const pass = document.getElementById("studentLoginPass").value.trim();

    UI.setLoading("studentLoginBtn", true, "Signing in...");
    const res = await API.studentLogin(roll, pass);
    UI.setLoading("studentLoginBtn", false, "Login to Portal");

    if (res.status === "success") {
      this.currentSession = {
        role: "student",
        user: res.student
      };
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(this.currentSession));
      UI.toast(`Welcome, ${res.student.fullName}!`, "success");
      UI.closeModal("studentAuthModal");
      this.updateNavUI();
      APP.showStudentView();
    } else {
      UI.toast(res.message || "Login failed. Check roll number/password.", "error");
    }
  },

  /**
   * Handle Student Registration
   */
  async handleStudentRegisterSubmit() {
    const roll = document.getElementById("regRoll").value.trim();
    const fullName = document.getElementById("regFullName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const department = document.getElementById("regDepartment").value;
    const type = document.getElementById("regType").value;
    const pass = document.getElementById("regPassword").value.trim();
    const confirmPass = document.getElementById("regConfirmPass").value.trim();

    if (pass !== confirmPass) {
      UI.toast("Passwords do not match!", "error");
      return;
    }

    UI.setLoading("studentRegisterBtn", true, "Registering Account...");
    const res = await API.studentRegister({
      rollNumber: roll,
      fullName: fullName,
      email: email,
      phone: phone,
      department: department,
      hostelOrDayScholar: type,
      password: pass
    });
    UI.setLoading("studentRegisterBtn", false, "Create Student Account");

    if (res.status === "success") {
      UI.toast("Registration complete! Automatically logging you in...", "success");
      this.currentSession = {
        role: "student",
        user: res.student
      };
      localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(this.currentSession));
      UI.closeModal("studentAuthModal");
      this.updateNavUI();
      APP.showStudentView();
    } else {
      UI.toast(res.message || "Registration failed.", "error");
    }
  },

  logout() {
    this.currentSession = null;
    localStorage.removeItem(CONFIG.STORAGE_KEYS.CURRENT_SESSION);
    this.updateNavUI();
    UI.toast("Logged out successfully.", "info");
    APP.showHomeView();
  },

  updateNavUI() {
    const guestNav = document.getElementById("navGuestActions");
    const userNav = document.getElementById("navUserSession");
    const navUserName = document.getElementById("navUserName");
    const navUserRole = document.getElementById("navUserRole");
    const navUserAvatar = document.getElementById("navUserAvatar");

    if (this.currentSession) {
      if (guestNav) guestNav.style.display = "none";
      if (userNav) userNav.style.display = "flex";

      if (this.currentSession.role === "admin") {
        navUserName.textContent = this.currentSession.user.name || "Administrator";
        navUserRole.textContent = "Master Admin";
        navUserRole.className = "role-pill role-admin";
        navUserAvatar.innerHTML = `<i class="fas fa-user-shield"></i>`;
      } else {
        navUserName.textContent = this.currentSession.user.fullName;
        navUserRole.textContent = `${this.currentSession.user.rollNumber} (${this.currentSession.user.department || "Student"})`;
        navUserRole.className = "role-pill role-student";
        navUserAvatar.innerHTML = `<i class="fas fa-user-graduate"></i>`;
      }
    } else {
      if (guestNav) guestNav.style.display = "flex";
      if (userNav) userNav.style.display = "none";
    }
  },

  isLoggedIn() {
    return !!this.currentSession;
  },

  isAdmin() {
    return this.currentSession && this.currentSession.role === "admin";
  },

  isStudent() {
    return this.currentSession && this.currentSession.role === "student";
  },

  getStudentUser() {
    return this.isStudent() ? this.currentSession.user : null;
  },

  getAdminCredentials() {
    return this.isAdmin() ? {
      adminUsername: this.currentSession.user.adminUsername,
      adminPassword: this.currentSession.user.adminPassword
    } : null;
  }
};
