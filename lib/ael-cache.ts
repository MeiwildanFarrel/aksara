import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function toPgVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`
}

export async function checkExactCache(queryHash: string, mode: string): Promise<string | null> {
  try {
    const client = getServiceClient()
    const { data, error } = await client
      .from('ael_cache')
      .select('response')
      .eq('query_hash', queryHash)
      .eq('mode', mode)
      .maybeSingle()

    if (error) {
      console.error('[ael-cache] exact lookup error:', error.message)
      return null
    }

    if (data?.response) {
      console.log('[ael-cache] EXACT HIT for hash', queryHash.slice(0, 12))
      return data.response
    }

    console.log('[ael-cache] EXACT MISS for hash', queryHash.slice(0, 12))
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[ael-cache] checkExactCache failed:', message)
    return null
  }
}

export async function checkSemanticCache(
  queryEmbedding: number[],
  mode: string,
  threshold: number = 0.92,
): Promise<string | null> {
  try {
    const client = getServiceClient()
    // The Database type doesn't yet include the new RPC functions
    // (regenerate via `supabase gen types` to remove this cast).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)('match_ael_cache', {
      query_embedding: toPgVector(queryEmbedding),
      match_mode: mode,
      similarity_threshold: threshold,
    })

    if (error) {
      console.error('[ael-cache] semantic lookup error:', error.message)
      return null
    }

    const rows = data as Array<{ response: string; similarity: number }> | null
    const top = rows?.[0]
    if (top?.response) {
      console.log(
        `[ael-cache] SEMANTIC HIT (sim=${(top.similarity * 100).toFixed(1)}%, threshold=${(threshold * 100).toFixed(0)}%)`,
      )
      return top.response
    }

    console.log('[ael-cache] SEMANTIC MISS')
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[ael-cache] checkSemanticCache failed:', message)
    return null
  }
}

export async function saveToCache(
  queryHash: string,
  queryEmbedding: number[],
  response: string,
  mode: string,
): Promise<void> {
  try {
    const client = getServiceClient()
    const { error } = await client.from('ael_cache').insert({
      query_hash: queryHash,
      query_embedding: toPgVector(queryEmbedding),
      response,
      mode,
    })

    if (error) {
      console.error('[ael-cache] save error:', error.message)
      return
    }

    console.log('[ael-cache] SAVED entry for hash', queryHash.slice(0, 12))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error'
    console.error('[ael-cache] saveToCache failed:', message)
  }
}
