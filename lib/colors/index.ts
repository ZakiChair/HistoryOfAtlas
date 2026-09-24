/** FNV-1a makes a polity's color independent of filtering, order and current year. */
function hashIdentifier(id: string): number {
  let hash = 0x811c9dc5;
  for (const character of id.normalize('NFC')) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function entityColorRgb(id: string): [number, number, number] {
  const hash = hashIdentifier(id);
  const hue = hash % 360;
  const saturation = 0.43 + ((hash >>> 9) % 18) / 100;
  const lightness = 0.53 + ((hash >>> 17) % 12) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const sectors: [number, number, number][] = [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ];
  return sectors[Math.floor(hue / 60)]!.map((channel) => Math.round((channel + m) * 255)) as [
    number,
    number,
    number,
  ];
}

export function entityColor(id: string): string {
  return `#${entityColorRgb(id)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`;
}

export function contrastingTextColor(hex: string): '#0b1220' | '#ffffff' {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return luminance > 0.19 ? '#0b1220' : '#ffffff';
}
