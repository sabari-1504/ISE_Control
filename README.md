# VR Controller Studio & Firebase Remote

Interactive web control interface for Firebase Realtime Database:
- **Firebase Database:** `https://easy-ise-default-rtdb.firebaseio.com/`
- **Subgroup `vendorControl`:**
  - `yes`: Toggle or set to `"yes"` (from `"no"`)
  - `choice`: Selected controller input
- **Subgroup `alphabetControl`:**
  - `currentLetter`: Selected letter input (`A`, `B`, `C`, `D`)

---

## Features
- **Primary Action (YES):** Changes the Firebase state of `vendorControl/yes` from `"no"` to `"yes"`.
- **4 Controller Buttons (A, B, C, D):** Real-time selection buttons with glowing active states and live database updates.
- **Auto-Reset Option:** Optional auto-reset of `yes` back to `"no"` after 3 seconds for automated VR testing cycles.
- **Keyboard Shortcuts:**
  - `Y` or `Enter`: Set state to **YES**
  - `N`: Reset state to **NO**
  - `Space`: Toggle state between **YES** and **NO**
  - `A`, `B`, `C`, `D`: Trigger respective alphabet buttons
- **Live Database Inspector:** Real-time Server-Sent Events (SSE) stream showing live JSON updates directly from Firebase.
- **Tactile Audio Feedback:** Built-in Web Audio API synthesizer clicks and success sounds (with mute toggle).
- **Zero Config Netlify Deployment:** Includes `netlify.toml` for 1-click deployment.

---

## Local Development

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build
```

---

## Netlify Deployment

1. Connect your repository `https://github.com/sabari-1504/ISE_Control` to [Netlify](https://app.netlify.com/).
2. Netlify will automatically detect `netlify.toml`:
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
3. Click **Deploy Site**!
