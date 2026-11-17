/** A Response whose body arrives in the given pieces, the way a network delivers it. */
export function chunked(text: string, cuts: number[] = [], type = "text/event-stream") {
  const bytes = new TextEncoder().encode(text);
  const at = [...new Set(cuts.map((c) => c % (bytes.length + 1)))].sort((a, b) => a - b);
  const parts = [0, ...at, bytes.length].flatMap((s, i, all) =>
    i < all.length - 1 ? [bytes.slice(s, all[i + 1])] : [],
  );
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const p of parts) if (p.length > 0) c.enqueue(p);
      c.close();
    },
  });
  return new Response(body, { headers: { "content-type": type } });
}
