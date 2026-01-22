import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';

// Tiny silent mp3 to keep the audio session active in background
const SILENT_AUDIO_URI = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTVFMAAAANYAAAZW5jb2RlcgBMYXZmNTguMjkuMTAwAAAAAAAAAAAAAAH//ebdAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMGluZm8AAAAPAAAABwAAAB0AExMTE1NYWFhYZmZmZm5wcHBweHh4eH+AgICBjY2NjZSUlJSZnZ2dnalra2ttbW1tcHBwcHV1dXV5eXl5fX19fX+AgICAgICAgP/73n3AAAB9AAAABQAAAAcAAABoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

export const useLiveSession = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentVolumeRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMountedRef = useRef(true);

  // Wake Lock & Background Audio Refs
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Volume analyzer
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    // Handle visibility change to restore audio context if tab comes back
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        if (inputAudioContextRef.current?.state === 'suspended') {
          await inputAudioContextRef.current.resume();
        }
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => { 
      isMountedRef.current = false; 
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, []);

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (err) {
        console.warn("Wake Lock request failed:", err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.warn("Wake Lock release failed:", err);
      }
    }
  };

  const updateVolume = () => {
    if (!isMountedRef.current) return;
    
    if (analyzerRef.current) {
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Smooth transition
      currentVolumeRef.current += (average - currentVolumeRef.current) * 0.1;
      setVolume(currentVolumeRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(updateVolume);
  };

  const connect = useCallback(async () => {
    try {
      setError(null);
      // Retrieve key from Env or LocalStorage
      const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
      if (!apiKey) throw new Error("Chave API não encontrada.");

      const ai = new GoogleGenAI({ apiKey });

      // 1. Activate Screen Wake Lock
      await requestWakeLock();

      // 2. Play Silent Audio (iOS/Android Background Keep-Alive Hack)
      if (!silentAudioRef.current) {
        silentAudioRef.current = new Audio(SILENT_AUDIO_URI);
        silentAudioRef.current.loop = true;
        silentAudioRef.current.volume = 0.01; 
      }
      try {
        await silentAudioRef.current.play();
      } catch(e) {
        console.warn("Silent audio playback failed (user gesture missing?)", e);
      }

      // 3. Check Microphone Permissions
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Seu dispositivo não suporta acesso ao microfone ou não é seguro (HTTPS).");
      }

      // Initialize Audio Contexts WITHOUT fixed sample rate
      // This allows mobile devices to use their native hardware rate (e.g. 48000Hz) avoiding crashes
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      // Input Context (Microphone)
      inputAudioContextRef.current = new AudioContextClass();
      
      // Output Context (Speaker)
      audioContextRef.current = new AudioContextClass();

      // Explicitly resume contexts
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Setup output analyzer
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      updateVolume();

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000 // Try to request 16k, but browser might ignore
        } 
      });
      mediaStreamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: ['AUDIO'], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: SYSTEM_PROMPT,
        },
        callbacks: {
            onopen: () => {
              if (!isMountedRef.current) return;
              setIsConnected(true);
              
              if (!inputAudioContextRef.current) return;
              
              const source = inputAudioContextRef.current.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (!isConnected && !sessionRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                
                // Downsample to 16000Hz if necessary
                const currentRate = inputAudioContextRef.current?.sampleRate || 16000;
                let dataToSend = inputData;
                
                if (currentRate !== 16000) {
                    dataToSend = downsampleBuffer(inputData, currentRate, 16000);
                }

                const pcmBlob = createBlob(dataToSend);
                
                sessionPromise.then((session: any) => {
                  if (isMountedRef.current) {
                    session.sendRealtimeInput({ media: pcmBlob });
                  }
                }).catch(console.error);
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContextRef.current.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (!isMountedRef.current) return;

              // Handle Audio Output
              if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                setIsSpeaking(true);
                const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                
                if (audioContextRef.current) {
                   const audioCtx = audioContextRef.current;
                   try {
                     // Gemini returns 24000Hz audio. 
                     // We must create a buffer with that rate.
                     // The browser's AudioContext will handle resampling to hardware rate on playback.
                     const audioBuffer = await decodeAudioData(
                        decode(base64Audio),
                        audioCtx,
                        24000, 
                        1
                     );

                     const source = audioCtx.createBufferSource();
                     source.buffer = audioBuffer;
                     
                     if (analyzerRef.current) {
                        source.connect(analyzerRef.current);
                        analyzerRef.current.connect(audioCtx.destination);
                     } else {
                        source.connect(audioCtx.destination);
                     }

                     source.addEventListener('ended', () => {
                        sourcesRef.current.delete(source);
                        if (sourcesRef.current.size === 0 && isMountedRef.current) {
                            setIsSpeaking(false);
                        }
                     });

                     const currentTime = audioCtx.currentTime;
                     if (nextStartTimeRef.current < currentTime) {
                       nextStartTimeRef.current = currentTime;
                     }
                     
                     source.start(nextStartTimeRef.current);
                     nextStartTimeRef.current += audioBuffer.duration;
                     sourcesRef.current.add(source);
                   } catch (decodeErr) {
                     console.error("Audio decode error", decodeErr);
                   }
                }
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(source => {
                    try { source.stop(); } catch(e) {}
                });
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                if (isMountedRef.current) setIsSpeaking(false);
              }
            },
            onclose: () => {
              if (isMountedRef.current) {
                setIsConnected(false);
                setIsSpeaking(false);
                releaseWakeLock();
              }
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              if (isMountedRef.current) {
                let msg = "Erro na conexão.";
                if (err instanceof Error) {
                     if (err.message.includes("403")) msg = "Acesso negado. Verifique sua chave API.";
                     else if (err.message.includes("404")) msg = "Modelo de voz indisponível.";
                     else msg = `Erro: ${err.message}`;
                }
                setError(msg);
                setIsConnected(false);
                releaseWakeLock();
              }
            }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      if (isMountedRef.current) {
        setError(err.message || "Erro ao iniciar sessão.");
        releaseWakeLock();
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    releaseWakeLock();

    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
      silentAudioRef.current = null;
    }

    if (sessionRef.current) {
        sessionRef.current.then((session: any) => {
            if(session.close) {
                try { session.close(); } catch(e) { console.warn("Error closing session", e); }
            }
        });
        sessionRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      try { inputAudioContextRef.current.close(); } catch(e) {}
      inputAudioContextRef.current = null;
    }

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch(e) {}
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }
    
    sourcesRef.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (isMountedRef.current) {
        setIsConnected(false);
        setIsSpeaking(false);
        setVolume(0);
    }
  }, []);

  return { connect, disconnect, isConnected, isSpeaking, volume, error };
};

// --- Helpers ---

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
    if (outputRate === inputRate) return buffer;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        let sum = 0;
        let count = 0;
        for (let j = start; j < end && j < buffer.length; j++) {
            sum += buffer[j];
            count++;
        }
        result[i] = count > 0 ? sum / count : buffer[start];
    }
    return result;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  // Note: We create the buffer with the SOURCE sample rate (Gemini's 24000Hz).
  // The AudioContext (which might be 48000Hz) handles the resampling playback automatically.
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}