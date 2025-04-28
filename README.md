# Document Processing and Query System

This system provides an API for processing documents (PDF, HTML, Excel) and answering queries based on the processed content using a hybrid search approach combining dense and sparse retrieval methods.

## Features

- Document processing support for PDF, HTML, and Excel files
- Semantic chunking with configurable overlap
- Hybrid search combining dense embeddings and BM25 scoring
- Query rewriting for improved retrieval
- Confidence scoring for answers

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory with the following variables:
```env
OPENAI_API_KEY=your_openai_api_key
```

3. Create required directories:
```bash
mkdir uploads
mkdir documents
```

## API Endpoints

### Process Document
```http
POST /api/process-document
Content-Type: multipart/form-data

file: <document_file>
```

### Query Documents
```http
POST /api/query
Content-Type: application/json

{
  "query": "What are the minimum investment requirements?"
}
```

## Usage Example

1. Start the server:
```bash
npm start
```

2. Process a document:
```bash
curl -X POST -F "file=@/path/to/your/document.pdf" http://localhost:3000/api/process-document
```

3. Query the processed documents:
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"What are the minimum investment requirements?"}' \
  http://localhost:3000/api/query
```

## Architecture

The system consists of three main services:

1. **DocumentProcessor**: Handles document ingestion and chunking
2. **HybridSearch**: Combines dense embeddings and BM25 for retrieval
3. **QueryProcessor**: Manages query processing and response generation

## Dependencies

- Node.js >= 14
- OpenAI API access
- ChromaDB for vector storage
- PDF, HTML, and Excel processing libraries 