import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, Mic, Paperclip, Volume2, User, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'undefined' || key === 'YOUR_API_KEY_HERE') {
    return null;
  }
  return key;
};

export const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string, type?: 'text' | 'image' }[]>([
    { role: 'bot', text: 'Hello! I am your OPTISCANN Eye Health Assistant. How can I help you today? (I support English, Tamil, and more!)' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text: string, image?: string) => {
    if (!text && !image) return;

    const apiKey = getApiKey();
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'user', text: text || 'Sent an image' }, { role: 'bot', text: 'Gemini API key is missing or invalid. Please set GEMINI_API_KEY in your .env file.' }]);
      return;
    }

    const ai = new GoogleGenAI({ apiKey });
    const userMsg = { role: 'user' as const, text: text || 'Sent an image' };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const model = ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: `You are a specialized Optical and Eye Health Assistant for the OPTISCANN app. 
                     Answer the user's question accurately. 
                     If the user asks in a specific language (like Tamil), answer in that same language.
                     Keep answers concise and helpful. 
                     If an image is provided, analyze it for eye-related concerns.
                     User Question: ${text}` },
            ...(image ? [{ inlineData: { mimeType: "image/jpeg", data: image.split(',')[1] } }] : [])
          ]
        }
      });

      const response = await model;
      const botMsg = { role: 'bot' as const, text: response.text || 'I am sorry, I could not process that.' };
      setMessages(prev => [...prev, botMsg]);
      
      // Voice output (Disabled as per user request)
      /*
      if (botMsg.text) {
        const utterance = new SpeechSynthesisUtterance(botMsg.text);
        window.speechSynthesis.speak(utterance);
      }
      */
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Voice recognition not supported in this browser.");

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Default, but it often detects others
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };
    recognition.start();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSend('', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[1000]">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-[380px] h-[550px] rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold">Eye Assistant</h3>
                  <p className="text-[10px] text-emerald-400 uppercase tracking-widest">Online</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${m.role === 'user' ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Ask about eye health..." 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSend(input)}
                  className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm focus:ring-2 focus:ring-slate-900 transition-all"
                />
                <button 
                  onClick={() => handleSend(input)}
                  className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="flex justify-center gap-4">
                <button onClick={startVoice} className={`p-2 rounded-full transition-all ${isListening ? 'bg-rose-100 text-rose-500 animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-slate-900'}`}>
                  <Mic size={20} />
                </button>
                <label className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full cursor-pointer transition-all">
                  <Paperclip size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all active:scale-95"
      >
        <MessageSquare size={28} />
      </button>
    </div>
  );
};
