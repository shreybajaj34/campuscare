/**
 * CampusCare - Configuration
 */
const CONFIG = {
  APP_NAME: "CampusCare",
  TAGLINE: "College Grievance Redressal & Facility Support Portal",
  VERSION: "1.0.0",

  // PASTE YOUR GOOGLE APPS SCRIPT WEB APP URL HERE:
  // e.g. "https://script.google.com/macros/s/AKfycb.../exec"
  DEFAULT_SCRIPT_URL: "",

  // Get active script URL from localStorage (if user configured via UI) or fallback
  getScriptUrl: function() {
    return localStorage.getItem("campuscare_script_url") || this.DEFAULT_SCRIPT_URL;
  },

  setScriptUrl: function(url) {
    if (url) {
      localStorage.setItem("campuscare_script_url", url.trim());
    } else {
      localStorage.removeItem("campuscare_script_url");
    }
  },

  isLiveBackendConfigured: function() {
    const url = this.getScriptUrl();
    return !!(url && url.startsWith("https://script.google.com/macros/s/"));
  },

  // Storage Keys for Offline / LocalStorage Mode
  STORAGE_KEYS: {
    ADMIN_CONFIG: "campuscare_admin_config",
    STUDENTS: "campuscare_students",
    COMPLAINTS: "campuscare_complaints",
    CURRENT_SESSION: "campuscare_current_session"
  },

  // Categories & Sub-Fields
  CATEGORIES: {
    Hostel: {
      name: "Hostel & Accommodation",
      icon: "fa-bed",
      color: "#4f46e5",
      subFields: [
        { id: "hostelBlock", label: "Hostel Block / Name", placeholder: "e.g. Boys Hostel A / Girls Block 3", required: true },
        { id: "roomNumber", label: "Room Number", placeholder: "e.g. Room 204", required: true },
        { id: "issueType", label: "Issue Type", type: "select", options: ["Electricity / Fan / Light", "Plumbing / Water Supply", "Cleanliness & Sanitation", "Furniture / Bed / Wardrobe", "Internet / Wi-Fi Router", "Other"], required: true }
      ]
    },
    Mess: {
      name: "Mess & Cafeteria",
      icon: "fa-utensils",
      color: "#ea580c",
      subFields: [
        { id: "messName", label: "Mess / Canteen Name", placeholder: "e.g. Central Mess / North Wing Canteen", required: true },
        { id: "mealType", label: "Meal Affected", type: "select", options: ["Breakfast", "Lunch", "Evening Snacks", "Dinner", "General Hygiene / Drinking Water"], required: true },
        { id: "issueType", label: "Issue Type", type: "select", options: ["Food Quality / Taste", "Hygiene & Cleanliness", "Insect / Foreign Object Found", "Shortage of Food", "Catering Staff Behavior", "Other"], required: true }
      ]
    },
    Classroom: {
      name: "Classroom & Academics",
      icon: "fa-chalkboard-teacher",
      color: "#0891b2",
      subFields: [
        { id: "academicBlock", label: "Academic Block / Department", placeholder: "e.g. Engineering Block 2 / Science Wing", required: true },
        { id: "roomLabNo", label: "Room / Hall / Lab No.", placeholder: "e.g. LT-3 / Computer Lab 102", required: true },
        { id: "issueType", label: "Issue Type", type: "select", options: ["Projector / Smartboard Defect", "AC / Fans / Lights Not Working", "Broken Benches / Desks", "Mic / Audio System", "Podium / Marker Shortage", "Other"], required: true }
      ]
    },
    Transport: {
      name: "Transport & Bus Facility",
      icon: "fa-bus",
      color: "#d97706",
      subFields: [
        { id: "routeNumber", label: "Bus Route No. / Name", placeholder: "e.g. Route 14 (City Center)", required: true },
        { id: "busNumber", label: "Bus Vehicle No.", placeholder: "e.g. DL-1P-4521 (or leave blank if unsure)", required: false },
        { id: "issueType", label: "Issue Type", type: "select", options: ["Bus Delayed / Skipped Stop", "Heavy Overcrowding", "Rash Driving / Driver Behavior", "AC / Window / Seat Issue", "Emergency Breakdown", "Other"], required: true }
      ]
    },
    CampusInfra: {
      name: "Campus Infrastructure & Wi-Fi",
      icon: "fa-wifi",
      color: "#7c3aed",
      subFields: [
        { id: "location", label: "Specific Campus Location", placeholder: "e.g. Near Central Library / Sports Ground", required: true },
        { id: "issueType", label: "Issue Type", type: "select", options: ["Campus Wi-Fi Connectivity", "Street Light / Pathway Darkness", "Water Dispenser Defect", "Restroom / Washroom Issue", "Garden / Ground Maintenance", "Security / Guard Assistance", "Other"], required: true }
      ]
    }
  },

  STATUS_FLOW: ["Pending", "Under Review", "In Progress", "Resolved", "Rejected"],

  STATUS_BADGES: {
    "Pending": { label: "Pending Review", class: "badge-pending", icon: "fa-clock" },
    "Under Review": { label: "Under Review", class: "badge-review", icon: "fa-search" },
    "In Progress": { label: "In Progress", class: "badge-progress", icon: "fa-tools" },
    "Resolved": { label: "Resolved", class: "badge-resolved", icon: "fa-check-circle" },
    "Rejected": { label: "Declined", class: "badge-rejected", icon: "fa-times-circle" }
  },

  URGENCY_LEVELS: {
    "Low": { label: "Low Priority", class: "urgency-low" },
    "Medium": { label: "Medium Priority", class: "urgency-medium" },
    "High": { label: "High Priority", class: "urgency-high" },
    "Emergency": { label: "Emergency / Immediate Action", class: "urgency-emergency" }
  }
};
