import { useEffect, useRef, useState } from 'react';
import { PortfolioCanvas } from './components/PortfolioCanvas';
import { DISCIPLINES, PROFILE, PROJECTS } from './data/portfolioData';

export default function App() {
  const scrollProgressRef = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let rafPending = false;
    const syncScroll = () => {
      rafPending = false;
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      scrollProgressRef.current = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(syncScroll);
      }
    };

    syncScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className="relative bg-[#030507]">
      {/* Pure, unobstructed 3D WebGL viewport containing all typography & controls */}
      <PortfolioCanvas
        scrollProgressRef={scrollProgressRef}
        reducedMotion={reducedMotion}
      />

      {/* Invisible scroll track to drive the 3D spline camera */}
      <div className="h-[680vh] w-full pointer-events-none" aria-hidden="true" />

      {/* Screen-reader accessible summary of the 3D portfolio */}
      <main className="sr-only">
        <h1>{PROFILE.brandName} — {PROFILE.roleHeadline}</h1>
        <p>{PROFILE.heroSubtitle}</p>
        <section>
          <h2>Systems &amp; Craft</h2>
          {DISCIPLINES.map((d) => (
            <article key={d.id}>
              <h3>{d.title}</h3>
              <p>{d.summary}</p>
            </article>
          ))}
        </section>
        <section>
          <h2>Selected Engineering</h2>
          {PROJECTS.map((p) => (
            <article key={p.id}>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
            </article>
          ))}
        </section>
        <section>
          <h2>Contact</h2>
          <p>{PROFILE.email}</p>
        </section>
      </main>
    </div>
  );
}
