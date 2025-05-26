import path from "path";
import multer from "multer";
import { Router, Request, Response } from "express";
import { QueryProcessor } from "../services/queryProcessor";
import { DocumentProcessor } from "../services/documentProcessor";

const router = Router();
const upload = multer({ dest: "uploads/" });
const queryProcessor = new QueryProcessor();

router.post(
  "/api/process-document",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      const fileType = path.extname(req.file.originalname).slice(1);
      const documents = await DocumentProcessor.processFile(
        req.file.path,
        fileType
      );

      res.json({
        success: true,
        data: {
          chunks: documents.length,
          documents,
        },
        message: "Document processed successfully",
      });
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process document",
      });
    }
  }
);

router.post("/api/query", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }
    const result = await queryProcessor.processQuery(query);
    res.json({
      success: true,
      data: result,
      message: "Query processed successfully",
    });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process query",
    });
  }
});

export default router;
