import { useRef } from 'react';

export default function GuideModal({ onClose }) {
  const overlayClickRef = useRef(false);

  return (
    <div 
      className="guide-overlay" 
      onMouseDown={(e) => { 
        if (e.target === e.currentTarget) overlayClickRef.current = true; 
      }}
      onMouseUp={(e) => { 
        if (e.target === e.currentTarget && overlayClickRef.current) onClose(); 
        overlayClickRef.current = false; 
      }}
    >
      <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>&times;</button>

        <div className="guide-content">
          <h2 className="guide-title">How to use</h2>

          <section className="guide-section">
            <p>This tool checks campsite availability at <strong>Tidal River, Wilsons Promontory</strong> (drive-in sites only). Pick a date range and instantly see which campsites have spots. You can book up to ~8 months ahead.</p>
            <p>Every search shows two things: the <strong>full period</strong> (can you book the entire stay?) and a <strong>per-night breakdown</strong>. This is the key feature — even when your full date range is booked out, individual nights often still have openings. You can book those nights separately on the Parks Victoria website to piece together your trip.</p>
            <p>Use the tabs to browse by weekend, holiday, or custom dates. Want to keep an eye on something? Save it to Favourites and we'll email you when spots open up.</p>
          </section>

          <section className="guide-section">
            <h3><span className="guide-tab-icon">◐</span> Weekend</h3>
            <ul>
              <li>Pick a weekend from the dropdown — availability loads instantly</li>
              <li>The top result shows the <strong>full weekend</strong> (Fri → Sun, 2 nights) — if a campsite appears here, you can book both nights in one go</li>
              <li>Below that, each night is listed separately. If the full weekend is booked out, you might still find Friday or Saturday available on its own — book them as separate stays</li>
              <li>Each result lists available campsites with pricing and how many spots are left</li>
              <li>Tap any campsite name to go straight to the booking page</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3><span className="guide-tab-icon">⟡</span> Holidays</h3>
            <ul>
              <li>Browse upcoming public holidays within the booking window (~8 months)</li>
              <li>Tap a holiday card to check availability for that long weekend</li>
              <li>Past holidays are greyed out</li>
              <li>Long weekends are popular and often sell out as a whole. The per-night breakdown lets you spot which individual nights still have openings, so you can book them separately and still enjoy part of the holiday</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3><span className="guide-tab-icon">◈</span> Custom</h3>
            <ul>
              <li>Set your own check-in and check-out dates (up to 14 nights)</li>
              <li>Tap <span className="guide-btn-sample">Search</span> to check availability</li>
              <li>Same full period + per-night breakdown as the other tabs — great for planning longer trips where you can mix and match available nights</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>Favourites</h3>
            <p>Never miss a campsite opening. Save the dates you want and we'll keep checking for you. Requires a free account.</p>

            <h4>Getting started</h4>
            <ul>
              <li>Tap <span className="guide-btn-sample"><span className="guide-btn-plus">+</span> Add Monitor</span>, pick your dates, and give it a name</li>
              <li>Want a specific spot? Expand "Filter campsites" to choose preferred sites (e.g. 3rd Ave #77-98). Otherwise we'll watch all available campsites for you</li>
            </ul>

            <h4>Checking availability</h4>
            <ul>
              <li>Each card shows whether each night is <span className="guide-tag muted">Full</span> or <span className="guide-tag green">Available</span></li>
              <li>Tap <svg className="guide-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> on any night to see exactly which campsites have spots</li>
              <li>Availability is refreshed automatically every 15 minutes</li>
            </ul>

            <h4>Get notified by email</h4>
            <ul>
              <li>Enter your email at the top of the Favourites tab</li>
              <li>Tap <svg className="guide-icon" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.5 1.5 4 3.5 4 5.5V8L2.5 10.5H13.5L12 8V5.5C12 3.5 10.5 1.5 8 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M6.5 11.5C6.5 12.3 7.2 13 8 13C8.8 13 9.5 12.3 9.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg> on a card to turn on email alerts</li>
              <li>When a spot opens up, you'll get an email telling you which campsites are now available</li>
              <li>You'll only be emailed once per opening — no spam</li>
            </ul>

            <h4>Already booked?</h4>
            <ul>
              <li>Tap <span className="guide-btn-sample">Mark booked</span> on a night you've secured — we'll stop watching that night</li>
              <li>Changed your mind? Tap <span className="guide-btn-sample">Undo</span> to resume watching</li>
            </ul>
          </section>

          <section className="guide-section">
            <h3>Tips</h3>
            <ul>
              <li>Data comes from Parks Victoria / BookEasy. Booking window is ~8 months ahead</li>
              <li>Only drive-in Tidal River campsites are shown (hiking-only and premium accommodation filtered out)</li>
              <li>Long weekends (Melbourne Cup, Easter, etc.) sell out fast — use Favourites to get notified when spots open up</li>
              <li>You can monitor up to 5 date ranges at once</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
