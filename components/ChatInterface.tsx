import React, { useState, useRef, useEffect } from 'react';
import { Message, Settings, AppView } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { startListening, speakText, stopSpeaking } from '../services/voiceService';
import { Mic, Send, Volume2, Square, Loader2, Phone } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatInterfaceProps {
  settings: Settings;
  onStartLive: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ settings, onStartLive }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '**A Paz do Senhor esteja com você.** \n\nEstou aqui para fazer companhia, ler a Bíblia e conversar com calma. Sinta-se em casa. \n\nO que gostaria de ouvir ou perguntar hoje?',
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);
    stopSpeaking(); // Stop any current speech

    try {
      const responseText = await sendMessageToGemini(messages, userMsg.text);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, botMsg]);

      // Auto-speak if voice is enabled in settings
      if (settings.voiceEnabled) {
        handleSpeak(responseText);
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      // Manual stop not strictly needed as voice service handles single utterance, 
      // but good for UX state cleanup
      setIsListening(false);
      return;
    }

    setIsListening(true);
    stopSpeaking();

    startListening(
      (text) => {
        setInputText(text);
        setIsListening(false);
      },
      () => setIsListening(false), // onEnd
      (err) => {
        console.error("Mic error", err);
        setIsListening(false);
        alert("Não foi possível acessar o microfone. Verifique as permissões.");
      }
    );
  };

  const handleSpeak = (text: string) => {
    setIsSpeaking(true);
    speakText(text, settings.voiceSpeed);
    
    // Reset speaking state logic is tricky with window.speechSynthesis as it doesn't give a clean 'end' callback globally easily without wrapping.
    // For MVP, we toggle state purely for visual feedback or use a timeout/interval to check `speaking` prop.
    const interval = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
            setIsSpeaking(false);
            clearInterval(interval);
        }
    }, 500);
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Live Call CTA - Floating top right or embedded header */}
      <div className="absolute top-2 right-4 z-20">
        <button 
          onClick={onStartLive}
          className="bg-green-600/90 hover:bg-green-500 text-white rounded-full px-4 py-2 shadow-md flex items-center gap-2 transition-transform active:scale-95 backdrop-blur-sm"
        >
           <Phone size={16} className="animate-pulse" />
           <span className="text-xs font-bold uppercase tracking-wide">Ligar</span>
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pt-12">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`
                max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-leather text-ivory rounded-br-none' 
                  : 'bg-white/60 border border-stone-200 text-ink rounded-bl-none'}
              `}
            >
              {msg.role === 'model' ? (
                <div className="prose prose-stone prose-p:my-2 prose-headings:font-display prose-headings:text-leather prose-li:my-0">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                  <div className="mt-3 pt-2 border-t border-stone-300 flex justify-start">
                     <button 
                        onClick={() => isSpeaking ? handleStopSpeaking() : handleSpeak(msg.text)}
                        className="flex items-center gap-2 text-leather hover:bg-leather/10 px-3 py-1 rounded-full transition-colors"
                        aria-label="Ouvir resposta"
                     >
                        {isSpeaking ? <Square size={18} fill="currentColor" /> : <Volume2 size={20} />}
                        <span className="text-sm font-sans font-medium uppercase tracking-wide">
                            {isSpeaking ? 'Parar' : 'Ouvir'}
                        </span>
                     </button>
                  </div>
                </div>
              ) : (
                <p className="font-sans text-lg">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
             <div className="bg-white/60 rounded-2xl p-4 rounded-bl-none flex items-center gap-3">
                <Loader2 className="animate-spin text-leather" size={24} />
                <span className="text-stone-500 font-sans italic">Escrevendo...</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white/40 border-t border-leather/10">
        <div className="flex gap-2 items-end">
          <button
            onClick={handleMicClick}
            className={`
              h-14 w-14 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
              ${isListening 
                ? 'bg-red-600 text-white animate-pulse shadow-lg scale-110' 
                : 'bg-leather text-gold shadow-md hover:bg-leather-dark'}
            `}
            aria-label="Falar"
          >
            <Mic size={28} />
          </button>
          
          <div className="flex-1 bg-white rounded-2xl border border-stone-300 shadow-inner flex items-center px-4 py-2 focus-within:ring-2 focus-within:ring-gold/50">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite ou fale sua dúvida..."
              className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 py-2 font-sans text-lg"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isProcessing}
            className={`
              h-14 w-14 rounded-full flex items-center justify-center shrink-0 transition-colors
              ${!inputText.trim() 
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed' 
                : 'bg-gold text-leather-dark shadow-md hover:bg-gold-light'}
            `}
            aria-label="Enviar"
          >
            <Send size={24} />
          </button>
        </div>
        <p className="text-center text-[10px] uppercase tracking-widest text-stone-400 mt-2 font-sans">
          Bíblia Responde • IA Generativa
        </p>
      </div>
    </div>
  );
};