import express from "express";
import cookieParser from "cookie-parser";
import apiRouter from "../server/routes/index.js";

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// Mount the clean layered API routes
app.use("/api", apiRouter);

// Export the app for Vercel Serverless Functions
export default app;
