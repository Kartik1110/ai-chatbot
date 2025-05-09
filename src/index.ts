import dotenv from "dotenv";
import express from "express";
import indexRoutes from "./controller";
import { QueryProcessor } from "./services/queryProcessor";
import cors from "cors";

dotenv.config();

const app = express();

const queryProcessor = new QueryProcessor();

// Middleware
app.use(express.json());
app.use(cors());
app.use("/", indexRoutes);

// Initialize services before starting the server
async function initializeServices() {
  try {
    await queryProcessor.initialize();
    console.log("Services initialized successfully");
  } catch (error) {
    console.error("Failed to initialize services:", error);
    process.exit(1);
  }
}


// Initialize services and start the server
initializeServices().then(() => {
  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
}).catch(console.error);
