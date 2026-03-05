const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

if (!process.env.GEMINI_API_KEY) {
    console.error("FATAL ERROR: GEMINI_API_KEY is not set in the environment variables!");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getGeminiModel = (modelName = 'gemini-2.5-flash') => {
    return genAI.getGenerativeModel({ model: modelName });
};

const generateContent = async (prompt, modelName = 'gemini-2.5-flash') => {
    try {
        const model = getGeminiModel(modelName);
        const result = await model.generateContent(prompt);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API Error:', error.message);
        throw error;
    }
};

const generateJSON = async (prompt, modelName = 'gemini-2.5-flash') => {
    try {
        const model = getGeminiModel(modelName);
        const result = await model.generateContent(prompt + '\n\nRespond ONLY with valid JSON. No markdown formatting, no code blocks, no extra text.');
        const text = result.response.text().trim();
        // Clean markdown code blocks if present
        const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error('Gemini JSON Parse Error:', error.message);
        throw error;
    }
};

module.exports = { genAI, getGeminiModel, generateContent, generateJSON };
