import React from 'react';
import { Settings, AppView } from '../types';
import { BookOpen, MessageCircle, Settings as SettingsIcon, Home, Heart } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  view: AppView;
  setView: (view: AppView) => void;
  settings: Settings;
  title?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  view, 
  setView, 
  settings,
  title 
}) => {
  const getFontSizeClass = () => {
    switch(settings.fontSize) {
      case 'small': return 'text-base';
      case 'large': return 'text-xl';
      default: return 'text-lg';
    }
  };

  const NavButton = ({ target, icon, label }: { target: AppView, icon: React.ReactNode, label: string }) => {
    const isActive = view === target;
    return (
      <button 
        onClick={() => setView(target)}
        className={`flex flex-col items-center justify-center w-full py-2 transition-colors duration-200 ${
          isActive ? 'text-leather-dark scale-105' : 'text-gray-500'
        }`}
      >
        <div className={`${isActive ? 'text-leather-dark drop-shadow-sm' : ''}`}>
          {icon}
        </div>
        <span className={`text-xs mt-1 font-sans font-medium ${isActive ? 'font-bold' : ''}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className={`
      w-full h-screen overflow-hidden flex flex-col relative
      ${settings.highContrast ? 'bg-black' : 'bg-leather'}
    `}>
      {/* Decorative Leather stitching top */}
      <div className="h-2 bg-black/20 w-full border-b border-white/5" />

      {/* Main Content Area - The "Page" */}
      <div className={`
        flex-1 m-2 sm:m-4 rounded-xl shadow-page overflow-hidden flex flex-col relative
        ${settings.highContrast ? 'bg-gray-900 text-white' : 'bg-ivory text-ink'}
      `}>
        {/* Header */}
        <header className="h-16 flex items-center justify-center relative border-b border-leather/10 px-4 shrink-0">
          <h1 className="font-display font-bold text-xl tracking-wider text-leather-dark">
            {title || "Bíblia Responde"}
          </h1>
          {/* Gold Accent Line */}
          <div className="absolute bottom-0 left-1/4 right-1/4 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent opacity-60"></div>
        </header>

        {/* Scrollable Content */}
        <main className={`flex-1 overflow-y-auto overflow-x-hidden relative ${getFontSizeClass()} font-serif leading-relaxed`}>
          {children}
        </main>

        {/* Navigation Bar */}
        <nav className={`
          h-20 shrink-0 border-t flex items-center justify-around px-2 pb-2
          ${settings.highContrast ? 'bg-gray-800 border-gray-700' : 'bg-[#EAE0CC] border-leather/10'}
        `}>
          <NavButton target={AppView.HOME} icon={<Home size={28} />} label="Início" />
          <NavButton target={AppView.CHAT} icon={<MessageCircle size={28} />} label="Conversar" />
          <NavButton target={AppView.READING} icon={<BookOpen size={28} />} label="Ler" />
          <NavButton target={AppView.FAVORITES} icon={<Heart size={28} />} label="Favoritos" />
          <NavButton target={AppView.SETTINGS} icon={<SettingsIcon size={28} />} label="Ajustes" />
        </nav>
      </div>

      {/* Decorative Leather stitching bottom */}
      <div className="h-2 bg-black/20 w-full border-t border-white/5" />
    </div>
  );
};
