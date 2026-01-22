import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";
import { SYSTEM_PROMPT } from "../constants";

const getClient = (): GoogleGenAI => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  // Create a new instance every time to ensure we use the latest API_KEY
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string
): Promise<string> => {
  try {
    const ai = getClient();
    
    // Transform internal history to Gemini chat format
    // We only take the last few turns to save context window and keep focus
    const chatHistory = history.slice(-6).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7, // Slightly creative but stable
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "Desculpe, não consegui processar sua mensagem. Tente novamente.";
  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return "Houve um erro de conexão. Por favor, verifique sua internet e tente novamente.";
  }
};