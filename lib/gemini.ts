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
  } catch {
    // Fallback to Groq on any Gemini error
    console.log('[gemini] fallback to Groq')
    const groqRes = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1000
        })
      }
    )
    const groqData = await groqRes.json() as { choices: Array<{ message: { content: string } }> }
    return groqData.choices[0].message.content
  }
}

export async function generateJson(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status !== 429) throw err

    // Fallback to Groq on rate limit; force JSON via response_format
    console.warn('[gemini] rate-limited (429), falling back to Groq (JSON)')
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    return completion.choices[0]?.message?.content ?? ''
  }
}
