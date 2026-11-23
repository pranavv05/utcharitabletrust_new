/** What each kind of website content looks like in the admin editor. */
export type FieldType =
  'text' | 'textarea' | 'date' | 'year' | 'number' | 'url' | 'select' | 'image' | 'images' | 'file' | 'video';
export type FieldSpec = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  rows?: number;
  options?: [string, string][];
  /** Needed before the record can be published (also enforced by the database). */
  publish?: boolean;
};
export type KindSpec = {
  kind: string;
  tab: string;
  singular: string;
  nameLabel: string;
  intro: string;
  fields: FieldSpec[];
  /** The field holding the date or year used for the year filter. */
  yearField?: string;
  /** One fixed record that can be edited but not added or deleted. */
  single?: boolean;
  publicPath?: (slug: string) => string;
};

const tiers: [string, string][] = [
  ['principal', 'Principal partner'],
  ['gold', 'Gold partner'],
  ['silver', 'Silver partner'],
  ['supporter', 'Supporter'],
];

export const kindSpecs: KindSpec[] = [
  {
    kind: 'news',
    tab: 'News & Media',
    singular: 'news item',
    nameLabel: 'Headline',
    intro: 'Stories, press coverage, events and announcements with photographs and video.',
    yearField: 'date',
    publicPath: (slug) => '/news/' + slug,
    fields: [
      {
        key: 'date',
        label: 'Date',
        type: 'date',
        publish: true,
        help: 'Used for the year filter and sorting.',
      },
      {
        key: 'category',
        label: 'Category',
        type: 'select',
        options: [
          ['News', 'News'],
          ['Press', 'In the press'],
          ['Event', 'Event'],
          ['Award', 'Award'],
          ['Media', 'Media'],
        ],
      },
      {key: 'summary', label: 'Short summary', type: 'textarea', rows: 3},
      {key: 'body', label: 'Full story', type: 'textarea', rows: 8},
      {key: 'image', label: 'Cover photograph', type: 'image'},
      {
        key: 'photos',
        label: 'More photographs',
        type: 'images',
        help: 'Up to 12 photographs shown in the story.',
      },
      {key: 'video_url', label: 'Video link (YouTube or Vimeo)', type: 'url'},
      {key: 'video_file', label: 'Or upload a short video', type: 'video'},
    ],
  },
  {
    kind: 'gallery',
    tab: 'Gallery',
    singular: 'photograph',
    nameLabel: 'Photo caption',
    intro: 'Photographs on the gallery page. Set a year so visitors can filter by year.',
    yearField: 'year',
    fields: [
      {key: 'image', label: 'Photograph', type: 'image', publish: true},
      {key: 'category', label: 'Category', type: 'text'},
      {key: 'year', label: 'Year taken', type: 'year', help: 'Optional. Leave empty if unknown.'},
      {key: 'description', label: 'Photo description', type: 'textarea', rows: 3},
      {key: 'link', label: 'Related website page (optional)', type: 'text'},
    ],
  },
  {
    kind: 'programme',
    tab: 'Our work',
    singular: 'programme',
    nameLabel: 'Programme name',
    intro:
      'Programmes shown on the home page and Our work. Years come from the photographs linked to each one.',
    publicPath: (slug) => (slug === 'book-bank' ? '/book-bank' : '/our-work/' + slug),
    fields: [
      {key: 'title', label: 'Headline', type: 'text'},
      {key: 'category', label: 'Category', type: 'text'},
      {key: 'description', label: 'Short description', type: 'textarea', rows: 3, publish: true},
      {key: 'body', label: 'Full description', type: 'textarea', rows: 6, publish: true},
      {
        key: 'color',
        label: 'Accent colour',
        type: 'select',
        options: [
          ['blue', 'Blue'],
          ['red', 'Red'],
          ['green', 'Green'],
          ['yellow', 'Yellow'],
        ],
      },
      {key: 'image', label: 'Cover photograph', type: 'image', publish: true},
    ],
  },
  {
    kind: 'team',
    tab: 'Team',
    singular: 'team member',
    nameLabel: 'Full name',
    intro: 'People shown on the Our people page. Each person has a photograph, role and optional short bio.',
    publicPath: () => '/team',
    fields: [
      {
        key: 'group',
        label: 'Group',
        type: 'select',
        options: [
          ['trustee', 'Trustees'],
          ['advisory', 'Advisory Board'],
          ['mentor', 'Our Mentors'],
          ['working', 'Working Body'],
        ],
        help: 'The section of the Our people page this person appears in.',
      },
      {
        key: 'role',
        label: 'Role / responsibility',
        type: 'text',
        help: 'For example Chairman, President, Trustee or Mentor.',
      },
      {key: 'image', label: 'Photograph', type: 'image', publish: true},
      {key: 'bio', label: 'Short bio (optional)', type: 'textarea', rows: 4},
    ],
  },
  {
    kind: 'testimonial',
    tab: 'Testimonials',
    singular: 'testimonial',
    nameLabel: 'Person’s name',
    intro: 'Words from donors, volunteers, beneficiaries and partners.',
    publicPath: () => '/testimonials',
    fields: [
      {key: 'quote', label: 'Their words', type: 'textarea', rows: 5, publish: true},
      {key: 'role', label: 'Who they are', type: 'text', help: 'For example Parent, Volunteer or Donor.'},
      {key: 'image', label: 'Photograph (optional)', type: 'image'},
      {key: 'video_url', label: 'Video link (optional)', type: 'url'},
      {
        key: 'featured',
        label: 'Show on the home page',
        type: 'select',
        options: [
          ['no', 'No'],
          ['yes', 'Yes'],
        ],
      },
    ],
  },
  {
    kind: 'student_voice',
    tab: 'Student videos',
    singular: 'student video',
    nameLabel: 'Student’s first name',
    intro:
      'Video feedback from students who borrowed from the book bank, shown on the Book Bank page. To take one down, set it to Archived or Draft (it disappears from the website straight away) or delete it permanently.',
    yearField: 'year',
    publicPath: () => '/book-bank',
    fields: [
      {key: 'video_file', label: 'Video file', type: 'video'},
      {key: 'video_url', label: 'Or a YouTube / Vimeo link', type: 'url'},
      {
        key: 'quote',
        label: 'What they said (optional)',
        type: 'textarea',
        rows: 4,
        help: 'A short written version, shown under the video.',
      },
      {key: 'role', label: 'Class or book (optional)', type: 'text', help: 'For example Class 10 or Maths.'},
      {key: 'year', label: 'Year recorded', type: 'year'},
      {
        key: 'image',
        label: 'Preview picture (optional)',
        type: 'image',
        help: 'Shown before the video plays. Added automatically when you bulk upload.',
      },
      {
        key: 'featured',
        label: 'Show on the home page',
        type: 'select',
        options: [
          ['no', 'No'],
          ['yes', 'Yes'],
        ],
      },
    ],
  },
  {
    kind: 'partner',
    tab: 'Partners',
    singular: 'partner',
    nameLabel: 'Company name',
    intro: 'Companies and organisations that support the trust. Principal and gold partners appear first.',
    publicPath: () => '/partners',
    fields: [
      {key: 'tier', label: 'Partnership level', type: 'select', options: tiers},
      {key: 'logo', label: 'Logo', type: 'image', publish: true},
      {key: 'website', label: 'Website (https://…)', type: 'url'},
      {key: 'description', label: 'How they support us', type: 'textarea', rows: 4},
      {key: 'since', label: 'Supporting since (year)', type: 'year'},
    ],
  },
  {
    kind: 'legal',
    tab: 'Legal documents',
    singular: 'document',
    nameLabel: 'Document title',
    intro: 'Registrations, tax certificates, annual reports and policies.',
    yearField: 'year',
    publicPath: () => '/legal',
    fields: [
      {
        key: 'group',
        label: 'Type of document',
        type: 'select',
        options: [
          ['registration', 'Registration & tax certificate'],
          ['certification', 'Certification (for example ISO)'],
          ['report', 'Annual report / accounts'],
          ['policy', 'Policy'],
          ['other', 'Other'],
        ],
      },
      {key: 'number', label: 'Certificate / registration number', type: 'text'},
      {key: 'issuer', label: 'Issued by', type: 'text'},
      {key: 'issued', label: 'Issue date', type: 'date'},
      {key: 'valid_until', label: 'Valid until', type: 'date'},
      {key: 'year', label: 'Year (for reports)', type: 'year'},
      {
        key: 'file',
        label: 'Document file (PDF or image)',
        type: 'file',
        help: 'Needed unless you write the text below.',
      },
      {key: 'image', label: 'Preview image (optional)', type: 'image'},
      {key: 'body', label: 'Text of the policy (optional)', type: 'textarea', rows: 8},
    ],
  },
  {
    kind: 'college',
    tab: 'Intern colleges',
    singular: 'college',
    nameLabel: 'College name',
    intro:
      'Colleges the trust’s interns come from. Only the college and the number of interns are shown, never student names.',
    publicPath: () => '/interns',
    fields: [
      {key: 'city', label: 'City', type: 'text'},
      {key: 'interns', label: 'Number of interns so far', type: 'number', publish: true},
      {key: 'period', label: 'Years (for example 2024–2026)', type: 'text'},
      {key: 'logo', label: 'College logo (optional)', type: 'image'},
      {key: 'note', label: 'Note (optional)', type: 'textarea', rows: 3},
    ],
  },
  {
    kind: 'announcement',
    tab: 'Announcements',
    singular: 'announcement',
    nameLabel: 'Title',
    intro: 'A short notice shown above website pages.',
    fields: [
      {key: 'body', label: 'Announcement text', type: 'textarea', rows: 3},
      {key: 'link', label: 'Website link (optional)', type: 'text'},
    ],
  },
  {
    kind: 'setting',
    tab: 'ISO certification',
    singular: 'certification',
    nameLabel: 'Label',
    intro:
      'The trust’s ISO certification. Once published, a badge with the standard appears in the header, footer and on the Legal documents page.',
    single: true,
    publicPath: () => '/legal',
    fields: [
      {key: 'standard', label: 'Standard (for example ISO 9001:2015)', type: 'text', publish: true},
      {key: 'certificate_no', label: 'Certificate number', type: 'text'},
      {key: 'issuer', label: 'Certifying body', type: 'text'},
      {key: 'valid_until', label: 'Valid until', type: 'date'},
      {key: 'image', label: 'Badge or certificate image (optional)', type: 'image'},
      {key: 'link', label: 'Link to the certificate (optional)', type: 'text'},
      {key: 'note', label: 'Extra text (optional)', type: 'textarea', rows: 3},
    ],
  },
];

export const kindSpec = (kind: string) => kindSpecs.find((k) => k.kind === kind) ?? kindSpecs[0];

/** Friendly list of what is still missing before this record can be published. */
export function publishIssues(kind: string, data: Record<string, string>, name: string): string[] {
  const spec = kindSpec(kind);
  const issues = spec.fields.filter((f) => f.publish && !(data[f.key] || '').trim()).map((f) => f.label);
  if (kind === 'student_voice' && !(data.video_file || '').trim() && !(data.video_url || '').trim())
    issues.push('Video file or link');
  if (kind === 'legal' && !(data.file || '').trim() && !(data.body || '').trim())
    issues.push('Document file or text');
  if (!name.trim()) issues.push(spec.nameLabel);
  return issues;
}

/** Turns a title into a URL slug: lower-case letters, digits and single hyphens. */
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}
