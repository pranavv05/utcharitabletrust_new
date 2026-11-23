/** The groups the trust's people belong to, as on its member page, and helpers for showing them. */
export type TeamGroup = 'trustee' | 'advisory' | 'mentor' | 'working' | 'other';

export type GroupInfo = {
  id: TeamGroup;
  /** Heading of the group's section. */
  label: string;
  /** Short name for tabs. */
  tab: string;
  /** A line under the heading. */
  about: string;
};

export const teamGroups: GroupInfo[] = [
  {
    id: 'trustee',
    label: 'Trustees',
    tab: 'Trustees',
    about: 'The trustees who guide the trust and keep it true to its purpose.',
  },
  {
    id: 'advisory',
    label: 'Advisory Board',
    tab: 'Advisory Board',
    about: 'Experienced advisers who share their knowledge and judgement with the trust.',
  },
  {
    id: 'mentor',
    label: 'Our Mentors',
    tab: 'Mentors',
    about: 'Mentors who support our programmes and the people who run them.',
  },
  {
    id: 'working',
    label: 'Working Body',
    tab: 'Working Body',
    about: 'The people who give their time, week after week, to turn plans into care.',
  },
  {
    id: 'other',
    label: 'Our team',
    tab: 'Team',
    about: 'More of the people behind our work.',
  },
];

const known = new Set<string>(teamGroups.map((g) => g.id));

/** A stored group value, or 'other' when it is missing or not one of the known groups. */
export const normalizeGroup = (value: unknown): TeamGroup =>
  typeof value === 'string' && known.has(value) ? (value as TeamGroup) : 'other';

type Person = {name: string; role: string; image: string; group: TeamGroup};

/** People who hold a leading title (chairman or a president), shown first and larger. */
export const isLeader = (person: Pick<Person, 'role'>) => /chairman|president/i.test(person.role);

/** Photographs that are only a placeholder are not shown; initials are used instead. */
export const hasPhoto = (image: string) => !!image && !/(^|\/)blank\.(webp|png|jpe?g)$/i.test(image);

/** Two capital letters from a name (first and last word), ignoring titles such as Mr. or Dr. */
export function initials(name: string): string {
  const words = name
    .replace(/^(Mr|Mrs|Ms|Miss|Dr|Adv|Prof)\.?\s*/i, '')
    .split(/[\s.]+/)
    .filter(Boolean);
  if (!words.length) return '';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/** Each group that has people, in the order above, with its people in the order they were arranged. */
export function groupTeam<T extends Person>(team: T[]): {group: GroupInfo; people: T[]}[] {
  return teamGroups
    .map((group) => ({group, people: team.filter((p) => p.group === group.id)}))
    .filter((g) => g.people.length > 0);
}
