import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/AppLayout';
import { ChatInterface } from './components/ChatInterface';
import { LiveSession } from './components/LiveSession';
import { AppView, Settings } from './types';
import { MOCK_DAILY_VERSE, SAMPLE_TOPICS, BIBLE_BOOKS } from './constants';
import { MessageCircle, Play, Heart, Book, Sun, Moon, Volume2, Type, Sparkles, Phone, Key, Lock, CheckCircle, ArrowRight, HelpCircle, ExternalLink } from 'lucide-react';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.SPLASH);
  const [settings, setSettings] = useState<Settings>({
    fontSize: 'large', // Default to Large for elders
    voiceSpeed: 0.8, // Default to Slow (0.8) for elders
    highContrast: false,
    voiceEnabled: true
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState('');

  // Initial Checks
  useEffect(() => {
    const checkApiKey = async () => {
      // 1. Check env var (injected by build)
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }
      // 2. Check LocalStorage (User entered key)
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setHasApiKey(true);
        return;
      }
      // 3. Check AI Studio wrapper
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
        setHasApiKey(true);
      }
    };
    checkApiKey();

    const timer = setTimeout(() => {
      setCurrentView(AppView.ONBOARDING);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleFinishOnboarding = () => {
    if (hasApiKey) {
      setCurrentView(AppView.HOME);
    } else {
      setCurrentView(AppView.API_SETUP);
    }
  };

  const handleManualKeySubmit = () => {
    if (manualKeyInput.trim().length > 10) {
      localStorage.setItem('gemini_api_key', manualKeyInput.trim());
      setHasApiKey(true);
      setCurrentView(AppView.HOME);
    } else {
      alert("Por favor, insira uma chave API válida.");
    }
  };

  const handleConnectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
        setCurrentView(AppView.HOME);
      } catch (e: any) {
        console.error("Failed to select key", e);
        if (e.message && e.message.includes("Requested entity was not found")) {
            try {
                await window.aistudio.openSelectKey();
                setHasApiKey(true);
                setCurrentView(AppView.HOME);
                return;
            } catch (retryError) {
                console.error("Retry failed", retryError);
            }
        }
        alert("Não foi possível conectar a chave automaticamente. Tente inserir manualmente.");
      }
    }
  };

  /* --- VIEW COMPONENTS --- */

  const SplashView = () => (
    <div className="h-full w-full bg-leather flex flex-col items-center justify-center text-gold animate-in fade-in duration-1000">
      <div className="border-4 border-gold p-8 rounded-lg mb-6 shadow-gold">
        <Book size={64} />
      </div>
      <h1 className="font-display text-4xl font-bold tracking-widest text-center">BÍBLIA<br/>RESPONDE</h1>
      <p className="font-serif italic mt-4 text-gold-light opacity-80">Palavras de paz e vida.</p>
    </div>
  );

  const OnboardingView = () => (
    <div className="h-full bg-ivory text-ink flex flex-col p-8 text-center font-serif safe-area-top safe-area-bottom">
      <div className="flex-1 flex flex-col justify-center items-center space-y-8">
        <h2 className="font-display text-3xl text-leather">Bem-vindo</h2>
        <p className="text-xl leading-relaxed">
          Este é o seu espaço sagrado para conversar, aprender e encontrar paz nas escrituras.
        </p>
        <div className="space-y-4 w-full max-w-xs text-left text-lg">
          <div className="flex items-center gap-4">
            <div className="bg-leather text-gold p-3 rounded-full"><MessageCircle /></div>
            <span>Pergunte o que quiser</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-leather text-gold p-3 rounded-full"><Volume2 /></div>
            <span>Ouça a resposta</span>
          </div>
        </div>
      </div>
      <button 
        onClick={handleFinishOnboarding}
        className="bg-leather text-gold font-display font-bold py-4 px-8 rounded-xl shadow-lg hover:bg-leather-dark transition-transform active:scale-95 text-xl"
      >
        Começar
      </button>
    </div>
  );

  const ApiSetupView = () => {
    const [showHelp, setShowHelp] = useState(false);

    return (
      <div className="h-full bg-leather text-ivory flex flex-col p-6 text-center font-serif safe-area-top safe-area-bottom overflow-y-auto">
        <div className="flex-1 flex flex-col items-center space-y-6 pt-8">
          <div className="bg-leather-dark p-6 rounded-full border-2 border-gold shadow-gold mb-2">
            <Key size={40} className="text-gold" />
          </div>
          
          <div>
            <h2 className="font-display text-2xl text-gold mb-2">Configuração de Acesso</h2>
            <p className="text-base opacity-90 leading-relaxed max-w-sm mx-auto">
              Para conversar com a Bíblia, é necessário uma chave de acesso (API Key).
            </p>
          </div>
          
          {/* Manual Input Section */}
          <div className="w-full max-w-xs space-y-4 bg-white/5 p-4 rounded-xl border border-white/10">
              <div className="text-left space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gold opacity-80">Insira sua Chave API</label>
                  <input 
                      type="password"
                      value={manualKeyInput}
                      onChange={(e) => setManualKeyInput(e.target.value)}
                      placeholder="Cole sua chave (AIza...)"
                      className="w-full bg-black/40 border border-gold/30 rounded-lg p-3 text-white placeholder-white/30 focus:border-gold focus:outline-none font-mono text-sm"
                  />
              </div>
              <button 
                  onClick={handleManualKeySubmit}
                  disabled={manualKeyInput.length < 10}
                  className={`w-full font-display font-bold py-3 px-4 rounded-lg shadow-lg transition-all flex items-center justify-center gap-2 ${manualKeyInput.length > 10 ? 'bg-gold text-leather-dark hover:bg-gold-light' : 'bg-stone-700 text-stone-500'}`}
              >
                  <span>Entrar no Aplicativo</span>
                  <ArrowRight size={18} />
              </button>
          </div>

          {/* Help Toggle */}
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center gap-2 text-gold-light/80 hover:text-gold text-sm font-sans"
          >
            <HelpCircle size={16} />
            {showHelp ? "Ocultar ajuda" : "Onde consigo uma chave?"}
          </button>

          {/* Tutorial */}
          {showHelp && (
            <div className="w-full max-w-xs bg-black/20 p-4 rounded-lg text-left space-y-3 text-sm animate-in fade-in slide-in-from-top-2">
              <p className="font-bold text-gold">Como criar uma chave grátis:</p>
              <ol className="list-decimal pl-4 space-y-2 text-white/80">
                <li>
                  Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-gold underline inline-flex items-center gap-1">
                    Google AI Studio <ExternalLink size={10} />
                  </a>
                </li>
                <li>Faça login com sua conta Google.</li>
                <li>Clique no botão <strong>Create API Key</strong>.</li>
                <li>Copie o código e cole no campo acima.</li>
              </ol>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center w-full max-w-xs gap-2 opacity-50 mt-4">
              <div className="h-px bg-white/20 flex-1"></div>
              <span className="text-xs uppercase">OU</span>
              <div className="h-px bg-white/20 flex-1"></div>
          </div>

          {/* Google Auth (If available) */}
          {window.aistudio && (
            <button 
                onClick={handleConnectKey}
                className="w-full max-w-xs bg-white/10 text-white border border-white/20 font-sans font-medium py-3 px-4 rounded-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Lock size={16} />
                Conectar com Google Cloud
              </button>
          )}
        </div>
      </div>
    );
  };

  const HomeView = () => (
    <div className="p-6 flex flex-col gap-6">
      {/* Daily Verse Card */}
      <div className="bg-white/80 rounded-xl p-6 shadow-sm border-l-4 border-gold relative overflow-hidden">
        <span className="text-xs font-sans font-bold text-gold-DEFAULT uppercase tracking-wider mb-2 block">Versículo do Dia</span>
        <p className="text-xl italic text-leather-dark mb-4 leading-relaxed">"{MOCK_DAILY_VERSE.text}"</p>
        <p className="text-right font-display font-bold text-sm text-stone-500">{MOCK_DAILY_VERSE.reference}</p>
        <Heart className="absolute top-4 right-4 text-stone-300" size={20} />
      </div>

      {/* Main Actions */}
      <div className="py-2 flex flex-col gap-4">
        {/* Chat Button */}
        <button 
          onClick={() => setCurrentView(AppView.CHAT)}
          className="w-full bg-leather text-ivory rounded-2xl p-8 shadow-xl border-2 border-gold relative overflow-hidden group transition-transform active:scale-95"
        >
          {/* Glow Effect Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gold/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="text-left space-y-2">
              <div className="flex items-center gap-2 text-gold-light mb-1">
                <Sparkles size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Texto e Áudio</span>
              </div>
              <h3 className="font-display text-3xl font-bold text-white">Conversar</h3>
              <p className="text-white/70 font-sans text-base">Toque para escrever ou falar</p>
            </div>
            
            <div className="bg-gold p-5 rounded-full text-leather-dark shadow-lg shadow-gold/20 group-hover:scale-110 transition-transform">
              <MessageCircle size={40} strokeWidth={2.5} />
            </div>
          </div>
        </button>

        {/* Live Call Button */}
        <button 
          onClick={() => setCurrentView(AppView.LIVE)}
          className="w-full bg-white text-leather rounded-2xl p-6 shadow-md border border-stone-200 relative overflow-hidden group transition-transform active:scale-95 flex items-center justify-between"
        >
          <div className="text-left space-y-1">
            <div className="flex items-center gap-2 text-green-700 mb-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-xs font-bold uppercase tracking-widest">Chamada de Voz</span>
            </div>
            <h3 className="font-display text-2xl font-bold text-leather">Ligar Agora</h3>
            <p className="text-stone-500 font-sans text-sm">Falar como no telefone</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-full text-green-700 border border-green-100 group-hover:bg-green-100 transition-colors">
            <Phone size={32} />
          </div>
        </button>
      </div>

      {/* Quick Topics */}
      <div>
        <h3 className="font-display text-lg font-bold text-leather mb-3 ml-1">Temas Sugeridos</h3>
        <div className="flex flex-wrap gap-3">
          {SAMPLE_TOPICS.map((topic, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentView(AppView.CHAT)} // In a real app, pass topic to chat
              className="bg-white border border-stone-200 px-4 py-3 rounded-lg text-left shadow-sm hover:border-gold hover:text-leather transition-colors text-base"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const ReadingView = () => (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
         {BIBLE_BOOKS.map(book => (
            <div key={book} className="bg-white p-4 rounded-lg shadow-sm border-b-2 border-stone-100 flex items-center justify-between">
                <span className="font-display font-bold text-leather">{book}</span>
                <span className="text-xs text-stone-400 font-sans">Cap 1</span>
            </div>
         ))}
      </div>
      <p className="text-center text-stone-400 italic mt-8">Mais livros serão adicionados em breve.</p>
    </div>
  );

  const SettingsView = () => (
    <div className="p-6 space-y-8">
      
      {/* Font Size */}
      <section>
        <h3 className="font-display font-bold text-lg text-leather mb-4 flex items-center gap-2">
            <Type size={20}/> Tamanho da Letra
        </h3>
        <div className="flex bg-stone-200 rounded-lg p-1">
          {(['small', 'medium', 'large'] as const).map((size) => (
             <button
                key={size}
                onClick={() => setSettings(s => ({...s, fontSize: size}))}
                className={`flex-1 py-3 rounded-md font-serif text-center transition-all ${settings.fontSize === size ? 'bg-white shadow-sm text-leather font-bold' : 'text-stone-500'}`}
             >
                {size === 'small' ? 'A' : size === 'medium' ? 'Aa' : 'AAA'}
             </button>
          ))}
        </div>
      </section>

      {/* Theme */}
      <section>
        <h3 className="font-display font-bold text-lg text-leather mb-4 flex items-center gap-2">
            <Sun size={20}/> Aparência
        </h3>
        <button 
            onClick={() => setSettings(s => ({...s, highContrast: !s.highContrast}))}
            className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${settings.highContrast ? 'bg-black border-white text-white' : 'bg-ivory border-leather text-leather'}`}
        >
            <span>Alto Contraste</span>
            {settings.highContrast ? <Moon /> : <Sun />}
        </button>
      </section>

      {/* API Key Management */}
      <section>
        <h3 className="font-display font-bold text-lg text-leather mb-4 flex items-center gap-2">
            <Key size={20}/> Chave de Acesso
        </h3>
        <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-stone-500 mb-2">Chave salva no dispositivo</p>
            <div className="flex gap-2">
                <input 
                    type="password" 
                    value="************************" 
                    disabled 
                    className="flex-1 bg-stone-100 border-none rounded px-3 py-2 text-stone-500"
                />
                <button 
                    onClick={() => {
                        localStorage.removeItem('gemini_api_key');
                        window.location.reload();
                    }}
                    className="bg-red-100 text-red-600 px-3 py-2 rounded font-bold text-sm hover:bg-red-200"
                >
                    Sair
                </button>
            </div>
        </div>
      </section>

      <div className="pt-8 text-center">
        <p className="text-xs text-stone-400">Versão 1.0.0 • Bíblia Responde</p>
      </div>
    </div>
  );

  const FavoritesView = () => (
      <div className="p-8 text-center text-stone-500">
          <Heart size={48} className="mx-auto mb-4 text-stone-300" />
          <h3 className="font-display text-xl mb-2">Seus Favoritos</h3>
          <p>Salve conversas e versículos tocando no coração.</p>
      </div>
  );

  if (currentView === AppView.SPLASH) return <SplashView />;
  if (currentView === AppView.ONBOARDING) return <OnboardingView />;
  if (currentView === AppView.API_SETUP) return <ApiSetupView />;
  if (currentView === AppView.LIVE) return <LiveSession onExit={() => setCurrentView(AppView.CHAT)} />;

  return (
    <AppLayout 
        view={currentView} 
        setView={setCurrentView} 
        settings={settings}
        title={currentView === AppView.CHAT ? "Conversa" : currentView === AppView.SETTINGS ? "Ajustes" : undefined}
    >
      {currentView === AppView.HOME && <HomeView />}
      {currentView === AppView.CHAT && <ChatInterface settings={settings} onStartLive={() => setCurrentView(AppView.LIVE)} />}
      {currentView === AppView.READING && <ReadingView />}
      {currentView === AppView.SETTINGS && <SettingsView />}
      {currentView === AppView.FAVORITES && <FavoritesView />}
    </AppLayout>
  );
};

export default App;