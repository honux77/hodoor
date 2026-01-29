import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendarName?: string;
  calendarColor?: string;
}

declare global {
  interface Window {
    electronAPI: {
      sendInput: (data: string) => void;
      resize: (cols: number, rows: number) => void;
      onData: (callback: (data: string) => void) => void;
      removeAllListeners: () => void;
      calendar: {
        checkAuth: () => Promise<boolean>;
        auth: () => Promise<boolean>;
        getEvents: () => Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }>;
        logout: () => Promise<boolean>;
        onAuthSuccess: (callback: () => void) => void;
      };
    };
  }
}

// Create terminal instance (output only)
const terminal = new Terminal({
  cursorBlink: false,
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  disableStdin: true,
  theme: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#1e1e1e',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
});

// Create fit addon for auto-resizing
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// Open terminal in container
const terminalContainer = document.getElementById('terminal');
if (terminalContainer) {
  terminal.open(terminalContainer);
  fitAddon.fit();
}

// Get input elements
const commandInput = document.getElementById('command-input') as HTMLInputElement;
const promptSpan = document.getElementById('prompt') as HTMLSpanElement;

// Command history
const commandHistory: string[] = [];
let historyIndex = -1;

// Handle command input
commandInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const command = commandInput.value;
    if (command.trim()) {
      commandHistory.push(command);
      historyIndex = commandHistory.length;
      // Display command in output
      terminal.writeln(`\x1b[36m$ ${command}\x1b[0m`);
      window.electronAPI.sendInput(command + '\n');
    } else {
      window.electronAPI.sendInput('\n');
    }
    commandInput.value = '';
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      commandInput.value = commandHistory[historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      commandInput.value = commandHistory[historyIndex];
    } else {
      historyIndex = commandHistory.length;
      commandInput.value = '';
    }
  } else if (e.key === 'c' && e.ctrlKey) {
    window.electronAPI.sendInput('\x03');
  }
});

// Handle data from main process
window.electronAPI.onData((data) => {
  terminal.write(data);
});

// Handle window resize
window.addEventListener('resize', () => {
  fitAddon.fit();
  window.electronAPI.resize(terminal.cols, terminal.rows);
});

// Initial resize notification
setTimeout(() => {
  fitAddon.fit();
  window.electronAPI.resize(terminal.cols, terminal.rows);
}, 100);

// Focus input on click anywhere (except side panel)
document.getElementById('main-content')?.addEventListener('click', () => {
  commandInput.focus();
});

// Initial focus
commandInput.focus();

// ============================================
// Side Panel Toggle
// ============================================
const sidePanel = document.getElementById('side-panel') as HTMLElement;
const toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;

toggleBtn.addEventListener('click', () => {
  sidePanel.classList.toggle('hidden');
  toggleBtn.classList.toggle('panel-hidden');
  toggleBtn.textContent = sidePanel.classList.contains('hidden') ? '▶' : '◀';

  // Refit terminal after animation
  setTimeout(() => {
    fitAddon.fit();
    window.electronAPI.resize(terminal.cols, terminal.rows);
  }, 300);
});

// ============================================
// Clock
// ============================================
const currentTimeEl = document.getElementById('current-time') as HTMLElement;
const currentDateEl = document.getElementById('current-date') as HTMLElement;

function updateClock(): void {
  const now = new Date();

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  currentTimeEl.textContent = `${hours}:${minutes}:${seconds}`;

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  currentDateEl.textContent = now.toLocaleDateString('ko-KR', options);
}

updateClock();
setInterval(updateClock, 1000);

// ============================================
// Calendar
// ============================================
const calendarGrid = document.getElementById('calendar-grid') as HTMLElement;
const calendarMonthYear = document.getElementById('calendar-month-year') as HTMLElement;
const prevMonthBtn = document.getElementById('prev-month') as HTMLButtonElement;
const nextMonthBtn = document.getElementById('next-month') as HTMLButtonElement;

let currentCalendarDate = new Date();

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

function renderCalendar(date: Date): void {
  const year = date.getFullYear();
  const month = date.getMonth();

  calendarMonthYear.textContent = `${year}년 ${MONTHS_KO[month]}`;

  calendarGrid.innerHTML = '';

  // Day headers
  DAYS_KO.forEach((day, index) => {
    const header = document.createElement('div');
    header.className = 'calendar-day-header';
    if (index === 0) header.style.color = '#f14c4c';
    if (index === 6) header.style.color = '#3b8eea';
    header.textContent = day;
    calendarGrid.appendChild(header);
  });

  // Get first day of month and total days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Previous month days
  for (let i = firstDay - 1; i >= 0; i--) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day other-month';
    const dayNum = daysInPrevMonth - i;
    const dayOfWeek = (firstDay - i - 1 + 7) % 7;
    if (dayOfWeek === 0) dayEl.classList.add('sunday');
    if (dayOfWeek === 6) dayEl.classList.add('saturday');
    dayEl.textContent = String(dayNum);
    calendarGrid.appendChild(dayEl);
  }

  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';

    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0) dayEl.classList.add('sunday');
    if (dayOfWeek === 6) dayEl.classList.add('saturday');

    if (isCurrentMonth && day === today.getDate()) {
      dayEl.classList.add('today');
    }

    dayEl.textContent = String(day);
    calendarGrid.appendChild(dayEl);
  }

  // Next month days
  const totalCells = 42; // 6 rows * 7 days
  const currentCells = firstDay + daysInMonth;
  for (let day = 1; day <= totalCells - currentCells; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day other-month';
    const dayOfWeek = (currentCells + day - 1) % 7;
    if (dayOfWeek === 0) dayEl.classList.add('sunday');
    if (dayOfWeek === 6) dayEl.classList.add('saturday');
    dayEl.textContent = String(day);
    calendarGrid.appendChild(dayEl);
  }
}

prevMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar(currentCalendarDate);
});

nextMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar(currentCalendarDate);
});

// Initial render
renderCalendar(currentCalendarDate);

// ============================================
// Google Calendar Events
// ============================================
const googleAuthBtn = document.getElementById('google-auth-btn') as HTMLButtonElement;
const eventsList = document.getElementById('events-list') as HTMLElement;

let isAuthenticated = false;

function formatEventTime(event: CalendarEvent): string {
  if (event.start.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime!);
    const startTime = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return `${startTime} - ${endTime}`;
  }
  return 'All day';
}

function renderEvents(events: CalendarEvent[]): void {
  eventsList.innerHTML = '';

  if (events.length === 0) {
    eventsList.innerHTML = '<div class="no-events">No events today</div>';
    return;
  }

  events.forEach((event) => {
    const eventEl = document.createElement('div');
    eventEl.className = 'event-item';
    if (event.calendarColor) {
      eventEl.style.borderLeftColor = event.calendarColor;
    }
    eventEl.innerHTML = `
      <div class="event-time">${formatEventTime(event)}</div>
      <div class="event-title">${event.summary || '(No title)'}</div>
      ${event.calendarName ? `<div class="event-calendar">${event.calendarName}</div>` : ''}
    `;
    eventsList.appendChild(eventEl);
  });
}

function showLoading(): void {
  eventsList.innerHTML = '<div class="events-loading">Loading events...</div>';
}

function showError(message: string): void {
  eventsList.innerHTML = `<div class="no-events">${message}</div>`;
}

async function loadEvents(): Promise<void> {
  showLoading();
  const result = await window.electronAPI.calendar.getEvents();

  if (result.success && result.events) {
    renderEvents(result.events);
  } else {
    showError(result.error || 'Failed to load events');
  }
}

async function updateAuthState(): Promise<void> {
  isAuthenticated = await window.electronAPI.calendar.checkAuth();

  if (isAuthenticated) {
    googleAuthBtn.textContent = 'Refresh';
    loadEvents();
  } else {
    googleAuthBtn.textContent = 'Connect';
    eventsList.innerHTML = '<div class="no-events">Click Connect to sync Google Calendar</div>';
  }
}

googleAuthBtn.addEventListener('click', async () => {
  if (isAuthenticated) {
    // Refresh events
    loadEvents();
  } else {
    // Start OAuth flow
    googleAuthBtn.textContent = 'Connecting...';
    googleAuthBtn.disabled = true;

    const success = await window.electronAPI.calendar.auth();

    googleAuthBtn.disabled = false;
    if (success) {
      isAuthenticated = true;
      googleAuthBtn.textContent = 'Refresh';
      loadEvents();
    } else {
      googleAuthBtn.textContent = 'Connect';
      showError('Authentication failed. Please try again.');
    }
  }
});

// Listen for auth success from main process
window.electronAPI.calendar.onAuthSuccess(() => {
  isAuthenticated = true;
  googleAuthBtn.textContent = 'Refresh';
  loadEvents();
});

// Initial auth check
updateAuthState();
