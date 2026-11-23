import Link from 'next/link';
import {getBookStats, getSiteContent} from '@/lib/site-content';
import {StudentVoiceCard, StudentVoiceGrid} from './student-voices';

const count = (n: number) => n.toLocaleString('en-IN');

/** Video feedback from students on the Book Bank page, after the catalogue. Nothing renders until one exists. */
export async function StudentVoicesSection() {
  const [{studentVoices}, stats] = await Promise.all([getSiteContent(), getBookStats()]);
  if (!studentVoices.length) return null;
  return (
    <section className="sx-voices-section" id="student-voices" aria-labelledby="student-voices-title">
      <div className="section-heading">
        <div>
          <span className="chapter-tag">STUDENT VOICES</span>
          <h2 id="student-voices-title" style={{marginTop: 10}}>
            Hear it from the students.
          </h2>
          <p style={{marginTop: 14}}>
            Students who borrowed from our book bank share, in their own words, what it meant for their
            studies.
          </p>
        </div>
        <ul className="sx-voice-facts" aria-label="Book bank in numbers">
          {stats && (
            <li>
              <strong>{count(stats.issued)}</strong> books issued
            </li>
          )}
          <li>
            <strong>{count(studentVoices.length)}</strong> student videos
          </li>
        </ul>
      </div>
      <StudentVoiceGrid voices={studentVoices} />
    </section>
  );
}

/** Up to three featured student videos for the home page. */
export async function HomeStudentVoices() {
  const [{studentVoices}, stats] = await Promise.all([getSiteContent(), getBookStats()]);
  if (!studentVoices.length) return null;
  const featured = studentVoices.filter((v) => v.featured);
  const shown = (featured.length ? featured : studentVoices).slice(0, 3);
  return (
    <section className="sx-testimonials" aria-labelledby="home-voices-title">
      <div className="experience-container">
        <span className="chapter-tag">FROM THE BOOK BANK</span>
        <div className="sx-strip-head">
          <h2 id="home-voices-title">
            Students, <em>in their words.</em>
          </h2>
          <Link href="/book-bank#student-voices" className="text-link">
            Watch more student stories →
          </Link>
        </div>
        {stats && (
          <p className="sx-voice-lead">
            <strong>{count(stats.issued)}</strong> books issued to students so far.
          </p>
        )}
        <div className="sx-quote-grid">
          {shown.map((v) => (
            <StudentVoiceCard key={v.id} item={v} />
          ))}
        </div>
      </div>
    </section>
  );
}
