import { GoogleGenAI } from "@google/genai";
async function test() {
  try {
    // @ts-ignore
    const ai = new GoogleGenAI();
    console.log("No key constructor worked?");
  } catch (e) {
    console.log("No key constructor failed:", e.message);
  }
}
test();
