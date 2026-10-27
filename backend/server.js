
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ==========================================
// 1. MONGODB CONNECTION
// ==========================================
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/eatsafe_ai";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) =>
    console.error("MongoDB connection error:", error.message)
  );

// ==========================================
// 2. CONSTANTS
// ==========================================
const allowedCategories = [
  "Spoiled Food",
  "Foreign Object",
  "Hygiene Issue",
  "Packaging Issue",
  "Labelling Issue",
  "Suspected Contamination",
  "Expired Product",
  "Suspected Adulteration",
];

const allowedStatuses = [
  "Submitted",
  "Under Review",
  "Investigation",
  "Action Taken",
  "Resolved",
  "Closed",
];

// ==========================================
// 3. COMPLAINT SCHEMA AND MODEL
// ==========================================
const reportSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: allowedCategories,
    },

    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 3000,
      trim: true,
    },

    location: {
      type: String,
      required: true,
      maxlength: 300,
      trim: true,
    },

    status: {
      type: String,
      enum: allowedStatuses,
      default: "Submitted",
    },

    riskLevel: {
      type: String,
      enum: ["Low", "Medium", "High", "Pending assessment"],
      default: "Pending assessment",
    },

    possibleDuplicate: {
      type: Boolean,
      default: false,
    },

    relatedReports: [
      {
        reportId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Report",
        },
        complaintId: String,
        similarity: Number,
      },
    ],
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);

// ==========================================
// 4. RISK ASSESSMENT
// Basic rule-based preliminary scoring
// ==========================================
function calculateRisk(category, description) {
  const text = `${category} ${description}`.toLowerCase();

  let score = 0;

  const highRiskTerms = [
    "contamination",
    "allergic reaction",
    "allergy",
    "chemical",
    "glass",
    "metal",
    "food poisoning",
  ];

  const mediumRiskTerms = [
    "spoiled",
    "rotten",
    "expired",
    "foreign object",
    "unhygienic",
    "mold",
    "mould",
  ];

  if (category === "Suspected Contamination") score += 3;
  if (category === "Suspected Adulteration") score += 3;
  if (category === "Foreign Object") score += 2;
  if (category === "Expired Product") score += 2;
  if (category === "Spoiled Food") score += 2;
  if (category === "Hygiene Issue") score += 1;

  if (highRiskTerms.some((term) => text.includes(term))) {
    score += 2;
  } else if (mediumRiskTerms.some((term) => text.includes(term))) {
    score += 1;
  }

  if (score >= 4) return "High";
  if (score >= 2) return "Medium";

  return "Low";
}

// ==========================================
// 5. TEXT TOKENIZATION
// ==========================================
function tokenize(text) {
  const stopWords = new Set([
    "the", "is", "a", "an", "and", "or", "of", "to",
    "in", "for", "was", "were", "my", "this", "that",
    "hai", "ka", "ki", "ke", "me", "mein", "tha", "thi",
  ]);

  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) => word.length > 1 && !stopWords.has(word)
    );
}

// ==========================================
// 6. COSINE SIMILARITY
// Word-frequency vector comparison
// ==========================================
function cosineSimilarity(textA, textB) {
  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);

  if (!wordsA.length || !wordsB.length) return 0;

  const vectorA = {};
  const vectorB = {};

  for (const word of wordsA) {
    vectorA[word] = (vectorA[word] || 0) + 1;
  }

  for (const word of wordsB) {
    vectorB[word] = (vectorB[word] || 0) + 1;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const word in vectorA) {
    magnitudeA += vectorA[word] ** 2;

    if (vectorB[word]) {
      dotProduct += vectorA[word] * vectorB[word];
    }
  }

  for (const word in vectorB) {
    magnitudeB += vectorB[word] ** 2;
  }

  if (!magnitudeA || !magnitudeB) return 0;

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}

// ==========================================
// 7. HEALTH CHECK
// GET /
// ==========================================
app.get("/", (req, res) => {
  res.json({
    message: "EatSafe AI API is running",
    status: "OK",
    database:
      mongoose.connection.readyState === 1
        ? "Connected"
        : "Disconnected",
  });
});

// ==========================================
// 8. SUBMIT COMPLAINT
// POST /api/reports
// ==========================================
app.post("/api/reports", async (req, res) => {
  try {
    const { category, description, location } = req.body;

    if (!category || !description || !location) {
      return res.status(400).json({
        message:
          "Category, description and location are required.",
      });
    }

    if (
      !allowedCategories.includes(category) ||
      typeof description !== "string" ||
      typeof location !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid complaint data.",
      });
    }

    const cleanDescription = description.trim();
    const cleanLocation = location.trim();

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > 3000 ||
      cleanLocation.length === 0 ||
      cleanLocation.length > 300
    ) {
      return res.status(400).json({
        message: "Description or location length is invalid.",
      });
    }

    // Fetch existing complaints for comparison
    const existingReports = await Report.find(
      {},
      "category description location"
    ).lean();

    const newText = `${category} ${cleanDescription}`;

    // Compare descriptions with existing complaints
    const relatedReports = existingReports
      .map((oldReport) => {
        const oldText =
          `${oldReport.category} ${oldReport.description}`;

        const similarity = cosineSimilarity(newText, oldText);

        return {
          reportId: oldReport._id,
          complaintId:
            `ES-${oldReport._id.toString().slice(-6).toUpperCase()}`,
          similarity: Number(similarity.toFixed(3)),
        };
      })
      .filter((report) => report.similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);

    // Calculate preliminary risk
    const riskLevel = calculateRisk(
      category,
      cleanDescription
    );

    // Save complaint
    const report = await Report.create({
      category,
      description: cleanDescription,
      location: cleanLocation,
      riskLevel,
      possibleDuplicate: relatedReports.length > 0,
      relatedReports,
    });

    const complaintId =
      `ES-${report._id.toString().slice(-6).toUpperCase()}`;

    return res.status(201).json({
      message: "Complaint submitted successfully.",
      complaintId,
      possibleDuplicate: relatedReports.length > 0,
      relatedReports,
      report,
    });
  } catch (error) {
    console.error("Submit complaint error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Could not save complaint.",
    });
  }
});

// ==========================================
// 9. FETCH ALL COMPLAINTS
// GET /api/reports
// ==========================================
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await Report.find().sort({
      createdAt: -1,
    });

    return res.json(reports);
  } catch (error) {
    console.error("Fetch reports error:", error.message);

    return res.status(500).json({
      message: "Could not fetch complaints.",
    });
  }
});

// ==========================================
// 10. FETCH ONE COMPLAINT
// GET /api/reports/:id
// ==========================================
app.get("/api/reports/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid complaint ID.",
      });
    }

    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    return res.json(report);
  } catch (error) {
    console.error("Fetch report error:", error.message);

    return res.status(500).json({
      message: "Could not fetch complaint.",
    });
  }
});

// ==========================================
// 11. UPDATE COMPLAINT STATUS
// PATCH /api/reports/:id/status
// ==========================================
app.patch("/api/reports/:id/status", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid complaint ID.",
      });
    }

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid complaint status.",
        allowedStatuses,
      });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!report) {
      return res.status(404).json({
        message: "Complaint not found.",
      });
    }

    return res.json({
      message: "Complaint status updated successfully.",
      report,
    });
  } catch (error) {
    console.error("Update status error:", error.message);

    return res.status(500).json({
      message: "Could not update complaint status.",
    });
  }
});

// ==========================================
// 12. START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`EatSafe AI server running on port ${PORT}`);
});
