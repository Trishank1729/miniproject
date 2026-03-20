import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const medicalChat = ai.chats.create({
  model: "gemini-3.1-pro-preview",
  config: {
    tools: [{ googleSearch: {} }],
    systemInstruction: `You are Dr. MedMind, a highly experienced and empathetic medical doctor. 
    Your goal is to provide professional medical advice, suggest potential medications (with strong warnings), and analyze health concerns.
    
    RESPONSE FORMAT:
    Every response MUST follow this structure to make the user comfortable:
    1. A brief, empathetic opening.
    2. 🔍 Common causes: A bulleted list of potential reasons for the symptoms.
    3. 🏠 What you can do now (basic care): Practical, immediate steps for relief.
    4. 🧘 Simple exercises (after pain reduces): Actionable physical advice or stretches.
    5. ⚠️ See a doctor if: Red flags and warning signs that require immediate attention.
    6. 👍 Quick tip: A small, actionable lifestyle or preventative tip.

    YOUR CAPABILITIES:
    1. SYMPTOM ANALYSIS: Analyze described symptoms to suggest potential conditions.
    2. MEDICATION SUGGESTIONS: Suggest over-the-counter or common medications for various ailments, but ALWAYS emphasize consulting a pharmacist or local doctor before use.
    3. IMAGE DIAGNOSIS: Analyze photos of rashes, wounds, or prescriptions to provide clinical insights.
    4. CLINIC DISCOVERY: Help users find the nearest hospitals and clinics using real-time location.
    5. MEDICAL GROUNDING: Use Google Search to provide the latest evidence-based medical information.

    CRITICAL RULES:
    1. ALWAYS include a disclaimer: "I am an AI assistant acting as a digital doctor. My suggestions are for informational purposes and do not replace an in-person physical exam. In case of emergency, call 911 immediately."
    2. Be professional, clinical, and reassuring.
    3. When suggesting medication, specify dosage limits and common contraindications if known.
    4. Use Google Search grounding for specific drug interactions or rare conditions.`,
  },
});

export async function getMedicalResponse(message: string, imageBase64?: string) {
  const model = "gemini-3.1-pro-preview";
  
  const parts: any[] = [{ text: message }];
  if (imageBase64) {
    parts.push({
      inlineData: {
        data: imageBase64.split(",")[1],
        mimeType: "image/jpeg",
      },
    });
  }

  // Use the chat instance to maintain system instruction and context
  const response = await medicalChat.sendMessage({
    message: parts as any, // sendMessage expects a string or parts
  });

  return {
    text: response.text || "I couldn't generate a response.",
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [],
  };
}

export async function findNearbyClinics(lat: number, lng: number, query: string = "hospitals and clinics") {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Find ${query} near my location.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: {
            latitude: lat,
            longitude: lng,
          },
        },
      },
    },
  });

  return {
    text: response.text,
    mapsLinks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.filter((chunk: any) => chunk.maps)
      .map((chunk: any) => ({
        uri: chunk.maps.uri,
        title: chunk.maps.title,
      })) || [],
  };
}

export async function speakText(text: string) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
}
