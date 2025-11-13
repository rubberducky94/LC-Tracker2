import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';
import 'chart.js/auto';
import { Bar } from 'react-chartjs-2';

import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';

// LocalStorage helpers (kept for fallback / export/import)
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

function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (!auth) {
        setError('Firebase not configured. Please set REACT_APP_FIREBASE_API_KEY in .env.local');
        return;
      }
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Auth failed');
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: '2rem auto' }}>
      {!auth && (
        <p style={{ color: 'orange' }}>Firebase not configured. Server sign-up/login disabled. Use "Continue without signing in" on the main page or set <code>REACT_APP_FIREBASE_API_KEY</code> in <code>.env.local</code>.</p>
      )}
      <h3>{mode === 'login' ? 'Login' : 'Sign up'}</h3>
      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={!auth}>{mode === 'login' ? 'Login' : 'Create account'}</button>{' '}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Switch to Sign up' : 'Switch to Login'}
          </button>
        </div>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p style={{ marginTop: 8 }}>
        Tip: create an account to store data per-user (or continue without signing in below).
      </p>
    </div>
  );
}

function Dashboard({ user }) {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const [date, setDate] = useState(getLocalDateString());
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function getDayOfWeek(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return dayNames[localDate.getDay()];
  }
  const selectedDay = getDayOfWeek(date);
  const [period, setPeriod] = useState('');
  const [entries, setEntries] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (user?.uid) {
        try {
          const stuQ = query(collection(db, 'users', user.uid, 'students'), orderBy('name'));
          const znQ = query(collection(db, 'users', user.uid, 'zones'), orderBy('name'));
          const [stuSnap, znSnap] = await Promise.all([getDocs(stuQ), getDocs(znQ)]);
          if (!mounted) return;
          setStudents(stuSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setZones(znSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e);
            if (msg.includes('does not exist') || msg.includes('CONFIGURATION_NOT_FOUND') || (msg.includes('database') && msg.includes('does not exist'))) {
              setError('Cloud Firestore is not configured for this project. Please create a Firestore database in the Firebase console: https://console.firebase.google.com/project/' + (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'YOUR_PROJECT') + '/firestore');
            } else {
              setError('Failed to load server data, falling back to local: ' + msg);
            }
          setStudents(loadJSON('lc_students', []));
          setZones(loadJSON('lc_zones', []));
        }
      } else {
        setStudents(loadJSON('lc_students', []));
        setZones(loadJSON('lc_zones', []));
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const handleEntryChange = (studentId, field, value) => {
    setEntries(prev => {
      const next = {
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [field]: value,
        }
      };
      // Ensure action defaults to Self-Directed if not set
      if (!next[studentId].action) next[studentId].action = 'Self-Directed';
      // If type changed away from Study, clear used_study_planner
      if (field === 'type' && value !== 'Study') {
        next[studentId].used_study_planner = false;
      }
      // If type changed to Enrichment, clear/disable zone selection
      if (field === 'type' && value === 'Enrichment') {
        next[studentId].zone_id = '';
      }
      // If type changed to Absent, clear/disable all other inputs for that student
      if (field === 'type' && value === 'Absent') {
        next[studentId].zone_id = '';
        next[studentId].used_study_planner = false;
        next[studentId].notes = '';
        // keep action but disable the selector in the UI; default to Self-Directed if not present
        if (!next[studentId].action) next[studentId].action = 'Self-Directed';
      }
      return next;
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const now = new Date().toISOString();
      let added = 0;

      if (user?.uid) {
        const colRef = collection(db, 'users', user.uid, 'entries');
        const promises = [];
        students.forEach((student, idx) => {
          const entry = entries[student.id];
          if (!entry || !entry.type) return;
          // zone is optional for Enrichment and Absent
          if (entry.type !== 'Enrichment' && entry.type !== 'Absent' && !entry.zone_id) return;
          // require action, default to Self-Directed
          const action = entry.action || 'Self-Directed';
          // include used_study_planner only if type === 'Study'
          const obj = {
            day: selectedDay,
            date,
            period,
            student_id: student.id,
            type: entry.type,
            action,
            notes: entry.notes || '',
            createdAt: serverTimestamp(),
            client_ts: now,
          };
          if (entry.type !== 'Enrichment' && entry.type !== 'Absent') {
            obj.zone_id = entry.zone_id;
          }
          if (entry.type === 'Study') {
            obj.used_study_planner = !!entry.used_study_planner;
          }
          promises.push(addDoc(colRef, obj));
          added += 1;
        });
        await Promise.all(promises);
      } else {
        const saved = loadJSON('lc_entries', []);
        students.forEach((student, idx) => {
          const entry = entries[student.id];
          if (!entry || !entry.type) return;
          if (entry.type !== 'Enrichment' && entry.type !== 'Absent' && !entry.zone_id) return;
          const action = entry.action || 'Self-Directed';
          const obj = {
            id: `${Date.now()}-${idx}`,
            day: selectedDay,
            date,
            period,
            student_id: student.id,
            type: entry.type,
            action,
            notes: entry.notes || '',
            timestamp: now,
          };
          if (entry.type !== 'Enrichment' && entry.type !== 'Absent') {
            obj.zone_id = entry.zone_id;
          }
          if (entry.type === 'Study') {
            obj.used_study_planner = !!entry.used_study_planner;
          }
          saved.push(obj);
          added += 1;
        });
        saveJSON('lc_entries', saved);
      }

      if (added > 0) {
        setMessage('Entries saved!');
        setEntries({});
      } else {
        setError('No entries were logged. Please fill out at least one student (type + zone required).');
      }
    } catch (e) {
      setError('Save failed: ' + (e.message || e));
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
          <label>
            <strong>Date:</strong>{' '}
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          &nbsp; <strong>Day:</strong> {selectedDay}
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
                      value={entries[s.id]?.type || 'Class'}
                      onChange={e => handleEntryChange(s.id, 'type', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Class">Class</option>
                      <option value="Study">Study</option>
                      <option value="Enrichment">Enrichment</option>
                      <option value="Absent">Absent</option>
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
                      disabled={(entries[s.id]?.type || '') === 'Enrichment' || (entries[s.id]?.type || '') === 'Absent'}
                      title={(entries[s.id]?.type || '') === 'Enrichment' ? 'Zone not applicable for Enrichment' : (entries[s.id]?.type || '') === 'Absent' ? 'Zone not applicable for Absent' : ''}
                    >
                      <option value="">Select</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
              <tr>
                <td>Used Study Planner?</td>
                {students.map(s => (
                  <td key={s.id}>
                    <input
                      type="checkbox"
                      checked={!!entries[s.id]?.used_study_planner}
                      onChange={e => handleEntryChange(s.id, 'used_study_planner', e.target.checked)}
                      disabled={(entries[s.id]?.type || '') !== 'Study'}
                      title="Only applicable when Type is Study"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <td>Action</td>
                {students.map(s => (
                  <td key={s.id}>
                    <select
                      value={entries[s.id]?.action || 'Self-Directed'}
                      onChange={e => handleEntryChange(s.id, 'action', e.target.value)}
                      disabled={(entries[s.id]?.type || '') === 'Absent'}
                    >
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
                      disabled={(entries[s.id]?.type || '') === 'Absent'}
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

function Data({ user }) {
  const [entries, setEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterStudent, setFilterStudent] = useState('');
  const [filterDay, setFilterDay] = useState('All');
  const [filterPeriod, setFilterPeriod] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [allTime, setAllTime] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user?.uid) {
          const eQ = query(collection(db, 'users', user.uid, 'entries'), orderBy('date', 'desc'));
          const [eSnap, sSnap, zSnap] = await Promise.all([
            getDocs(eQ),
            getDocs(query(collection(db, 'users', user.uid, 'students'))),
            getDocs(query(collection(db, 'users', user.uid, 'zones'))),
          ]);
          if (!mounted) return;
          setEntries(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setEntries(loadJSON('lc_entries', []));
          setStudents(loadJSON('lc_students', []));
          setZones(loadJSON('lc_zones', []));
        }
        setLoading(false);
      } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          if (msg.includes('does not exist') || msg.includes('CONFIGURATION_NOT_FOUND')) {
            setError('Cloud Firestore is not configured for this project. Please create a Firestore database: https://console.firebase.google.com/project/' + (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'YOUR_PROJECT') + '/firestore');
          } else {
            setError('Failed to load data: ' + msg);
          }
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const getStudentName = id => students.find(s => s.id === id)?.name || id;
  const getZoneName = id => zones.find(z => z.id === id)?.name || id;
  const formatLocal = ts => ts ? new Date(ts.seconds ? ts.toDate() : ts).toLocaleString(undefined, { timeZoneName: 'short' }) : '';

  // Filtering logic
  const filteredEntries = useMemo(() => {
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    return entries.filter(e => {
      // student
      if (filterStudent && e.student_id !== filterStudent) return false;
      // day of week
      if (filterDay && filterDay !== 'All') {
        if (!e.date) return false;
        const d = new Date(e.date + 'T00:00:00');
        if (dayNames[d.getDay()] !== filterDay) return false;
      }
      // period
      if (filterPeriod && filterPeriod !== 'All') {
        if (String(e.period) !== String(filterPeriod)) return false;
      }
      // date range (unless allTime)
      if (!allTime) {
        if (dateFrom) {
          if (!e.date || e.date < dateFrom) return false;
        }
        if (dateTo) {
          if (!e.date || e.date > dateTo) return false;
        }
      }
      return true;
    });
  }, [entries, filterStudent, filterDay, filterPeriod, dateFrom, dateTo, allTime]);

  // Zone usage chart
  const zoneCounts = useMemo(() => {
    // Start with all zones at zero so zones with 0 uses are shown
    const acc = Object.fromEntries((zones || []).map(z => [z.id, 0]));
    filteredEntries.forEach(e => {
      if (!e.zone_id) return;
      acc[e.zone_id] = (acc[e.zone_id] || 0) + 1;
    });
    // Preserve zone order from zones array and map to names/data
    const labels = (zones || []).map(z => z.name || z.id);
    const data = (zones || []).map(z => acc[z.id] || 0);
    return { labels, data };
  }, [filteredEntries, zones]);

  // Category usage chart (include zero-count categories)
  const categoryCounts = useMemo(() => {
    const baseCategories = ['Focus', 'Semi-Collaborative', 'Collaborative', 'Unknown'];
    // Initialize all base categories to zero
    const acc = Object.fromEntries(baseCategories.map(c => [c, 0]));

    const zoneById = Object.fromEntries((zones || []).map(z => [z.id, z]));
    filteredEntries.forEach(e => {
      const z = zoneById[e.zone_id];
      const cat = (z && z.category) ? z.category : 'Unknown';
      if (!acc.hasOwnProperty(cat)) {
        // If there are custom/extra categories, include them too
        acc[cat] = 0;
      }
      acc[cat] += 1;
    });

    // Keep base categories first, then any extras discovered
    const labels = [...baseCategories, ...Object.keys(acc).filter(k => !baseCategories.includes(k))];
    const data = labels.map(l => acc[l] || 0);
    return { labels, data };
  }, [filteredEntries, zones]);

  const handleExportCSV = () => {
    const rows = [
      ['Date','Day','Period','Student','Type','Zone','Zone Category','Used Study Planner','Action','Notes','Timestamp']
    ];
    filteredEntries.forEach(e => {
      const z = zones.find(z => z.id === e.zone_id);
      rows.push([
        e.date || '',
        e.day || '',
        e.period || '',
        getStudentName(e.student_id),
        e.type || '',
        getZoneName(e.zone_id),
        z?.category || '',
        e.used_study_planner ? 'Yes' : 'No',
        e.action || '',
        (e.notes || '').replace(/\n/g, ' '),
        (e.createdAt || e.timestamp || e.client_ts) ? formatLocal(e.createdAt || e.timestamp || e.client_ts) : '',
      ]);
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lc-entries-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2>LC Tracker - Data Table & Charts</h2>
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
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <label>
              Student:
              <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}>
                <option value="">All</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label>
              Day:
              <select value={filterDay} onChange={e => setFilterDay(e.target.value)}>
                <option>All</option>
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map(d => <option key={d}>{d}</option>)}
              </select>
            </label>

            <label>
              Period:
              <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                <option>All</option>
                {[4,5,6,7,8].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label>
              All time:
              <input type="checkbox" checked={allTime} onChange={e => setAllTime(e.target.checked)} />
            </label>

            {!allTime && (
              <>
                <label>
                  From: <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </label>
                <label>
                  To: <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </label>
              </>
            )}

            <button onClick={handleExportCSV}>Export Filtered CSV</button>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 600, flex: 1 }}>
              <h4>Zone Usage</h4>
              {zoneCounts.labels.length > 0 ? (
                <Bar data={{ labels: zoneCounts.labels, datasets: [{ label: 'Zone uses', data: zoneCounts.data, backgroundColor: 'rgba(25,118,210,0.7)' }] }} />
              ) : <p>No data for selected filters</p>}
            </div>

            <div style={{ maxWidth: 600, flex: 1 }}>
              <h4>Category Usage</h4>
              {categoryCounts.labels.length > 0 ? (
                <Bar data={{ labels: categoryCounts.labels, datasets: [{ label: 'Category uses', data: categoryCounts.data, backgroundColor: 'rgba(76,175,80,0.7)' }] }} />
              ) : <p>No data for selected filters</p>}
            </div>
          </div>

          <hr />

          <h4>Filtered Table ({filteredEntries.length} rows)</h4>
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
                  <th>Zone Category</th>
                  <th>Used Study Planner</th>
                  <th>Action</th>
                  <th>Notes</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map(e => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.day}</td>
                    <td>{e.period}</td>
                    <td>{getStudentName(e.student_id)}</td>
                    <td>{e.type}</td>
                    <td>{getZoneName(e.zone_id)}</td>
                    <td>{zones.find(z => z.id === e.zone_id)?.category || ''}</td>
                    <td>{e.type === 'Study' ? (e.used_study_planner ? 'Yes' : 'No') : 'N/A'}</td>
                    <td>{e.action}</td>
                    <td>{e.notes}</td>
                    <td>{formatLocal(e.createdAt || e.timestamp || e.client_ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Manage({ user }) {
  const [students, setStudents] = useState([]);
  const [zones, setZones] = useState([]);
  const [newStudent, setNewStudent] = useState('');
  const [newZone, setNewZone] = useState('');
  const [zoneCategory, setZoneCategory] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [savingZone, setSavingZone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Editing state
  const [editingStudent, setEditingStudent] = useState(null); // { id, name }
  const [editingZone, setEditingZone] = useState(null); // { id, name, category }
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [selectedZones, setSelectedZones] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        if (user?.uid) {
          const sSnap = await getDocs(query(collection(db, 'users', user.uid, 'students'), orderBy('name')));
          const zSnap = await getDocs(query(collection(db, 'users', user.uid, 'zones'), orderBy('name')));
          if (!mounted) return;
          setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          setStudents(loadJSON('lc_students', []));
          setZones(loadJSON('lc_zones', []));
        }
        setLoading(false);
      } catch (e) {
          const msg = (e && e.message) ? e.message : String(e);
          if (msg.includes('does not exist') || msg.includes('CONFIGURATION_NOT_FOUND')) {
            setError('Cloud Firestore is not configured for this project. Please create a Firestore database: https://console.firebase.google.com/project/' + (process.env.REACT_APP_FIREBASE_PROJECT_ID || 'YOUR_PROJECT') + '/firestore');
          } else {
            setError('Failed to load: ' + msg);
          }
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user]);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setError('');
    if (savingStudent) return;
    setSavingStudent(true);
    try {
      const obj = { name: newStudent };
      if (user?.uid) {
        const tempId = `tmp-${Date.now()}`;
        const optimistic = { id: tempId, ...obj };
        setStudents(prev => [...prev, optimistic]);
        try {
          const ref = await addDoc(collection(db, 'users', user.uid, 'students'), obj);
          setStudents(prev => prev.map(s => s.id === tempId ? { id: ref.id, ...obj } : s));
        } catch (innerErr) {
          setStudents(prev => prev.filter(s => s.id !== tempId));
          throw innerErr;
        }
        const sSnap = await getDocs(query(collection(db, 'users', user.uid, 'students'), orderBy('name')));
        setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const saved = [...students, { id: `${Date.now()}`, ...obj }];
        setStudents(saved);
        saveJSON('lc_students', saved);
      }
      setNewStudent('');
    } catch (e) {
      setError('Save failed: ' + (e.message || e));
    }
    setSavingStudent(false);
  };

  const handleAddZone = async (e) => {
    e.preventDefault();
    setError('');
    if (savingZone) return;
    setSavingZone(true);
    try {
      const obj = { name: newZone, category: zoneCategory };
      if (user?.uid) {
        const tempId = `tmp-${Date.now()}`;
        const optimistic = { id: tempId, ...obj };
        setZones(prev => [...prev, optimistic]);
        try {
          const ref = await addDoc(collection(db, 'users', user.uid, 'zones'), obj);
          setZones(prev => prev.map(z => z.id === tempId ? { id: ref.id, ...obj } : z));
        } catch (innerErr) {
          setZones(prev => prev.filter(z => z.id !== tempId));
          throw innerErr;
        }
        const zSnap = await getDocs(query(collection(db, 'users', user.uid, 'zones'), orderBy('name')));
        setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const saved = [...zones, { id: `${Date.now()}`, ...obj }];
        setZones(saved);
        saveJSON('lc_zones', saved);
      }
      setNewZone('');
      setZoneCategory('');
    } catch (e) {
      setError('Save failed: ' + (e.message || e));
    }
    setSavingZone(false);
  };

  // Edit / Delete handlers
  const startEditStudent = (s) => setEditingStudent({ id: s.id, name: s.name });
  const cancelEditStudent = () => setEditingStudent(null);
  const saveEditStudent = async () => {
    if (!editingStudent) return;
    setError('');
    try {
      const { id, name } = editingStudent;
      if (user?.uid) {
        const ref = doc(db, 'users', user.uid, 'students', id);
        await updateDoc(ref, { name });
        const sSnap = await getDocs(query(collection(db, 'users', user.uid, 'students'), orderBy('name')));
        setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const updated = students.map(s => s.id === id ? { ...s, name } : s);
        setStudents(updated);
        saveJSON('lc_students', updated);
      }
      setEditingStudent(null);
    } catch (e) {
      setError('Update failed: ' + (e.message || e));
    }
  };

  const deleteStudent = async (id) => {
    if (!window.confirm('Delete this student? This cannot be undone.')) return;
    setError('');
    try {
      if (user?.uid && !String(id).startsWith('tmp-')) {
        await deleteDoc(doc(db, 'users', user.uid, 'students', id));
        const sSnap = await getDocs(query(collection(db, 'users', user.uid, 'students'), orderBy('name')));
        setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const filtered = students.filter(s => s.id !== id);
        setStudents(filtered);
        saveJSON('lc_students', filtered);
      }
      // also remove from selected set if present
      setSelectedStudents(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (e) {
      setError('Delete failed: ' + (e.message || e));
    }
  };

  const startEditZone = (z) => setEditingZone({ id: z.id, name: z.name, category: z.category || '' });
  const cancelEditZone = () => setEditingZone(null);
  const saveEditZone = async () => {
    if (!editingZone) return;
    setError('');
    try {
      const { id, name, category } = editingZone;
      if (user?.uid) {
        const ref = doc(db, 'users', user.uid, 'zones', id);
        await updateDoc(ref, { name, category });
        const zSnap = await getDocs(query(collection(db, 'users', user.uid, 'zones'), orderBy('name')));
        setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const updated = zones.map(z => z.id === id ? { ...z, name, category } : z);
        setZones(updated);
        saveJSON('lc_zones', updated);
      }
      setEditingZone(null);
    } catch (e) {
      setError('Update failed: ' + (e.message || e));
    }
  };

  const deleteZone = async (id) => {
    if (!window.confirm('Delete this zone? This cannot be undone.')) return;
    setError('');
    try {
      if (user?.uid && !String(id).startsWith('tmp-')) {
        await deleteDoc(doc(db, 'users', user.uid, 'zones', id));
        const zSnap = await getDocs(query(collection(db, 'users', user.uid, 'zones'), orderBy('name')));
        setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const filtered = zones.filter(z => z.id !== id);
        setZones(filtered);
        saveJSON('lc_zones', filtered);
      }
      setSelectedZones(prev => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    } catch (e) {
      setError('Delete failed: ' + (e.message || e));
    }
  };

  // Selection helpers for bulk actions
  const toggleStudentSelection = (id) => {
    setSelectedStudents(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleZoneSelection = (id) => {
    setSelectedZones(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const deleteSelectedStudents = async () => {
    if (selectedStudents.size === 0) return;
    if (!window.confirm(`Delete ${selectedStudents.size} selected student(s)? This cannot be undone.`)) return;
    setError('');
    try {
      const ids = Array.from(selectedStudents);
      if (user?.uid) {
        // perform deletes sequentially to reduce contention
        for (const id of ids) {
          if (!String(id).startsWith('tmp-')) {
            await deleteDoc(doc(db, 'users', user.uid, 'students', id));
          }
        }
        const sSnap = await getDocs(query(collection(db, 'users', user.uid, 'students'), orderBy('name')));
        setStudents(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const filtered = students.filter(s => !selectedStudents.has(s.id));
        setStudents(filtered);
        saveJSON('lc_students', filtered);
      }
      setSelectedStudents(new Set());
    } catch (e) {
      setError('Bulk delete failed: ' + (e.message || e));
    }
  };

  const deleteSelectedZones = async () => {
    if (selectedZones.size === 0) return;
    if (!window.confirm(`Delete ${selectedZones.size} selected zone(s)? This cannot be undone.`)) return;
    setError('');
    try {
      const ids = Array.from(selectedZones);
      if (user?.uid) {
        for (const id of ids) {
          if (!String(id).startsWith('tmp-')) {
            await deleteDoc(doc(db, 'users', user.uid, 'zones', id));
          }
        }
        const zSnap = await getDocs(query(collection(db, 'users', user.uid, 'zones'), orderBy('name')));
        setZones(zSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const filtered = zones.filter(z => !selectedZones.has(z.id));
        setZones(filtered);
        saveJSON('lc_zones', filtered);
      }
      setSelectedZones(new Set());
    } catch (e) {
      setError('Bulk delete failed: ' + (e.message || e));
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
        <>
          <div style={{ marginBottom: 8 }}>
            <button onClick={deleteSelectedStudents} disabled={selectedStudents.size === 0}>Delete Selected Students ({selectedStudents.size})</button>
          </div>
          <ul>
            {students.map(s => (
              <li key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={selectedStudents.has(s.id)} onChange={() => toggleStudentSelection(s.id)} />
                {editingStudent?.id === s.id ? (
                  <>
                    <input value={editingStudent.name} onChange={e => setEditingStudent(prev => ({ ...prev, name: e.target.value }))} />
                    <button onClick={saveEditStudent}>Save</button>
                    <button onClick={cancelEditStudent}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <button onClick={() => startEditStudent(s)}>Edit</button>
                    <button onClick={() => deleteStudent(s.id)}>Delete</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <form onSubmit={handleAddStudent}>
        <input
          type="text"
          placeholder="Add student name"
          value={newStudent}
          onChange={e => setNewStudent(e.target.value)}
        />
        <button type="submit" disabled={savingStudent}>{savingStudent ? 'Saving...' : 'Add Student'}</button>
      </form>
      <h3>Manage Zones</h3>
      <div style={{ marginBottom: 8 }}>
        <button onClick={deleteSelectedZones} disabled={selectedZones.size === 0}>Delete Selected Zones ({selectedZones.size})</button>
      </div>
      <ul>
        {zones.map(z => (
          <li key={z.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={selectedZones.has(z.id)} onChange={() => toggleZoneSelection(z.id)} />
            {editingZone?.id === z.id ? (
              <>
                <input value={editingZone.name} onChange={e => setEditingZone(prev => ({ ...prev, name: e.target.value }))} />
                <select value={editingZone.category} onChange={e => setEditingZone(prev => ({ ...prev, category: e.target.value }))}>
                  <option value="">Category (optional)</option>
                  <option value="Focus">Focus</option>
                  <option value="Semi-Collaborative">Semi-Collaborative</option>
                  <option value="Collaborative">Collaborative</option>
                </select>
                <button onClick={saveEditZone}>Save</button>
                <button onClick={cancelEditZone}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{z.name} {z.category && `(${z.category})`}</span>
                <button onClick={() => startEditZone(z)}>Edit</button>
                <button onClick={() => deleteZone(z.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={handleAddZone}>
        <input
          type="text"
          placeholder="Zone name"
          value={newZone}
          onChange={e => setNewZone(e.target.value)}
        />
        <select
          value={zoneCategory}
          onChange={e => setZoneCategory(e.target.value)}
          aria-label="Zone category (optional)"
          style={{ width: '45%', padding: '0.4rem', margin: '0.2rem 0 1rem 0' }}
        >
          <option value="">Category (optional)</option>
          <option value="Focus">Focus</option>
          <option value="Semi-Collaborative">Semi-Collaborative</option>
          <option value="Collaborative">Collaborative</option>
        </select>
        <br/>
        <button type="submit" disabled={savingZone}>{savingZone ? 'Saving...' : 'Add Zone'}</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [skipAuth, setSkipAuth] = useState(false);

  useEffect(() => {
    if (!auth) return; // Firebase not configured
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, [auth]);

  const handleSignOut = async () => {
    try {
      if (auth) await fbSignOut(auth);
      setUser(null);
    } catch (e) {
      console.error('Sign out failed', e);
    }
  };

  if (!user && !skipAuth) {
    return (
      <div>
        <Auth />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={() => setSkipAuth(true)}>Continue without signing in</button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div style={{ textAlign: 'right', padding: '0.5rem 1rem' }}>
        {user ? (
          <>
            <span style={{ marginRight: 12 }}>{user.email}</span>
            <button onClick={handleSignOut}>Sign out</button>
          </>
        ) : (
          <span style={{ marginRight: 12 }}>Using local mode</span>
        )}
      </div>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/manage" element={<Manage user={user} />} />
        <Route path="/data" element={<Data user={user} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;

