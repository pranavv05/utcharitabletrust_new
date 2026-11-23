import {Hero} from '@/components/sections/hero';
import {CommunityStory} from '@/components/sections/community-story';
import {Programmes} from '@/components/sections/programmes';
import {Participation} from '@/components/sections/participation';
import {TrustNumbers} from '@/components/sections/trust-numbers';
import {HorizontalGallery} from '@/components/sections/horizontal-gallery';
import {Voices} from '@/components/sections/voices';
import {VelocityMarquee} from '@/components/sections/velocity-marquee';
import {Experience} from '@/components/sections/experience';
import {MagneticLink} from '@/components/ui/magnetic-link';
import {TestimonialsSection} from '@/components/testimonials';
import {HomeStudentVoices} from '@/components/student-voices-section';
import {PartnersStrip} from '@/components/partners';

export default function Home() {
  return (
    <Experience>
      <Hero />
      <CommunityStory />
      <VelocityMarquee />
      <Programmes />
      <Participation />
      <TrustNumbers />
      <HorizontalGallery />
      <Voices />
      <HomeStudentVoices />
      <TestimonialsSection />
      <PartnersStrip />
      <section id="together" className="chapter final-chapter">
        <div className="experience-container">
          <span className="chapter-tag" data-reveal>
            THE NEXT CHAPTER
          </span>
          <h2 data-reveal>
            Good things
            <br />
            start with <em>us.</em>
          </h2>
          <div className="final-chapter-bottom" data-reveal>
            <p>
              Give your time. Share a book. Bring an idea.
              <br />
              There’s a place for you in our story.
            </p>
            <MagneticLink href="/join" className="final-cta">
              Let’s make a difference
            </MagneticLink>
          </div>
        </div>
        <div className="final-orbit" aria-hidden="true" />
      </section>
    </Experience>
  );
}
