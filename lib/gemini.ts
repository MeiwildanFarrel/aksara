import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  // gemini-embedding-2 with outputDimensionality=768 keeps the vector(768) schema intact.
  // The SDK types don't expose outputDimensionality, so we use fetch directly.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent` +
    `?key=${process.env.GEMINI_API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/gemini-embedding-2',
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  })
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } }
    throw Object.assign(
      new Error(err.error?.message ?? `HTTP ${res.status}`),
      { status: res.status },
    )
  }
  const data = (await res.json()) as { embedding: { values: number[] } }
  return data.embedding.values
}

export async function generateText(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 429) throw err

    // Fallback to Groq on rate limit
    console.warn('[gemini] rate-limited (429), falling back to Groq')
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
    })
    return completion.choices[0]?.message?.content ?? ''
  }
}
