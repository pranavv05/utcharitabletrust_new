import type {Row} from './config';

export type QuickResult = {
  key: string;
  group: 'Books' | 'People' | 'Issued books';
  title: string;
  detail: string;
  href: string;
};

const text = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const statusNames: Record<string, string> = {
  active: 'Available',
  issue: 'Issued',
  lost: 'Lost',
  inactive: 'Archived',
  return: 'Returned',
  partial_return: 'Partial return',
  new: 'Donation',
  donar: 'Donor',
  customer: 'Borrower',
};
const label = (value: unknown) => statusNames[text(value)] || text(value).replaceAll('_', ' ');

/** Turns raw list rows from the admin API into links that open the matching record. */
export function quickResults(entity: 'books' | 'people' | 'loans', rows: Row[], limit = 5): QuickResult[] {
  return rows
    .filter((row) => row && row.id !== undefined && row.id !== null)
    .slice(0, limit)
    .map((row): QuickResult => {
      const id = encodeURIComponent(text(row.id));
      if (entity === 'books') {
        const utbn = text(row.utbn);
        return {
          key: 'book-' + id,
          group: 'Books',
          title: text(row.bookName) || 'Untitled book',
          detail: [utbn && 'UTBN ' + utbn, text(row.author), label(row.status)].filter(Boolean).join(' · '),
          href: '/admin/books?search=' + encodeURIComponent(utbn || text(row.bookName)),
        };
      }
      if (entity === 'people') {
        return {
          key: 'person-' + id,
          group: 'People',
          title: text(row.name) || 'Unnamed person',
          detail: [label(row.type), text(row.phone), text(row.customerId)].filter(Boolean).join(' · '),
          href: '/admin/people?id=' + id,
        };
      }
      return {
        key: 'loan-' + id,
        group: 'Issued books',
        title: text(row.orderNo) || 'Issue',
        detail: [text(row.name), label(row.status)].filter(Boolean).join(' · '),
        href: '/admin/loans?id=' + id,
      };
    });
}

/** Search text shorter than two characters is ignored to avoid broad, slow lookups. */
export const searchable = (query: string) => query.trim().length >= 2;
