const CHUNK_SIZE = 500
const OVERLAP = 50

export function chunkText(text: string): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + CHUNK_SIZE

    if (end < text.length) {
      // Walk back to the nearest space so we never cut mid-word
      const spaceIndex = text.lastIndexOf(' ', end)
      if (spaceIndex > start) {
        end = spaceIndex
      }
    } else {
      end = text.length
    }

    const chunk = text.slice(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    const nextStart = end - OVERLAP
    // Guard against infinite loop if overlap >= chunk length
    start = nextStart > start ? nextStart : end
  }

  return chunks
}
