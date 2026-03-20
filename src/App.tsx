import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Image as ImageIcon, 
  MapPin, 
  Volume2, 
  Stethoscope, 
  Info, 
  Loader2, 
  X,
  ExternalLink,
  Mic,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getMedicalResponse, findNearbyClinics, speakText } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  mapsLinks?: { uri: string; title: string }[];
  groundingLinks?: { uri: string; title: string }[];
  isNearbySearch?: boolean;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello, I am **Dr. MedMind**, your digital medical consultant. I am here to provide clinical insights and health guidance.

### What I can do for you:
*   **Symptom Analysis:** Describe how you feel, and I'll provide a potential diagnosis.
*   **Medication Guidance:** I can suggest over-the-counter treatments and explain how they work.
*   **Visual Diagnosis:** Upload photos of symptoms or prescriptions for my review.
*   **Nearby Care:** I can find the closest clinics and hospitals to your current location.
*   **Medical Research:** I use real-time search to find the latest evidence-based health data.

*Disclaimer: I am an AI assistant acting as a digital doctor. My suggestions are for informational purposes and do not replace an in-person physical exam. In case of emergency, call 911 immediately.*`,
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
      }
    }
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      image: selectedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await getMedicalResponse(input, selectedImage || undefined);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        groundingLinks: response.groundingChunks
          .filter((c: any) => c.web)
          .map((c: any) => ({ uri: c.web.uri, title: c.web.title })),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I'm sorry, I encountered an error processing your request. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNearbySearch = async () => {
    setIsLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      const response = await findNearbyClinics(latitude, longitude);

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.text || "Here are some medical facilities near you:",
        mapsLinks: response.mapsLinks,
        isNearbySearch: true,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "I couldn't access your location. Please ensure location permissions are granted.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = async (text: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const audioData = await speakText(text);
      if (audioData) {
        const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
      }
    } catch (error) {
      console.error(error);
      setIsSpeaking(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Stethoscope className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">MedMind AI</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Professional Medical Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleNearbySearch}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Find Nearby Clinics
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div className={cn(
                  "px-4 py-3 rounded-2xl shadow-sm",
                  msg.role === 'user' 
                    ? "bg-emerald-600 text-white rounded-tr-none" 
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                )}>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="Uploaded symptom" 
                      className="max-w-full rounded-lg mb-3 border border-white/20"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="prose prose-slate prose-sm max-w-none dark:prose-invert">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                  
                  {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sources</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.groundingLinks.map((link, i) => (
                          <a 
                            key={i} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-emerald-700 text-[11px] font-medium rounded border border-slate-200 transition-colors"
                          >
                            {link.title}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.mapsLinks && msg.mapsLinks.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nearby Locations</p>
                      <div className="flex flex-col gap-2">
                        {msg.mapsLinks.map((link, i) => (
                          <a 
                            key={i} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg border border-emerald-100 transition-colors"
                          >
                            <span>{link.title}</span>
                            <MapPin className="w-4 h-4 text-emerald-600" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {msg.role === 'assistant' && (
                  <button 
                    onClick={() => handleSpeak(msg.content)}
                    disabled={isSpeaking}
                    className="mt-2 p-1.5 text-slate-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                  >
                    <Volume2 className={cn("w-4 h-4", isSpeaking && "animate-pulse")} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-sm italic">
              <Loader2 className="w-4 h-4 animate-spin" />
              MedMind is thinking...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-6 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto">
          {selectedImage && (
            <div className="relative inline-block mb-4">
              <img 
                src={selectedImage} 
                alt="Preview" 
                className="h-20 w-20 object-cover rounded-xl border-2 border-emerald-500 shadow-lg"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          
          <div className="relative flex items-center gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
              title="Upload image of symptom or prescription"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            
            <div className="flex-1 relative flex items-center gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Describe your symptoms or ask a medical question..."
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none min-h-[52px] max-h-32"
                  rows={1}
                />
                <button 
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all shadow-sm"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              
              <button 
                onClick={toggleListening}
                className={cn(
                  "p-3 rounded-xl transition-all shadow-sm",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-emerald-600"
                )}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                <Mic className={cn("w-6 h-6", isListening && "scale-110")} />
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-6 text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Emergency: Call 911
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="w-3 h-3" />
              AI-Powered Assistant
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
