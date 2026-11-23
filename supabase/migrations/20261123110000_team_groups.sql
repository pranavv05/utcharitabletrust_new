-- Our team page: people are grouped as on the old member page (Trustees, Advisory Board, Our Mentors and
-- Working Body). This gives every existing team entry its group and role, corrects three names and three
-- photographs, adds Dr. Laxman Rohit (missing) and removes two exact duplicate entries.
-- Entries an administrator has already edited are left alone: a row is only renamed or re-photographed while
-- it still has its original seeded name / photograph, and a role is only replaced while it is "Trust member".
BEGIN;

WITH v(slug,old_name,old_image,new_name,new_role,grp,new_image,pos) AS (VALUES
  ('person-1','Mr. Pradip Mishra','/images/team/team-v1-1.webp','Mr. Pradip Mishra','Chairman','trustee','/images/team/team-v1-1.webp',0),
  ('person-2','Adv. Prakashchandra N. Patel','/images/team/team-v1-2.webp','Adv. Prakashchandra N. Patel','Trustee','trustee','/images/team/team-v1-2.webp',1),
  ('person-3','Mrs. Rupa Mishra','/images/team/team-v1-5.webp','Mrs. Rupa Mishra','Trustee','trustee','/images/team/team-v1-5.webp',2),
  ('person-4','Mr. Chandan Kumar Mishra','/images/team/team-v1-3.webp','Mr. Chandan Kumar Mishra','Trustee','trustee','/images/team/team-v1-3.webp',3),
  ('person-5','Mr. Anand Kumar Jha','/images/team/team-v1-4.webp','Mr. Anand Kumar Jha','Trustee','trustee','/images/team/team-v1-4.webp',4),
  ('person-6','Mr. Navindra Mishra','/images/team/navindra_mishra.webp','Mr. Navindra Mishra','Trustee','trustee','/images/team/navindra_mishra.webp',5),
  ('person-7','Dr.K.S. Chandrashekhar','/images/team/chandras.webp','Dr.K.S. Chandrashekhar','Advisory Board Chairman','advisory','/images/team/chandras.webp',6),
  ('person-8','Mr. Nagendra Singh','/images/team/nagendra_mishra.webp','Mr. Nagendra Singh','Advisory Board member','advisory','/images/team/nagendra_mishra.webp',7),
  ('person-9','Mrs. Pinky Khimani','/images/team/pinky_khimani.webp','Mrs. Pinky Khimani','Advisory Board member','advisory','/images/team/pinky_khimani.webp',8),
  ('person-10','Mr. Surya Prakash Agarwal','/images/team/surya_prakash.webp','Mr. Surya Prakash Agarwal','Advisory Board member','advisory','/images/team/surya_prakash.webp',9),
  ('person-11','Mr. Sanjeev Bhuwalka','/images/team/sanjeev.webp','Mr. Sanjeev Bhuwalka','Advisory Board member','advisory','/images/team/sanjeev.webp',10),
  ('person-12','Mr. Anil Dixit','/images/team/anil_dixit.webp','Mr. Anil Dixit','Advisory Board member','advisory','/images/team/anil_dixit.webp',11),
  ('person-13','Mr. Dilip Barnwal','/images/team/dilip_barnwal.webp','Mr. Dilip Barnwal','Mentor','mentor','/images/team/dilip_barnwal.webp',12),
  ('person-14','Mr. Durgesh Rajpurohit','/images/team/blank.webp','Mr. Durgesh Rajpurohit','Mentor','mentor','/images/team/durgesh.webp',13),
  ('person-15','Mr. Kapil Kanodiya','/images/team/blank.webp','Mr. Kapil Kanodiya','Mentor','mentor','/images/team/blank.webp',14),
  ('person-16','Dr. G L Patel','/images/team/G_L_patel.webp','Dr. G L Chaudhary','Mentor','mentor','/images/team/G_L_patel.webp',16),
  ('person-17','Mr. Sanjay Singh','/images/team/sanjay_singh.webp','Mr. Sanjay Singh','Mentor','mentor','/images/team/sanjay_singh.webp',17),
  ('person-18','Ms. Rashmi Nair','/images/team/rashmi.webp','Ms. Rashmi Nair','Mentor','mentor','/images/team/rashmi.webp',18),
  ('person-19','Mr. Rajeev Ranjan','/images/team/rajjev_ranjan.webp','Mr. Rajeev Ranjan','Mentor','mentor','/images/team/rajjev_ranjan.webp',19),
  ('person-20','Dr. Rajesh Shah','/images/team/blank.webp','Dr. Rajesh Shah','Mentor','mentor','/images/team/blank.webp',20),
  ('person-21','Mr. Mohan K.S','/images/team/blank.webp','Mr. Mohan K.S','Mentor','mentor','/images/team/Mohan_k.s.webp',21),
  ('person-22','Mr. Priyank Singh Parmar','/images/team/blank.webp','Mr. Priyanksinh I Parmar','Mentor','mentor','/images/team/priyanksingh.webp',22),
  ('person-23','Mr. Dhiraj Kumar Singh','/images/team/dhiraj.webp','Mr. Dhiraj Kumar Singh','President','working','/images/team/dhiraj.webp',23),
  ('person-24','Mr. Jagdish Singh Kang','/images/team/jagdish.webp','Mr. Jagdish Singh Kang','Raktveer President','working','/images/team/jagdish.webp',24),
  ('person-25','Ms. Prabha Kathiria','/images/team/prabha.webp','Ms. Prabha Kathiria','Narishakti President','working','/images/team/prabha.webp',25),
  ('person-26','Mr. Bipin Tiwari','/images/team/bipin_tiwari.webp','Mr. Bipin Tiwari','Working Body member','working','/images/team/bipin_tiwari.webp',26),
  ('person-27','Mr. Ravi Shankar Pandey','/images/team/team-v1-10.webp','Mr. Ravi Shankar Pandey','Working Body member','working','/images/team/team-v1-10.webp',27),
  ('person-28','Mr. Rahul Shah','/images/team/rahul_shah.webp','Mr. Rahul Shah','Working Body member','working','/images/team/rahul_shah.webp',28),
  ('person-29','Mr. Jatin Mistry','/images/team/jatin_mistry.webp','Mr. Jatin Mistry','Working Body member','working','/images/team/jatin_mistry.webp',29),
  ('person-30','Mr. Biswaranjan Muderla','/images/team/bhiswaranjan.webp','Mr. Biswaranjan Muderla','Working Body member','working','/images/team/bhiswaranjan.webp',30),
  ('person-31','Mr. Dilip Pusti','/images/team/team-v1-14.webp','Mr. Dilip Pusti','Working Body member','working','/images/team/team-v1-14.webp',31),
  ('person-32','Mr. Kumarkant Jha','/images/team/kumar_kanat.webp','Mr. Kumarkant Jha','Working Body member','working','/images/team/kumar_kanat.webp',32),
  ('person-33','Mr. Ram Raksha Sonkar','/images/team/ram_sonar.webp','Mr. Ram Raksha Sonkar','Working Body member','working','/images/team/ram_sonar.webp',33),
  ('person-34','Mr. Pankaj Jha','/images/team/team-v1-7.webp','Mr. Pankaj Jha','Working Body member','working','/images/team/team-v1-7.webp',34),
  ('person-35','Mr. Sudhir Jha','/images/team/sudhir_jha.webp','Mr. Sudhir Jha','Working Body member','working','/images/team/sudhir_jha.webp',35),
  ('person-36','Mr. Sadik Meghani','/images/team/team-v1-8.webp','Mr. Sadik Meghani','Working Body member','working','/images/team/team-v1-8.webp',36),
  ('person-37','Mr. Biswanath Mishra','/images/team/blank.webp','Mr. Biswanath Mishra','Working Body member','working','/images/team/blank.webp',37),
  ('person-38','Mr. Gopal Agarwal','/images/team/gopal.webp','Mr. Gopal Agarwal','Working Body member','working','/images/team/gopal.webp',38),
  ('person-39','Mr. Murlidhar Mali','/images/team/murlidhar.webp','Mr. Murlidhar Mali','Working Body member','working','/images/team/murlidhar.webp',39),
  ('person-40','Mr. Dinkar Dubey','/images/team/dinkar.webp','Mr. Dinkar Dubey','Working Body member','working','/images/team/dinkar.webp',40),
  ('person-41','Mr. Manthan Bhanushali','/images/team/mathan_bhanushali.webp','Mr. Manthan Bhanushali','Working Body member','working','/images/team/mathan_bhanushali.webp',41),
  ('person-42','Mr. Pyarelal Sinsinwar','/images/team/blank.webp','Mr. Pyarelal Sinsinwar','Working Body member','working','/images/team/blank.webp',42),
  ('person-43','Mr. Munna Lal Shah','/images/team/munna_lal.webp','Mr. Munna Lal Shah','Working Body member','working','/images/team/munna_lal.webp',43),
  ('person-45','Mr. Prem Prakash Patel','/images/team/prem.webp','Mr. Prem Prakash Singh','Working Body member','working','/images/team/prem.webp',44)
)
UPDATE trust_admin.site_content c SET
  name=CASE WHEN c.name=v.old_name THEN v.new_name ELSE c.name END,
  data=c.data
    || jsonb_build_object('group',coalesce(nullif(c.data->>'group',''),v.grp))
    || jsonb_build_object('role',CASE WHEN coalesce(c.data->>'role','') IN ('','Trust member') THEN v.new_role ELSE c.data->>'role' END)
    || jsonb_build_object('image',CASE WHEN c.data->>'image'=v.old_image THEN v.new_image ELSE c.data->>'image' END),
  sort_order=CASE WHEN c.name=v.old_name THEN v.pos ELSE c.sort_order END,
  updated_at=now()
FROM v WHERE c.kind='team' AND c.slug=v.slug;

-- Exact duplicates of people who are already listed.
DELETE FROM trust_admin.site_content
 WHERE kind='team' AND ((slug='person-44' AND name='Mr. Dinkar Dubey') OR (slug='person-46' AND name='Mr. Rahul Shah'));

-- Dr. Laxman Rohit is on the member page but was missing from the website.
INSERT INTO trust_admin.site_content(kind,slug,name,data,status,sort_order)
VALUES('team','person-47','Dr. Laxman Rohit','{"image": "/images/team/lakshman_rohit.webp", "role": "Mentor", "group": "mentor"}','published',15)
ON CONFLICT(kind,slug) DO NOTHING;

NOTIFY pgrst,'reload schema';
COMMIT;
