"use client"
import { useState, useRef, useEffect } from "react"

export default function Home() {
  // Hydration fix
  const [mounted, setMounted] = useState(false)
  
  // State for multiple chat sessions
  const [conversations, setConversations] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<number | null>(null)
  
  const [input, setInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [uploaded, setUploaded] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)

  // Find current active conversation data
  const currentChat = conversations.find(c => c.id === activeChat)

  // NEW FEATURE: PERSISTENCE - Load from LocalStorage on mount
  useEffect(() => {
    setMounted(true)
    fetchFiles()
    
    const saved = localStorage.getItem("documind_history")
    if (saved) {
      const parsed = JSON.parse(saved)
      setConversations(parsed)
      if (parsed.length > 0) setActiveChat(parsed[0].id)
    } else {
      // Default initial chat if nothing is saved
      const initialId = Date.now()
      setConversations([{ id: initialId, messages: [], title: "New Chat" }])
      setActiveChat(initialId)
    }
  }, [])

  // NEW FEATURE: PERSISTENCE - Save to LocalStorage on change
  useEffect(() => {
    if (mounted && conversations.length > 0) {
      localStorage.setItem("documind_history", JSON.stringify(conversations))
    }
  }, [conversations, mounted])

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [currentChat?.messages])

  const fetchFiles = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/files")
      const data = await res.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error("Error fetching files:", error)
    }
  }

  const createNewChat = () => {
    const newId = Date.now()
    const timestamp = new Date(newId).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setConversations(prev => [{ id: newId, messages: [], title: `Chat ${timestamp}` }, ...prev])
    setActiveChat(newId)
  }

  // NEW FEATURE: DELETE CHAT
  const deleteChat = (id: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent selecting the chat while deleting
    const filtered = conversations.filter(c => c.id !== id)
    setConversations(filtered)
    if (activeChat === id && filtered.length > 0) {
      setActiveChat(filtered[0].id)
    } else if (filtered.length === 0) {
      createNewChat()
    }
  }

  // NEW FEATURE: DELETE DOCUMENT
  const deleteDocument = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Remove ${filename} from database?`)) return
    try {
      const res = await fetch(`http://127.0.0.1:8000/files/${filename}`, { method: "DELETE" })
      if (res.ok) fetchFiles()
    } catch (error) {
      alert("Failed to delete file")
    }
  }

  const uploadFile = async () => {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      await fetch("http://127.0.0.1:8000/upload", { method: "POST", body: formData })
      setUploaded(true)
      fetchFiles()
    } catch (error) {
      alert("Upload failed")
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeChat) return

    const userMsg = { role: "user", content: input }
    const currentInput = input
    setInput("")

    // Add user message to state
    setConversations(prev => prev.map(chat => 
      chat.id === activeChat ? { ...chat, messages: [...chat.messages, userMsg] } : chat
    ))

    setLoading(true)

    try {
      const response = await fetch(`http://127.0.0.1:8000/ask?question=${encodeURIComponent(currentInput)}`)
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      
      let aiContent = ""
      const aiMsg = { role: "assistant", content: "" }

      // Add placeholder for AI response
      setConversations(prev => prev.map(chat => 
        chat.id === activeChat ? { ...chat, messages: [...chat.messages, aiMsg] } : chat
      ))

      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiContent += decoder.decode(value)

        // Update current AI message content in real-time
        setConversations(prev => prev.map(chat => {
          if (chat.id === activeChat) {
            const newMsgs = [...chat.messages]
            newMsgs[newMsgs.length - 1] = { ...aiMsg, content: aiContent }
            
            // Auto-update title based on first message
            const newTitle = chat.messages.length <= 1 
                ? (currentInput.substring(0, 25) + "...") 
                : chat.title;

            return { ...chat, messages: newMsgs, title: newTitle }
          }
          return chat
        }))
      }
    } catch (error) {
      console.error("Streaming error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return <div className="h-screen bg-slate-900" />

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Sidebar: Chats & Files */}
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800">
        <div className="p-4 border-b border-slate-800 space-y-4">
          <button 
            onClick={createNewChat}
            className="w-full bg-white text-slate-900 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Chat
          </button>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 border-b border-slate-800 custom-scrollbar">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-2 mb-2">History</p>
          {conversations.map(chat => (
            <div key={chat.id} className="group relative">
                <button
                onClick={() => setActiveChat(chat.id)}
                className={`w-full text-left p-3 rounded-lg text-sm truncate transition-all pr-10 ${
                    activeChat === chat.id 
                    ? "bg-slate-800 text-white border-l-4 border-blue-500 shadow-inner" 
                    : "hover:bg-slate-800/50 text-slate-400 hover:text-slate-200"
                }`}
                >
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span className="truncate">{chat.title}</span>
                </div>
                </button>
                <button 
                    onClick={(e) => deleteChat(chat.id, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            </div>
          ))}
        </div>

        {/* Knowledge Base (Files) */}
        <div className="h-1/3 p-4 overflow-y-auto bg-slate-950/30">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest px-2 mb-2">Knowledge Base</p>
          <div className="space-y-2">
            {files.length === 0 ? (
               <p className="text-[10px] text-slate-600 px-2 italic">No files indexed</p>
            ) : (
              files.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-slate-800/30 text-[11px] border border-slate-800/50 group hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-2 truncate">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>
                    <span className="truncate text-slate-400 group-hover:text-slate-200" title={f}>{f}</span>
                  </div>
                  <button onClick={(e) => deleteDocument(f, e)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 leading-none">DocuMind AI</h1>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">Mistral-7B RAG Pipeline</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 pr-3">
            <input
              type="file"
              onChange={(e: any) => {
                setFile(e.target.files[0])
                setUploaded(false)
              }}
              className="text-xs text-slate-500 file:bg-white file:text-slate-700 file:border file:border-slate-200 file:px-3 file:py-1.5 file:rounded-lg file:font-bold file:mr-3 cursor-pointer hover:file:bg-slate-50"
            />
            <button 
              onClick={uploadFile} 
              className={`${uploaded ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'} text-white text-xs px-4 py-1.5 rounded-lg font-bold transition-colors`}
            >
              {uploaded ? "✓ Indexed" : "Index PDF"}
            </button>
          </div>
        </header>

        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
          <div className="max-w-3xl mx-auto space-y-6">
            {currentChat?.messages.length === 0 && (
              <div className="text-center py-32 space-y-4">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
                </div>
                <h3 className="text-slate-800 font-semibold">Start a conversation</h3>
                <p className="text-slate-400 text-sm max-w-xs mx-auto italic">
                  Index your PDFs using the header button, then ask questions about their content here.
                </p>
              </div>
            )}
            
            {currentChat?.messages.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                  msg.role === "user" 
                    ? "bg-blue-600 text-white rounded-br-none" 
                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                }`}>
                  <div className="flex items-center gap-2 mb-1 opacity-60">
                    <span className="font-bold text-[9px] uppercase tracking-widest">
                      {msg.role === "user" ? "User" : "DocuMind AI"}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-5 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Form */}
        <footer className="p-6 bg-white border-t border-slate-200">
          <div className="max-w-3xl mx-auto flex gap-3 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Query your document database..."
              className="flex-1 bg-slate-50 border border-slate-200 p-4 px-6 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none transition-all pr-20"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="absolute right-2 top-2 bottom-2 bg-slate-900 text-white px-5 rounded-xl font-bold hover:bg-black transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-2"
            >
              <span>Send</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400 mt-3">
            AI can make mistakes. Verify information from the source documents.
          </p>
        </footer>
      </main>
    </div>
  )
}