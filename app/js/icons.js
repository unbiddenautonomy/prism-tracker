// Thin line icons (24×24, drawn with the current text color).
const PATHS = {
  flask: 'M9 3h6M10 3v6.2L4.7 18.1A2 2 0 0 0 6.4 21h11.2a2 2 0 0 0 1.7-2.9L14 9.2V3M7.2 15h9.6',
  drop: 'M12 3.2s6 6.3 6 10.8a6 6 0 0 1-12 0c0-4.5 6-10.8 6-10.8z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  chart: 'M4 4v16h16M8 15l3.5-4 3 2.5L19 8',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
  back: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  alert: 'M12 3.5l9 16H3l9-16zM12 10v4M12 17h.01',
  edit: 'M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  share: 'M12 3v12M7.5 7.5L12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c-2.2 2.6-3.3 5.6-3.3 9s1.1 6.4 3.3 9M12 3c2.2 2.6 3.3 5.6 3.3 9s-1.1 6.4-3.3 9',
  backspace: 'M21 5H9l-6 7 6 7h12V5zM12.5 9.5l5 5M17.5 9.5l-5 5',
  box: 'M20.5 7.5L12 3 3.5 7.5 12 12l8.5-4.5zM3.5 7.5v9L12 21l8.5-4.5v-9M12 12v9',
  barrel: 'M7 3.5h10M7 20.5h10M7.5 3.5C6 7 6 17 7.5 20.5M16.5 3.5C18 7 18 17 16.5 20.5M6.6 9h10.8M6.6 15h10.8',
  leak: 'M3.5 6.5h10a4 4 0 0 1 4 4v1.5M17.5 15.5s-1.6 1.9-1.6 3a1.6 1.6 0 0 0 3.2 0c0-1.1-1.6-3-1.6-3z',
  xcircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6',
  sparkle: 'M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6-4.6-1.7 4.6-1.7L11 3.5zM18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z',
  dots: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  cloud: 'M7 18.5h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.6 4.4 4.4 0 0 0 7 18.5z',
  phone: 'M8 2.5h8a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18h2',
  note: 'M5 4h14v16H5zM8.5 9h7M8.5 13h7M8.5 17h4',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2zM10 21h4',
  stack: 'M12 3.5l8.5 4.5L12 12.5 3.5 8 12 3.5zM3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5',
};

export const REASON_ICONS = {
  spill: 'drop',
  leak: 'leak',
  contaminated: 'alert',
  expired: 'clock',
  failed: 'xcircle',
  cleaning: 'sparkle',
  other: 'dots',
};

const NS = 'http://www.w3.org/2000/svg';

export function icon(name, size, stroke) {
  const svg = document.createElementNS(NS, 'svg');
  const s = String(size || 20);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', s);
  svg.setAttribute('height', s);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(stroke || 1.75));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', PATHS[name] || PATHS.dots);
  svg.append(p);
  return svg;
}
