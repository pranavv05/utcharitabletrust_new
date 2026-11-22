export const trustContacts = {
  support: {number: '+91 97129 68582', digits: '919712968582', label: 'General support'},
  events: {number: '+91 93779 58582', digits: '919377958582', label: 'Events & drives'},
  email: 'help@utcharitabletrust.com',
  secondaryEmail: 'utctrust@gmail.com',
  address: 'Shop No. 05, V-Raj Darshan, Samarwani, Silvassa, Dadra and Nagar Haveli – 396230',
};
export const whatsappLink = (number = trustContacts.support.digits) =>
  'https://wa.me/' +
  number.replace(/\D/g, '') +
  '?text=' +
  encodeURIComponent('Hello UT Charitable Trust, I would like to get in touch.');
export const gmailLink = (email = trustContacts.email) =>
  'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email);
export const mapsLink =
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(trustContacts.address);
export const contactTopics = [
  {
    name: 'Donate essentials',
    hint: 'Books, clothes, blankets, food supplies or stationery.',
    placeholder: 'What would you like to give, roughly how much, and where are you located?',
  },
  {
    name: 'Volunteer',
    hint: 'Share your time, skills or experience with our community.',
    placeholder: 'Tell us about your interests, availability and how you would like to help.',
  },
  {
    name: 'Request support',
    hint: 'Tell us what you need so our team can understand your situation.',
    placeholder: 'What support are you looking for, and how can our team reach you?',
  },
  {
    name: 'Partner with us',
    hint: 'Bring your organisation, resources or ideas to a shared purpose.',
    placeholder: 'Tell us about your organisation and the partnership you have in mind.',
  },
  {
    name: 'Media & other',
    hint: 'Press enquiries, questions and anything else you would like to share.',
    placeholder: 'How can we help you?',
  },
] as const;
export function initialContactTopic(subject: string) {
  if (/volunt|blood/i.test(subject)) return 'Volunteer';
  if (/partner/i.test(subject)) return 'Partner with us';
  if (/support|medical|food|blanket|clothing|monsoon/i.test(subject)) return 'Request support';
  if (/general|media/i.test(subject)) return 'Media & other';
  return 'Donate essentials';
}
