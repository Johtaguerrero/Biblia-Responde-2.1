import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
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

  // Volume analyzer
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const updateVolume = () => {
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
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey });

      // Initialize Audio Contexts
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // Setup output analyzer for visualizer
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      updateVolume();

      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Kore is softer/soothing
          },
          systemInstruction: SYSTEM_PROMPT,
        },
        callbacks: {
            onopen: () => {
              setIsConnected(true);
              
              // Process Input Audio
              if (!inputAudioContextRef.current) return;
              
              const source = inputAudioContextRef.current.createMediaStreamSource(stream);
              const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
              
              scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                
                sessionPromise.then((session: any) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
                
                // Simple input visualization if needed, but we focus on output for now
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContextRef.current.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data) {
                setIsSpeaking(true);
                const base64Audio = message.serverContent.modelTurn.parts[0].inlineData.data;
                
                if (audioContextRef.current) {
                   const audioCtx = audioContextRef.current;
                   const audioBuffer = await decodeAudioData(
                      decode(base64Audio),
                      audioCtx,
                      24000,
                      1
                   );

                   const source = audioCtx.createBufferSource();
                   source.buffer = audioBuffer;
                   
                   // Connect to analyzer for visualization -> then to destination
                   if (analyzerRef.current) {
                      source.connect(analyzerRef.current);
                      analyzerRef.current.connect(audioCtx.destination);
                   } else {
                      source.connect(audioCtx.destination);
                   }

                   source.addEventListener('ended', () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) setIsSpeaking(false);
                   });

                   const currentTime = audioCtx.currentTime;
                   if (nextStartTimeRef.current < currentTime) {
                     nextStartTimeRef.current = currentTime;
                   }
                   
                   source.start(nextStartTimeRef.current);
                   nextStartTimeRef.current += audioBuffer.duration;
                   sourcesRef.current.add(source);
                }
              }

              if (message.serverContent?.interrupted) {
                // Clear audio queue
                sourcesRef.current.forEach(source => source.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsSpeaking(false);
              }
            },
            onclose: () => {
              setIsConnected(false);
              setIsSpeaking(false);
            },
            onerror: (err) => {
              console.error("Live API Error:", err);
              setError("Erro na conexão. Tente novamente.");
              setIsConnected(false);
            }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao iniciar sessão.");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
        // There isn't a direct .close() on the promise wrapper in the prompt example, 
        // but typically we close media streams and context.
        // Assuming session object has close if resolved.
        sessionRef.current.then((session: any) => {
            if(session.close) session.close();
        });
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
    }

    setIsConnected(false);
    setIsSpeaking(false);
    setVolume(0);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return { connect, disconnect, isConnected, isSpeaking, volume, error };
};

// --- Helpers ---

function createBlob(data: Float32Array): { data: string, mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
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