import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../../../../../lib/supabase/server'
import {
  generateSkillTree,
  generateQuestsForNode,
  generateVariants,
  generateNodeSummary,
} from '../../../../../lib/quest-generator'
import type { Database } from '../../../../../types/supabase'

export const maxDuration = 60

interface RequestBody {
  session_id?: string
}

interface ChunkRow {
  content: string
  source_ref: string | null
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse body
    let body: RequestBody
    try {
      body = (await request.json()) as RequestBody
    } catch {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const sessionId = body.session_id
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Field "session_id" wajib diisi.' },
        { status: 400 },
      )
    }

    // 3. Validate session ownership
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('instructor_id', user.id)
      .maybeSingle()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session tidak ditemukan atau bukan milik Anda.' },
        { status: 403 },
      )
    }

    // 4. Service role for inserts
    const serviceClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 5. Load chunks for this session
    const { data: chunkRows, error: chunksError } = await serviceClient
      .from('pdf_chunks')
      .select('content, source_ref')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (chunksError) {
      return NextResponse.json(
        { error: 'Gagal memuat chunks.', detail: chunksError.message },
        { status: 500 },
      )
    }

    const chunks: Array<{ content: string; source_ref: string }> = (
      (chunkRows ?? []) as ChunkRow[]
    ).map((c) => ({
      content: c.content,
      source_ref: c.source_ref ?? '',
    }))

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada chunks untuk session ini. Upload PDF dulu.' },
        { status: 400 },
      )
    }

    // 6. Skill tree
    console.log('[quest-gen] Generating skill tree...')
    const topics = await generateSkillTree(chunks, sessionId)
    console.log(`[quest-gen] Skill tree: ${topics.length} topics`)

    if (topics.length === 0) {
      return NextResponse.json(
        {
          nodes_created: 0,
          quests_created: 0,
          variants_created: 0,
        },
        { status: 200 },
      )
    }

    // 7. Insert nodes sequentially (linear prereq chain) and capture node ids
    const nodeRecords: Array<{
      id: string
      title: string
      relevantChunks: Array<{ content: string; source_ref: string }>
    }> = []
    let prevNodeId: string | null = null

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i]
      const positionX = (i % 3) * 300
      const positionY = Math.floor(i / 3) * 200
      const prerequisiteIds: string[] = prevNodeId ? [prevNodeId] : []

      const nodeInsert = await serviceClient
        .from('skill_nodes')
        .insert({
          session_id: sessionId,
          title: topic.title,
          position_x: positionX,
          position_y: positionY,
          prerequisite_ids: prerequisiteIds,
        })
        .select('id')
        .single()

      if (nodeInsert.error || !nodeInsert.data) {
        console.error(
          `[quest-gen] Failed to insert node "${topic.title}": ${nodeInsert.error?.message ?? 'unknown'}`,
        )
        continue
      }

      const nodeId: string = nodeInsert.data.id
      const relevantChunks = topic.chunkIndices
        .map((idx) => chunks[idx])
        .filter((c): c is { content: string; source_ref: string } => Boolean(c))

      nodeRecords.push({ id: nodeId, title: topic.title, relevantChunks })
      prevNodeId = nodeId
    }

    const nodesCreated = nodeRecords.length

    // 8. Parallel: generate quests for all nodes at once
    const questResults = await Promise.all(
      nodeRecords.map(async (node) => {
        if (node.relevantChunks.length === 0) {
          console.warn(
            `[quest-gen] Node "${node.title}" has no relevant chunks, skipping`,
          )
          return { node, quests: [] as Awaited<ReturnType<typeof generateQuestsForNode>> }
        }
        const quests = await generateQuestsForNode(node.title, node.relevantChunks, 2)
        console.log(`[quest-gen] Node "${node.title}" -> ${quests.length} quests`)
        return { node, quests }
      }),
    )

    // 9. Insert quests sequentially per node so we can capture ids; nodes done in parallel
    const questsByNode = await Promise.all(
      questResults.map(async ({ node, quests }) => {
        const insertedQuestIds: Array<{
          id: string
          quest: (typeof quests)[number]
        }> = []
        for (const quest of quests) {
          const questInsert = await serviceClient
            .from('quests')
            .insert({
              node_id: node.id,
              question: quest.question,
              options: quest.options,
              correct_index: quest.correct_index,
              bloom_level: quest.bloom_level,
            })
            .select('id')
            .single()

          if (questInsert.error || !questInsert.data) {
            console.error(
              `[quest-gen] Failed to insert quest: ${questInsert.error?.message ?? 'unknown'}`,
            )
            continue
          }
          insertedQuestIds.push({ id: questInsert.data.id, quest })
        }
        return { node, insertedQuestIds }
      }),
    )

    const questsCreated = questsByNode.reduce(
      (sum, n) => sum + n.insertedQuestIds.length,
      0,
    )

    // 10. Parallel: generate variants for every quest across every node
    const variantTasks: Array<
      Promise<{ parentId: string; nodeId: string; bloomLevel: number; variants: Awaited<ReturnType<typeof generateVariants>> }>
    > = []

    for (const { node, insertedQuestIds } of questsByNode) {
      for (const { id: parentId, quest } of insertedQuestIds) {
        variantTasks.push(
          (async () => {
            const variants = await generateVariants(
              {
                question: quest.question,
                options: quest.options,
                correct_index: quest.correct_index,
              },
              node.relevantChunks,
            )
            return {
              parentId,
              nodeId: node.id,
              bloomLevel: quest.bloom_level,
              variants,
            }
          })(),
        )
      }
    }

    const variantResults = await Promise.all(variantTasks)

    // 11. Insert all variants
    let variantsCreated = 0
    const variantInserts: Array<{
      node_id: string
      question: string
      options: string[]
      correct_index: number
      bloom_level: number
      variant_of: string
    }> = []
    for (const { parentId, nodeId, bloomLevel, variants } of variantResults) {
      for (const variant of variants) {
        variantInserts.push({
          node_id: nodeId,
          question: variant.question,
          options: variant.options,
          correct_index: variant.correct_index,
          bloom_level: bloomLevel,
          variant_of: parentId,
        })
      }
    }

    if (variantInserts.length > 0) {
      const { error: variantInsertError, count } = await serviceClient
        .from('quests')
        .insert(variantInserts, { count: 'exact' })

      if (variantInsertError) {
        console.error(
          `[quest-gen] Variant batch insert error: ${variantInsertError.message}`,
        )
      } else {
        variantsCreated = count ?? variantInserts.length
      }
    }

    // 12. Parallel: generate summaries for all nodes and save to DB
    //     Best-effort — errors here don't fail the overall response.
    await Promise.all(
      nodeRecords.map(async (node) => {
        try {
          const summary = await generateNodeSummary(node.title, node.relevantChunks)
          // New columns added by migration — generated types don't include them yet
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const summaryPayload = { summary: summary.summary, key_points: summary.key_points, flash_cards: summary.flash_cards } as any
          const { error: updateErr } = await serviceClient
            .from('skill_nodes')
            .update(summaryPayload)
            .eq('id', node.id)
          if (updateErr) {
            console.error(
              `[quest-gen] summary update failed for node "${node.title}": ${updateErr.message}`,
            )
          } else {
            console.log(`[quest-gen] summary saved for node "${node.title}"`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.warn(`[quest-gen] generateNodeSummary failed for "${node.title}": ${msg}`)
        }
      }),
    )

    console.log(
      `[quest-gen] Done: ${nodesCreated} nodes, ${questsCreated} quests, ${variantsCreated} variants`,
    )

    return NextResponse.json({
      nodes_created: nodesCreated,
      quests_created: questsCreated,
      variants_created: variantsCreated,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[quest-gen] fatal:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
