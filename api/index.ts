import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../server/routes/index.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

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
