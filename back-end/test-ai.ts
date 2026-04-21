import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
    console.log("Testing Gemini 3 Flash...");
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: "Hello, say 'Test OK'" }] }]
    });
    console.log("Response:", result.text);
    process.exit(0);
  } catch (error) {
    console.error("AI Error:", error);
    process.exit(1);
  }
}

test();
