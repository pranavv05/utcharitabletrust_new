import Link from 'next/link';
import {getBookStats, getSiteContent} from '@/lib/site-content';
import {StudentVoiceGrid, StudentVoiceMarquee, StudentVoiceRow} from './student-voices';

/** Fewer than this and a moving strip would leave gaps, so they are shown as a plain row instead. */
const MARQUEE_MIN = 5;
const count = (n: number) => n.toLocaleString('en-IN');

/** Video feedback from students on the Book Bank page, after the catalogue. Nothing renders until one exists. */
export async function StudentVoicesSection() {
  const {studentVoices} = await getSiteContent();
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
      </div>
      <StudentVoiceGrid voices={studentVoices} />
    </section>
  );
}

/** The home page strip of student videos: featured ones first, then the rest, scrolling by itself. */
export async function HomeStudentVoices() {
  const [{studentVoices}, stats] = await Promise.all([getSiteContent(), getBookStats()]);
  if (!studentVoices.length) return null;
  // The home strip shows only the video, so names and words are not sent to the browser.
  const ordered = [
    ...studentVoices.filter((v) => v.featured),
    ...studentVoices.filter((v) => !v.featured),
  ].map((v) => ({
    id: v.id,
    name: '',
    quote: '',
    role: '',
    year: '',
    image: v.image,
    videoUrl: v.videoUrl,
    videoFile: v.videoFile,
    featured: v.featured,
  }));
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
      </div>
      {ordered.length >= MARQUEE_MIN ? (
        <StudentVoiceMarquee voices={ordered} />
      ) : (
        <div className="experience-container">
          <StudentVoiceRow voices={ordered} />
        </div>
      )}
    </section>
  );
}
