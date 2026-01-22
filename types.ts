import React from 'react';

export enum AppView {
  SPLASH = 'SPLASH',
  ONBOARDING = 'ONBOARDING',
  API_SETUP = 'API_SETUP',
  HOME = 'HOME',
  CHAT = 'CHAT',
  READING = 'READING',
  SETTINGS = 'SETTINGS',
  FAVORITES = 'FAVORITES',
  LIVE = 'LIVE'
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  // If true, the message has structured data (for model responses)
  isStructured?: boolean;
}

export interface Settings {
  fontSize: 'small' | 'medium' | 'large';
  voiceSpeed: number; // 0.8 (Slow), 1.0 (Normal), 1.2 (Fast)
  highContrast: boolean;
  voiceEnabled: boolean;
}

export interface DailyVerse {
  reference: string;
  text: string;
}

// Navigation Item Interface
export interface NavItem {
  id: AppView;
  label: string;
  icon: React.ReactNode;
}

// Extend Window interface for AI Studio integration
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}