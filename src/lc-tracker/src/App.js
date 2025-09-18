import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';

// Dashboard: Entry logging form
// LocalStorage helpers (zero-dollar backend for now)
function loadJSON(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function Dashboard({ onLogout }) {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  // Use local time for today
  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const today = getLocalDateString();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDay = dayNames[new Date().getDay()];
  const [period, setPeriod] = useState('');
  const [entries, setEntries] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Load students and zones for dropdowns
  React.useEffect(() => {
    // load from localStorage
    setStudents(loadJSON('lc_students', []));
    setZones(loadJSON('lc_zones', []));
  }, []);

  // Handle entry field change for a student
  const handleEntryChange = (studentId, field, value) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      }
    }));
  };

  // Submit all entries for the selected day/period
  const handleSubmit = e => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const now = new Date().toISOString();
      const saved = loadJSON('lc_entries', []);
      let added = 0;
      students.forEach((student, idx) => {
        const entry = entries[student.id];
        if (!entry || !entry.type || !entry.zone_id || !entry.action) return;
        const obj = {
          id: `${Date.now()}-${idx}`,
          day: todayDay,
          date: today,
          period,
          student_id: student.id,
          type: entry.type,
          zone_id: entry.zone_id,
          zone_detail: entry.zone_detail || '',
          action: entry.action,
          notes: entry.notes || '',
          timestamp: now,
        };
        saved.push(obj);
        added += 1;
      });
      saveJSON('lc_entries', saved);
      if (added > 0) {
        setMessage('Entries saved locally!');
        setEntries({});
      } else {
        setError('No entries were logged. Please fill out at least one student.');
      }
    } catch (e) {
      setError('Save failed');
    }
  };

  return (
    <div>
      <h2>LC Tracker - Log Entries</h2>
      <nav>
        <Link to="/manage">Manage Students/Zones</Link> |{' '}
        <Link to="/data">View Data</Link>
      </nav>
      <hr />
      <form onSubmit={handleSubmit} style={{ maxWidth: '100%', margin: '0 auto', textAlign: 'left' }}>
        <div style={{ marginBottom: 16 }}>
          <strong>Date:</strong> {today} &nbsp; <strong>Day:</strong> {todayDay}
        </div>
        <label>
          Period:
          <select value={period} onChange={e => setPeriod(e.target.value)} required>
            <option value="">Select</option>
            {[4,5,6,7,8].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <br /><br />
        <div style={{ overflowX: 'auto' }}>
          <table border="1" cellPadding="4" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Student</th>
                {students.map(s => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Type</td>
                {students.map(s => (
                  <td key={s.id}>
                    <select
                      value={entries[s.id]?.type || ''}
                      onChange={e => handleEntryChange(s.id, 'type', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Class">Class</option>
                      <option value="Study">Study</option>
                    </select>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Zone</td>
                {students.map(s => (
                  <td key={s.id}>
                    <select
                      value={entries[s.id]?.zone_id || ''}
                      onChange={e => handleEntryChange(s.id, 'zone_id', e.target.value)}
                    >
                      <option value="">Select</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Zone Detail</td>
                {students.map(s => (
                  <td key={s.id}>
                    <input
                      type="text"
                      value={entries[s.id]?.zone_detail || ''}
                      onChange={e => handleEntryChange(s.id, 'zone_detail', e.target.value)}
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td>Action</td>
                {students.map(s => (
                  <td key={s.id}>
                    <select
                      value={entries[s.id]?.action || ''}
                      onChange={e => handleEntryChange(s.id, 'action', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option>Self-Directed</option>
                      <option>Coached</option>
                      <option>Redirected</option>
                      <option>Conduct 1</option>
                      <option>Conduct 2</option>
                      <option>Conduct 3</option>
                      <option>Need Attention</option>
                    </select>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Notes</td>
                {students.map(s => (
                  <td key={s.id}>
                    <input
                      type="text"
                      value={entries[s.id]?.notes || ''}
                      onChange={e => handleEntryChange(s.id, 'notes', e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <br />
        <button type="submit">Save Entries</button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

// Data: Table view of all entries
function Data() {
  const [entries, setEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setLoading(true);
    try {
      setEntries(loadJSON('lc_entries', []));
      setStudents(loadJSON('lc_students', []));
      setZones(loadJSON('lc_zones', []));
      setLoading(false);
    } catch (e) {
      setError('Failed to load data');
      setLoading(false);
    }
  }, []);

  const getStudentName = id => students.find(s => s.id === id)?.name || id;
  const getZoneName = id => zones.find(z => z.id === id)?.name || id;

  // Format timestamp in user's local time zone
  const formatLocal = ts => ts ? new Date(ts).toLocaleString(undefined, { timeZoneName: 'short' }) : '';

  return (
    <div>
      <h2>LC Tracker - Data Table</h2>
      <nav>
        <Link to="/">Log Entry</Link> |{' '}
        <Link to="/manage">Manage Students/Zones</Link>
      </nav>
      <hr />
      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table border="1" cellPadding="4" style={{ margin: '0 auto', minWidth: 900 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Period</th>
                <th>Student</th>
                <th>Type</th>
                <th>Zone</th>
                <th>Zone Detail</th>
                <th>Action</th>
                <th>Notes</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td>{e.day}</td>
                  <td>{e.period}</td>
                  <td>{getStudentName(e.student_id)}</td>
                  <td>{e.type}</td>
                  <td>{getZoneName(e.zone_id)}</td>
                  <td>{e.zone_detail}</td>
                  <td>{e.action}</td>
                  <td>{e.notes}</td>
                  <td>{formatLocal(e.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Manage: Students and Zones (unchanged)
function Manage() {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [newStudent, setNewStudent] = useState('');
  const [newZone, setNewZone] = useState('');
  const [zoneCategory, setZoneCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    setLoading(true);
    setStudents(loadJSON('lc_students', []));
    setZones(loadJSON('lc_zones', []));
    setLoading(false);
  }, []);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const obj = { id: `${Date.now()}`, name: newStudent };
      const updated = [...students, obj];
      setStudents(updated);
      saveJSON('lc_students', updated);
      setNewStudent('');
    } catch (e) {
      setError('Save failed');
    }
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const obj = { id: `${Date.now()}`, name: newZone, category: zoneCategory };
      const updated = [...zones, obj];
      setZones(updated);
      saveJSON('lc_zones', updated);
      setNewZone('');
      setZoneCategory('');
    } catch (e) {
      setError('Save failed');
    }
  };

  return (
    <div>
      <nav>
        <Link to="/">Log Entry</Link> |{' '}
        <Link to="/data">View Data</Link>
      </nav>
      <h3>Manage Students</h3>
      {loading ? <p>Loading...</p> : (
        <ul>
          {students.map(s => <li key={s.id}>{s.name}</li>)}
        </ul>
      )}
      <form onSubmit={handleAddStudent}>
        <input
          type="text"
          placeholder="Add student name"
          value={newStudent}
          onChange={e => setNewStudent(e.target.value)}
        />
        <button type="submit">Add Student</button>
      </form>
      <h3>Manage Zones</h3>
      <ul>
        {zones.map(z => <li key={z.id}>{z.name} {z.category && `(${z.category})`}</li>)}
      </ul>
      <form onSubmit={handleAddZone}>
        <input
          type="text"
          placeholder="Zone name"
          value={newZone}
          onChange={e => setNewZone(e.target.value)}
        />
        <input
          type="text"
          placeholder="Category (optional)"
          value={zoneCategory}
          onChange={e => setZoneCategory(e.target.value)}
        />
        <button type="submit">Add Zone</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/manage" element={<Manage />} />
        <Route path="/data" element={<Data />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
