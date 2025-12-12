PCOS Lifestyle Coach – DWA Health App 
=============================================

This is a small health-themed Node.js / Express / EJS app for the
Dynamic Web Applications final lab assignment.

Theme: PCOS Lifestyle Coach
- Users can register and log in
- They can log a daily PCOS check-in (sleep, movement, mood, energy, cravings, cycle day, notes)
- There is a small recipe library with PCOS-friendly recipes and a search box
- Home page shows the last 7 check-ins if you are logged in

Tech stack
----------
- Node.js
- Express
- EJS
- MySQL (mysql2)
- express-session
- bcrypt
- dotenv

How to run locally
------------------
1. Copy .env.example to .env and adjust if necessary.
2. Create the database and tables:

   mysql -u health_app -p < create_db.sql
   mysql -u health_app -p < insert_test_data.sql

3. Install dependencies:

   npm install

4. Run the app:

   node index.js

5. Visit:
   http://localhost:8000/
   home=https://www.doc.gold.ac.uk/usr/147/
Demo login
----------
Username: gold
Password: smiths123ABC$
