const express = require('express');
const path = require('node:path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// CLASSROOM SIMULATION ONLY. These are server-defined fictional identities.
// Selecting an account is NOT authentication. Real apps verify a session/token.

app.get('/api/health', (req, res) => res.json({ message: 'Greenbridge server is running.' }));
app.use('/api/requests', (req, res, next) => {
  const user = users[req.get('X-Demo-User')];
  if (!user) return res.status(401).json({ message: 'Choose a demo account.' });
  req.user = user; // Real authentication would supply this verified identity.
  next();
});

app.get('/api/requests/:id', async (req, res) => {
  const user = req.user;
  const request = await store.getRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ message: 'Request not found.' });

  // STEP 3: Replace only the next line with the worksheet ownership check.
  if (user.role === "resident" && request.owner_id !== user.id) {
    return res.status(403).json({ message: 'You do not have permission to view this request.' });
  }
  return res.json(request);
});

app.patch('/api/requests/:id/status', async (req, res) => {
  const user = req.user;

  // STEP 4: Replace only the next line with the worksheet role check.
  if (user.role !== "staff" && user.role !== "manager") {
    return res.status(403).json({ message: 'You do not have permission to change request status.' });
  }
  const request = await store.getRequest(Number(req.params.id));
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  const status = req.body.status;
  if (!['submitted', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Choose a valid status.' });
  }
  if (request.archived_at) return res.status(409).json({ message: 'This request is archived.' });
  const updated = await store.updateRequestStatus(request.id, status);
  return res.json(updated);
});
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status === 400 ? 400 : 500).json({ message: 'The server could not process this request. Check the terminal.' });
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Greenbridge: open port ${port}. Stop with Ctrl+C.`));
