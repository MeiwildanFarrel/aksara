import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../../../lib/supabase/server'

interface SummaryResponse {
  id: string
  title: string
  summary: string | null
  key_points: string[]
  flash_cards: Array<{ front: string; back: string }>
  quest_count: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { pin: string; nodeId: string } },
) {
  try {
    const { pin, nodeId } = params

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Format PIN tidak valid. PIN harus 6 digit angka.' },
        { status: 400 },
      )
    }

    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json({ error: 'nodeId tidak valid.' }, { status: 400 })
    }

    const supabase = await createClient()

    // Resolve session dari PIN
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('pin', pin)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json(
        { error: 'Gagal mengambil data sesi.', detail: sessionError.message },
        { status: 500 },
      )
    }

    if (!session) {
      return NextResponse.json({ error: 'Sesi tidak ditemukan.' }, { status: 404 })
    }

    // Fetch node yang ada di session ini (validasi ownership sekaligus)
    const { data: node, error: nodeError } = await supabase
      .from('skill_nodes')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .select('id, title, summary, key_points, flash_cards' as any)
      .eq('id', nodeId)
      .eq('session_id', session.id)
      .maybeSingle()

    if (nodeError) {
      return NextResponse.json(
        { error: 'Gagal mengambil node.', detail: nodeError.message },
        { status: 500 },
      )
    }

    if (!node) {
      return NextResponse.json(
        { error: 'Node tidak ditemukan dalam sesi ini.' },
        { status: 404 },
      )
    }

    // Hitung quest_count (soal utama, bukan varian)
    const { count, error: countError } = await supabase
      .from('quests')
      .select('*', { count: 'exact', head: true })
      .eq('node_id', nodeId)
      .is('variant_of', null)

    if (countError) {
      console.warn(`[node/summary] quest count error: ${countError.message}`)
    }

    const typedNode = node as unknown as {
      id: string
      title: string
      summary: string | null
      key_points: unknown
      flash_cards: unknown
    }

    const key_points = Array.isArray(typedNode.key_points)
      ? (typedNode.key_points as unknown[]).filter(
          (p): p is string => typeof p === 'string',
        )
      : []

    const flash_cards = Array.isArray(typedNode.flash_cards)
      ? (typedNode.flash_cards as unknown[]).filter(
          (fc): fc is { front: string; back: string } =>
            typeof fc === 'object' &&
            fc !== null &&
            typeof (fc as Record<string, unknown>).front === 'string' &&
            typeof (fc as Record<string, unknown>).back === 'string',
        )
      : []

    const response: SummaryResponse = {
      id: typedNode.id,
      title: typedNode.title,
      summary: typedNode.summary ?? null,
      key_points,
      flash_cards,
      quest_count: count ?? 0,
    }

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[node/summary] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
