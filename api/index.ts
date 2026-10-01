import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../server/routes/index.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Vercel rewrites /api/* requests to this function at /api. Mount the shared
// router at the function root so /api/investments resolves to /investments.
app.use("/", apiRouter);

// Export the app for Vercel Serverless Functions
export default app;
