import {gmailLink, whatsappLink, trustContacts} from '@/lib/contact-links';
import {BrandLogo} from '@/components/brand-logo';
import Link from 'next/link';
import {Instagram, Facebook} from 'lucide-react';
export function Footer() {
  return (
    <footer className="immersive-footer">
      <div className="experience-container">
        <div className="footer-topline">
          <Link href="/" className="immersive-brand">
            <BrandLogo />
          </Link>
          <a href="#main" className="back-to-top">
            BACK TO TOP <span aria-hidden="true">↑</span>
          </a>
        </div>
        <div className="footer-links-grid">
          <div>
            <span className="overline">OUR HOME</span>
            <p>
              Shop No. 05, V-Raj Darshan,
              <br />
              Samarwani, Silvassa,
              <br />
              Dadra and Nagar Haveli – 396230
            </p>
          </div>
          <div>
            <span className="overline">EXPLORE</span>
            <Link href="/about">Our story</Link>
            <Link href="/our-work">Our work</Link>
            <Link href="/book-bank">Book bank</Link>
            <Link href="/gallery">Gallery</Link>
          </div>
          <div>
            <span className="overline">THE TRUST</span>
            <Link href="/team">Our people</Link>
            <Link href="/president-message">President’s message</Link>
            <Link href="/certificates">Certificates</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <div>
            <span className="overline">START A CONVERSATION</span>
            <a href={gmailLink()} target="_blank" rel="noopener noreferrer">
              help@utcharitabletrust.com
            </a>
            <a href={whatsappLink(trustContacts.events.digits)} target="_blank" rel="noopener noreferrer">
              +91 93779 58582
            </a>
            <div className="footer-social-icons">
              <a href="https://www.instagram.com/utctrust" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://www.facebook.com/profile.php?id=100066515376555" aria-label="Facebook">
                <Facebook size={20} />
              </a>
            </div>
          </div>
        </div>
        <div className="footer-wordmark" aria-label="UT Charitable Trust">
          Together<span>.</span>
        </div>
        <div className="footer-copyright">
          <span>© {new Date().getFullYear()} UT Charitable Trust</span>
          <span>People. Purpose. Possibility.</span>
        </div>
      </div>
      <div className="footer-brand-line" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </footer>
  );
}
