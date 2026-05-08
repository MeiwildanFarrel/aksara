import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: NextRequest,
  { params }: { params: { nodeId: string } },
) {
  try {
    const { nodeId } = params

    if (!nodeId || !UUID_RE.test(nodeId)) {
      return NextResponse.json(
        { error: 'Format nodeId tidak valid (harus UUID).' },
        { status: 400 },
      )
    }

    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query main quests for the node (variants excluded).
    //    correct_index intentionally NOT selected — never expose answer to client.
    const { data: quests, error: queryErr } = await supabase
      .from('quests')
      .select('id, question, options, bloom_level, node_id')
      .eq('node_id', nodeId)
      .is('variant_of', null)

    if (queryErr) {
      return NextResponse.json(
        { error: 'Gagal mengambil quest.', detail: queryErr.message },
        { status: 500 },
      )
    }

    return NextResponse.json(quests ?? [])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[quest/[nodeId]] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
