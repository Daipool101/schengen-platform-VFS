/**
 * Flattens Contentful rich-text "document" nodes into plain text.
 * VFS stores fee tables, document checklists, etc. as Contentful rich text;
 * this turns that nested structure into readable text for LLM extraction.
 */
export function flattenRichText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenRichText).join('');

  if (node.nodeType === 'text') return node.value || '';

  let out = '';

  // Table cells / rows → keep separated so the LLM can read columns
  if (node.nodeType === 'table-cell') {
    out += flattenRichText(node.content) + ' | ';
    return out;
  }
  if (node.nodeType === 'table-row') {
    out += flattenRichText(node.content) + '\n';
    return out;
  }

  if (node.content) out += flattenRichText(node.content);

  // Add line breaks after block-level nodes for readability
  const nt = node.nodeType || '';
  if (nt === 'paragraph' || nt.startsWith('heading')) out += '\n';
  if (nt === 'list-item') out = '\n- ' + out.trim();
  if (nt === 'unordered-list' || nt === 'ordered-list') out += '\n';

  return out;
}

/** Cleans up excessive whitespace from flattened rich text. */
export function cleanText(text: string): string {
  return text
    .replace(/\{\{[^}]+\}\}/g, '') // remove Contentful template vars like {{vacmissiontitle}}
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
