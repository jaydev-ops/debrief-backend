// src/services/classifyNote.js
//
// This is the "brain" that reads a note's text and decides what TYPE it is.
//
// We keep this in its own file (a "service") so it's:
//   - Easy to test independently
//   - Easy to swap out later (e.g. replace with AI/OpenAI call)
//   - Not cluttering the route/controller code
//
// How it works:
//   We define keyword lists for each category.
//   We check if ANY keyword from a list appears in the note text.
//   The first match wins. If nothing matches → "discussion" (default).

// ─── Keyword lists per category ───────────────────────────────────────────────
//
// Each entry is a regular expression (regex).
// \b means "word boundary" — so "decide" won't match "undecided" accidentally.
// The 'i' flag means case-insensitive (matches "DECIDE" and "decide" equally).

const CATEGORIES = [
  {
    type: 'decision',
    // Words that signal a decision was made
    patterns: [
      /\bdecide[sd]?\b/i,
      /\bdecision\b/i,
      /\bfinal(ized|ly)?\b/i,
      /\bagreed?\b/i,
      /\bapproved?\b/i,
      /\bchose\b/i,
      /\bchosen\b/i,
      /\bselected?\b/i,
      /\bwill use\b/i,
      /\bgoing with\b/i,
      /\bconfirmed?\b/i,
      /\bresolve[sd]?\b/i,
      /\bunanimous(ly)?\b/i,
    ],
  },
  {
    type: 'action',
    // Words that signal someone needs to DO something
    patterns: [
      /\bassign(ed)?\b/i,
      /\btask\b/i,
      /\bto-?do\b/i,
      /\baction item\b/i,
      /\bfollow.?up\b/i,
      /\bwill (do|fix|build|create|send|update|implement|review|prepare|complete|finish)\b/i,
      /\bneeds? to\b/i,
      /\bshould (do|fix|build|create|send|update)\b/i,
      /\bdeadline\b/i,
      /\bdue (by|on|date)\b/i,
      /\bresponsible\b/i,
      /\bowner\b/i,
      /\bdeliver\b/i,
      /\bschedule\b/i,
      /\basap\b/i,
      /\bby (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      /\bby (end of|eod|eow)\b/i,
    ],
  },
  {
    type: 'problem',
    // Words that signal something is broken or blocked
    patterns: [
      /\bbug\b/i,
      /\bissue\b/i,
      /\bproblem\b/i,
      /\berror\b/i,
      /\bfail(ing|ed|ure)?\b/i,
      /\bcrash(ing|ed)?\b/i,
      /\bbroken?\b/i,
      /\bnot working\b/i,
      /\bdown\b/i,
      /\boutage\b/i,
      /\bblocker\b/i,
      /\bblocked\b/i,
      /\bincident\b/i,
      /\bregression\b/i,
      /\bdefect\b/i,
      /\blatency\b/i,
      /\bperformance\b/i,
      /\bcritical\b/i,
      /\btimeout\b/i,
      /\bexception\b/i,
      /\b500 error\b/i,
      /\bproduction (issue|problem|bug|outage)\b/i,
    ],
  },
  // Note: "discussion" is the DEFAULT — no keywords needed.
  // If nothing above matches, it's a discussion.
];

/**
 * classifyNote
 *
 * Takes note text as input, returns the category string.
 *
 * @param {string} content - The raw text of the note
 * @returns {string} - One of: "decision" | "action" | "problem" | "discussion"
 *
 * Example:
 *   classifyNote("We decided to use Postgres") → "decision"
 *   classifyNote("John will fix the bug by Friday") → "action"
 *   classifyNote("Production is down!") → "problem"
 *   classifyNote("Maybe we should consider TypeScript?") → "discussion"
 */
function classifyNote(content) {
  if (!content || typeof content !== 'string') return 'discussion';

  // Try each category in order (decision → action → problem)
  for (const category of CATEGORIES) {
    // Check if ANY pattern in this category matches the text
    const matched = category.patterns.some((pattern) => pattern.test(content));

    if (matched) {
      return category.type; // Return the first match we find
    }
  }

  // Nothing matched → it's a general discussion
  return 'discussion';
}

/**
 * getMatchedKeywords (bonus utility — useful for debugging)
 *
 * Returns which keywords triggered the classification.
 * Handy for frontend display ("classified because: 'decided', 'final'")
 *
 * @param {string} content
 * @returns {{ type: string, matches: string[] }}
 */
function classifyNoteWithDetails(content) {
  if (!content) return { type: 'discussion', matches: [] };

  for (const category of CATEGORIES) {
    const matches = category.patterns
      .filter((pattern) => pattern.test(content))
      .map((pattern) => pattern.source.replace(/\\b|\\i|\//g, '').replace(/\(.*?\)/g, '').trim());

    if (matches.length > 0) {
      return { type: category.type, matches };
    }
  }

  return { type: 'discussion', matches: [] };
}

module.exports = { classifyNote, classifyNoteWithDetails };
