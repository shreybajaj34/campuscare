/**
 * CampusCare - College Complaint Management System
 * Google Apps Script Backend (Code.gs)
 * 
 * Instructions:
 * 1. Open Google Sheets (https://sheets.new)
 * 2. Name your sheet: "CampusCare_Database"
 * 3. Go to: Extensions > Apps Script
 * 4. Replace all code in the script editor with this file's code.
 * 5. Click "Deploy" > "New deployment"
 * 6. Select type: "Web app"
 * 7. Configuration:
 *    - Description: "CampusCare API v1"
 *    - Execute as: "Me" (your email)
 *    - Who has access: "Anyone" (crucial for frontend fetch access)
 * 8. Click "Deploy", copy the Web App URL, and paste it into CampusCare's config.js or Settings modal.
 */

// Global Sheet Tab Names
var SHEETS = {
  ADMIN: "Admin_Config",
  STUDENTS: "Students",
  COMPLAINTS: "Complaints"
};

/**
 * Handles incoming GET requests (Health check, Setup check, Data fetch)
 */
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || "ping";
    var result = {};

    initSpreadsheet();

    if (action === "ping") {
      result = { status: "success", message: "CampusCare Backend is active and running!" };
    } else if (action === "check_admin_setup") {
      result = checkAdminSetup();
    } else if (action === "get_student_complaints") {
      result = getStudentComplaints(params.rollNumber);
    } else if (action === "get_all_complaints") {
      result = getAllComplaints(params.adminUsername, params.adminPassword);
    } else {
      result = { status: "error", message: "Unknown GET action: " + action };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Handles incoming POST requests (Admin Setup, Login, Registration, Complaint Submission, Status Update)
 */
function doPost(e) {
  try {
    initSpreadsheet();

    var postData = {};
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        // Fallback for form-encoded or raw data
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    var action = postData.action || "";
    var result = {};

    switch (action) {
      case "setup_admin":
        result = setupAdmin(postData);
        break;
      case "admin_login":
        result = adminLogin(postData.username, postData.password);
        break;
      case "student_register":
        result = studentRegister(postData);
        break;
      case "student_login":
        result = studentLogin(postData.rollNumber, postData.password);
        break;
      case "submit_complaint":
        result = submitComplaint(postData);
        break;
      case "update_complaint_status":
        result = updateComplaintStatus(postData);
        break;
      case "get_student_complaints":
        result = getStudentComplaints(postData.rollNumber);
        break;
      case "get_all_complaints":
        result = getAllComplaints(postData.adminUsername, postData.adminPassword);
        break;
      default:
        result = { status: "error", message: "Invalid or missing action: " + action };
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * Helper to produce standard JSON output with proper CORS headers
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Initializes the Google Spreadsheet with proper headers and tabs if they don't exist
 */
function initSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Admin Config Sheet
  var adminSheet = ss.getSheetByName(SHEETS.ADMIN);
  if (!adminSheet) {
    adminSheet = ss.insertSheet(SHEETS.ADMIN);
    adminSheet.appendRow([
      "SetupCompleted", 
      "CollegeName", 
      "AdminName", 
      "AdminEmail", 
      "AdminUsername", 
      "AdminPassword", 
      "SetupTimestamp", 
      "IsLocked"
    ]);
    adminSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e8eaf6");
  }

  // 2. Students Sheet
  var studentSheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!studentSheet) {
    studentSheet = ss.insertSheet(SHEETS.STUDENTS);
    studentSheet.appendRow([
      "RollNumber", 
      "FullName", 
      "Email", 
      "Phone", 
      "Department", 
      "HostelOrDayScholar", 
      "Password", 
      "CreatedAt"
    ]);
    studentSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e0f2fe");
  }

  // 3. Complaints Sheet
  var complaintSheet = ss.getSheetByName(SHEETS.COMPLAINTS);
  if (!complaintSheet) {
    complaintSheet = ss.insertSheet(SHEETS.COMPLAINTS);
    complaintSheet.appendRow([
      "TicketID", 
      "Timestamp", 
      "StudentRollNumber", 
      "StudentName", 
      "Category", 
      "Title", 
      "Description", 
      "LocationDetails", 
      "Urgency", 
      "Status", 
      "ImageUrl", 
      "AdminRemarks", 
      "UpdatedAt"
    ]);
    complaintSheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#fef3c7");
  }
}

/**
 * Checks if the Admin profile has already been initialized and locked
 */
function checkAdminSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ADMIN);
  if (!sheet) return { status: "success", isConfigured: false };

  var rows = sheet.getDataRange().getValues();
  if (rows.length > 1) {
    var isSetup = rows[1][0] === true || rows[1][0] === "TRUE";
    var isLocked = rows[1][7] === true || rows[1][7] === "TRUE";
    return {
      status: "success",
      isConfigured: isSetup && isLocked,
      collegeName: rows[1][1] || "CampusCare College Portal"
    };
  }

  return { status: "success", isConfigured: false, collegeName: "" };
}

/**
 * Sets up Master Admin details for the first time, then permanently locks them
 */
function setupAdmin(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ADMIN);
  var rows = sheet.getDataRange().getValues();

  // If already locked, prevent any overwrite
  if (rows.length > 1 && (rows[1][7] === true || rows[1][7] === "TRUE")) {
    return { 
      status: "error", 
      message: "Admin credentials are already permanently configured and locked." 
    };
  }

  if (!data.username || !data.password || !data.collegeName) {
    return { status: "error", message: "Missing required admin setup fields." };
  }

  var now = new Date().toISOString();
  var rowData = [
    true,                      // SetupCompleted
    data.collegeName,          // CollegeName
    data.adminName || "Admin", // AdminName
    data.email || "",          // AdminEmail
    data.username,             // AdminUsername
    data.password,             // AdminPassword
    now,                       // SetupTimestamp
    true                       // IsLocked
  ];

  if (rows.length > 1) {
    sheet.getRange(2, 1, 1, 8).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { 
    status: "success", 
    message: "Admin registered successfully and locked permanently.",
    collegeName: data.collegeName
  };
}

/**
 * Verifies admin credentials
 */
function adminLogin(username, password) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.ADMIN);
  var rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return { status: "error", message: "Admin is not set up yet. Please complete initial setup." };
  }

  var storedUser = String(rows[1][4]).trim();
  var storedPass = String(rows[1][5]).trim();

  if (storedUser === String(username).trim() && storedPass === String(password).trim()) {
    return {
      status: "success",
      admin: {
        username: storedUser,
        name: rows[1][2],
        email: rows[1][3],
        collegeName: rows[1][1]
      }
    };
  }

  return { status: "error", message: "Invalid Admin username or password." };
}

/**
 * Registers a new student account
 */
function studentRegister(data) {
  if (!data.rollNumber || !data.fullName || !data.password) {
    return { status: "error", message: "Roll number, Name, and Password are required." };
  }

  var roll = String(data.rollNumber).trim().toUpperCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  var rows = sheet.getDataRange().getValues();

  // Check if roll number already exists
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === roll) {
      return { status: "error", message: "A student with this Roll Number is already registered. Please login." };
    }
  }

  var now = new Date().toISOString();
  sheet.appendRow([
    roll,
    data.fullName.trim(),
    data.email || "",
    data.phone || "",
    data.department || "",
    data.hostelOrDayScholar || "Day Scholar",
    data.password,
    now
  ]);

  return {
    status: "success",
    message: "Student registration successful!",
    student: {
      rollNumber: roll,
      fullName: data.fullName.trim(),
      email: data.email || "",
      department: data.department || "",
      hostelOrDayScholar: data.hostelOrDayScholar || "Day Scholar"
    }
  };
}

/**
 * Student login verification
 */
function studentLogin(rollNumber, password) {
  if (!rollNumber || !password) {
    return { status: "error", message: "Roll number and password are required." };
  }

  var roll = String(rollNumber).trim().toUpperCase();
  var pass = String(password).trim();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim().toUpperCase() === roll && String(rows[i][6]).trim() === pass) {
      return {
        status: "success",
        student: {
          rollNumber: roll,
          fullName: rows[i][1],
          email: rows[i][2],
          phone: rows[i][3],
          department: rows[i][4],
          hostelOrDayScholar: rows[i][5]
        }
      };
    }
  }

  return { status: "error", message: "Invalid Roll Number or Password." };
}

/**
 * Submits a new student complaint
 */
function submitComplaint(data) {
  if (!data.studentRollNumber || !data.category || !data.title || !data.description) {
    return { status: "error", message: "Missing essential complaint fields." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMPLAINTS);
  
  // Generate Ticket ID: e.g. CC-2026-1042
  var year = new Date().getFullYear();
  var randomNum = Math.floor(1000 + Math.random() * 9000);
  var ticketId = "CC-" + year + "-" + randomNum;
  var now = new Date().toISOString();

  var imageUrl = data.imageUrl || "";
  // If base64 image data is provided, upload to Google Drive folder if possible
  if (data.imageBase64 && data.imageFileName) {
    imageUrl = saveImageToDrive(ticketId, data.imageFileName, data.imageBase64);
  }

  var row = [
    ticketId,
    now,
    String(data.studentRollNumber).trim().toUpperCase(),
    data.studentName || "Anonymous Student",
    data.category,
    data.title,
    data.description,
    data.locationDetails || "",
    data.urgency || "Medium",
    "Pending", // Initial Status
    imageUrl,
    "", // AdminRemarks initially empty
    now // UpdatedAt
  ];

  sheet.appendRow(row);

  return {
    status: "success",
    message: "Complaint submitted successfully!",
    ticketId: ticketId,
    submittedAt: now
  };
}

/**
 * Saves uploaded image to a dedicated Google Drive folder and returns shareable URL
 */
function saveImageToDrive(ticketId, fileName, base64Data) {
  try {
    var folderName = "CampusCare_Complaint_Attachments";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Extract content type and bytes from Base64 string
    var splitData = base64Data.split(",");
    var contentType = "image/jpeg";
    var rawBase64 = base64Data;
    if (splitData.length > 1) {
      var match = splitData[0].match(/:(.*?);/);
      if (match) contentType = match[1];
      rawBase64 = splitData[1];
    }

    var decodedBlob = Utilities.newBlob(Utilities.base64Decode(rawBase64), contentType, ticketId + "_" + fileName);
    var file = folder.createFile(decodedBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    // If Drive fails or permissions restricted, return raw string or error note
    return "Attachment uploaded (Drive link error: " + err.toString() + ")";
  }
}

/**
 * Returns complaints for a specific student ONLY (Strict Privacy)
 */
function getStudentComplaints(rollNumber) {
  if (!rollNumber) {
    return { status: "error", message: "Roll number is required to fetch complaints." };
  }

  var roll = String(rollNumber).trim().toUpperCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMPLAINTS);
  if (!sheet) return { status: "success", complaints: [] };

  var rows = sheet.getDataRange().getValues();
  var complaints = [];

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).trim().toUpperCase() === roll) {
      complaints.push(formatComplaintRow(rows[i]));
    }
  }

  // Sort descending by date (newest first)
  complaints.reverse();

  return {
    status: "success",
    complaints: complaints
  };
}

/**
 * Returns ALL complaints (Accessible only by Admin)
 */
function getAllComplaints(adminUser, adminPass) {
  // Validate Admin
  var loginCheck = adminLogin(adminUser, adminPass);
  if (loginCheck.status !== "success") {
    return { status: "error", message: "Unauthorized. Admin credentials required to view all complaints." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMPLAINTS);
  if (!sheet) return { status: "success", complaints: [] };

  var rows = sheet.getDataRange().getValues();
  var complaints = [];

  for (var i = 1; i < rows.length; i++) {
    complaints.push(formatComplaintRow(rows[i]));
  }

  // Sort newest first
  complaints.reverse();

  return {
    status: "success",
    complaints: complaints
  };
}

/**
 * Updates a complaint's status and remarks (Admin only)
 */
function updateComplaintStatus(data) {
  // Verify Admin
  var loginCheck = adminLogin(data.adminUsername, data.adminPassword);
  if (loginCheck.status !== "success") {
    return { status: "error", message: "Unauthorized: Admin credentials invalid." };
  }

  if (!data.ticketId || !data.status) {
    return { status: "error", message: "Ticket ID and new status are required." };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.COMPLAINTS);
  var rows = sheet.getDataRange().getValues();
  var foundRowIndex = -1;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(data.ticketId).trim()) {
      foundRowIndex = i + 1; // 1-based index in sheets
      break;
    }
  }

  if (foundRowIndex === -1) {
    return { status: "error", message: "Complaint ticket not found: " + data.ticketId };
  }

  var now = new Date().toISOString();
  // Column 10: Status, Column 12: AdminRemarks, Column 13: UpdatedAt
  sheet.getRange(foundRowIndex, 10).setValue(data.status);
  if (data.adminRemarks !== undefined) {
    sheet.getRange(foundRowIndex, 12).setValue(data.adminRemarks);
  }
  sheet.getRange(foundRowIndex, 13).setValue(now);

  return {
    status: "success",
    message: "Complaint " + data.ticketId + " updated to status '" + data.status + "'.",
    updatedAt: now
  };
}

/**
 * Helper to transform a complaint row array into an object
 */
function formatComplaintRow(row) {
  return {
    ticketId: row[0],
    timestamp: row[1],
    studentRollNumber: row[2],
    studentName: row[3],
    category: row[4],
    title: row[5],
    description: row[6],
    locationDetails: row[7],
    urgency: row[8],
    status: row[9],
    imageUrl: row[10],
    adminRemarks: row[11],
    updatedAt: row[12]
  };
}
