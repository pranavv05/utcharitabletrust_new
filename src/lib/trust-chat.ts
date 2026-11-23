import {trustContacts, whatsappLink, gmailLink, mapsLink} from './contact-links';
import type {SiteContent} from './site-content';
import {isLeader, teamGroups} from './team';
export type ChatLink = {label: string; href: string};
export type ChatReply = {message: string; links: ChatLink[]; mode: 'guide' | 'groq'};
const programmeHref = (slug: string) => (slug === 'book-bank' ? '/book-bank' : '/our-work/' + slug);
export function guideReply(question: string, site: SiteContent): ChatReply {
  const q = question.toLowerCase();
  let message = '';
  let links: ChatLink[] = [];
  if (/\b(hi|hello|hey|namaste)\b/.test(q) && q.length < 35)
    message =
      'Hello! I can help you explore UT Charitable Trust, its programmes, book donations, membership and ways to get involved. What would you like to know?';
  else if (/where|address|location|direction|visit|located/.test(q)) {
    message =
      'You can find UT Charitable Trust at ' +
      trustContacts.address +
      '. Please message the team before visiting to confirm availability or arrange a drop-off.';
    links = [
      {label: 'Get directions', href: mapsLink},
      {label: 'Message the trust', href: whatsappLink()},
    ];
  } else if (/contact|phone|email|whatsapp|call|number/.test(q)) {
    message =
      'You can call or message the trust on WhatsApp at ' +
      trustContacts.phone.number +
      '. You can also write to ' +
      trustContacts.email +
      '.';
    links = [
      {label: 'Message on WhatsApp', href: whatsappLink()},
      {label: 'Write in Gmail', href: gmailLink()},
    ];
  } else if (/chair|president|leadership|who leads|team/.test(q)) {
    const leaders = site.team.filter(isLeader);
    message =
      'The published leadership profiles include ' +
      leaders.map((p) => p.name + ' (' + p.role + ')').join(', ') +
      '. The people page groups everyone into Trustees, the Advisory Board, Mentors and the Working Body.';
    links = [{label: 'Meet our leadership', href: '/team'}];
  } else if (/\biso\b|certif|accredit/.test(q)) {
    message =
      'UT Charitable Trust is an ISO certified trust' +
      (site.iso ? ' (' + site.iso.standard + ')' : '') +
      '. You can see its certificates and registration documents on the Legal documents page.';
    links = [{label: 'View our certification', href: '/legal#certification'}];
  } else if (/volunteer|membership|become a member|join|partner/.test(q)) {
    message =
      'You can offer your time, skills or resources through our community activities. Use the membership form to tell the trust about your interests and availability; the staff team reviews applications. For partnerships or a specific volunteering enquiry, choose the matching option on the contact page.';
    links = [
      {label: 'Membership application', href: '/join'},
      {label: 'Contact the team', href: '/contact?subject=Volunteer'},
    ];
  } else if (/gallery|photo|picture/.test(q)) {
    message =
      'The gallery brings together photographs of education, health, essential support, community events and recognition activities. Filter by subject and open a photograph to read its context.';
    links = [{label: 'Explore gallery', href: '/gallery'}];
  } else {
    const keywords: Record<string, RegExp> = {
      'book-bank': /book|borrow|library|student/,
      'blood-donation-camp': /blood|donor/,
      'food-packet-distribution': /food|meal/,
      'school-stationary-distribution': /school|stationery|stationary/,
      'mega-cloth-distribution': /cloth/,
      'blanket-distribution': /blanket|winter/,
      'medical-help': /medical|health/,
      'raining-season': /rain|umbrella|monsoon/,
      'fight-against-covid': /covid|pandemic/,
    };
    const match = site.programmes.find((p) => keywords[p.slug]?.test(q) || q.includes(p.name.toLowerCase()));
    if (match) {
      message =
        match.body +
        ' Please contact the trust to confirm current arrangements; this chat cannot reserve books or approve assistance.';
      links = [
        {label: match.name, href: programmeHref(match.slug)},
        {label: 'Contact the team', href: '/contact?subject=' + encodeURIComponent(match.name)},
      ];
    } else if (/programme|program|activities|work|help|support|donat/.test(q)) {
      message =
        'The trust’s published programmes include ' +
        site.programmes.map((p) => p.name).join(', ') +
        '. You can donate useful essentials, volunteer or speak with the team about support.';
      links = [
        {label: 'Explore our work', href: '/our-work'},
        {label: 'How would you like to help?', href: '/contact'},
      ];
    } else if (/trust|story|history|about|purpose|mission/.test(q)) {
      message =
        'UT Charitable Trust is rooted in Silvassa and supports migrant and low-income families through education, health, nutrition and practical assistance. Its published objectives describe help without distinction of caste, colour, creed, sex or religion. The trust’s earlier website also describes counselling, skills and community development as part of its wider purpose.';
      links = [{label: 'Read our story', href: '/about'}];
    } else {
      message =
        'I can currently help with the trust’s published programmes, book bank, membership, people and contact details. What would you like to explore?';
      links = [
        {label: 'Our work', href: '/our-work'},
        {label: 'Talk to the team', href: '/contact'},
      ];
    }
  }
  return {message, links, mode: 'guide'};
}
export function chatContext(site: SiteContent) {
  return JSON.stringify({
    trust: 'UT Charitable Trust, Silvassa',
    purpose:
      'Support for migrant and low-income families through education, health, nutrition and practical assistance. Help without distinction of caste, colour, creed, sex or religion. Do not invent a founding year.',
    contact: trustContacts,
    programmes: site.programmes.map((p) => ({
      name: p.name,
      description: p.description,
      body: p.body,
      url: programmeHref(p.slug),
    })),
    people: site.team.map((p) => ({
      name: p.name,
      role: p.role,
      group: teamGroups.find((g) => g.id === p.group)?.label ?? '',
    })),
    certification: site.iso ? site.iso.standard + ' certified' : 'ISO certified trust',
    pages: {story: '/about', people: '/team', gallery: '/gallery', membership: '/join', contact: '/contact'},
    announcements: site.announcements.map((a) => ({name: a.name, body: a.body, link: a.link})),
    operations:
      'Borrowing, donations and support require confirmation by the staff team. This chatbot has no access to private library records and cannot reserve books, promise aid, approve membership or send messages.',
  });
}
