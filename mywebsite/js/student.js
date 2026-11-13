/**
 * CampusCare - Student Dashboard & Complaint Management
 * Strictly enforces student privacy (only current student's complaints are fetched and rendered)
 */

const STUDENT = {
  currentCategory: "Hostel",
  currentUrgency: "Medium",
  uploadedImageBase64: "",
  uploadedImageFileName: "",
  complaintsCache: [],

  init() {
    this.renderCategoryOptions();
    this.setupSubFields("Hostel");
    this.bindEvents();
  },

  bindEvents() {
    // Urgency buttons
    document.querySelectorAll(".urgency-option").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".urgency-option").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        this.currentUrgency = btn.getAttribute("data-urgency");
      });
    });

    // Image file upload
    const fileInput = document.getElementById("complaintImageFile");
    const dropZone = document.getElementById("imageDropZone");

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleImageFile(e.target.files[0]);
        }
      });
    }

    // Click on drop zone opens file picker
    if (dropZone) {
      dropZone.addEventListener("click", () => {
        if (fileInput) fileInput.click();
      });
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-hover");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("drag-hover");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-hover");
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          this.handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Image remove
    const removeImgBtn = document.getElementById("removeImageBtn");
    if (removeImgBtn) {
      removeImgBtn.addEventListener("click", () => this.clearImage());
    }

    // Complaint Form Submission
    const complaintForm = document.getElementById("newComplaintForm");
    if (complaintForm) {
      complaintForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleComplaintSubmit();
      });
    }

    // Filter changes in student tracking view
    const filterStatus = document.getElementById("studentFilterStatus");
    const filterCat = document.getElementById("studentFilterCategory");
    const searchInput = document.getElementById("studentSearchTicket");

    if (filterStatus) filterStatus.addEventListener("change", () => this.filterAndRenderComplaints());
    if (filterCat) filterCat.addEventListener("change", () => this.filterAndRenderComplaints());
    if (searchInput) searchInput.addEventListener("input", () => this.filterAndRenderComplaints());
  },

  renderCategoryOptions() {
    const container = document.getElementById("categoryCardsContainer");
    if (!container) return;

    container.innerHTML = "";
    Object.keys(CONFIG.CATEGORIES).forEach(key => {
      const cat = CONFIG.CATEGORIES[key];
      const isSelected = key === this.currentCategory;
      const card = document.createElement("div");
      card.className = `category-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute("data-category", key);
      card.innerHTML = `
        <div class="cat-icon" style="color: ${cat.color}; background-color: ${cat.color}18;">
          <i class="fas ${cat.icon}"></i>
        </div>
        <div class="cat-info">
          <h4>${cat.name}</h4>
          <span class="cat-sub">${cat.subFields.length} specific fields</span>
        </div>
      `;

      card.addEventListener("click", () => {
        document.querySelectorAll(".category-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        this.currentCategory = key;
        this.setupSubFields(key);
      });

      container.appendChild(card);
    });
  },

  setupSubFields(categoryKey) {
    const container = document.getElementById("categorySubFieldsContainer");
    if (!container) return;

    const cat = CONFIG.CATEGORIES[categoryKey];
    if (!cat) return;

    let html = `<div class="subfields-grid">`;
    cat.subFields.forEach(field => {
      html += `
        <div class="form-group">
          <label for="subfield_${field.id}">${field.label} ${field.required ? '<span class="req">*</span>' : ''}</label>
      `;

      if (field.type === "select") {
        html += `<select id="subfield_${field.id}" class="form-control" ${field.required ? 'required' : ''}>
          <option value="">-- Select ${field.label} --</option>
          ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join("")}
        </select>`;
      } else {
        html += `<input type="text" id="subfield_${field.id}" class="form-control" placeholder="${field.placeholder}" ${field.required ? 'required' : ''}>`;
      }

      html += `</div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
  },

  handleImageFile(file) {
    if (!file.type.startsWith("image/")) {
      UI.toast("Please upload a valid image file (JPG, PNG, WEBP).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      UI.toast("Image size exceeds 5MB limit. Please choose a smaller photo.", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.uploadedImageBase64 = e.target.result;
      this.uploadedImageFileName = file.name;

      const previewContainer = document.getElementById("imagePreviewContainer");
      const previewImg = document.getElementById("imagePreviewImg");
      const previewMeta = document.getElementById("imagePreviewMeta");
      const dropZone = document.getElementById("imageDropZone");

      if (previewImg) previewImg.src = e.target.result;
      if (previewMeta) previewMeta.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      if (previewContainer) previewContainer.style.display = "flex";
      if (dropZone) dropZone.style.display = "none";
    };
    reader.readAsDataURL(file);
  },

  clearImage() {
    this.uploadedImageBase64 = "";
    this.uploadedImageFileName = "";

    const fileInput = document.getElementById("complaintImageFile");
    if (fileInput) fileInput.value = "";

    const previewContainer = document.getElementById("imagePreviewContainer");
    const dropZone = document.getElementById("imageDropZone");

    if (previewContainer) previewContainer.style.display = "none";
    if (dropZone) dropZone.style.display = "flex";
  },

  async handleComplaintSubmit() {
    if (!AUTH.isStudent()) {
      UI.toast("Please log in as a student to lodge a complaint.", "warning");
      UI.openModal("studentAuthModal");
      return;
    }

    const student = AUTH.getStudentUser();
    const title = document.getElementById("complaintTitle").value.trim();
    const description = document.getElementById("complaintDescription").value.trim();

    // Compile dynamic subfields
    const cat = CONFIG.CATEGORIES[this.currentCategory];
    const subfieldDetails = [];
    let hasMissingRequired = false;

    cat.subFields.forEach(field => {
      const el = document.getElementById(`subfield_${field.id}`);
      const val = el ? el.value.trim() : "";
      if (field.required && !val) {
        hasMissingRequired = true;
      }
      if (val) {
        subfieldDetails.push(`${field.label}: ${val}`);
      }
    });

    if (hasMissingRequired) {
      UI.toast("Please fill in all required category specific details.", "warning");
      return;
    }

    UI.setLoading("submitComplaintBtn", true, "Submitting Complaint...");

    const payload = {
      studentRollNumber: student.rollNumber,
      studentName: student.fullName,
      category: this.currentCategory,
      title: title,
      description: description,
      locationDetails: subfieldDetails.join(" | "),
      urgency: this.currentUrgency,
      imageBase64: this.uploadedImageBase64,
      imageFileName: this.uploadedImageFileName
    };

    const res = await API.submitComplaint(payload);
    UI.setLoading("submitComplaintBtn", false, '<i class="fas fa-paper-plane"></i> Submit Grievance');

    if (res.status === "success") {
      // Clear form
      document.getElementById("newComplaintForm").reset();
      this.clearImage();
      this.setupSubFields(this.currentCategory);

      // Show Success Modal with Ticket ID
      this.showSubmissionSuccess(res.ticketId);

      // Refresh complaints list
      await this.loadMyComplaints();
    } else {
      UI.toast(res.message || "Failed to submit complaint.", "error");
    }
  },

  showSubmissionSuccess(ticketId) {
    const modal = document.getElementById("complaintSuccessModal");
    const ticketSpan = document.getElementById("successTicketId");
    if (ticketSpan) ticketSpan.textContent = ticketId;
    UI.openModal("complaintSuccessModal");
  },

  async loadMyComplaints() {
    if (!AUTH.isStudent()) return;
    const student = AUTH.getStudentUser();

    const listContainer = document.getElementById("studentComplaintsList");
    if (listContainer) {
      listContainer.innerHTML = `<div class="loading-state"><i class="fas fa-circle-notch fa-spin"></i> Loading your complaints securely...</div>`;
    }

    try {
      const res = await API.getStudentComplaints(student.rollNumber);
      if (res.status === "success") {
        this.complaintsCache = res.complaints || [];
        this.filterAndRenderComplaints();
        this.updateStudentStats();
      } else {
        if (listContainer) {
          listContainer.innerHTML = `<div class="empty-state text-error"><i class="fas fa-exclamation-circle"></i> ${res.message}</div>`;
        }
      }
    } catch (err) {
      console.error(err);
      if (listContainer) {
        listContainer.innerHTML = `<div class="empty-state text-error"><i class="fas fa-exclamation-circle"></i> Error loading complaints.</div>`;
      }
    }
  },

  updateStudentStats() {
    const total = this.complaintsCache.length;
    const pending = this.complaintsCache.filter(c => c.status === "Pending" || c.status === "Under Review").length;
    const inProgress = this.complaintsCache.filter(c => c.status === "In Progress").length;
    const resolved = this.complaintsCache.filter(c => c.status === "Resolved").length;

    const elTotal = document.getElementById("studentStatTotal");
    const elPending = document.getElementById("studentStatPending");
    const elProgress = document.getElementById("studentStatProgress");
    const elResolved = document.getElementById("studentStatResolved");

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elProgress) elProgress.textContent = inProgress;
    if (elResolved) elResolved.textContent = resolved;
  },

  filterAndRenderComplaints() {
    const listContainer = document.getElementById("studentComplaintsList");
    if (!listContainer) return;

    const filterStatus = document.getElementById("studentFilterStatus").value;
    const filterCat = document.getElementById("studentFilterCategory").value;
    const search = document.getElementById("studentSearchTicket").value.trim().toLowerCase();

    let list = this.complaintsCache;

    if (filterStatus) {
      list = list.filter(c => c.status === filterStatus);
    }

    if (filterCat) {
      list = list.filter(c => c.category === filterCat);
    }

    if (search) {
      list = list.filter(c => 
        c.ticketId.toLowerCase().includes(search) ||
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search) ||
        (c.locationDetails && c.locationDetails.toLowerCase().includes(search))
      );
    }

    if (list.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-clipboard-check"></i></div>
          <h3>No Complaints Found</h3>
          <p>You haven't submitted any complaints matching this filter yet.</p>
        </div>
      `;
      return;
    }

    let html = "";
    list.forEach(c => {
      const catConfig = CONFIG.CATEGORIES[c.category] || { name: c.category, icon: "fa-tag", color: "#6366f1" };
      const statusBadge = CONFIG.STATUS_BADGES[c.status] || { label: c.status, class: "badge-pending", icon: "fa-clock" };
      const urgencyBadge = CONFIG.URGENCY_LEVELS[c.urgency] || { label: c.urgency, class: "urgency-medium" };
      const dateFormatted = new Date(c.timestamp).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
      });

      // Status progress steps (Submitted -> Under Review -> In Progress -> Resolved)
      const steps = ["Pending", "Under Review", "In Progress", "Resolved"];
      let currentStepIndex = steps.indexOf(c.status);
      if (c.status === "Rejected") currentStepIndex = -1;

      html += `
        <div class="complaint-card" onclick="STUDENT.openComplaintDetail('${c.ticketId}')">
          <div class="complaint-card-header">
            <div class="ticket-badge-group">
              <span class="ticket-id"><i class="fas fa-ticket-alt"></i> ${c.ticketId}</span>
              <span class="cat-pill" style="color: ${catConfig.color}; background: ${catConfig.color}15;">
                <i class="fas ${catConfig.icon}"></i> ${catConfig.name}
              </span>
            </div>
            <div class="status-badge-group">
              <span class="urgency-pill ${urgencyBadge.class}">${urgencyBadge.label}</span>
              <span class="status-pill ${statusBadge.class}"><i class="fas ${statusBadge.icon}"></i> ${statusBadge.label}</span>
            </div>
          </div>

          <div class="complaint-card-body">
            <h4 class="complaint-title">${c.title}</h4>
            <p class="complaint-desc-snippet">${c.description.substring(0, 160)}${c.description.length > 160 ? '...' : ''}</p>
            
            ${c.locationDetails ? `
              <div class="complaint-meta-row">
                <i class="fas fa-map-marker-alt"></i> <span>${c.locationDetails}</span>
              </div>
            ` : ''}

            ${c.imageUrl ? `
              <div class="complaint-has-attachment">
                <i class="fas fa-paperclip"></i> Photo proof attached
              </div>
            ` : ''}
          </div>

          <!-- Progress Timeline Bar -->
          <div class="timeline-bar-wrapper">
            <div class="timeline-progress-track">
              <div class="timeline-step ${currentStepIndex >= 0 ? 'completed' : ''}">
                <div class="step-dot"><i class="fas fa-check"></i></div>
                <span class="step-label">Submitted</span>
              </div>
              <div class="timeline-connector ${currentStepIndex >= 1 ? 'active' : ''}"></div>
              <div class="timeline-step ${currentStepIndex >= 1 ? 'completed' : ''}">
                <div class="step-dot"><i class="fas fa-search"></i></div>
                <span class="step-label">Under Review</span>
              </div>
              <div class="timeline-connector ${currentStepIndex >= 2 ? 'active' : ''}"></div>
              <div class="timeline-step ${currentStepIndex >= 2 ? 'completed' : ''}">
                <div class="step-dot"><i class="fas fa-tools"></i></div>
                <span class="step-label">In Progress</span>
              </div>
              <div class="timeline-connector ${currentStepIndex >= 3 ? 'active' : ''}"></div>
              <div class="timeline-step ${currentStepIndex >= 3 ? 'completed' : (c.status === 'Rejected' ? 'declined' : '')}">
                <div class="step-dot">${c.status === 'Rejected' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-flag-checkered"></i>'}</div>
                <span class="step-label">${c.status === 'Rejected' ? 'Declined' : 'Resolved'}</span>
              </div>
            </div>
          </div>

          <div class="complaint-card-footer">
            <span class="timestamp"><i class="far fa-calendar-alt"></i> ${dateFormatted}</span>
            ${c.adminRemarks ? `
              <span class="has-remarks-badge"><i class="fas fa-comment-dots"></i> Admin Responded</span>
            ` : '<span class="awaiting-review">Awaiting official action</span>'}
            <span class="view-link">View Details <i class="fas fa-chevron-right"></i></span>
          </div>
        </div>
      `;
    });

    listContainer.innerHTML = html;
  },

  openComplaintDetail(ticketId) {
    const item = this.complaintsCache.find(c => c.ticketId === ticketId);
    if (!item) return;

    const modal = document.getElementById("complaintDetailModal");
    const catConfig = CONFIG.CATEGORIES[item.category] || { name: item.category, icon: "fa-tag", color: "#6366f1" };
    const statusBadge = CONFIG.STATUS_BADGES[item.status] || { label: item.status, class: "badge-pending", icon: "fa-clock" };
    const urgencyBadge = CONFIG.URGENCY_LEVELS[item.urgency] || { label: item.urgency, class: "urgency-medium" };

    document.getElementById("detailTicketId").textContent = item.ticketId;
    document.getElementById("detailTitle").textContent = item.title;
    document.getElementById("detailCategory").innerHTML = `<i class="fas ${catConfig.icon}"></i> ${catConfig.name}`;
    document.getElementById("detailUrgency").textContent = urgencyBadge.label;
    document.getElementById("detailUrgency").className = `urgency-pill ${urgencyBadge.class}`;
    document.getElementById("detailStatus").textContent = statusBadge.label;
    document.getElementById("detailStatus").className = `status-pill ${statusBadge.class}`;
    document.getElementById("detailLocation").textContent = item.locationDetails || "Standard Campus Facility";
    document.getElementById("detailDescription").textContent = item.description;
    document.getElementById("detailDate").textContent = new Date(item.timestamp).toLocaleString("en-IN");

    // Remarks
    const remarksEl = document.getElementById("detailAdminRemarks");
    if (item.adminRemarks) {
      remarksEl.innerHTML = `
        <div class="official-remark-box">
          <div class="remark-header"><i class="fas fa-user-shield"></i> Official Admin Resolution Note:</div>
          <p>${item.adminRemarks}</p>
          <small class="remark-date">Last Updated: ${item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-IN") : 'Recently'}</small>
        </div>
      `;
    } else {
      remarksEl.innerHTML = `<p class="no-remarks-yet"><i class="fas fa-hourglass-half"></i> No official remarks posted yet. The administration is processing your grievance.</p>`;
    }

    // Attachment
    const imgWrapper = document.getElementById("detailImageWrapper");
    if (item.imageUrl) {
      imgWrapper.style.display = "block";
      document.getElementById("detailImage").src = item.imageUrl;
    } else {
      imgWrapper.style.display = "none";
    }

    UI.openModal("complaintDetailModal");
  }
};
