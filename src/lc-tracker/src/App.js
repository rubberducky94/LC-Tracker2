import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';

// Dashboard: Entry logging form
function Dashboard({ onLogout, token }) {
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
    if (!token) return;
    Promise.all([
      fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ]).then(([studentsData, zonesData]) => {
      setStudents(studentsData);
      setZones(zonesData);
    });
  }, [token]);

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
  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const results = await Promise.all(
        students.map(async student => {
          const entry = entries[student.id];
          if (!entry || !entry.type || !entry.zone_id || !entry.action) return null;
          const res = await fetch('/api/entries', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              day: todayDay,
              date: today,
              period,
              student_id: student.id,
              type: entry.type,
              zone_id: entry.zone_id,
              zone_detail: entry.zone_detail || '',
              action: entry.action,
              notes: entry.notes || '',
              // timestamp will be set by backend as UTC
            }),
          });
          return res.ok;
        })
      );
      if (results.some(r => r)) {
        setMessage('Entries logged!');
        setEntries({});
      } else {
        setError('No entries were logged. Please fill out at least one student.');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div>
      <h2>LC Tracker - Log Entries</h2>
      <nav>
        <Link to="/manage">Manage Students/Zones</Link> |{' '}
        <Link to="/data">View Data</Link> |{' '}
        <button onClick={onLogout}>Logout</button>
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
        <button type="submit">Log Entries</button>
      </form>
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

// Data: Table view of all entries
function Data({ token }) {
  const [entries, setEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/entries', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
      .then(([entriesData, studentsData, zonesData]) => {
        setEntries(entriesData);
        setStudents(studentsData);
        setZones(zonesData);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load data');
        setLoading(false);
      });
  }, [token]);

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
function Manage({ token }) {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [newStudent, setNewStudent] = useState('');
  const [newZone, setNewZone] = useState('');
  const [zoneCategory, setZoneCategory] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch('/api/students', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
      .then(([studentsData, zonesData]) => {
        setStudents(studentsData);
        setZones(zonesData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newStudent }),
      });
      const data = await res.json();
      if (res.ok) {
        setStudents([...students, data]);
        setNewStudent('');
      } else {
        setError(data.error || 'Could not add student');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newZone, category: zoneCategory }),
      });
      const data = await res.json();
      if (res.ok) {
        setZones([...zones, data]);
        setNewZone('');
        setZoneCategory('');
      } else {
        setError(data.error || 'Could not add zone');
      }
    } catch {
      setError('Network error');
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

// Auth (unchanged)
function Auth({ onAuth, showRegister, setShowRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        onAuth(data.token);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, school_name: schoolName }),
      });
      const data = await res.json();
      if (res.ok) {
        onAuth(data.token);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }
  };

  return (
    <div className="App">
      <h2>LC Tracker {showRegister ? 'Registration' : 'Login'}</h2>
      <form onSubmit={showRegister ? handleRegister : handleLogin}>
        <input
          type="email"
          placeholder="School Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        /><br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        /><br />
        {showRegister && (
          <>
            <input
              type="text"
              placeholder="School Name"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              required
            /><br />
          </>
        )}
        <button type="submit">{showRegister ? 'Register' : 'Login'}</button>
      </form>
      <button onClick={() => { setShowRegister(!showRegister); setError(''); }}>
        {showRegister ? 'Back to Login' : 'Register School'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [showRegister, setShowRegister] = useState(false);

  const handleAuth = (token) => {
    setToken(token);
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
  };

  if (!token) {
    return <Auth onAuth={handleAuth} showRegister={showRegister} setShowRegister={setShowRegister} />;
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard onLogout={handleLogout} token={token} />} />
        <Route path="/manage" element={<Manage token={token} />} />
        <Route path="/data" element={<Data token={token} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
