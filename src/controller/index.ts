import path from "path";
import multer from "multer";
import { Router, Request, Response } from "express";
import { QueryProcessor } from "../services/queryProcessor";
import { DocumentProcessor } from "../services/documentProcessor";

const router = Router();
const upload = multer({ dest: "uploads/" });
const queryProcessor = new QueryProcessor();

// Ensure uploads directory exists
// (async () => {
//   try {
//     fs.mkdirSync("./uploads", { recursive: true });
//   } catch (error) {
//     console.error("Error creating uploads directory:", error);
//   }
// })();

// router.post("/query", async (req: Request, res: Response) => {
//   try {
//     await initializeChromaDB();
//     const { query } = req.body;

//     if (!query || typeof query !== "string") {
//       return res
//         .status(400)
//         .json({ error: "Query must be a non-empty string" });
//     }

//     // Generate embedding for the query text
//     const queryEmbedding = await generateEmbedding(query, "question");
//     const documents = await queryDocuments(queryEmbedding);
//     const result = await processQuery(query, documents);

//     res.json({
//       answer: result.answer,
//       confidence: result.confidence,
//       sources: documents,
//     });
//   } catch (error) {
//     console.error("Error querying documents:", error);
//     res.status(500).json({ error: "Failed to query documents" });
//   }
// });

// router.post("/generate-embedding", async (req: Request, res: Response) => {
//   try {
//     // Initialize ChromaDB first
//     await initializeChromaDB();

//     const filePath = "/home/kartik/code/chatbot/yoda-endgame/docs/NSE-FAQs.pdf";
//     const text = fs.readFileSync(filePath);
//     // clean up the pdf text to remove all the metadata and only keep the text
//     const cleanedText = await pdf(text);
//     const embedding = await generateEmbedding(cleanedText.text, "document");
//     res.json(embedding);
//   } catch (error) {
//     console.error("Error generating embedding:", error);
//     res.status(500).json({ error: "Failed to generate embedding" });
//   }
// });

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
