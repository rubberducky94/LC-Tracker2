import React, { useState } from 'react';
import './App.css';

function Dashboard() {
  // Sample data
  const students = [
    { id: 's1', name: 'Alice' },
    { id: 's2', name: 'Bob' },
    { id: 's3', name: 'Charlie' },
  ];
  const metrics = [
    'Study Planner Usage',
    'Zone Movement',
    'Self-Directed Learning',
  ];
  const periods = [4, 5, 6, 7, 8];

  // State
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]);
  const [data, setData] = useState({});
  const today = new Date().toLocaleDateString();

  // Handle input change
  const handleInputChange = (studentId, metric, value) => {
    setData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [metric]: value,
      },
    }));
  };

  // Handle save
  const handleSave = () => {
    // For now, just log the data
    console.log({
      date: today,
      period: selectedPeriod,
      data,
    });
    alert('Data saved (see console for output)');
  };

  return (
    <div>
      <h2>Dashboard</h2>
      <div>
        <span>Date: {today}</span>
        <span style={{ marginLeft: 16 }}>
          Period:{' '}
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </span>
      </div>
      <table style={{ margin: '24px auto', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: 8 }}>Metric</th>
            {students.map((s) => (
              <th key={s.id} style={{ border: '1px solid #ccc', padding: 8 }}>
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric}>
              <td style={{ border: '1px solid #ccc', padding: 8 }}>{metric}</td>
              {students.map((s) => (
                <td key={s.id} style={{ border: '1px solid #ccc', padding: 8 }}>
                  <input
                    type="text"
                    value={data[s.id]?.[metric] || ''}
                    onChange={(e) =>
                      handleInputChange(s.id, metric, e.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSave}>Save</button>
    </div>
  );
}

function StudentZoneList() {
  return <div>Student & Zone List will go here.</div>;
}

function DataVisualization() {
  return <div>Data Visualization will go here.</div>;
}

function App() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="App">
      <header className="App-header">
        <h1>LC Tracker</h1>
        <nav>
          <button onClick={() => setTab('dashboard')}>Dashboard</button>
          <button onClick={() => setTab('students')}>Students & Zones</button>
          <button onClick={() => setTab('visualization')}>Data Visualization</button>
        </nav>
        <main>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'students' && <StudentZoneList />}
          {tab === 'visualization' && <DataVisualization />}
        </main>
      </header>
    </div>
  );
}

export default App;
