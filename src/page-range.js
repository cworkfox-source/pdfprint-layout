// §12.2 page-range syntax for PDF import: `1-5`, `1,3,5`, `1-5,8,10-12`, plus
// the `all` / `odd` / `even` keywords. Pure string parsing — no PDF.js, no
// DOM — so it's fully unit-testable and reusable by both the Source Engine
// loader and any future "range" UI control.

const RANGE_SEGMENT = /^(\d+)-(\d+)$/;
const SINGLE_PAGE = /^(\d+)$/;

// Returns 0-based page indices, ascending, deduplicated. `spec` uses
// 1-based page numbers (as shown to the user); `pageCount` bounds validation.
export function parsePageRange(spec, pageCount) {
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error(`parsePageRange requires a positive pageCount, got ${pageCount}`);
  }

  const trimmed = (spec ?? '').trim();
  if (trimmed === '' || trimmed === 'all') {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  if (trimmed === 'odd') {
    return Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 1);
  }
  if (trimmed === 'even') {
    return Array.from({ length: pageCount }, (_, i) => i).filter((i) => (i + 1) % 2 === 0);
  }

  const indices = new Set();
  for (const rawSegment of trimmed.split(',')) {
    const segment = rawSegment.replace(/\s+/g, '');
    if (segment === '') continue;

    const rangeMatch = segment.match(RANGE_SEGMENT);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start > end) {
        throw new Error(`Invalid page range segment "${segment}": start > end`);
      }
      assertInBounds(start, pageCount, segment);
      assertInBounds(end, pageCount, segment);
      for (let n = start; n <= end; n += 1) indices.add(n - 1);
      continue;
    }

    const singleMatch = segment.match(SINGLE_PAGE);
    if (singleMatch) {
      const n = Number(singleMatch[1]);
      assertInBounds(n, pageCount, segment);
      indices.add(n - 1);
      continue;
    }

    throw new Error(`Invalid page range segment: "${segment}"`);
  }

  if (indices.size === 0) {
    throw new Error(`Page range "${spec}" resolved to zero pages`);
  }
  return Array.from(indices).sort((a, b) => a - b);
}

function assertInBounds(pageNumber, pageCount, segment) {
  if (pageNumber < 1 || pageNumber > pageCount) {
    throw new Error(`Page ${pageNumber} in segment "${segment}" is out of range 1-${pageCount}`);
  }
}
