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
            <h3>Weekend</h3>
            <p>Select a weekend from the dropdown to instantly check campsite availability. Shows the full weekend (Fri→Sun, 2 nights) and each night separately.</p>
          </section>

          <section className="guide-section">
            <h3>Holidays</h3>
            <p>Tap any VIC public holiday to check availability for the entire long weekend. Displays the full period and a nightly breakdown.</p>
          </section>

          <section className="guide-section">
            <h3>Custom</h3>
            <p>Pick your own check-in and check-out dates (up to 14 nights), then tap Search. Results show the full period and each night individually.</p>
          </section>

          <section className="guide-section">
            <h3>Favourites</h3>
            <p>Save date ranges you want to monitor. Requires a free account.</p>
            <ul>
              <li><strong>Add Monitor</strong> — Pick dates and optionally filter to specific campsites (e.g. 23rd Ave #298)</li>
              <li><strong>Live status</strong> — Each night shows Full or Available with spot count. Tap the arrow to expand details</li>
              <li><strong>Mark booked</strong> — When you book a night, mark it to stop monitoring that night</li>
              <li><strong>Email notifications</strong> — Toggle the bell icon per monitor. Set your email in the Notification Email field. The system checks every 15 minutes and emails you when availability changes</li>
              <li><strong>Campsite filter</strong> — Optionally monitor specific sites instead of all campsites. Expand "Filter campsites" when adding a monitor</li>
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
