import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import type { Database } from '../../../../../types/supabase'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { pin: string } }
) {
  try {
    const { pin } = params

    // Validasi format PIN: harus 6 digit angka
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Format PIN tidak valid. PIN harus 6 digit angka.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data: session, error } = await supabase
      .from('sessions')
      .select('id, title, instructor_id, created_at, users!sessions_instructor_id_fkey(email)')
      .eq('pin', pin)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'Gagal mengambil data sesi.', detail: error.message },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Sesi tidak ditemukan.' },
        { status: 404 }
      )
    }

    // Fetch first pdf_chunk as description/summary
    const { data: firstChunk } = await supabase
      .from('pdf_chunks')
      .select('content')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      ...session,
      pin,
      description: firstChunk?.content?.slice(0, 300) || null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { pin: string } }
) {
  try {
    const sessionId = params.pin

    if (!isUuid(sessionId)) {
      return NextResponse.json(
        { error: 'Format course ID tidak valid.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, instructor_id')
      .eq('id', sessionId)
      .maybeSingle()

    if (sessionError) {
      return NextResponse.json(
        { error: 'Gagal memvalidasi course.', detail: sessionError.message },
        { status: 500 }
      )
    }

    if (!session) {
      return NextResponse.json({ error: 'Course tidak ditemukan.' }, { status: 404 })
    }

    if (session.instructor_id !== user.id) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses untuk menghapus course ini.' },
        { status: 403 }
      )
    }

    const adminSupabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: nodeRows, error: nodesError } = await adminSupabase
      .from('skill_nodes')
      .select('id')
      .eq('session_id', sessionId)

    if (nodesError) {
      return NextResponse.json(
        { error: 'Gagal mengambil skill nodes.', detail: nodesError.message },
        { status: 500 }
      )
    }

    const nodeIds = nodeRows?.map((node) => node.id) ?? []

    if (nodeIds.length > 0) {
      const { data: questRows, error: questsError } = await adminSupabase
        .from('quests')
        .select('id')
        .in('node_id', nodeIds)

      if (questsError) {
        return NextResponse.json(
          { error: 'Gagal mengambil quests.', detail: questsError.message },
          { status: 500 }
        )
      }

      const questIds = questRows?.map((quest) => quest.id) ?? []

      if (questIds.length > 0) {
        const { error: attemptsError } = await adminSupabase
          .from('quest_attempts')
          .delete()
          .in('quest_id', questIds)

        if (attemptsError) {
          return NextResponse.json(
            { error: 'Gagal menghapus quest attempts.', detail: attemptsError.message },
            { status: 500 }
          )
        }

        const { error: variantError } = await adminSupabase
          .from('quests')
          .delete()
          .in('variant_of', questIds)

        if (variantError) {
          return NextResponse.json(
            { error: 'Gagal menghapus quest variants.', detail: variantError.message },
            { status: 500 }
          )
        }

        const { error: questsDeleteError } = await adminSupabase
          .from('quests')
          .delete()
          .in('node_id', nodeIds)

        if (questsDeleteError) {
          return NextResponse.json(
            { error: 'Gagal menghapus quests.', detail: questsDeleteError.message },
            { status: 500 }
          )
        }
      }

      const { error: masteryError } = await adminSupabase
        .from('mastery_scores')
        .delete()
        .in('node_id', nodeIds)

      if (masteryError) {
        return NextResponse.json(
          { error: 'Gagal menghapus mastery scores.', detail: masteryError.message },
          { status: 500 }
        )
      }

      const { error: nodesDeleteError } = await adminSupabase
        .from('skill_nodes')
        .delete()
        .in('id', nodeIds)

      if (nodesDeleteError) {
        return NextResponse.json(
          { error: 'Gagal menghapus skill nodes.', detail: nodesDeleteError.message },
          { status: 500 }
        )
      }
    }

    const { error: chunksError } = await adminSupabase
      .from('pdf_chunks')
      .delete()
      .eq('session_id', sessionId)

    if (chunksError) {
      return NextResponse.json(
        { error: 'Gagal menghapus PDF chunks.', detail: chunksError.message },
        { status: 500 }
      )
    }

    const { error: deleteError } = await adminSupabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Gagal menghapus course.', detail: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
