import os
import uuid
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaLLM
from langchain_huggingface import HuggingFaceEmbeddings

# -------------------------------
# 1. Load models ONLY once
# -------------------------------
embeddings = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

llm = OllamaLLM(model="mistral")

# -------------------------------
# 2. Initialize Vector Store
# -------------------------------
vectorstore = Chroma(
    persist_directory="chroma_db",
    embedding_function=embeddings
)

retriever = vectorstore.as_retriever(search_kwargs={"k": 5}) # Increased k for better multi-doc coverage

# -------------------------------
# 3. Logic to add documents with Metadata
# -------------------------------
def add_document(pdf_path):
    loader = PyPDFLoader(pdf_path)
    docs = loader.load()

    # Extract the filename to use as a label
    file_name = os.path.basename(pdf_path)

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    chunks = splitter.split_documents(docs)

    # Attach the filename to every chunk's metadata
    for chunk in chunks:
        chunk.metadata["source"] = file_name

    vectorstore.add_documents(chunks)
    vectorstore.persist()
    print(f"Added {file_name} to knowledge base with metadata.")

# -------------------------------
# 4. Logic to ask questions with Source Awareness
# -------------------------------
def ask_question(question):
    # Retrieve chunks
    docs = retriever.invoke(question)

    # Build context string that explicitly mentions the source of each chunk
    context_parts = []
    for doc in docs:
        source = doc.metadata.get("source", "Unknown Document")
        content = doc.page_content
        context_parts.append(f"--- START CHUNK FROM {source} ---\n{content}\n--- END CHUNK ---")

    context = "\n\n".join(context_parts)

    # Updated Prompt to force the AI to respect the sources
    prompt = f"""
You are a helpful AI assistant with access to multiple uploaded documents.
Each document chunk below is labeled with its source filename.

Instructions:
1. Answer the question ONLY using the provided context.
2. If the user asks to "describe" or "show" a specific file, look for chunks labeled with that filename.
3. If the answer is not in the context, say: "I couldn't find this information in the uploaded documents."

Context:
{context}

Question:
{question}

Answer:
"""
    return llm.invoke(prompt)