// notion-markdown.service.ts
export interface VoxeraPayload {
  title: string;
  intent: string;
  body: string;
}

export class NotionMarkdownService {
  /**
   * [핵심 로직 1: Markdown-first 전송]
   * 제미나이 정제 JSON을 순수 Markdown 문자열로 파싱
   */
  public static toMarkdown(data: VoxeraPayload): string {
    let md = '';
    if (data.title) md += `# ${data.title}\n\n`;
    if (data.intent) md += `> **Intent:** ${data.intent}\n\n`;
    if (data.body) md += `${data.body}\n`;

    return md.trim();
  }
}
