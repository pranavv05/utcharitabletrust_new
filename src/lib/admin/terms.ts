/**
 * The workspace says "issued books" instead of "loans". Database errors raised by older migrations
 * still use the old word, so they are translated before staff see them.
 */
export function plainTerms(message: string) {
  return message
    .replace(/\bLoans\b/g, 'Issued books')
    .replace(/\bloans\b/g, 'issued books')
    .replace(/\bLoan\b/g, 'Issue')
    .replace(/\bloan\b/g, 'issue record');
}
