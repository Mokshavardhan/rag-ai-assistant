# DocuMind AI

AI-powered document assistant that allows users to upload PDFs and ask questions about them using Retrieval Augmented Generation (RAG).

## Features

- Multi-document knowledge base
- ChatGPT-style chat interface
- Streaming responses
- Conversation history
- File manager
- Local LLM using Ollama (Mistral)

## Tech Stack

Frontend
- Next.js
- Tailwind CSS

Backend
- FastAPI
- LangChain

AI
- Mistral (Ollama)
- HuggingFace Embeddings

Vector Database
- ChromaDB

## Architecture

[architecture diagram]

## Demo

![Demo](docs/demo.gif)

## Run Locally

### Backend

pip install -r requirements.txt  
uvicorn app.main:app --reload

### Frontend

npm install  
npm run dev