// form-submit.js
// Add to the event request form page, after the form and its existing script:
//   <script src="form-submit.js"></script>
//
// What it does:
//   1. Intercepts the form submit (the browser's built-in validation and the
//      existing end-time check still run first).
//   2. Sends the answers to the server as JSON.
//   3. Redirects to the success page (with a token) or to the failed page (with a reason code).

(function () {
  'use strict';

  // ---------- Settings: update these for your environment ----------
  var CONFIG = {
    // Endpoint that saves the request.
    submitUrl: '/api/event-requests',
    // Success page. The token from the server is added as ?token=...
    confirmationUrl: '/event-request/confirmation',
    // Failed page (to be built). A reason code is added as ?reason=...
    failedUrl: '/event-request/failed'
  };

  var form = document.getElementById('event-form');
  if (!form) return;

  var submitButton = form.querySelector('button[type="submit"]');
  var submitting = false;

  // replace() keeps the form out of the Back button history, so the client
  // can't navigate back to a filled-in form and resubmit by accident.
  function goToFailed(reason) {
    window.location.replace(CONFIG.failedUrl + '?reason=' + encodeURIComponent(reason));
  }

  function goToConfirmation(token) {
    window.location.replace(CONFIG.confirmationUrl + '?token=' + encodeURIComponent(token));
  }

  function collectAnswers() {
    var data = new FormData(form);
    return {
      category: data.get('category'),
      type: data.get('type'),
      name: data.get('name'),
      start: data.get('start'),
      end: data.get('end'),
      attendance: data.get('attendance'),
      furniture: data.getAll('furniture[]'),
      tech: data.getAll('tech[]'),
      catering: data.get('catering'),
      notes: data.get('notes')
    };
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    // Block double submissions (double clicks, impatient re-clicks).
    if (submitting) return;
    submitting = true;
    if (submitButton) submitButton.disabled = true;

    try {
      var response = await fetch(CONFIG.submitUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(collectAnswers())
      });

      // The server may reply with an error body that isn't JSON.
      var result = null;
      try {
        result = await response.json();
      } catch (parseError) {
        result = null;
      }

      // Expected success reply: { "success": true, "token": "abc123" }
      if (response.ok && result && result.success && result.token) {
        goToConfirmation(result.token);
        return;
      }

      // Expected failure reply: { "success": false, "reason": "time_unavailable" }
      goToFailed((result && result.reason) || 'server_error');
    } catch (networkError) {
      goToFailed('network_error');
    }
  });
})();
