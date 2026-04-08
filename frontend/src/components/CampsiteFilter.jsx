import { useState, useEffect } from 'react';

const UNITS_API = 'https://webapi.bookeasy.com.au/api/getAccomUnits?q=114';
const TIDAL_RIVER_OPERATOR = 33314;

// Cache units globally so we only fetch once
let cachedRooms = null;

export default function CampsiteFilter({ selected, onChange }) {
  const [rooms, setRooms] = useState(cachedRooms || []);
  const [loading, setLoading] = useState(!cachedRooms);
  const [expanded, setExpanded] = useState(selected.length > 0);
  const [activeRoom, setActiveRoom] = useState(null);

  useEffect(() => {
    if (cachedRooms) return;
    (async () => {
      try {
        const res = await fetch(UNITS_API);
        const data = await res.json();
        const units = data.Units || [];
        const filtered = units.filter(u => u.OperatorId === TIDAL_RIVER_OPERATOR);

        const roomMap = {};
        for (const unit of filtered) {
          const rn = unit.RoomName;
          if (!roomMap[rn]) {
            roomMap[rn] = { roomId: unit.RoomId, name: rn, units: [] };
          }
          // Extract short name: "23rd Ave Campsite 298 - 8 x 11m" → "298"
          const match = unit.UnitName.match(/Campsite\s+(\S+)/);
          const shortName = match ? match[1] : unit.UnitName;
          roomMap[rn].units.push({
            id: unit.UnitId,
            name: unit.UnitName,
            short: shortName,
          });
        }

        // Sort rooms and units naturally
        const sorted = Object.values(roomMap).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        for (const room of sorted) {
          room.units.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        }

        cachedRooms = sorted;
        setRooms(sorted);
      } catch (e) {
        console.error('Failed to load campsite units:', e);
      }
      setLoading(false);
    })();
  }, []);

  const isSelected = (unitId) => selected.some(s => s.id === unitId);

  const toggleUnit = (unit, roomName) => {
    if (isSelected(unit.id)) {
      onChange(selected.filter(s => s.id !== unit.id));
    } else {
      onChange([...selected, { id: unit.id, name: unit.short, room: roomName }]);
    }
  };

  const selectAllInRoom = (room) => {
    const existing = selected.filter(s => s.room !== room.name);
    const roomUnits = room.units.map(u => ({ id: u.id, name: u.short, room: room.name }));
    onChange([...existing, ...roomUnits]);
  };

  const deselectAllInRoom = (room) => {
    onChange(selected.filter(s => s.room !== room.name));
  };

  const roomSelectedCount = (room) => selected.filter(s => s.room === room.name).length;

  const clearAll = () => {
    onChange([]);
    setActiveRoom(null);
  };

  return (
    <div className="cf-wrap">
      {/* Toggle */}
      <button
        className={`cf-toggle ${expanded ? 'open' : ''}`}
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <svg className="cf-toggle-icon" width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M6 3h4M4 6h8M2 9h12M4 12h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span>Filter campsites</span>
        {selected.length > 0 && <span className="cf-count">{selected.length}</span>}
        <svg className={`cf-chevron ${expanded ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {expanded && (
        <div className="cf-body">
          {loading && <div className="cf-loading">Loading campsites...</div>}

          {!loading && (
            <>
              {/* Avenue pills */}
              <div className="cf-rooms">
                {rooms.map(room => {
                  const count = roomSelectedCount(room);
                  const isActive = activeRoom === room.name;
                  return (
                    <button
                      key={room.name}
                      className={`cf-room ${isActive ? 'active' : ''} ${count > 0 ? 'has-selected' : ''}`}
                      onClick={() => setActiveRoom(isActive ? null : room.name)}
                      type="button"
                    >
                      {room.name}
                      {count > 0 && <span className="cf-room-count">{count}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Sites for selected avenue */}
              {activeRoom && (() => {
                const room = rooms.find(r => r.name === activeRoom);
                if (!room) return null;
                const allSelected = roomSelectedCount(room) === room.units.length;
                return (
                  <div className="cf-sites">
                    <div className="cf-sites-head">
                      <span className="cf-sites-title">{room.name}</span>
                      <button
                        className="cf-sites-toggle"
                        onClick={() => allSelected ? deselectAllInRoom(room) : selectAllInRoom(room)}
                        type="button"
                      >
                        {allSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="cf-sites-grid">
                      {room.units.map(unit => (
                        <label key={unit.id} className={`cf-site ${isSelected(unit.id) ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected(unit.id)}
                            onChange={() => toggleUnit(unit, room.name)}
                          />
                          <span className="cf-site-num">{unit.short}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Selected chips */}
              {selected.length > 0 && (
                <div className="cf-selected">
                  <div className="cf-chips">
                    {selected.map(s => (
                      <span key={s.id} className="cf-chip">
                        {s.room} #{s.name}
                        <button onClick={() => onChange(selected.filter(x => x.id !== s.id))} type="button">&times;</button>
                      </span>
                    ))}
                  </div>
                  <button className="cf-clear" onClick={clearAll} type="button">Clear all</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
