import "server-only";

const JD_FIELDS = ["JD", "职位描述", "岗位描述", "Description"];

export function findJobDescriptionProperty(properties: Record<string, { type: string }>): string | null {
  return JD_FIELDS.find((name) => properties[name]?.type === "rich_text") ?? null;
}

export function jobDescriptionRichText(value: string) {
  // Notion limits each rich-text content to 2000 UTF-16 characters. Keep Unicode pairs intact.
  const chunks: string[] = [];
  let chunk = "";
  for (const character of value) {
    if (chunk.length + character.length > 2000) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((content) => ({ text: { content } }));
}
