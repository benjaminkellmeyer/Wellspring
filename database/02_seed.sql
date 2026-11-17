--The code for this was all generated with the help of AI

--=====================================================================
-- SECTION 2: SAMPLE DATA CODE
-- (run after Section 1; ordered so parent rows exist before child rows)
--=====================================================================


--------------------------------------------------------------------
-- Client Sample Data
--------------------------------------------------------------------
--this creates sample client data

INSERT INTO public.client (c_type, c_name, c_email, c_phone) VALUES
    ('commercial', 'Lone Star Events Co',       'bookings@lonestarevents.com',   '2145550101'),
    ('non_profit', 'North Texas Food Alliance', 'info@ntfoodalliance.org',       '8175550102'),
    ('individual', 'Jamie Rivera',              'jamie.rivera@example.com',      '9725550104'),
    ('other',      'Riverbend Neighborhood HOA','board@riverbendhoa.example.net','4695550105'),
    ('tenant',     'Arlington Parks Department','parks@arlingtontx.example.gov', '8175550103');


--------------------------------------------------------------------
-- Coordinator Sample Data
--------------------------------------------------------------------
--this is sample data for the coordinator table
INSERT INTO Coordinator (Co_name, Co_email, Co_phone) VALUES
('Maria Gonzalez', 'maria.gonzalez@example.com', '2145550101'),
('James Carter',   'james.carter@example.com',   '8175550142'),
('Priya Patel',    'priya.patel@example.com',    '4695550177'),
('David Nguyen',   'david.nguyen@example.com',   '9725550193'),
('Aisha Williams', 'aisha.williams@example.com', '2815550118');


--------------------------------------------------------------------
-- Room Sample Data
--------------------------------------------------------------------
--this is sample data for the room table
INSERT INTO Room (R_name, R_capacity, R_status) VALUES
('Grand Ballroom',    300, 'Available'),
('Conference Hall A',  75, 'Under Renovation'),
('Meeting Room 101',    50, 'Occupied'),
('Auditorium',        80, 'Closed');

INSERT INTO public.room (r_name, r_capacity, r_status) VALUES
('Wellspring Hall', 350, 'Available'),
('Garden Pavilion', 120, 'Available');


--------------------------------------------------------------------
-- Inquiry Sample Data
--------------------------------------------------------------------
--this creates sample inquiry data

INSERT INTO Inquiry
  (C_id, Co_id, I_type, I_name, I_bodytext, I_priority, I_status, I_notes)
VALUES
(4, 1, 'tour', 'School group tour request',
 'We are a 4th grade class of 28 students and would like to book a guided tour in early November. Do you offer discounted rates for school groups, and how long does a typical tour last?',
 'medium', 'submitted', NULL),

(5, 2, 'spaces', 'Wedding reception venue inquiry',
 'We are planning a wedding reception for about 120 guests next June. Is the main hall available on Saturdays, and does the rental include tables, chairs, and catering access?',
 'high', 'in_progress', 'Sent pricing sheet 10/14. Waiting on client to confirm date.'),

(6, 3, 'general_info', 'Weekend hours question',
 'What are your hours on Sundays, and is parking free for visitors?',
 'low', 'completed', 'Answered by email. No follow-up needed.'),

(7, 4, 'donation', 'Large donation offer',
 'I would like to donate a collection of vintage photographs from my late grandfather. Who can I speak with about how to arrange this?',
 'urgent', 'needs_followup', 'Client prefers phone contact. Left voicemail 10/16.'),

(8, 5, 'tour', 'Accessible tour for wheelchair user',
 'My mother uses a wheelchair. Are your tours fully accessible, and can we request a quieter time slot?',
 'high', 'in_progress', NULL),

(4, 2, 'spaces', 'Conference room booking',
 'Our nonprofit needs a meeting room for 15 people every first Tuesday of the month. Do you offer recurring bookings?',
 'medium', 'declined', 'Recurring bookings not available for this room. Offered one-time options instead.'),

(5, 3, 'general_info', 'Photography policy',
 'Am I allowed to take photos inside for a personal blog? Are tripods permitted?',
 'low', 'submitted', NULL),

(6, 4, 'donation', 'Monthly giving program',
 'Do you have a monthly donation option, and are contributions tax deductible?',
 'medium', 'completed', 'Sent link to giving page and tax info.'),

(7, 5, 'tour', 'Corporate team outing tour',
 'We would like to book a private tour for a team of 20 employees on a weekday afternoon. Please send availability and pricing.',
 'medium', 'cancelled', 'Client emailed 10/12 to cancel. Company event postponed.'),

(8, 1, 'spaces', 'Birthday party space rental',
 'Is the courtyard available for a child''s birthday party on a Saturday in March? About 25 guests.',
 'low', 'needs_followup', 'Need to confirm courtyard availability with facilities.'),

(4, 5, 'general_info', 'Volunteer opportunities',
 'I am a college student looking for volunteer or internship opportunities this spring. Who should I contact?',
 'low', 'in_progress', NULL),

(5, 4, 'donation', 'In-kind equipment donation',
 'Our company is upgrading office furniture and would like to donate desks and chairs. Is this something you accept?',
 'high', 'submitted', NULL);


--------------------------------------------------------------------
-- Event Sample Data
--------------------------------------------------------------------
--this creates sample records with permutations for all meaningful variables.

INSERT INTO public.event (
    e_name, c_id, co_id, r_id, e_category, e_type,
    e_start, e_end, e_attendance, e_furniture, e_tech,
    e_catering, e_notes, e_priority, e_status, e_archived_at
) VALUES
-- PUBLIC (all 6 types)
('Public Wedding Celebration', 4, 1, 1, 'public',  'wedding', '2027-01-04 14:00-06', '2027-01-04 22:00-06', 300,
  ARRAY['tables','chairs','podium','stage','linens'], ARRAY['projector','microphone','speakers','wifi','screen'],
  'Plated dinner for 300, open bar', 'Needs ceremony arch setup', 'low', 'submitted', NULL),
('Community Birthday Bash', 5, 2, 1, 'public',  'birthday_party', '2027-01-05 13:00-06', '2027-01-05 17:00-06',  40,
  ARRAY['tables','chairs','linens'], ARRAY['speakers'],
  'Cake and finger foods', NULL, 'medium', 'in_progress', NULL),
('Quarterly All-Hands Meeting', 6, 3, 1, 'public',  'corporate', '2027-01-06 09:00-06', '2027-01-06 12:00-06', 120,
  ARRAY['chairs','podium'], ARRAY['projector','screen','microphone'],
  NULL, 'Quarterly all-hands meeting', 'high', 'scheduled', NULL),
('Neighborhood Check-In', 7, 4, 1, 'public',  'community', '2027-01-07 18:00-06', '2027-01-07 18:30-06',   2,
  ARRAY['chairs'], ARRAY['wifi'],
  NULL, NULL, 'urgent', 'declined', NULL),
('Annual Fundraiser Gala', 8, 5, 1, 'public',  'non-profit', '2027-01-08 10:00-06', '2027-01-08 16:00-06', 250,
  ARRAY['tables','chairs','stage','podium'], ARRAY['microphone','speakers','projector','screen','wifi'],
  'Boxed lunches', 'Fundraiser gala, silent auction tables', 'low', 'cancelled', '2026-10-21 15:00-05'),
('Art Exhibit Opening', 4, 1, 1, 'public',  'other', '2027-01-09 11:00-06', '2027-01-09 13:00-06',  15,
  ARRAY['linens'], ARRAY['screen'],
  NULL, 'Art exhibit opening', 'medium', 'needs_followup', NULL),

-- PRIVATE (all 6 types)
('Private Wedding Reception', 5, 2, 1, 'private', 'wedding', '2027-01-10 15:00-06', '2027-01-10 23:00-06', 180,
  ARRAY['tables','chairs','stage','linens'], ARRAY['speakers','microphone'],
  'Buffet dinner, dessert bar', NULL, 'high', 'completed', '2026-10-21 15:00-05'),
('Private Birthday Party', 6, 3, 1, 'private', 'birthday_party', '2027-01-11 12:00-06', '2027-01-11 16:00-06',  30,
  ARRAY['tables','chairs'], ARRAY['speakers','wifi'],
  'Pizza and soft drinks', NULL, 'urgent', 'submitted', NULL),
('Client Presentation Breakfast', 7, 4, 1, 'private', 'corporate', '2027-01-12 08:30-06', '2027-01-12 11:30-06',  45,
  ARRAY['tables','chairs','podium'], ARRAY['projector','screen','wifi'],
  'Coffee and pastries', 'Client presentation', 'low', 'in_progress', NULL),
('Neighborhood Talent Show', 8, 5, 1, 'private', 'community', '2027-01-13 17:00-06', '2027-01-13 20:00-06', 100,
  ARRAY['chairs','stage'], ARRAY['microphone','speakers'],
  NULL, 'Neighborhood talent show', 'medium', 'scheduled', NULL),
('Nonprofit Board Meeting', 4, 2, 1, 'private', 'non-profit', '2027-01-14 09:00-06', '2027-01-14 10:00-06',  25,
  ARRAY['tables','chairs'], ARRAY['projector'],
  NULL, 'Board meeting', 'high', 'declined', NULL),
('Retirement Dinner', 5, 3, 1, 'private', 'other', '2027-01-15 19:00-06', '2027-01-15 21:30-06',  20,
  ARRAY['linens','tables'], ARRAY['speakers'],
  'Appetizers only', 'Retirement dinner', 'urgent', 'cancelled', '2026-10-21 15:00-05'),

-- TENANT (all 6 types)
('Tenant Wedding Ceremony', 6, 4, 1, 'tenant',  'wedding', '2027-01-16 13:00-06', '2027-01-16 21:00-06', 300,
  ARRAY['tables','chairs','stage','podium'], ARRAY['microphone','speakers','wifi'],
  'Outside caterer, kitchen access needed', NULL, 'low', 'needs_followup', NULL),
('Tenant Birthday Gathering', 7, 5, 1, 'tenant',  'birthday_party', '2027-01-17 14:00-06', '2027-01-17 18:00-06',  35,
  ARRAY['tables','chairs','linens'], ARRAY['speakers','screen'],
  NULL, NULL, 'medium', 'completed', '2026-10-21 15:00-05'),
('Full-Day Training Session', 8, 1, 1, 'tenant',  'corporate', '2027-01-18 09:00-06', '2027-01-18 17:00-06',  90,
  ARRAY['tables','chairs','podium'], ARRAY['projector','screen','microphone','wifi'],
  'Working lunch', 'Full-day training session', 'high', 'submitted', NULL),
('Resident Town Hall', 4, 2, 1, 'tenant',  'community', '2027-01-19 18:00-06', '2027-01-19 20:00-06',  75,
  ARRAY['chairs','podium','stage'], ARRAY['microphone','speakers'],
  NULL, 'Resident town hall', 'urgent', 'in_progress', NULL),
('Volunteer Appreciation Event', 5, 3, 1, 'tenant',  'non-profit', '2027-01-20 10:00-06', '2027-01-20 14:00-06',  55,
  ARRAY['tables','chairs','linens'], ARRAY['wifi','projector'],
  'Donated catering', 'Volunteer appreciation event', 'low', 'scheduled', NULL),
('Small Tenant Meetup', 6, 4, 1, 'tenant',  'other', '2027-01-21 16:00-06', '2027-01-21 17:00-06',   8,
  ARRAY['chairs'], ARRAY['screen','wifi'],
  NULL, 'Needs a stage backdrop that is not on the options list', 'medium', 'declined', NULL);
