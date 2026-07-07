import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import bcrypt from "bcryptjs";
import cors from "cors";
import { createDatabaseAdapter } from "./db/db";

const db = createDatabaseAdapter();
await db.init();

async function startServer() {
  const app = express();

  app.use(
    cors({
      origin: [
        "https://opti-scan-3t4e0osnl-kishorekumar04072004-6584s-projects.vercel.app",
        "https://opti-scan-ai.vercel.app"
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // Auth Routes
  app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
      const existingUser = await db.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.createUser(id, username, hashedPassword, username === 'admin' ? 'admin' : 'user');
      
      const profileId = Math.random().toString(36).substr(2, 9);
      await db.createProfile(profileId, id, username, 25, 'Male', 'Self', true);

      res.json({ success: true, message: "User registered successfully" });
    } catch (error) {
      res.status(500).json({ success: false, message: "Registration failed" });
    }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const user = await db.getUserByUsername(username) as any;
      if (!user) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ success: false, message: "Login failed" });
    }
  });

  app.get("/api/profiles/:userId", async (req, res) => {
    const profiles = await db.getProfilesByUserId(req.params.userId);
    res.json(profiles);
  });

  app.post("/api/profiles", async (req, res) => {
    const { id, userId, name, age, gender, relationship } = req.body;
    await db.createProfile(id, userId, name, age, gender, relationship, true);
    res.json({ success: true });
  });

  app.post("/api/profiles/authorize", async (req, res) => {
    const { profileId, isAuthorized } = req.body;
    await db.authorizeProfile(profileId, isAuthorized);
    res.json({ success: true });
  });

  app.get("/api/profiles/all", async (req, res) => {
    const profiles = await db.getAllProfiles();
    res.json(profiles);
  });

  app.get("/api/reports/profile/all", async (req, res) => {
    const reports = await db.getAllReports();
    res.json(reports);
  });

  app.post("/api/reports", async (req, res) => {
    const { id, profileId, patientName, data, previousReportData } = req.body;
    await db.createReport(id, profileId, patientName, data, previousReportData);
    res.json({ success: true });
  });

  app.get("/api/reports/profile/:profileId", async (req, res) => {
    const reports = await db.getReportsByProfileId(req.params.profileId);
    res.json(reports);
  });

  app.post("/api/appointments", async (req, res) => {
    const { profileId, patientName, reportId } = req.body;
    const id = Math.random().toString(36).substr(2, 9);
    try {
      await db.createAppointment(id, profileId, patientName, reportId);
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/appointments/all", async (req, res) => {
    const appointments = await db.getAllAppointments();
    res.json(appointments);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
