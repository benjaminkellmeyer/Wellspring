const person = document.querySelector('#person');
const record = document.querySelector('#record');
const result = document.querySelector('#result');
const trace = document.querySelector('#trace');
async function send(method, url, body) {
  result.textContent = 'Waiting for the server…';
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Demo-User': person.value },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    result.textContent = `${method} ${url} — HTTP ${response.status}`;
    trace.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    result.textContent = 'Could not reach the server. Check the terminal and port preview.';
    trace.textContent = error.message;
  }
}
document.querySelector('#view').addEventListener('click', () => send('GET', `/api/requests/${record.value}`));
document.querySelector('#change').addEventListener('click', () => send('PATCH', `/api/requests/${record.value}/status`, { status: document.querySelector('#status').value }));
for (const control of [person, record]) control.addEventListener('change', () => {
  result.textContent = 'Selection changed. Run a new test.';
  trace.textContent = 'Previous response cleared.';
});


// LESSON 5.4: Browser preference. This is separate from request records.
const privacyKey = 'greenbridge.analytics.v1';
let privacyChoice = 'unset';
let privacyCount = 0;
const privacyFeedback = document.querySelector('#privacy-feedback');

// STEP 1: Read a known value. Missing/invalid storage means no permission.
function readPrivacyChoice() {
  try {
    const saved = localStorage.getItem(privacyKey); // STEP 1: Replace null with the storage read.
    if (saved === 'accepted' || saved === 'rejected') {
      return saved;
    }
  } catch (error) {
    privacyFeedback.textContent = 'Storage unavailable. Optional analytics starts off.';
  }
  return 'unset';
}

// Display the current state and where it is held.
function showPrivacyChoice() {
  let analyticsState = 'Off';
  if (privacyChoice === 'accepted') {
    analyticsState = 'On';
  }
  document.querySelector('#privacy-state').textContent = 'Choice: ' + privacyChoice + ' | Optional analytics: ' + analyticsState;
  document.querySelector('#privacy-count').textContent = privacyCount;
  document.querySelector('#privacy-notice').hidden = privacyChoice !== 'unset';
  document.querySelector('#privacy-trace').textContent = JSON.stringify({
    location: 'Browser localStorage',
    key: privacyKey,
    currentPageChoice: privacyChoice,
    sentToServer: false,
    fictionalEventsInMemory: privacyCount
  }, null, 2);
}

// STEP 2: Apply the choice immediately; then try to remember it.
function savePrivacyChoice(nextChoice) {
  privacyChoice = nextChoice;
  try {
    // STEP 2: Add the storage write here.
    localStorage.setItem(privacyKey, nextChoice);
    privacyFeedback.textContent = 'Choice applied. Reload to test whether it was saved: ' + privacyChoice + '.';
  } catch (error) {
    privacyFeedback.textContent = 'Applied for this page only. Saving failed; an older saved choice might remain. Use browser site-data controls if needed.';
  }
  showPrivacyChoice();
}

// STEP 3: Check permission at the optional behavior itself.
function recordPrivacyEvent() {
  if (privacyChoice === 'accepted') { // STEP 3: Replace false with the acceptance check.
    privacyCount = privacyCount + 1;
    privacyFeedback.textContent = 'Fictional event counted.';
  } else {
    privacyFeedback.textContent = 'Event blocked. Optional analytics is off.';
  }
  showPrivacyChoice();
}

// Existing request actions above do not depend on this analytics preference.
document.querySelector('#privacy-accept').addEventListener('click', function () {
  savePrivacyChoice('accepted');
});
document.querySelector('#privacy-reject').addEventListener('click', function () {
  savePrivacyChoice('rejected');
});
document.querySelector('#privacy-settings').addEventListener('click', function () {
  document.querySelector('#privacy-notice').hidden = false;
  document.querySelector('#privacy-accept').focus();
});
document.querySelector('#privacy-event').addEventListener('click', recordPrivacyEvent);
document.querySelector('#privacy-reload').addEventListener('click', function () {
  window.location.reload();
});
document.querySelector('#privacy-reset').addEventListener('click', function () {
  privacyChoice = 'unset';
  privacyCount = 0;
  try {
    localStorage.removeItem(privacyKey);
    privacyFeedback.textContent = 'Privacy practice reset. Request records were not changed.';
  } catch (error) {
    privacyFeedback.textContent = 'Reset this page only. Saved preference could not be removed.';
  }
  showPrivacyChoice();
});
window.addEventListener('storage', function (event) {
  if (event.key === privacyKey || event.key === null) {
    privacyChoice = readPrivacyChoice();
    showPrivacyChoice();
  }
});

// STEP 4: Read before allowing any optional events.
privacyChoice = readPrivacyChoice();
showPrivacyChoice();
