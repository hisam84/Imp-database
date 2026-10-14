import { CallUpdate } from "./types";

export const CALL_UPDATES_SEPARATOR = "\n<!--CALL_UPDATES_DATA-->\n";

export function extractNotesAndCalls(rawNotes: string | null | undefined): {
  userNotes: string;
  callUpdates: CallUpdate[];
} {
  if (!rawNotes) return { userNotes: "", callUpdates: [] };

  if (rawNotes.includes(CALL_UPDATES_SEPARATOR)) {
    const parts = rawNotes.split(CALL_UPDATES_SEPARATOR);
    const userNotes = parts[0]?.trim() || "";
    const jsonStr = parts.slice(1).join(CALL_UPDATES_SEPARATOR);
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        userNotes,
        callUpdates: Array.isArray(parsed) ? parsed : [],
      };
    } catch {
      return { userNotes: rawNotes.trim(), callUpdates: [] };
    }
  }

  return { userNotes: rawNotes.trim(), callUpdates: [] };
}

export function packNotesAndCalls(
  userNotes: string | null | undefined,
  callUpdates: CallUpdate[]
): string {
  const cleanNotes = (userNotes || "").trim();
  if (!callUpdates || callUpdates.length === 0) {
    return cleanNotes;
  }
  return `${cleanNotes}${CALL_UPDATES_SEPARATOR}${JSON.stringify(callUpdates)}`;
}
