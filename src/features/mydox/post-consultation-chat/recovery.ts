/** Tracks confirmed history separately from isolated send responses. */
export class ChatRecovery {
  private generation = 0;
  private historySequence: number | null = null;
  private accessConfirmed = false;

  capture(): number { return this.generation; }
  isCurrent(generation: number): boolean { return generation === this.generation; }
  get authorised(): boolean { return this.accessConfirmed; }
  get historyBoundary(): number | null { return this.historySequence; }

  invalidate(): void {
    this.generation += 1;
    this.historySequence = null;
    this.accessConfirmed = false;
  }

  confirmHistory(generation: number, sequences: number[]): boolean {
    if (!this.isCurrent(generation)) return false;
    this.historySequence = sequences.reduce((latest, sequence) => Math.max(latest, sequence), this.historySequence ?? 0);
    this.accessConfirmed = true;
    return true;
  }
}

type HistoryPage<Message> = { messages: Message[]; next_before_sequence: number | null };

/** Reconnect until the last fetched boundary is reached, even across many pages. */
export async function recoverHistory<Message extends { sequence_id: number }>(
  fetchPage: (before?: number) => Promise<HistoryPage<Message>>,
  boundary: number | null,
  isCurrent: () => boolean,
): Promise<{ messages: Message[]; nextBefore: number | null } | null> {
  const messages: Message[] = [];
  let before: number | undefined;
  let nextBefore: number | null = null;
  do {
    if (!isCurrent()) return null;
    const page = await fetchPage(before);
    if (!isCurrent()) return null;
    messages.push(...page.messages);
    nextBefore = page.next_before_sequence == null ? null : Number(page.next_before_sequence);
    if (nextBefore != null && before != null && nextBefore >= before) throw new Error("Chat history pagination did not advance. Please refresh.");
    if (boundary == null || nextBefore == null || page.messages.some(message => Number(message.sequence_id) <= boundary)) break;
    before = nextBefore;
  } while (isCurrent());
  return isCurrent() ? { messages, nextBefore } : null;
}
