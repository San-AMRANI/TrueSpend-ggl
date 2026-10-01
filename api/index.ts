import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../server/routes/index.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Vercel may preserve or strip the /api prefix depending on the rewrite path.
// Support both forms so every /api/* request reaches the shared router.
app.use("/", apiRouter);
app.use("/api", apiRouter);

// Export the app for Vercel Serverless Functions
export default app;
