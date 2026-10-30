import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Page = 'station' | 'trends' | 'progress';
type WindowKey = '1h' | '6h' | '24h' | '7d';
type OutputState = 'ON' | 'OFF' | 'UNKNOWN';
type Point = {
  _time?: string;
  temperature_c?: number;
  humidity_pct?: number;
  light_lux?: number;
  light_raw?: number;
  proximity_raw?: number;
  pitch_deg?: number;
  roll_deg?: number;
  motion_event?: boolean;
  actual_output?: OutputState;
};
type Snapshot = {
  mode: 'actual';
  mqtt_connected: boolean;
  stale: boolean;
  last_received_at: string | null;
  device: Point & { device_id?: string; state?: string; wifi_connected?: boolean; fault_code?: string };
};
type Mission = { id: string; title: string; detail: string; done: boolean };
type LogEntry = { id: string; title: string; detail: string; time: string; kind: 'reading' | 'command' | 'motion' };

const IS_ACTUAL = import.meta.env.VITE_DATA_MODE === 'actual';
const windowOptions: WindowKey[] = ['1h', '6h', '24h', '7d'];
const chartColors = { temperature: '#c65b43', humidity: '#4d7fa2' };
const startTime = Date.now();

function demoPoints(windowKey: WindowKey = '6h'): Point[] {
  const span = { '1h': 60, '6h': 360, '24h': 1440, '7d': 10080 }[windowKey] * 60_000;
  return Array.from({ length: 36 }, (_, index) => {
    const phase = index / 4;
    return {
      _time: new Date(Date.now() - (35 - index) * span / 35).toISOString(),
      temperature_c: 23.1 + Math.sin(phase) * 0.58 + Math.cos(phase * 0.56) * 0.22,
      humidity_pct: 51.7 + Math.cos(phase * 0.8) * 2.6 + Math.sin(phase * 0.32) * 1.1,
      light_lux: 346 + Math.sin(phase * 0.45) * 26,
      motion_event: index === 22 || index === 31,
      actual_output: 'OFF',
    };
  });
}

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    mark: <><path d="M4 16.5 9.1 4l5.1 12.5" /><path d="M6.1 11.3h6" /><path d="M14.5 8.2h5v11h-5z" /><path d="M16.2 11h1.6M16.2 14h1.6M16.2 17h1.6" /></>,
    station: <><path d="M3 10.8 12 4l9 6.8" /><path d="M5.5 9.6V20h13V9.6M9 20v-6h6v6" /></>,
    trends: <><path d="M3 18.5 8.3 13l3.5 2.9 7.2-8.2" /><path d="M15.5 7.7H19v3.5" /><path d="M3 21h18" /></>,
    progress: <><path d="M12 3.5 14.6 9l6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1-6-4.3-4.2 6-.8z" /></>,
    signal: <><path d="M4 10.5a12 12 0 0 1 16 0M7 13.5a7.5 7.5 0 0 1 10 0M10 16.5a3 3 0 0 1 4 0" /><path d="M12 20h.01" /></>,
    sun: <><circle cx="12" cy="12" r="3.4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
    thermo: <><path d="M14 14.2V5a2.5 2.5 0 0 0-5 0v9.2a4.3 4.3 0 1 0 5 0Z" /><path d="M11.5 8v8" /></>,
    motion: <><path d="m4 13 4-4 3 3 5-6 4 3" /><path d="M4 19h16M4 5h2" /></>,
    drop: <><path d="M12 3s6 6.3 6 11a6 6 0 0 1-12 0c0-4.7 6-11 6-11Z" /><path d="M9 15.5c.4 1.2 1.3 1.8 2.7 2" /></>,
    light: <><path d="M9 18h6M10 21h4M8.2 14.5a7 7 0 1 1 7.6 0c-.9.6-1.1 1.4-1.1 2h-5.4c0-.6-.2-1.4-1.1-2Z" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.4-2.8 7.8-7 10-4.2-2.2-7-5.6-7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.station}</svg>;
}

function fmt(value: number | undefined, digits = 1) {
  return value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function relativeTime(iso: string | null | undefined) {
  if (!iso) return 'No sample received';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'Updated just now';
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes}m ago`;
}

function SensorReading({ icon, label, value, unit, tone, footer }: { icon: string; label: string; value: string; unit: string; tone: string; footer: string }) {
  return <article className="sensor-reading">
    <div className={`sensor-icon ${tone}`}><Icon name={icon} size={19} /></div>
    <div className="sensor-copy"><span className="sensor-name">{label}</span><span className="sensor-note">{footer}</span></div>
    <div className="sensor-value"><strong>{value}</strong><span>{unit}</span></div>
  </article>;
}

function TrendChart({ points, windowKey }: { points: Point[]; windowKey: WindowKey }) {
  const W = 720; const H = 232; const pad = { top: 16, right: 14, bottom: 32, left: 40 };
  const series = useMemo(() => {
    const values = points.map((point) => point.temperature_c).filter((value): value is number => typeof value === 'number');
    const humidity = points.map((point) => point.humidity_pct).filter((value): value is number => typeof value === 'number');
    const min = values.length ? Math.floor(Math.min(...values) - 0.35) : 20;
    const max = values.length ? Math.ceil(Math.max(...values) + 0.35) : 26;
    const x = (i: number, count: number) => pad.left + (count <= 1 ? 0 : i * (W - pad.left - pad.right) / (count - 1));
    const y = (value: number) => pad.top + (max - value) * (H - pad.top - pad.bottom) / Math.max(1, max - min);
    const pathFor = (input: number[]) => input.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i, input.length).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    return { min, max, temp: pathFor(values), humidity: pathFor(humidity.map((v) => min + (v - 45) / 5)), x, y, count: values.length };
  }, [points]);
  const labelsByWindow: Record<WindowKey, string[]> = {
    '1h': ['−60m', '−45m', '−30m', '−15m', 'Now'],
    '6h': ['−6h', '−4.5h', '−3h', '−1.5h', 'Now'],
    '24h': ['−24h', '−18h', '−12h', '−6h', 'Now'],
    '7d': ['−7d', '−5d', '−3.5d', '−2d', 'Now'],
  };
  const labels = labelsByWindow[windowKey];
  const hasData = series.count > 1;
  return <div className="chart-frame">
    <div className="chart-y-labels"><span>{series.max}°</span><span>{(series.max + series.min) / 2}°</span><span>{series.min}°</span></div>
    {hasData ? <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Temperature and humidity trend over ${windowKey}`}>
      <defs><linearGradient id="temp-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={chartColors.temperature} stopOpacity=".14" /><stop offset="1" stopColor={chartColors.temperature} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2].map((tick) => { const yy = pad.top + tick * (H - pad.top - pad.bottom) / 2; return <line key={tick} x1={pad.left} x2={W - pad.right} y1={yy} y2={yy} className="chart-grid" />; })}
      <path d={`${series.temp} L ${W - pad.right} ${H - pad.bottom} L ${pad.left} ${H - pad.bottom} Z`} fill="url(#temp-area)" />
      <path d={series.temp} fill="none" stroke={chartColors.temperature} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={series.humidity} fill="none" stroke={chartColors.humidity} strokeWidth="2.1" strokeDasharray="5 6" strokeLinecap="round" strokeLinejoin="round" />
      {points.slice(-1).map((point, i) => typeof point.temperature_c === 'number' ? <circle key={i} cx={W - pad.right} cy={series.y(point.temperature_c)} r="4.5" className="chart-dot" /> : null)}
      {labels.map((label, index) => <text key={label} x={pad.left + index * (W - pad.left - pad.right) / 4} y={H - 8} textAnchor={index === 0 ? 'start' : index === 4 ? 'end' : 'middle'} className="chart-axis">{label}</text>)}
    </svg> : <div className="chart-empty"><Icon name="trends" size={26} /><strong>No trend samples yet</strong><span>When the device reports readings, they will appear here.</span></div>}
    <div className="chart-legend"><span><i className="legend-dot temp" />Temperature</span><span><i className="legend-dot humidity" />Humidity · scaled for comparison</span></div>
  </div>;
}

function DemoNotice() {
  return <div className="demo-ribbon" role="note"><span className="demo-pulse" /><span><strong>Interactive demo</strong><em>All readings are illustrative. Controls are simulated and cannot reach hardware.</em></span><span className="demo-tag">DEMO DATA</span></div>;
}

function LoginGate({ onLogin, error, loading }: { onLogin: (password: string) => void; error: string; loading: boolean }) {
  const [password, setPassword] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); onLogin(password); }
  return <main className="login-wrap"><form className="login-card" onSubmit={submit}>
    <div className="login-mark"><Icon name="mark" size={26} /></div>
    <h1>Connect to your station</h1>
    <p>Sign in to the local gateway to view real device data. The dashboard will show offline or unavailable states when the gateway has no readings.</p>
    <label htmlFor="gateway-password">Operator password</label>
    <input id="gateway-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-primary login-button" type="submit" disabled={loading}>{loading ? 'Connecting…' : 'Connect to local gateway'}<Icon name="arrow" size={17} /></button>
    <small>Your password stays in this browser tab and is sent only to the local gateway.</small>
  </form></main>;
}

export default function App() {
  const [page, setPage] = useState<Page>('station');
  const [windowKey, setWindowKey] = useState<WindowKey>('6h');
  const [demoSeries, setDemoSeries] = useState<Point[]>(() => demoPoints('6h'));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [actualPoints, setActualPoints] = useState<Point[]>([]);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [actualReady, setActualReady] = useState(false);
  const [demoOutput, setDemoOutput] = useState<OutputState>('OFF');
  const [requestedOutput, setRequestedOutput] = useState<OutputState | null>(null);
  const [commandMessage, setCommandMessage] = useState('');
  const [commandBusy, setCommandBusy] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const [flashMission, setFlashMission] = useState('');
  const [demoEvents, setDemoEvents] = useState<LogEntry[]>([
    { id: 'e1', title: 'Brief movement detected', detail: 'Motion sensor · equipment shelf', time: '2 min ago', kind: 'motion' },
    { id: 'e2', title: 'Environmental sample received', detail: 'Temperature and humidity', time: '4 min ago', kind: 'reading' },
    { id: 'e3', title: 'Station heartbeat', detail: 'Gateway connection healthy', time: '6 min ago', kind: 'reading' },
  ]);
  const [actualEvents, setActualEvents] = useState<LogEntry[]>([]);
  const [missions, setMissions] = useState<Mission[]>([
    { id: 'readings', title: 'Inspect the readings', detail: 'Review the current station snapshot.', done: false },
    { id: 'trend', title: 'Explore the trend', detail: 'Open the trend view and compare sensors.', done: false },
    { id: 'command', title: 'Verify an output', detail: 'Send a simulated request and inspect its acknowledgment.', done: false },
  ]);
  const demoMode = !IS_ACTUAL;
  const auth = useMemo(() => password ? `Basic ${btoa(`operator:${password}`)}` : '', [password]);

  const refreshActual = useCallback(async (credential: string, initial = false) => {
    const headers = { Authorization: credential };
    try {
      const response = await fetch('/api/summary', { headers, cache: 'no-store' });
      if (response.status === 401) {
        setActualReady(false); setAuthError('That password was not accepted. Check it and try again.');
        return false;
      }
      if (!response.ok) throw new Error(`Gateway returned ${response.status}.`);
      const summary = await response.json() as Snapshot;
      setSnapshot(summary); setActualReady(true); setAuthError(''); setLastUpdated(Date.now());
      const historyResponse = await fetch(`/api/history?window=${windowKey}`, { headers, cache: 'no-store' });
      if (historyResponse.ok) {
        const history = await historyResponse.json() as { points: Point[] };
        setActualPoints(history.points ?? []);
      }
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not reach the local gateway.');
      if (initial) setActualReady(false);
      return false;
    }
  }, [windowKey]);

  const login = useCallback(async (candidate: string) => {
    setAuthLoading(true); setAuthError('');
    const credential = `Basic ${btoa(`operator:${candidate}`)}`;
    const ok = await refreshActual(credential, true);
    if (ok) setPassword(candidate);
    setAuthLoading(false);
  }, [refreshActual]);

  useEffect(() => {
    if (!demoMode) return;
    setDemoSeries(demoPoints(windowKey).map((point) => ({ ...point, actual_output: demoOutput })));
    const timer = window.setInterval(() => {
      setDemoSeries((old) => old.map((point, index) => index === old.length - 1 ? {
        ...point,
        _time: new Date().toISOString(),
        temperature_c: 23.1 + Math.sin((Date.now() - startTime) / 28000) * 0.44,
        humidity_pct: 52 + Math.cos((Date.now() - startTime) / 41000) * 1.5,
        actual_output: demoOutput,
      } : point));
      setLastUpdated(Date.now());
    }, 4000);
    return () => window.clearInterval(timer);
  }, [demoMode, demoOutput, windowKey]);

  useEffect(() => {
    if (demoMode || !auth) return;
    void refreshActual(auth);
    const timer = window.setInterval(() => void refreshActual(auth), 5000);
    return () => window.clearInterval(timer);
  }, [auth, demoMode, refreshActual]);

  const points = demoMode ? demoSeries : actualPoints;
  const latest = demoMode ? demoSeries[demoSeries.length - 1] : snapshot?.device;
  const output = demoMode ? demoOutput : snapshot?.device.actual_output ?? 'UNKNOWN';
  const isStale = demoMode ? false : snapshot?.stale ?? true;
  const isOnline = demoMode ? true : snapshot?.mqtt_connected === true && snapshot?.device.state !== 'offline';
  const lastSample = demoMode ? new Date(lastUpdated).toISOString() : snapshot?.last_received_at;
  const completed = missions.filter((mission) => mission.done).length;
  const displayPageTitle = page === 'station' ? 'Station overview' : page === 'trends' ? 'Sensor trends' : 'Field notes';

  const markMission = useCallback((id: string, message: string) => {
    setMissions((current) => current.map((mission) => mission.id === id ? { ...mission, done: true } : mission));
    setFlashMission(id);
    window.setTimeout(() => setFlashMission(''), 1200);
    setCommandMessage(message);
  }, []);

  const navigate = (nextPage: Page) => {
    setPage(nextPage); setMenuOpen(false);
    if (demoMode && nextPage === 'trends') markMission('trend', 'Demo field note added: trend explored.');
    if (demoMode && nextPage === 'station') markMission('readings', 'Demo field note added: station readings inspected.');
  };

  async function toggleOutput(next: 'ON' | 'OFF') {
    if (commandBusy) return;
    setCommandBusy(true); setRequestedOutput(next); setCommandMessage(demoMode ? 'Simulating request…' : 'Waiting for device acknowledgment…');
    if (demoMode) {
      window.setTimeout(() => {
        setDemoOutput(next);
        setCommandMessage(`Demo acknowledgment received · indicator is ${next.toLowerCase()}.`);
        setDemoEvents((events) => [{ id: `command-${Date.now()}`, title: `Indicator ${next.toLowerCase()} · simulated`, detail: 'Demo command round-trip · no hardware connected', time: 'Just now', kind: 'command' as const }, ...events].slice(0, 5));
        markMission('command', 'Demo field note added: simulated acknowledgment received.');
        setCommandBusy(false); setRequestedOutput(null);
      }, 620);
      return;
    }
    try {
      const response = await fetch('/api/commands/indicator', {
        method: 'POST', headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ state: next }),
      });
      if (!response.ok) throw new Error(response.status === 503 ? 'Gateway or device command channel is unavailable.' : `Command failed (${response.status}).`);
      const result = await response.json() as { command_id: string; accepted: boolean | null; actual_state: OutputState; reason?: string | null; timed_out?: boolean };
      if (result.accepted && result.actual_state === next) {
        setCommandMessage(`Device acknowledged ${next.toLowerCase()} · actual state verified.`);
        setActualEvents((events) => [{ id: result.command_id, title: `Indicator ${next.toLowerCase()} verified`, detail: `Device acknowledgment · ${result.command_id.slice(0, 8)}`, time: 'Just now', kind: 'command' }, ...events]);
      } else if (result.timed_out) {
        setCommandMessage('No device acknowledgment arrived. Actual output remains unknown.');
      } else {
        setCommandMessage(`Device did not confirm the request${result.reason ? ` · ${result.reason}` : ''}.`);
      }
      await refreshActual(auth);
    } catch (error) {
      setCommandMessage(error instanceof Error ? error.message : 'Could not send the command.');
    } finally {
      setCommandBusy(false); setRequestedOutput(null);
    }
  }

  const events = demoMode ? demoEvents : actualEvents;
  const freshness = demoMode ? relativeTime(new Date(lastUpdated).toISOString()) : relativeTime(lastSample);

  if (!demoMode && !actualReady) return <LoginGate onLogin={login} error={authError} loading={authLoading} />;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <a className="brand" href="#station" onClick={(event) => { event.preventDefault(); navigate('station'); }} aria-label="LabSentinel station home">
        <span className="brand-mark"><Icon name="mark" size={23} /></span><span className="brand-name">Lab<span>Sentinel</span><small>FIELD EQUIPMENT</small></span>
      </a>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <button className={page === 'station' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('station')}><Icon name="station" /><span>Station</span><span className="nav-active-mark" /></button>
        <button className={page === 'trends' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('trends')}><Icon name="trends" /><span>Trends</span></button>
        <button className={page === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('progress')}><Icon name="progress" /><span>Field notes</span>{demoMode && completed > 0 && <span className="nav-count">{completed}</span>}</button>
      </nav>
      <div className="sidebar-spacer" />
      <div className="station-switcher">
        <span className="station-switch-icon"><Icon name="shield" size={17} /></span>
        <span><strong>Equipment station</strong><small>{demoMode ? 'Sample RT-Spark unit' : snapshot?.device.device_id ?? 'RT-Spark station'}</small></span>
        <Icon name="chevron" size={16} />
      </div>
      <div className="sidebar-foot"><span className={`status-led ${isOnline ? 'online' : ''}`} />{demoMode ? 'Demo environment' : isOnline ? 'Gateway connected' : 'Gateway offline'}<span className="version">v0.1</span></div>
    </aside>

    {menuOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-content">
      <header className="topbar">
        <button className="menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
        <div className="breadcrumb"><span>Lab equipment</span><span className="breadcrumb-slash">/</span><strong>{displayPageTitle}</strong></div>
        <div className="topbar-right">
          <span className={`connection-pill ${isOnline ? 'is-online' : 'is-offline'}`}><i />{demoMode ? 'SIMULATED ONLINE' : isOnline ? 'CONNECTED' : 'OFFLINE'}</span>
          <span className="topbar-divider" />
          <span className="operator-avatar" aria-label="Operator account">OP</span>
        </div>
      </header>

      <div className="page-wrap">
        {demoMode && <DemoNotice />}
        {authError && !demoMode && <div className="inline-warning" role="status">{authError} <button onClick={() => void refreshActual(auth)}>Retry connection</button></div>}

        <section className="page-heading">
          <div><p className="date-line">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</p>
            <h1>{displayPageTitle}</h1><p className="page-subtitle">A clear view of what the station is sensing and doing.</p></div>
          <div className="freshness"><span className={`freshness-led ${isOnline && !isStale ? 'fresh' : ''}`} /><span><strong>{isOnline ? isStale ? 'Data is stale' : 'Station is reporting' : 'No live connection'}</strong><small>{freshness}</small></span></div>
        </section>

        {page === 'station' && <>
          <section className="status-strip" aria-label="Station status">
            <div className="status-copy"><span className={`status-icon ${isOnline && !isStale ? 'healthy' : 'warning'}`}><Icon name={isOnline && !isStale ? 'check' : 'signal'} size={16} /></span><span><strong>{demoMode ? 'Sample station ready' : snapshot?.device.state === 'offline' || !isOnline ? 'Device is offline' : isStale ? 'Waiting for a fresh sample' : 'All systems reporting'}</strong><small>{demoMode ? 'Fixture data · refreshes every few seconds' : snapshot?.device.fault_code ? `Device fault: ${snapshot.device.fault_code}` : 'Gateway summary and last received telemetry'}</small></span></div>
            <span className="status-scope">{demoMode ? 'DEMO SNAPSHOT' : 'ACTUAL DEVICE DATA'}</span>
          </section>

          <div className="station-grid">
            <section className="panel sensor-panel">
              <div className="panel-heading"><div><h2>Environment & handling</h2><p>Latest sensor readings from this station</p></div><span className={`mini-state ${isOnline && !isStale ? 'good' : 'bad'}`}><i />{isOnline && !isStale ? 'Current' : 'Unavailable'}</span></div>
              <div className="sensor-list">
                <SensorReading icon="thermo" label="Temperature" value={fmt(latest?.temperature_c)} unit="°C" tone="tone-terracotta" footer="AHT10 · ambient" />
                <SensorReading icon="drop" label="Relative humidity" value={fmt(latest?.humidity_pct)} unit="%" tone="tone-blue" footer="AHT10 · ambient" />
                <SensorReading icon="light" label="Illuminance" value={fmt(latest?.light_lux, 0)} unit="lux" tone="tone-amber" footer="AP3216C · light" />
                <SensorReading icon="motion" label="Movement" value={latest?.motion_event === undefined ? '—' : latest.motion_event ? 'Detected' : 'Still'} unit="" tone="tone-pine" footer="ICM20608 · motion" />
              </div>
              <div className="sensor-footnote"><Icon name="clock" size={15} /><span>Sensor values are reported by the gateway. A dash means no value is available.</span></div>
            </section>

            <section className="panel output-panel">
              <div className="panel-heading"><div><h2>Indicator output</h2><p>Requested and actual state stay separate</p></div><span className="output-symbol"><span /></span></div>
              <div className="output-state"><span className="output-label">ACTUAL STATE</span><div className={`output-reading ${output === 'ON' ? 'lit' : ''}`}><span className="output-lamp" /><strong>{output}</strong>{requestedOutput && <small>Requesting {requestedOutput}</small>}</div></div>
              <div className="output-actions"><button className={`button button-on ${output === 'ON' ? 'selected' : ''}`} onClick={() => void toggleOutput('ON')} disabled={commandBusy || !demoMode && !isOnline} aria-pressed={output === 'ON'}>{commandBusy && requestedOutput === 'ON' ? <span className="button-spinner" /> : null}Turn on</button><button className={`button button-off ${output === 'OFF' ? 'selected' : ''}`} onClick={() => void toggleOutput('OFF')} disabled={commandBusy || !demoMode && !isOnline} aria-pressed={output === 'OFF'}>{commandBusy && requestedOutput === 'OFF' ? <span className="button-spinner" /> : null}Turn off</button></div>
              <p className="command-feedback" role="status" aria-live="polite">{commandMessage || (demoMode ? 'Try a simulated control request.' : 'Control is available when the device is connected.')}</p>
              {demoMode && <p className="demo-control-note"><Icon name="shield" size={14} />Demo only · no command reaches hardware</p>}
            </section>
          </div>

          <div className="lower-grid">
            <section className="panel trend-panel">
              <div className="panel-heading trend-heading"><div><h2>Recent conditions</h2><p>Temperature and humidity over time</p></div><div className="range-pills" role="group" aria-label="Chart time range">{windowOptions.slice(0, 3).map((option) => <button key={option} className={windowKey === option ? 'selected' : ''} onClick={() => setWindowKey(option)} aria-pressed={windowKey === option}>{option}</button>)}</div></div>
              <TrendChart points={points} windowKey={windowKey} />
              <button className="text-link" onClick={() => navigate('trends')}>Explore sensor trends <Icon name="arrow" size={16} /></button>
            </section>
            <section className="panel activity-panel">
              <div className="panel-heading"><div><h2>Station activity</h2><p>Recent device and command events</p></div><span className="event-count">{events.length} events</span></div>
              <div className="event-list">{events.length ? events.slice(0, 4).map((event) => <div className="event-row" key={event.id}><span className={`event-icon ${event.kind}`}><Icon name={event.kind === 'motion' ? 'motion' : event.kind === 'command' ? 'signal' : 'check'} size={15} /></span><span className="event-copy"><strong>{event.title}</strong><small>{event.detail}</small></span><time>{event.time}</time></div>) : <div className="activity-empty"><span>No device events yet</span><small>Confirmed activity will appear after the gateway receives it.</small></div>}</div>
              <button className="text-link" onClick={() => navigate('progress')}>{demoMode ? 'View demo field notes' : 'View evidence log'} <Icon name="arrow" size={16} /></button>
            </section>
          </div>
          {demoMode && <MissionStrip missions={missions} completed={completed} onNavigate={navigate} flashMission={flashMission} />}
        </>}

        {page === 'trends' && <section className="trend-page">
          <div className="trend-page-toolbar"><div><h2>Sensor history</h2><p>{demoMode ? 'Illustrative fixture series · clearly labeled demo data' : 'Measurements stored by the local InfluxDB gateway'}</p></div><div className="range-pills wide" role="group" aria-label="Select history window">{windowOptions.map((option) => <button key={option} className={windowKey === option ? 'selected' : ''} onClick={() => setWindowKey(option)} aria-pressed={windowKey === option}>{option}</button>)}</div></div>
          <section className="panel expanded-chart"><div className="chart-summary"><div><span className="chart-kicker">TEMPERATURE</span><strong>{fmt(latest?.temperature_c)}<small>°C</small></strong><span>Current reading</span></div><div><span className="chart-kicker">HUMIDITY</span><strong>{fmt(latest?.humidity_pct)}<small>%</small></strong><span>Current reading</span></div><div><span className="chart-kicker">ILLUMINANCE</span><strong>{fmt(latest?.light_lux, 0)}<small>lux</small></strong><span>Current reading</span></div></div><TrendChart points={points} windowKey={windowKey} /></section>
          <section className="panel trend-details"><div className="panel-heading"><div><h2>Reading notes</h2><p>Sensor coverage and current state</p></div></div><div className="coverage-grid"><div><span className="coverage-swatch temp" /><strong>Temperature</strong><small>AHT10 · Celsius</small><b>{latest?.temperature_c === undefined ? 'No data' : 'Reporting'}</b></div><div><span className="coverage-swatch humidity" /><strong>Humidity</strong><small>AHT10 · relative percent</small><b>{latest?.humidity_pct === undefined ? 'No data' : 'Reporting'}</b></div><div><span className="coverage-swatch light" /><strong>Light</strong><small>AP3216C · lux</small><b>{latest?.light_lux === undefined ? 'No data' : 'Reporting'}</b></div><div><span className="coverage-swatch motion" /><strong>Motion</strong><small>ICM20608 · event detection</small><b>{latest?.motion_event === undefined ? 'No data' : 'Reporting'}</b></div></div></section>
          {demoMode && <p className="demo-footnote">Every value in this view is simulated for demonstration. It is not a live equipment reading.</p>}
        </section>}

        {page === 'progress' && <section className="progress-page">
          {demoMode ? <>
            <div className="passport-intro"><div><div className="passport-seal"><Icon name="mark" size={33} /></div><div><span className="section-kicker">YOUR DEMO FIELD NOTES</span><h2>Learn the station by doing.</h2><p>Complete three small walkthrough steps. These stamps track demo interactions only; they are not equipment performance scores.</p></div></div><div className="passport-count"><strong>{completed}<small>/ 3</small></strong><span>demo steps</span></div></div>
            <div className="mission-list">{missions.map((mission, index) => <article className={`mission-row ${mission.done ? 'done' : ''} ${flashMission === mission.id ? 'stamped' : ''}`} key={mission.id}><span className="mission-index">{mission.done ? <Icon name="check" size={18} /> : `0${index + 1}`}</span><div><h3>{mission.title}</h3><p>{mission.detail}</p></div><span className={`mission-stamp ${mission.done ? 'earned' : ''}`}>{mission.done ? 'RECORDED' : 'READY'}</span>{!mission.done && <button className="mission-action" onClick={() => mission.id === 'trend' ? navigate('trends') : mission.id === 'readings' ? navigate('station') : navigate('station')}>{mission.id === 'command' ? 'Go to controls' : 'Open'}<Icon name="arrow" size={15} /></button>}</article>)}</div>
            <div className="passport-note"><Icon name="shield" size={18} /><span><strong>Demo progress is labeled and isolated.</strong><small>Simulated commands, readings, and milestones never change the local device or gateway.</small></span></div>
          </> : <>
            <div className="evidence-heading"><span className="evidence-seal"><Icon name="shield" size={27} /></span><div><span className="section-kicker">VERIFIED EVIDENCE</span><h2>Field notes</h2><p>Only events confirmed by the local gateway appear here.</p></div></div>
            {actualEvents.length ? <div className="mission-list">{actualEvents.map((event) => <article className="mission-row done" key={event.id}><span className="mission-index"><Icon name="check" size={18} /></span><div><h3>{event.title}</h3><p>{event.detail}</p></div><time className="evidence-time">{event.time}</time><span className="mission-stamp earned">VERIFIED</span></article>)}</div> : <div className="evidence-empty"><span className="empty-icon"><Icon name="shield" size={24} /></span><h3>No verified milestones yet</h3><p>When the gateway confirms a command or receives device activity, the evidence will be recorded here.</p><button className="button button-primary" onClick={() => navigate('station')}>Return to station <Icon name="arrow" size={16} /></button></div>}
          </>}
        </section>}

        <footer className="page-footer"><span>LabSentinel · Operator dashboard</span><span>{demoMode ? 'Demo fixtures · no hardware access' : 'Local gateway · actual mode'}</span></footer>
      </div>
    </main>
  </div>;
}

function MissionStrip({ missions, completed, onNavigate, flashMission }: { missions: Mission[]; completed: number; onNavigate: (page: Page) => void; flashMission: string }) {
  return <section className="mission-strip" aria-label="Demo walkthrough progress">
    <div className="mission-strip-head"><div><span className="section-kicker">DEMO WALKTHROUGH</span><h2>Make the station yours</h2><p>Three quick steps to explore how LabSentinel works.</p></div><button className="mission-count" onClick={() => onNavigate('progress')} aria-label={`${completed} of 3 demo steps complete`}><strong>{completed}<small>/3</small></strong><span>field notes</span></button></div>
    <div className="mission-progress-track" aria-label={`${completed} of 3 steps completed`}><span style={{ width: `${completed / 3 * 100}%` }} /></div>
    <div className="mission-mini-list">{missions.map((mission) => <button className={`mission-mini ${mission.done ? 'complete' : ''} ${flashMission === mission.id ? 'stamped' : ''}`} key={mission.id} onClick={() => onNavigate(mission.id === 'trend' ? 'trends' : 'station')}><span className="mini-check"><Icon name={mission.done ? 'check' : mission.id === 'trend' ? 'trends' : mission.id === 'command' ? 'signal' : 'station'} size={15} /></span><span><strong>{mission.title}</strong><small>{mission.done ? 'Stamped in demo' : 'Tap to explore'}</small></span><Icon name="arrow" size={15} /></button>)}</div>
  </section>;
}
