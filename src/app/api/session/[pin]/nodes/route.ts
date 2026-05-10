import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'

interface NodeResponse {
  id: string
  title: string
  prerequisite_ids: string[]
  position_x: number
  position_y: number
  quest_count: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { pin: string } },
) {
  try {
    const { pin } = params

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Format PIN tidak valid. PIN harus 6 digit angka.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()

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
      return NextResponse.json(
        { error: 'Sesi tidak ditemukan.' },
        { status: 404 },
      )
    }

    const { data: nodes, error: nodesError } = await supabase
      .from('skill_nodes')
      .select('id, title, prerequisite_ids, position_x, position_y')
      .eq('session_id', session.id)

    if (nodesError) {
      return NextResponse.json(
        { error: 'Gagal mengambil skill nodes.', detail: nodesError.message },
        { status: 500 },
      )
    }

    const nodeList = nodes ?? []
    if (nodeList.length === 0) {
      return NextResponse.json([] satisfies NodeResponse[])
    }

    const nodeIds = nodeList.map((n) => n.id)

    // Hitung quest_count per node — hanya soal utama (variant_of IS NULL)
    const { data: quests, error: questsError } = await supabase
      .from('quests')
      .select('node_id')
      .in('node_id', nodeIds)
      .is('variant_of', null)

    if (questsError) {
      return NextResponse.json(
        { error: 'Gagal mengambil data quests.', detail: questsError.message },
        { status: 500 },
      )
    }

    const counts = new Map<string, number>()
    for (const q of quests ?? []) {
      if (!q.node_id) continue
      counts.set(q.node_id, (counts.get(q.node_id) ?? 0) + 1)
    }

    const response: NodeResponse[] = nodeList.map((n) => ({
      id: n.id,
      title: n.title,
      prerequisite_ids: n.prerequisite_ids ?? [],
      position_x: n.position_x ?? 0,
      position_y: n.position_y ?? 0,
      quest_count: counts.get(n.id) ?? 0,
    }))

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
