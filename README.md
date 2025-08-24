## 🚀 Deploy on DigitalOcean (App Platform)

You can run this WhatsApp bot on **DigitalOcean App Platform** for 24/7 hosting.

---

### 1️⃣ Create a DigitalOcean Account

- Sign up at [https://www.digitalocean.com](https://www.digitalocean.com)  
- Claim your free credits if available.

---

### 2️⃣ Prepare Your GitHub Repo

- Push this project to your **GitHub** repository.  
- Ensure you have the following files at the root:
  - `package.json`
  - `index.js` (entry point)
  - `.env.example`
  - `README.md`

---

### 3️⃣ Deploy to DigitalOcean

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps).  
2. Click **Create App** → **GitHub Repository**.  
3. Select your bot’s repo.  
4. Choose **Node.js** runtime.  
5. Set **Build Command**:
   ```bash
   npm install

6. Set Run Command:

npm start


7. Deploy the app.




---

4️⃣ Configure Environment Variables

In App Settings → Environment Variables, add:

PREFIX=#
OWNER_NUMBER=2348012345678
BOT_NAME=MD Bot

(You can add more variables as needed.)


---

5️⃣ Persistent Session (Optional)

DigitalOcean restarts apps on update, which may reset WhatsApp session.
To persist sessions, mount a Volume in /app/data.


---

6️⃣ Manage Your Bot

Check Logs: App → Logs

Restart App: App → Settings → Redeploy

Update Code: Push to GitHub → Auto-Deploys

