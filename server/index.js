import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;

// Registry of Pre-configured Clients
const getClient = (provider, customUrl, customKey) => {
  const apiKey = customKey || process.env[`${provider.toUpperCase()}_API_KEY`];
  
  if (provider === 'gemini') {
    return new GoogleGenAI(apiKey || process.env.GEMINI_API_KEY || '');
  }

  // Generic OpenAI-compatible client
  let baseURL = customUrl;
  if (!baseURL) {
    if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
    if (provider === 'deepseek') baseURL = 'https://api.deepseek.com';
    if (provider === 'ollama') baseURL = 'http://localhost:11434/v1';
    if (provider === 'openai') baseURL = 'https://api.openai.com/v1';
    if (provider === 'mistral') baseURL = 'https://api.mistral.ai/v1';
    if (provider === 'openrouter') baseURL = 'https://openrouter.ai/api/v1';
  }

  return new OpenAI({
    apiKey: apiKey || 'missing-key',
    baseURL: baseURL
  });
};

app.post('/api/ai/review', async (req, res) => {
  const { context, provider = 'gemini', model, customUrl, customKey } = req.body;
  
  if (!context) return res.status(400).json({ error: 'Context is required' });

  const systemPrompt = `Eres un Arquitecto de Software Senior nivel Staff. 
Analiza la siguiente arquitectura de proyecto y proporciona un reporte técnico de alta calidad en español.
Sigue este formato Markdown... (resto del prompt)`;

  try {
    const client = getClient(provider, customUrl, customKey);
    let text = '';

    if (provider === 'gemini') {
      const genModel = client.getGenerativeModel({ model: model || "gemini-3-flash-preview" });
      const result = await genModel.generateContent(systemPrompt + "\n\nContexto:\n" + context);
      text = result.response.text();
    } else {
      // Handles Groq, DeepSeek, Ollama, OpenRouter, Mistral, Perplexity, etc.
      const response = await client.chat.completions.create({
        model: model || (provider === 'ollama' ? 'llama3' : 'gpt-3.5-turbo'),
        messages: [{ role: 'user', content: systemPrompt + "\n\nContexto:\n" + context }],
      });
      text = response.choices[0].message.content;
    }

    res.json({ text });
  } catch (error) {
    console.error(`AI Proxy Error [${provider}]:`, error);
    res.status(500).json({ error: error.message || 'Error processing AI request' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Universal AI Proxy running on port ${PORT}`);
});
