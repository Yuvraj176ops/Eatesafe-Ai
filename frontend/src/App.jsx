
import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/reports";

const CATEGORIES = [
  "Spoiled Food",
  "Foreign Object",
  "Hygiene Issue",
  "Packaging Issue",
  "Labelling Issue",
  "Suspected Contamination",
  "Expired Product",
  "Suspected Adulteration",
];

const STATUSES = [
  "Submitted",
  "Under Review",
  "Investigation",
  "Action Taken",
  "Resolved",
  "Closed",
];

function getComplaintId(report) {
  if (report.complaintId) return report.complaintId;

  const id = report._id || report.id || "";
  return `ES-${String(id).slice(-6).toUpperCase()}`;
}

function App() {
  const [form, setForm] = useState({
    category: "Spoiled Food",
    description: "",
    location: "",
  });

  const [selectedImage, setSelectedImage] = useState(null);
  const [recentReports, setRecentReports] = useState([]);
  const [dashboardReports, setDashboardReports] = useState([]);

  const [loadingReports, setLoadingReports] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch complaints from MongoDB through the backend
  const loadDashboardReports = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Unable to load complaints from the server.");
      }

      const data = await response.json();

      setDashboardReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.message || "Could not connect to the backend."
      );
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardReports();
  }, [loadDashboardReports]);

  // Handle complaint form inputs
  function handleFormChange(e) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // Submit a new complaint
  async function handleSubmit(e) {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Complaint submission failed."
        );
      }

      const savedReport = {
        ...data.report,
        complaintId: data.complaintId,
      };

      setRecentReports((previous) => [
        savedReport,
        ...previous,
      ]);

      setForm({
        category: "Spoiled Food",
        description: "",
        location: "",
      });

      setSelectedImage(null);
      e.target.reset();

      if (data.possibleDuplicate) {
        setSuccessMessage(
          `Complaint saved! ID: ${data.complaintId}. ` +
          `${data.relatedReports.length} potentially related report(s) found.`
        );
      } else {
        setSuccessMessage(
          `Complaint submitted successfully! ID: ${data.complaintId}`
        );
      }

      await loadDashboardReports();

      document.getElementById("tracking")?.scrollIntoView({
        behavior: "smooth",
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  // Update status in MongoDB
  async function updateComplaintStatus(reportId, status) {
    if (!reportId) {
      setError("Complaint database ID is missing.");
      return;
    }

    setUpdatingId(reportId);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `${API_URL}/${reportId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not update complaint status."
        );
      }

      setDashboardReports((previous) =>
        previous.map((report) =>
          report._id === reportId
            ? { ...report, status: data.report.status }
            : report
        )
      );

      setRecentReports((previous) =>
        previous.map((report) =>
          report._id === reportId
            ? { ...report, status: data.report.status }
            : report
        )
      );

      setSuccessMessage(
        `Complaint status updated to "${data.report.status}".`
      );
    } catch (err) {
      setError(err.message || "Status update failed.");
      await loadDashboardReports();
    } finally {
      setUpdatingId("");
    }
  }

  // Dashboard counts
  const totalReports = dashboardReports.length;

  const submittedCount = dashboardReports.filter(
    (report) => (report.status || "Submitted") === "Submitted"
  ).length;

  const reviewCount = dashboardReports.filter(
    (report) =>
      report.status === "Under Review" ||
      report.status === "Investigation"
  ).length;

  const resolvedCount = dashboardReports.filter(
    (report) =>
      report.status === "Resolved" ||
      report.status === "Closed"
  ).length;

  return (
    <div className="app">
      {/* Navigation */}
      <header className="navbar">
        <a className="brand" href="#">
          🍃 EatSafe AI
        </a>

        <a href="#report">Report Hazard</a>
        <a href="#tracking">Track Reports</a>
        <a href="#admin">Admin Dashboard</a>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="hero-content">
            <span className="tag">AI-POWERED FOOD SAFETY</span>

            <h1>
              See a food hazard?
              <br />
              <span>Report it. Track it.</span>
            </h1>

            <p>
              Report suspected food-safety issues with a description
              and location. AI-assisted tools can help organize
              complaints for human review.
            </p>

            <a className="primary-btn" href="#report">
              Report a Food Hazard →
            </a>
          </div>

          <div className="hero-card">
            <div className="food-icon">🥗</div>
            <h3>Safer food starts with you.</h3>
            <p>Report · Review · Respond</p>
            <span className="status-pill">
              Community Reporting
            </span>
          </div>
        </section>

        {/* Feature cards */}
        <section className="features">
          <article>
            <span>📷</span>
            <h3>Evidence Reporting</h3>
            <p>
              Select an image and describe the suspected food hazard.
            </p>
          </article>

          <article>
            <span>🤖</span>
            <h3>AI-Assisted Analysis</h3>
            <p>
              Organize complaints for future hazard classification
              and preliminary risk assessment.
            </p>
          </article>

          <article>
            <span>📍</span>
            <h3>Complaint Tracking</h3>
            <p>
              View submitted complaints and their current status.
            </p>
          </article>
        </section>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            style={{
              maxWidth: "1000px",
              margin: "20px auto",
              padding: "14px 18px",
              background: "#fff0f0",
              color: "#9f2525",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div
            role="status"
            style={{
              maxWidth: "1000px",
              margin: "20px auto",
              padding: "14px 18px",
              background: "#e5f5e9",
              color: "#187347",
              borderRadius: "8px",
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Complaint form */}
        <section className="report-section" id="report">
          <div className="section-heading">
            <span className="tag">NEW COMPLAINT</span>
            <h2>Report a Food Hazard</h2>
            <p>
              Provide the details so the complaint can be reviewed.
            </p>
          </div>

          <form className="report-form" onSubmit={handleSubmit}>
            <label>
              Hazard Category
              <select
                name="category"
                required
                value={form.category}
                onChange={handleFormChange}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Complaint Description
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={3000}
                placeholder="Describe what you observed..."
                value={form.description}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Incident Location
              <input
                name="location"
                required
                maxLength={300}
                placeholder="Area, city or shop name"
                value={form.location}
                onChange={handleFormChange}
              />
            </label>

            <label>
              Evidence Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setSelectedImage(e.target.files?.[0] || null)
                }
              />
            </label>

            {selectedImage && (
              <small>
                Selected file: {selectedImage.name}
              </small>
            )}

            <button
              className="primary-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Complaint →"}
            </button>

            <small>
              Complaint details are saved in MongoDB. Image selection
              is currently for the interface only; the file is not
              uploaded to the server yet.
            </small>
          </form>
        </section>

        {/* Recent reports */}
        <section className="tracking-section" id="tracking">
          <div className="section-heading">
            <span className="tag">REPORT MANAGEMENT</span>
            <h2>Recent Reports</h2>
            <p>
              Complaints submitted during this browser session.
            </p>
          </div>

          {recentReports.length === 0 ? (
            <div className="empty-state">
              <span>📋</span>
              <p>
                No new complaints submitted during this session.
              </p>
            </div>
          ) : (
            <div className="report-list">
              {recentReports.map((report) => (
                <article
                  className="report-card"
                  key={report._id || report.complaintId}
                >
                  <div>
                    <strong>{report.category}</strong>
                    <p>{report.description}</p>
                    <small>Location: {report.location}</small>
                    <br />
                    <small>
                      Complaint ID: {getComplaintId(report)}
                    </small>
                    <br />
                    <small>
                      Risk: {report.riskLevel || "Pending assessment"}
                    </small>
                  </div>

                  <span className="status-pill">
                    {report.status || "Submitted"}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Admin dashboard */}
        <section className="admin-section" id="admin">
          <div className="section-heading">
            <span className="tag">ADMIN PANEL</span>
            <h2>Complaint Dashboard</h2>
            <p>
              View saved complaints, preliminary risk levels and
              potentially related reports.
            </p>
          </div>

          {/* Statistics */}
          <div className="stats-grid">
            <article className="stat-card">
              <span>Total Reports</span>
              <strong>{totalReports}</strong>
            </article>

            <article className="stat-card">
              <span>Submitted</span>
              <strong>{submittedCount}</strong>
            </article>

            <article className="stat-card">
              <span>Under Review / Investigation</span>
              <strong>{reviewCount}</strong>
            </article>

            <article className="stat-card">
              <span>Resolved / Closed</span>
              <strong>{resolvedCount}</strong>
            </article>
          </div>

          {/* Refresh */}
          <div
            className="admin-list"
            style={{ marginBottom: "18px" }}
          >
            <button
              className="primary-btn"
              type="button"
              onClick={loadDashboardReports}
              disabled={loadingReports}
            >
              {loadingReports ? "Loading..." : "↻ Refresh Reports"}
            </button>
          </div>

          {/* Database reports */}
          <div className="admin-list">
            {loadingReports ? (
              <div className="empty-state">
                Loading complaints from MongoDB...
              </div>
            ) : dashboardReports.length === 0 ? (
              <div className="empty-state">
                <span>📋</span>
                <p>No complaints found in the database.</p>
              </div>
            ) : (
              dashboardReports.map((report) => (
                <article
                  className="admin-report"
                  key={report._id}
                >
                  <div>
                    <strong>{report.category}</strong>

                    <p>{report.description}</p>

                    <small>Location: {report.location}</small>
                    <br />

                    <small>
                      Complaint ID: {getComplaintId(report)}
                    </small>
                    <br />

                    <small>
                      Risk: {report.riskLevel || "Pending assessment"}
                    </small>

                    {report.createdAt && (
                      <>
                        <br />
                        <small>
                          Submitted:{" "}
                          {new Date(report.createdAt).toLocaleString()}
                        </small>
                      </>
                    )}

                    {/* Potentially related complaints */}
                    {report.possibleDuplicate &&
                      report.relatedReports?.length > 0 && (
                        <div style={{ marginTop: "12px" }}>
                          <span className="status-pill">
                            ⚠ Potentially Related Complaint
                          </span>

                          {report.relatedReports.map((related) => (
                            <p key={String(related.reportId)}>
                              Related ID: {related.complaintId}
                              {" · "}
                              Similarity:{" "}
                              {(related.similarity * 100).toFixed(0)}%
                            </p>
                          ))}
                        </div>
                      )}
                  </div>

                  {/* Status update */}
                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      minWidth: "155px",
                    }}
                  >
                    <span className="status-pill">
                      {report.status || "Submitted"}
                    </span>

                    <select
                      value={report.status || "Submitted"}
                      disabled={updatingId === report._id}
                      aria-label={`Update status for ${getComplaintId(report)}`}
                      onChange={(e) =>
                        updateComplaintStatus(
                          report._id,
                          e.target.value
                        )
                      }
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>

                    {updatingId === report._id && (
                      <small>Updating status...</small>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <strong>🍃 EatSafe AI</strong>
        <p>
          AI-Driven Platform for Rapid Food Hazard Reporting
          and Response Tracking.
        </p>
        <small>
          Similarity results and risk levels are preliminary and
          require human verification.
        </small>
      </footer>
    </div>
  );
}

export default App;
  