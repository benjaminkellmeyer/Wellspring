# Wellspring Event Requests — Team Rahmat Aid

**Team:** Benjamin Kellmeyer, Aiden Granger, Ethan Cassara
**Assignment:** 7 — Functional Feature

## 1. Feature summary
Clients of Wellspring on Main sign in, submit event requests (date, time, room, attendance, setup needs, etc.), and view the status of their own requests. Wellspring staff sign in to see every request with the client's name and contact details and the room name, filter and sort the list, and update a request's status, priority, coordinator, or room.
The workflow uses related tables: each `event` row references a `client` (`c_id`), a `room` (`r_id`), and a `coordinator` (`co_id`). Each `client` row is linked to a Supabase Auth account through `client.user_id`, and staff permission comes from the `user_roles` and `roles` tables.

## 2. Setup and access
### What you need
- Node.js 22 and npm.
- A Supabase project you control.
- The submitted project files.
The Express server runs locally and stores records in Supabase. A public deployment is not required. If a public deployment is desired, then you can use the following:
A Render account (free). The easiest way to do this is to use GitHub to sign up for it so that you can immediately connect your repo. Make sure to select the “Free” instance type.
### Install the project
In the project's main folder, run:
```
npm install
```

### Set up the database
In the Supabase SQL Editor, run these files in order:
1. `database/01_setup.sql`: creates the client, coordinator, room, inquiry, and event tables, their relationships, and checks.
2. `database/02_seed.sql`: adds fictional clients, coordinators, rooms, inquiries, and events.
3. Create the test accounts (below), then run `database/03_auth.sql`. This adds the roles tables, the `is_staff()` function, and Row Level Security policies, and it assigns roles to the test accounts.
### Create the test accounts
1. In Supabase, open **Authentication → Users → Add user → Create new user**.
2. Create these two fictional accounts with passwords you choose, and tick **Auto Confirm User**:
   - `staff@example.com`
   - `client@example.com`
3. Run `database/03_auth.sql`. It gives `staff@example.com` the **staff** role. It gives `client@example.com` the **client** role and links it to the sample client "Jamie Rivera," who already has sample events.
4. The last query in `03_auth.sql` lists both accounts with their role. Check that both appear.
No passwords are included in this submission.
If setting up in Render, choose New > Web Service (top right), and choose to build from a Git repository. Connect it to the appropriate GitHub repository with the server files, (configure GitHub App if Render needs access to see your repositories, choose “Only select repositories” and select your desired repository). Then, make sure the server name, region, branch, root directory, runtime/language, build command, and start command all match what you have in GitHub, and make sure the instance type is “Free to start.” 
### Configure the application
Copy `.env.example` to a new file named `.env` and enter your project's values (Supabase → Project Settings → API Keys):
```
PORT=3000
SUPABASE_URL=https://ziqfqmmstecdqfxdqejp.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_MMCOfLsZGqWU_aAK8UOKKQ_gGB1KIyG
```
NOTE: YOU ALSO NEED THE SUPABASE_SECRET_KEY but we are not providing it here due to security concerns. Contact us directly to obtain it.

The server sends only the publishable key to the browser (through `/api/config`) so users can sign in. The secret key stays on the server.
If running this on Render, go to Render and give it the Supabase URL, publishable key, and secret key. To do this, open the project, go to Environment (on the side navigation), and put in the three variables with the exact variable names and values as in the .env file. You do not need to set PORT yourself.
### Start the application
Use this command: 
```
npm start
```
Open http://localhost:3000. Keep the terminal running while you use the feature.

Or, if using Render, when you create the web service, Render should automatically deploy. If not, you can manually deploy. Watch the Logs or Events pages and make sure no errors appear. You then should be able to open your Render page using the URL.
If you get any errors, check Logs.

## 3. Try the workflow
### Create and read a request (client)
1. Open http://localhost:3000. You are redirected to **Sign in**. Sign in as `client@example.com`.
2. Select **Request an event**.
3. Enter:
   - **Category:** Private
   - **Type:** Birthday Party
   - **Event Name:** Rivera Family Birthday
   - **Start:** any future date at 2:00 PM; **End:** same day at 5:00 PM
   - **Attendance:** 40
   - **Room:** Garden Pavilion
4. Select **Submit Request**.
   **Expected:** The message "Request #N "Rivera Family Birthday" was saved. Status: Submitted." appears.
5. Select **View my requests**, then **Read → Show database**. Reload the page.
   **Expected:** The request is still listed. A client sees only their own requests.

### View related information and update a request (staff)
1. Select **Sign out**, then sign in as `staff@example.com`.
2. Select **Read → Show database**.
   **Expected:** Requests from every client appear. The Client and Room columns come from the related `client` and `room` tables.
3. Select **Update**, choose the request created above, change **Status** to `in progress`, and select **Save changes**.
   **Expected:** "Saved changes to #N." appears.
4. Reload the page and open **Read → Show database** again.
   **Expected:** The status is still `in progress`.

### Filter requests
1. As staff, select **Read → Show filters**.
2. Set **Status** to `in progress`.
   **Expected:** Only requests with that status appear. If none match, the table shows "No event requests match these filters."
3. Select **Reset filters**.
   **Expected:** All requests appear again.

### Check server validation
Sign in as `client@example.com`, open http://localhost:3000/eventForm.html, open the browser's developer console, and run:
*Initial confusion on how to get the database to show, “Show Database” button was above the filters. This confusion could also be from previous versions where the checkbox for showing the database was in a different spot and a checkbox instead of a button. 

```js
const token = await wellspring.getToken();
const start = new Date(Date.now() + 7 * 86400000);
fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    category: 'private', type: 'birthday_party', name: '',
    start: start.toISOString(),
    end: new Date(start.getTime() + 2 * 3600000).toISOString(),
    attendance: 40, room: 1
  })
}).then(async r => console.log(r.status, await r.json()));
```
**Expected:** `400 { error: "Event name is required.", ... }`. No new request is saved. Reload the request list to confirm.
This app uses bearer tokens: after sign-in, the browser sends `Authorization: Bearer <access token>`, and the server verifies the token with Supabase on every protected request.

### Check protected access

**A signed-in client cannot update a request.** While signed in as `client@example.com`, replace `EVENT_ID` with an event's ID and run:

```js
const token = await wellspring.getToken();
fetch('/api/events/EVENT_ID', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ status: 'completed' })
}).then(async r => console.log(r.status, await r.json()));
```

**Expected:** `403 { error: "Only Wellspring staff can do this." }`. Sign in as staff and confirm the status is unchanged.
**A signed-out visitor cannot read or update anything.** From a terminal:
```
curl -i http://localhost:3000/api/events
curl -i -X PATCH http://localhost:3000/api/events/1 -H "Content-Type: application/json" -d '{"status":"completed"}'
```
**Expected:** Both return `401 { "error": "Please sign in first." }`, and no event data is returned.
**Clients only see their own requests.** As `client@example.com`, run `wellspring.api('GET', '/api/events').then(console.log)`.
**Expected:** Only Jamie Rivera's events (and any you created) are returned.
## 4. Known limitations
- Staff do not have create functionality (this may be fine, but it is a limitation on the end users)
- Users are not immediately shown to the database to see their new request after they submit it
- It takes multiple clicks to see the database at all, which can be confusing
- List of items is not in ID order
- Staff can update status, priority, coordinator, and room. Other details (name, times, attendance) cannot be edited after submission.
- Staff can only edit one database entry at a time (which prevents them from accidentally changing a large amount of records at once, but is slower).
- New clients can create an account on the sign-in page. Staff roles are assigned only through `03_auth.sql`; there is no account-management screen, and accounts do not need email verification.
- No email notifications. Clients must return to the page to check progress.
- Room overlap is enforced by the database only for events with status `scheduled`.
- The feature uses fictional data.
- If run on Render, the page may take up to 50 seconds to load if on the free version.
- Filter Requests test: Initial confusion on how to get the database to show, “Show Database” button was above the filters. This confusion could also be from previous versions where the checkbox for showing the database was in a different spot and a checkbox instead of a button. 

## 5. Contributions and AI use

| Member | Main contribution |
|--------|-------------------|
| Benjamin Kellmeyer | Event Form, GitHub and Supabase management, testing |
| Aiden Granger | Success Page, sign-in, validation, and permissions, testing |
| Ethan Cassara | Home (dashboard) page, sample data, testing |

**AI use:** 
The AI created the authentication middleware, developed the protected routes, and created and finalized the SQL database code. All functionality was tested by the team.
