export interface RichBlock {
  id: string;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;   // hex or undefined = default
  size?: number;    // or undefined = default (15)
}

export const RICH_COLORS = [
  { key: 'default', value: undefined as string | undefined, dot: '#F0F0F0' },
  { key: 'red',     value: '#F87171',                       dot: '#F87171' },
  { key: 'amber',   value: '#FBBF24',                       dot: '#FBBF24' },
  { key: 'green',   value: '#34D399',                       dot: '#34D399' },
  { key: 'blue',    value: '#60A5FA',                       dot: '#60A5FA' },
  { key: 'purple',  value: '#C084FC',                       dot: '#C084FC' },
  { key: 'pink',    value: '#F472B6',                       dot: '#F472B6' },
] as const;

export const RICH_SIZES = [
  { size: 13, label: 'XS' },
  { size: 15, label: 'M'  },
  { size: 18, label: 'L'  },
  { size: 24, label: 'XL' },
] as const;

export function makeBlock(text = ''): RichBlock {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text };
}

export function serializeBlocks(blocks: RichBlock[]): string {
  return JSON.stringify(blocks);
}

export function deserializeBlocks(raw: string | undefined): RichBlock[] {
  if (!raw) return [makeBlock()];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as RichBlock[];
  } catch {}
  const lines = raw.split('\n');
  return lines.length > 0 ? lines.map(line => makeBlock(line)) : [makeBlock()];
}

export function blocksToPlainText(blocks: RichBlock[]): string {
  return blocks.map(b => b.text).join('\n');
}
