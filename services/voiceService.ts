// Browser native speech recognition types
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export const startListening = (
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (error: any) => void
): any => {
  const windowObj = window as unknown as IWindow;
  const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError("Speech recognition not supported in this browser.");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };

  recognition.onerror = (event: any) => {
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.start();
  return recognition;
};

export const speakText = (text: string, speed: number = 0.9) => {
  // Cancel any current speech
  window.speechSynthesis.cancel();

  // Strip markdown symbols for cleaner speech (basic regex)
  const cleanText = text
    .replace(/\*\*/g, '') // remove bold
    .replace(/\*/g, '')   // remove italics
    .replace(/^#+\s/gm, '') // remove headers
    .replace(/-/g, ' '); // replace dashes

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'pt-BR';
  utterance.rate = speed;
  utterance.pitch = 0.95; // Slightly deeper/softer for "mansa" effect

  // Try to find a good Portuguese voice
  // Prioritize "Google" voices as they are more natural/neural than system defaults
  const voices = window.speechSynthesis.getVoices();
  const ptVoice = voices.find(v => 
    (v.lang.includes('pt-BR') || v.lang.includes('pt')) && v.name.includes('Google')
  ) || voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt'));

  if (ptVoice) {
    utterance.voice = ptVoice;
  }

  window.speechSynthesis.speak(utterance);
};

export const stopSpeaking = () => {
  window.speechSynthesis.cancel();
};