import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';

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

  // Volume analyzer
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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

      // Initialize Audio Contexts
      // We explicitly create them inside the user gesture flow
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });

      // CRITICAL FIX: Explicitly resume contexts to bypass browser autoplay policies
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Setup output analyzer for visualizer
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      updateVolume();

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          // Use string literal 'AUDIO' to avoid enum import issues
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
              
              // Process Input Audio
              if (!inputAudioContextRef.current) return;
              
              const source = inputAudioContextRef.current.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (!isConnected && !sessionRef.current) return; // Guard clause

                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                
                // Only send if session is valid
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

              // Handle Interruption
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
              }
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              if (isMountedRef.current) {
                let msg = "Erro na conexão.";
                if (err instanceof Error) {
                     if (err.message.includes("403")) msg = "Acesso negado. Verifique sua chave API.";
                     else if (err.message.includes("404")) msg = "Modelo de voz indisponível no momento.";
                     else msg = `Erro: ${err.message}`;
                }
                setError(msg);
                setIsConnected(false);
              }
            }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      if (isMountedRef.current) {
        setError(err.message || "Erro ao iniciar sessão.");
      }
    }
  }, []);

  const disconnect = useCallback(() => {
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
    
    // Clear audio buffer queue
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

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values to prevent overflow distortion
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
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}