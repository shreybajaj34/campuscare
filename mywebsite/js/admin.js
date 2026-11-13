/**
 * CampusCare - Master Admin Dashboard & Complaint Resolution Management
 * Enables administrators to review all student complaints, inspect attachments, update status, and add resolution notes
 */

const ADMIN = {
  complaintsCache: [],
  selectedTicket: null,

  async init() {
    if (!AUTH.isAdmin()) {
      UI.toast("Admin access required. Please sign in.", "warning");
      APP.showHomeView();
      UI.openModal("adminLoginModal");
      return;
    }

    this.bindEvents();
    await this.loadAllComplaints();
  },

  bindEvents() {
    // Search & Filter Listeners
    const searchInput = document.getElementById("adminSearchInput");
    const filterCat = document.getElementById("adminFilterCat");
    const filterStatus = document.getElementById("adminFilterStatus");
    const filterUrgency = document.getElementById("adminFilterUrgency");
    const sortBy = document.getElementById("adminSortBy");

    if (searchInput) searchInput.addEventListener("input", () => this.filterAndRenderTable());
    if (filterCat) filterCat.addEventListener("change", () => this.filterAndRenderTable());
    if (filterStatus) filterStatus.addEventListener("change", () => this.filterAndRenderTable());
    if (filterUrgency) filterUrgency.addEventListener("change", () => this.filterAndRenderTable());
    if (sortBy) sortBy.addEventListener("change", () => this.filterAndRenderTable());

    // Status Update Form Submit
    const updateForm = document.getElementById("adminStatusUpdateForm");
    if (updateForm) {
      updateForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.handleStatusUpdateSubmit();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById("adminRefreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        UI.setLoading("adminRefreshBtn", true, "Syncing...");
        await this.loadAllComplaints();
        UI.setLoading("adminRefreshBtn", false, '<i class="fas fa-sync-alt"></i> Refresh Data');
        UI.toast("Complaints synchronized with database.", "info");
      });
    }

    // Export to CSV button
    const exportBtn = document.getElementById("adminExportBtn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportToCSV());
    }
  },

  async loadAllComplaints() {
    const creds = AUTH.getAdminCredentials();
    if (!creds) return;

    const tbody = document.getElementById("adminComplaintsTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><i class="fas fa-circle-notch fa-spin"></i> Fetching complaints from central database...</td></tr>`;
    }

    try {
      const res = await API.getAllComplaints(creds.adminUsername, creds.adminPassword);
      if (res.status === "success") {
        this.complaintsCache = res.complaints || [];
        this.updateAdminDashboardStats();
        this.filterAndRenderTable();
      } else {
        UI.toast(res.message || "Failed to load complaints.", "error");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="8" class="text-center text-error py-4"><i class="fas fa-exclamation-triangle"></i> ${res.message}</td></tr>`;
        }
      }
    } catch (err) {
      console.error(err);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-error py-4"><i class="fas fa-exclamation-triangle"></i> Communication error.</td></tr>`;
      }
    }
  },

  updateAdminDashboardStats() {
    const total = this.complaintsCache.length;
    const pending = this.complaintsCache.filter(c => c.status === "Pending").length;
    const underReview = this.complaintsCache.filter(c => c.status === "Under Review").length;
    const inProgress = this.complaintsCache.filter(c => c.status === "In Progress").length;
    const resolved = this.complaintsCache.filter(c => c.status === "Resolved").length;
    const emergency = this.complaintsCache.filter(c => c.urgency === "Emergency" || c.urgency === "High").length;

    document.getElementById("adminStatTotal").textContent = total;
    document.getElementById("adminStatPending").textContent = pending;
    document.getElementById("adminStatReview").textContent = underReview;
    document.getElementById("adminStatProgress").textContent = inProgress;
    document.getElementById("adminStatResolved").textContent = resolved;
    document.getElementById("adminStatUrgent").textContent = emergency;
  },

  filterAndRenderTable() {
    const tbody = document.getElementById("adminComplaintsTableBody");
    if (!tbody) return;

    const search = (document.getElementById("adminSearchInput")?.value || "").trim().toLowerCase();
    const filterCat = document.getElementById("adminFilterCat")?.value || "";
    const filterStatus = document.getElementById("adminFilterStatus")?.value || "";
    const filterUrgency = document.getElementById("adminFilterUrgency")?.value || "";
    const sortBy = document.getElementById("adminSortBy")?.value || "newest";

    let list = [...this.complaintsCache];

    if (filterCat) list = list.filter(c => c.category === filterCat);
    if (filterStatus) list = list.filter(c => c.status === filterStatus);
    if (filterUrgency) list = list.filter(c => c.urgency === filterUrgency);

    if (search) {
      list = list.filter(c => 
        c.ticketId.toLowerCase().includes(search) ||
        (c.studentRollNumber && c.studentRollNumber.toLowerCase().includes(search)) ||
        (c.studentName && c.studentName.toLowerCase().includes(search)) ||
        c.title.toLowerCase().includes(search) ||
        c.description.toLowerCase().includes(search) ||
        (c.locationDetails && c.locationDetails.toLowerCase().includes(search))
      );
    }

    // Sorting
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    } else if (sortBy === "urgency") {
      const weight = { "Emergency": 4, "High": 3, "Medium": 2, "Low": 1 };
      list.sort((a, b) => (weight[b.urgency] || 0) - (weight[a.urgency] || 0));
    }

    const countIndicator = document.getElementById("adminFilterCount");
    if (countIndicator) {
      countIndicator.textContent = `Showing ${list.length} of ${this.complaintsCache.length} complaints`;
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5">
            <div class="empty-state-table">
              <i class="fas fa-folder-open fa-2x mb-2 text-muted"></i>
              <p class="mb-0">No complaints match your selected filters.</p>
            </div>
          </td>
        </tr>
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

      html += `
        <tr class="complaint-row ${c.urgency === 'Emergency' ? 'row-emergency' : ''}">
          <td class="font-mono font-bold text-primary">
            <span class="ticket-table-pill">${c.ticketId}</span>
          </td>
          <td>
            <div class="student-info-cell">
              <strong>${c.studentName || 'Student'}</strong>
              <small class="text-muted"><i class="fas fa-id-card"></i> ${c.studentRollNumber}</small>
            </div>
          </td>
          <td>
            <span class="category-table-badge" style="color: ${catConfig.color}; background: ${catConfig.color}15;">
              <i class="fas ${catConfig.icon}"></i> ${catConfig.name}
            </span>
          </td>
          <td>
            <div class="complaint-subject-cell">
              <div class="font-semibold text-truncate" style="max-width: 240px;" title="${c.title}">${c.title}</div>
              <small class="text-muted text-truncate d-block" style="max-width: 240px;">${c.locationDetails || 'Campus'}</small>
            </div>
          </td>
          <td>
            <span class="urgency-pill ${urgencyBadge.class}">${urgencyBadge.label}</span>
          </td>
          <td>
            <span class="status-pill ${statusBadge.class}"><i class="fas ${statusBadge.icon}"></i> ${statusBadge.label}</span>
          </td>
          <td class="text-muted text-sm font-mono">${dateFormatted}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-outline-primary" onclick="ADMIN.openManageModal('${c.ticketId}')" title="Inspect & Update Status">
                <i class="fas fa-edit"></i> Manage
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openManageModal(ticketId) {
    const item = this.complaintsCache.find(c => c.ticketId === ticketId);
    if (!item) return;

    this.selectedTicket = item;

    const catConfig = CONFIG.CATEGORIES[item.category] || { name: item.category, icon: "fa-tag", color: "#6366f1" };
    const urgencyBadge = CONFIG.URGENCY_LEVELS[item.urgency] || { label: item.urgency, class: "urgency-medium" };

    // Fill Modal Info
    document.getElementById("adminModalTicketId").textContent = item.ticketId;
    document.getElementById("adminModalStudent").innerHTML = `<strong>${item.studentName}</strong> (Roll: ${item.studentRollNumber})`;
    document.getElementById("adminModalCategory").innerHTML = `<i class="fas ${catConfig.icon}"></i> ${catConfig.name}`;
    document.getElementById("adminModalLocation").textContent = item.locationDetails || "Standard Campus Facility";
    document.getElementById("adminModalTitle").textContent = item.title;
    document.getElementById("adminModalDesc").textContent = item.description;
    document.getElementById("adminModalUrgency").className = `urgency-pill ${urgencyBadge.class}`;
    document.getElementById("adminModalUrgency").textContent = urgencyBadge.label;
    document.getElementById("adminModalDate").textContent = new Date(item.timestamp).toLocaleString("en-IN");

    // Photo Attachment
    const imgWrapper = document.getElementById("adminModalImageWrapper");
    if (item.imageUrl) {
      imgWrapper.style.display = "block";
      document.getElementById("adminModalImage").src = item.imageUrl;
      const downloadLink = document.getElementById("adminModalImageDownload");
      if (downloadLink) {
        downloadLink.href = item.imageUrl;
      }
    } else {
      imgWrapper.style.display = "none";
    }

    // Current Status & Remarks into Inputs
    document.getElementById("adminUpdateStatusSelect").value = item.status;
    document.getElementById("adminUpdateRemarks").value = item.adminRemarks || "";

    UI.openModal("adminManageModal");
  },

  async handleStatusUpdateSubmit() {
    if (!this.selectedTicket) return;

    const creds = AUTH.getAdminCredentials();
    if (!creds) {
      UI.toast("Admin session expired. Please sign in again.", "error");
      return;
    }

    const newStatus = document.getElementById("adminUpdateStatusSelect").value;
    const remarks = document.getElementById("adminUpdateRemarks").value.trim();

    UI.setLoading("adminSaveStatusBtn", true, "Updating Record...");

    const res = await API.updateComplaintStatus({
      adminUsername: creds.adminUsername,
      adminPassword: creds.adminPassword,
      ticketId: this.selectedTicket.ticketId,
      status: newStatus,
      adminRemarks: remarks
    });

    UI.setLoading("adminSaveStatusBtn", false, '<i class="fas fa-check"></i> Save & Notify Student');

    if (res.status === "success") {
      UI.toast(`Ticket ${this.selectedTicket.ticketId} updated to ${newStatus}!`, "success");
      UI.closeModal("adminManageModal");
      
      // Update local cache item
      this.selectedTicket.status = newStatus;
      this.selectedTicket.adminRemarks = remarks;
      this.selectedTicket.updatedAt = res.updatedAt || new Date().toISOString();

      this.updateAdminDashboardStats();
      this.filterAndRenderTable();
    } else {
      UI.toast(res.message || "Failed to update complaint status.", "error");
    }
  },

  exportToCSV() {
    if (this.complaintsCache.length === 0) {
      UI.toast("No complaints to export.", "warning");
      return;
    }

    const headers = ["Ticket ID", "Timestamp", "Student Roll No", "Student Name", "Category", "Title", "Location", "Urgency", "Status", "Admin Remarks", "Updated At"];
    const rows = this.complaintsCache.map(c => [
      `"${c.ticketId}"`,
      `"${c.timestamp}"`,
      `"${c.studentRollNumber}"`,
      `"${(c.studentName || '').replace(/"/g, '""')}"`,
      `"${c.category}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${(c.locationDetails || '').replace(/"/g, '""')}"`,
      `"${c.urgency}"`,
      `"${c.status}"`,
      `"${(c.adminRemarks || '').replace(/"/g, '""')}"`,
      `"${c.updatedAt || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CampusCare_Grievance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    UI.toast("Complaints report downloaded as CSV.", "success");
  }
};
