import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../server/routes/index.js";

const app = express();
const GITHUB_APK_URL = "https://github.com/San-AMRANI/TrueSpend-ggl/releases/latest/download/TrueSpend.apk";

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/api/download-apk", async (_req, res) => {
  try {
    const response = await fetch(GITHUB_APK_URL, { redirect: "follow" });
    if (!response.ok) {
      res.status(response.status).json({ error: "The latest Android APK is unavailable." });
      return;
    }

    const apk = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="TrueSpend.apk"');
    res.setHeader("Content-Length", String(apk.length));
    res.send(apk);
  } catch (error) {
    console.error("APK download proxy failed", error);
    res.status(502).json({ error: "Could not retrieve the latest Android APK." });
  }
});

// Capacitor serves the bundled app from https://localhost, so allow the
// native WebView to call this Vercel API with its bearer token.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === "https://localhost" || origin === "capacitor://localhost") {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// Mount the clean layered API routes
app.use("/api", apiRouter);

// Export the app for Vercel Serverless Functions
export default app;
