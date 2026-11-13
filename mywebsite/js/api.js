/**
 * CampusCare - API Service Layer
 * Seamlessly interfaces with Google Apps Script Web App or LocalStorage Mock Engine
 */

const API = {
  /**
   * Universal Dispatcher
   */
  async request(action, payload = {}) {
    payload.action = action;

    if (CONFIG.isLiveBackendConfigured()) {
      try {
        const url = CONFIG.getScriptUrl();
        // Use text/plain to avoid CORS preflight issues with Google Apps Script
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8"
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        return data;
      } catch (err) {
        console.warn("Google Apps Script request failed, falling back to LocalStorage:", err);
        return this.localDispatch(action, payload);
      }
    } else {
      // Use LocalStorage Mock Engine
      return this.localDispatch(action, payload);
    }
  },

  /**
   * Check if Master Admin has been configured & locked
   */
  async checkAdminSetup() {
    return this.request("check_admin_setup");
  },

  /**
   * First-time Master Admin Setup (Locked permanently once created)
   */
  async setupAdmin(data) {
    return this.request("setup_admin", data);
  },

  /**
   * Admin Authentication
   */
  async adminLogin(username, password) {
    return this.request("admin_login", { username, password });
  },

  /**
   * Student Registration
   */
  async studentRegister(data) {
    return this.request("student_register", data);
  },

  /**
   * Student Login
   */
  async studentLogin(rollNumber, password) {
    return this.request("student_login", { rollNumber, password });
  },

  /**
   * Submit New Complaint
   */
  async submitComplaint(complaintData) {
    return this.request("submit_complaint", complaintData);
  },

  /**
   * Fetch complaints for a specific student ONLY (Strict Privacy)
   */
  async getStudentComplaints(rollNumber) {
    return this.request("get_student_complaints", { rollNumber });
  },

  /**
   * Fetch all complaints (Admin Only)
   */
  async getAllComplaints(adminUsername, adminPassword) {
    return this.request("get_all_complaints", { adminUsername, adminPassword });
  },

  /**
   * Update Complaint Status & Remarks (Admin Only)
   */
  async updateComplaintStatus(data) {
    return this.request("update_complaint_status", data);
  },

  // ==========================================
  // LOCAL STORAGE ENGINE (Offline / Demo Mode)
  // ==========================================
  localDispatch(action, payload) {
    return new Promise((resolve) => {
      setTimeout(() => {
        switch (action) {
          case "check_admin_setup":
            resolve(this.localCheckAdminSetup());
            break;
          case "setup_admin":
            resolve(this.localSetupAdmin(payload));
            break;
          case "admin_login":
            resolve(this.localAdminLogin(payload.username, payload.password));
            break;
          case "student_register":
            resolve(this.localStudentRegister(payload));
            break;
          case "student_login":
            resolve(this.localStudentLogin(payload.rollNumber, payload.password));
            break;
          case "submit_complaint":
            resolve(this.localSubmitComplaint(payload));
            break;
          case "get_student_complaints":
            resolve(this.localGetStudentComplaints(payload.rollNumber));
            break;
          case "get_all_complaints":
            resolve(this.localGetAllComplaints(payload.adminUsername, payload.adminPassword));
            break;
          case "update_complaint_status":
            resolve(this.localUpdateComplaintStatus(payload));
            break;
          default:
            resolve({ status: "error", message: "Unknown local action: " + action });
        }
      }, 150); // slight delay to feel realistic
    });
  },

  localCheckAdminSetup() {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_CONFIG);
    if (!raw) {
      return { status: "success", isConfigured: false, collegeName: "" };
    }
    try {
      const config = JSON.parse(raw);
      return {
        status: "success",
        isConfigured: !!(config.isLocked && config.username),
        collegeName: config.collegeName || "CampusCare Institute of Technology"
      };
    } catch (e) {
      return { status: "success", isConfigured: false };
    }
  },

  localSetupAdmin(data) {
    const existing = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_CONFIG);
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed.isLocked) {
          return { status: "error", message: "Master Admin details are locked permanently and cannot be reconfigured." };
        }
      } catch (e) {}
    }

    if (!data.username || !data.password || !data.collegeName) {
      return { status: "error", message: "Please fill in all required Master Admin setup fields." };
    }

    const adminConfig = {
      isLocked: true,
      collegeName: data.collegeName.trim(),
      adminName: data.adminName || "Chief Administrator",
      email: data.email || "",
      username: data.username.trim(),
      password: data.password.trim(),
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(CONFIG.STORAGE_KEYS.ADMIN_CONFIG, JSON.stringify(adminConfig));
    return {
      status: "success",
      message: "Master Admin credentials created and locked successfully!",
      collegeName: adminConfig.collegeName
    };
  },

  localAdminLogin(username, password) {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.ADMIN_CONFIG);
    if (!raw) {
      return { status: "error", message: "Admin is not set up yet. Please complete initial setup." };
    }
    const config = JSON.parse(raw);
    if (config.username === String(username).trim() && config.password === String(password).trim()) {
      return {
        status: "success",
        admin: {
          username: config.username,
          name: config.adminName,
          email: config.email,
          collegeName: config.collegeName
        }
      };
    }
    return { status: "error", message: "Invalid Admin username or password." };
  },

  localStudentRegister(data) {
    if (!data.rollNumber || !data.fullName || !data.password) {
      return { status: "error", message: "Roll number, Name, and Password are required." };
    }

    const roll = String(data.rollNumber).trim().toUpperCase();
    const students = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.STUDENTS) || "[]");

    if (students.some(s => s.rollNumber.toUpperCase() === roll)) {
      return { status: "error", message: "A student with this Roll Number is already registered. Please login." };
    }

    const newStudent = {
      rollNumber: roll,
      fullName: data.fullName.trim(),
      email: data.email || "",
      phone: data.phone || "",
      department: data.department || "General",
      hostelOrDayScholar: data.hostelOrDayScholar || "Hosteller",
      password: data.password.trim(),
      createdAt: new Date().toISOString()
    };

    students.push(newStudent);
    localStorage.setItem(CONFIG.STORAGE_KEYS.STUDENTS, JSON.stringify(students));

    const { password, ...studentSafe } = newStudent;
    return {
      status: "success",
      message: "Registration successful! You can now log in.",
      student: studentSafe
    };
  },

  localStudentLogin(rollNumber, password) {
    const roll = String(rollNumber).trim().toUpperCase();
    const pass = String(password).trim();
    const students = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.STUDENTS) || "[]");

    const found = students.find(s => s.rollNumber.toUpperCase() === roll && s.password === pass);
    if (found) {
      const { password, ...studentSafe } = found;
      return {
        status: "success",
        student: studentSafe
      };
    }
    return { status: "error", message: "Invalid Roll Number or Password." };
  },

  localSubmitComplaint(data) {
    const complaints = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.COMPLAINTS) || "[]");
    const year = new Date().getFullYear();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const ticketId = "CC-" + year + "-" + randomNum;
    const now = new Date().toISOString();

    const newComplaint = {
      ticketId: ticketId,
      timestamp: now,
      studentRollNumber: String(data.studentRollNumber).trim().toUpperCase(),
      studentName: data.studentName || "Anonymous Student",
      category: data.category,
      title: data.title,
      description: data.description,
      locationDetails: data.locationDetails || "",
      urgency: data.urgency || "Medium",
      status: "Pending",
      imageUrl: data.imageBase64 || data.imageUrl || "",
      adminRemarks: "",
      updatedAt: now
    };

    complaints.unshift(newComplaint); // newest first
    localStorage.setItem(CONFIG.STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints));

    return {
      status: "success",
      message: "Complaint submitted successfully!",
      ticketId: ticketId,
      submittedAt: now
    };
  },

  localGetStudentComplaints(rollNumber) {
    const roll = String(rollNumber).trim().toUpperCase();
    const complaints = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.COMPLAINTS) || "[]");
    // STRICT PRIVACY: Filter ONLY this student's complaints
    const filtered = complaints.filter(c => String(c.studentRollNumber).trim().toUpperCase() === roll);
    return {
      status: "success",
      complaints: filtered
    };
  },

  localGetAllComplaints(adminUser, adminPass) {
    const authCheck = this.localAdminLogin(adminUser, adminPass);
    if (authCheck.status !== "success") {
      return { status: "error", message: "Unauthorized: Admin verification failed." };
    }
    const complaints = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.COMPLAINTS) || "[]");
    return {
      status: "success",
      complaints: complaints
    };
  },

  localUpdateComplaintStatus(data) {
    const authCheck = this.localAdminLogin(data.adminUsername, data.adminPassword);
    if (authCheck.status !== "success") {
      return { status: "error", message: "Unauthorized: Admin credentials incorrect." };
    }

    const complaints = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.COMPLAINTS) || "[]");
    const item = complaints.find(c => c.ticketId === data.ticketId);

    if (!item) {
      return { status: "error", message: "Complaint ticket not found." };
    }

    item.status = data.status;
    if (data.adminRemarks !== undefined) {
      item.adminRemarks = data.adminRemarks;
    }
    item.updatedAt = new Date().toISOString();

    localStorage.setItem(CONFIG.STORAGE_KEYS.COMPLAINTS, JSON.stringify(complaints));

    return {
      status: "success",
      message: `Ticket ${data.ticketId} updated to ${data.status}.`,
      updatedAt: item.updatedAt
    };
  }
};
