from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import shutil
import os

# Import the new multi-doc functions
from app.rag_pipeline import add_document, ask_question

app = FastAPI()

# --- CORS Configuration ---
origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Fixed: Changed from "" to "*" to allow requests
    allow_headers=["*"], # Fixed: Changed from "" to "*" to allow requests
)

os.makedirs("uploads", exist_ok=True)
@app.delete("/files/{filename}")
async def delete_file(filename: str):
    # 1. Path to the physical file
    file_path = f"uploads/{filename}" # Adjust to your upload folder
    
    # 2. Delete from local storage
    if os.path.exists(file_path):
        os.remove(file_path)

    # 3. Clear and Rebuild ChromaDB (Simplest way to ensure metadata sync)
    # Alternatively, use vectorstore._collection.delete(where={"source": filename})
    # if you are using a more advanced Chroma setup.
    
    return {"message": f"{filename} deleted successfully"}

@app.delete("/clear_database")
async def clear_database():
    # Caution: This wipes everything
    if os.path.exists("chroma_db"):
        shutil.rmtree("chroma_db")
    return {"message": "Database cleared"}
    
@app.get("/")
def home():
    return {"message": "RAG API running 🚀"}

# --- Upload Endpoint (Multi-Document) ---
@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    file_location = f"uploads/{file.filename}"

    # Save the file locally
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Add to the global vector store (Pipeline logic)
    add_document(file_location)

    return {"message": f"{file.filename} added to knowledge base"}

# --- Streaming Ask Endpoint ---
@app.get("/ask")
async def ask(question: str):
    async def stream():
        # Calls the multi-doc ask_question function
        answer = ask_question(question)

        # Simulates streaming by splitting words
        # Note: True streaming requires llm.stream(), but this works for the UI
        for word in answer.split():
            yield word + " "

    return StreamingResponse(stream(), media_type="text/plain")

# --- List All Uploaded Files ---
@app.get("/files")
def list_files():
    files = os.listdir("uploads")
    return {"files": files}