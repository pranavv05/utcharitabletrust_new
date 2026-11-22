/** The book bank's lending policy. Change the numbers here and every form and receipt follows. */
export const ISSUE_DAYS = 365;
export const LATE_FEE_PER_DAY = 10;

const DAY = 86400000;
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);

/** Adds whole days to a YYYY-MM-DD date and returns YYYY-MM-DD (no timezone surprises). */
export function addDays(date: string, days: number): string {
  const start = Date.parse(date.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(start)) throw Error('Invalid date');
  return new Date(start + days * DAY).toISOString().slice(0, 10);
}

/** The return date for a book issued on `issueDate`: exactly 365 days later. */
export const issueDueDate = (issueDate: string) => addDays(issueDate, ISSUE_DAYS);

/** Whole days a book is kept past its due date; 0 when returned on time or when a date is missing. */
export function daysLate(due: unknown, returned: unknown): number {
  if (!isDate(due) || !isDate(returned)) return 0;
  const days = Math.round(
    (Date.parse(returned.slice(0, 10) + 'T00:00:00Z') - Date.parse(due.slice(0, 10) + 'T00:00:00Z')) / DAY,
  );
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** The late fee in rupees for one book returned on `returned`, at the standard daily rate. */
export const lateFee = (due: unknown, returned: unknown, copies = 1) =>
  daysLate(due, returned) * LATE_FEE_PER_DAY * Math.max(0, copies);

export type Term = {en: string; hi: string};

/** Printed on every issue receipt, in English with a Hindi translation. */
export const issueTerms: Term[] = [
  {
    en: `Books are issued free of charge for ${ISSUE_DAYS} days from the date of issue. The borrower must return each book to the trust on or before the due date printed on this receipt.`,
    hi: `पुस्तकें निःशुल्क, जारी करने की तिथि से ${ISSUE_DAYS} दिनों के लिए दी जाती हैं। प्रत्येक पुस्तक इस रसीद पर छपी देय तिथि को या उससे पहले ट्रस्ट को लौटानी होगी।`,
  },
  {
    en: `If a book is returned after the due date, a late fee of ₹${LATE_FEE_PER_DAY} per day is payable for every day after the due date until the book is returned.`,
    hi: `यदि पुस्तक देय तिथि के बाद लौटाई जाती है, तो देय तिथि के बाद पुस्तक लौटाने तक प्रत्येक दिन के लिए ₹${LATE_FEE_PER_DAY} प्रतिदिन विलंब शुल्क देना होगा।`,
  },
  {
    en: 'The borrower must take proper care of the book and must not write on, mark, tear, lend to another person or otherwise damage it.',
    hi: 'पुस्तक की उचित देखभाल करनी होगी। उस पर लिखना, निशान लगाना, फाड़ना, किसी अन्य व्यक्ति को देना या किसी भी प्रकार से क्षति पहुँचाना वर्जित है।',
  },
  {
    en: 'If a book is damaged, the borrower must pay the amount decided by the trust according to the damage. If a book is lost, the borrower must pay its current price or replace it with the same title and edition, as decided by the trust.',
    hi: 'यदि पुस्तक क्षतिग्रस्त हो जाए, तो क्षति के अनुसार ट्रस्ट द्वारा तय की गई राशि चुकानी होगी। यदि पुस्तक खो जाए, तो उसका वर्तमान मूल्य चुकाना होगा या उसी नाम और संस्करण की पुस्तक बदलकर देनी होगी, जैसा ट्रस्ट तय करे।',
  },
  {
    en: 'The book remains the property of the trust and is issued for personal educational use only. The trust will check the condition of the book when it is returned.',
    hi: 'पुस्तक ट्रस्ट की संपत्ति है और केवल व्यक्तिगत शैक्षिक उपयोग के लिए दी गई है। पुस्तक लौटाने पर ट्रस्ट उसकी स्थिति की जाँच करेगा।',
  },
  {
    en: 'Please bring this receipt when returning the book, and inform the trust if your address or phone number changes. The return period can be extended only with the trust’s approval.',
    hi: 'पुस्तक लौटाते समय यह रसीद साथ लाएँ, और पता या फ़ोन नंबर बदलने पर ट्रस्ट को सूचित करें। अवधि बढ़ाना केवल ट्रस्ट की स्वीकृति से संभव है।',
  },
];

export const acceptance: Term = {
  en: 'I have read and accept the terms above and received the books listed.',
  hi: 'मैंने उपरोक्त शर्तें पढ़ ली हैं और स्वीकार करता/करती हूँ तथा सूचीबद्ध पुस्तकें प्राप्त की हैं।',
};

export const donationNote: Term = {
  en: 'Thank you for your generous donation. The books listed above were received as a voluntary gift and become the property of the trust, to be shared with students and readers in our community.',
  hi: 'आपके उदार दान के लिए धन्यवाद। ऊपर सूचीबद्ध पुस्तकें स्वैच्छिक उपहार के रूप में प्राप्त हुई हैं और ट्रस्ट की संपत्ति होंगी, जिन्हें हमारे समुदाय के विद्यार्थियों और पाठकों के साथ साझा किया जाएगा।',
};
