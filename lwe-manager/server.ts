import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

function getFirebaseConfig() {
  try {
    const filePath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e: any) {
    console.error("[SERVER] Failed to read firebase-applet-config.json:", e.message);
  }
  return { projectId: "lwemanager-75ee0", apiKey: "" };
}

async function writeToFirestoreREST(docId: string, data: any) {
  const config = getFirebaseConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/passwordResets/${encodeURIComponent(docId)}?key=${config.apiKey}`;

  const fields: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    fields[key] = { stringValue: String(value) };
  }

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: fields
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[SERVER REST] Firestore write failed:", errText);
    } else {
      console.log("[SERVER REST] Firestore write succeeded for reset document:", docId);
    }
  } catch (err: any) {
    console.error("[SERVER REST] Firestore fetch write failed:", err.message);
  }
}

async function readFromFirestoreREST(docId: string) {
  const config = getFirebaseConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/passwordResets/${encodeURIComponent(docId)}?key=${config.apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json && json.fields) {
      const result: any = {};
      for (const [key, valObj] of Object.entries(json.fields)) {
        if (valObj && typeof valObj === 'object' && 'stringValue' in (valObj as any)) {
          result[key] = (valObj as any).stringValue;
        }
      }
      return result;
    }
  } catch (err: any) {
    console.error("[SERVER REST] Firestore fetch read failed:", err.message);
  }
  return null;
}

async function verifyIdTokenREST(token: string) {
  const config = getFirebaseConfig();
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[SERVER REST] Token verification via REST failed:", errText);
      return null;
    }
    const data = await res.json();
    if (data && data.users && data.users[0]) {
      const user = data.users[0];
      return {
        uid: user.localId,
        email: user.email,
        email_verified: user.emailVerified
      };
    }
  } catch (err: any) {
    console.error("[SERVER REST] verifyIdTokenREST error:", err.message);
  }
  return null;
}

async function readUserDocREST(uid: string) {
  const config = getFirebaseConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/users/${encodeURIComponent(uid)}?key=${config.apiKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const json = await res.json();
    if (json && json.fields) {
      const result: any = {};
      for (const [key, valObj] of Object.entries(json.fields)) {
        if (valObj && typeof valObj === 'object') {
          const vObj = valObj as any;
          if ('stringValue' in vObj) {
            result[key] = vObj.stringValue;
          } else if ('booleanValue' in vObj) {
            result[key] = vObj.booleanValue;
          }
        }
      }
      return result;
    }
  } catch (err: any) {
    console.error("[SERVER REST] Failed to read user doc via REST:", err.message);
  }
  return null;
}

// Initialize Firebase Admin SDK
try {
  const saPath = path.join(process.cwd(), "firebase-service-account.json");
  if (fs.existsSync(saPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: "lwemanager-75ee0"
    });
    console.log("[SERVER] Firebase Admin SDK initialized successfully using Service Account key file");
  } else {
    initializeApp({
      projectId: "lwemanager-75ee0"
    });
    console.log("[SERVER] Firebase Admin SDK initialized using default application credentials");
  }
} catch (e: any) {
  console.error("[SERVER] Failed to initialize Firebase Admin SDK:", e.message);
}

// In-memory password resets store
interface PasswordReset {
  email: string;
  otp: string;
  oobCode?: string;
  status: 'pending' | 'verified';
  createdAt: string;
  newPassword?: string;
  verifiedAt?: string;
}

const resetsStore = new Map<string, PasswordReset>();

async function startServer() {
  const app = reportMemoryAndCreateApp();
  const PORT = 3000;

  function reportMemoryAndCreateApp() {
    return express();
  }

  app.use(express.json());

  // API routes FIRST
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
      }

      // Ensure Firebase Service Account is configured
      const saPath = path.join(process.cwd(), "firebase-service-account.json");
      if (!fs.existsSync(saPath)) {
        console.warn("[SERVER] Firebase Admin service credentials file is missing.");
        return res.status(500).json({
          error: "The custom password reset system is currently unconfigured. Please contact an Administrator to upload the firebase-service-account.json file in the Admin Settings panel."
        });
      }

      console.log(`[SERVER] Generating forgot password reset request for ${email}`);

      // Verify that the user exists in Firebase Authentication by checking Firestore first,
      // and falling back to createAuthUri public REST API to avoid the restricted Admin SDK getUserByEmail endpoint.
      let userExists = false;
      try {
        const dbAdmin = getFirestore();
        const usersQuery = await dbAdmin.collection("users").where("email", "==", email.toLowerCase().trim()).get();
        if (!usersQuery.empty) {
          userExists = true;
        }
      } catch (fsErr: any) {
        console.error("[SERVER] Failed to query Firestore users collection:", fsErr.message);
      }

      if (!userExists) {
        try {
          const config = getFirebaseConfig();
          const authUriRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${config.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              identifier: email.toLowerCase().trim(),
              continueUri: req.get('origin') || "http://localhost"
            })
          });
          const authUriData = await authUriRes.json().catch(() => ({}));
          if (authUriRes.ok && authUriData.registered) {
            userExists = true;
          }
        } catch (apiErr: any) {
          console.error("[SERVER] Failed to query Firebase Auth REST API createAuthUri:", apiErr.message);
        }
      }

      if (!userExists) {
        console.log(`[SERVER] User not found for email: ${email}`);
        return res.status(404).json({ error: "No player account found with this email address." });
      }

      console.log(`[SERVER] User existence verified for ${email}. Sending OTP via Resend.`);

      const origin = req.get('origin') || "https://ais-dev-v3hiqu3vjvug3dotliopvu-964913235776.asia-southeast1.run.app";
      const resetLink = `${origin}/login?resetEmail=${encodeURIComponent(email.toLowerCase().trim())}&otp=${otp}`;

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": "Bearer re_YM722NqP_FwTPYk7RLgwSnf3GyZLEnsae",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: email.toLowerCase().trim(),
          subject: "LWE Password Reset Verification OTP & Reset Link",
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; background-color: #090514; color: #ffffff; border: 1px solid rgba(147, 51, 234, 0.3); border-radius: 16px; box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);">
              <h2 style="color: #a855f7; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 12px; font-size: 22px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700; margin-top: 0;">LWE Command Center</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #d1d5db;">You requested a password reset for your LWE account. Please use one of the following secure options to complete your reset:</p>
              
              <!-- Option 1: Direct Link -->
              <div style="text-align: center; margin: 25px 0;">
                <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 12px 30px; font-size: 14px; font-weight: bold; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4); border: 1px solid rgba(255, 255, 255, 0.15);">RESET PASSWORD NOW</a>
              </div>
              
              <!-- Option 2: 6-Digit OTP -->
              <p style="font-size: 13px; color: #9ca3af; text-align: center; margin-top: 20px;">Or enter this secure 6-digit OTP code on the verification screen:</p>
              <div style="background-color: #050507; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 15px; margin: 15px 0; text-align: center;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #c084fc; font-family: monospace;">${otp}</span>
              </div>
              
              <p style="font-size: 12px; color: #9ca3af; line-height: 1.5; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 15px;">This OTP and reset link are valid for 15 minutes. If you did not initiate this request, please change your password immediately or contact LWE support.</p>
              <div style="margin-top: 25px; font-size: 11px; color: #6b7280; text-align: center;">
                LWE Gaming Esports Community Hub
              </div>
            </div>
          `
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("[SERVER] Resend API failed:", resData);
        return res.status(response.status).json({ error: resData.message || "Failed to send email via Resend" });
      }

      // Save in server-side memory store
      resetsStore.set(email.toLowerCase().trim(), {
        email: email.toLowerCase().trim(),
        otp: otp,
        status: 'pending',
        createdAt: new Date().toISOString()
      });

      // Write to Firestore REST as fallback
      try {
        await writeToFirestoreREST(email.toLowerCase().trim(), {
          email: email.toLowerCase().trim(),
          otp: otp,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } catch (fErr) {
        console.warn("[SERVER] Failed to write fallback to Firestore REST:", fErr);
      }

      console.log(`[SERVER] Resend API successful:`, resData);
      return res.json({ success: true, message: "Verification code and direct reset link sent successfully via Resend!" });
    } catch (error: any) {
      console.error("[SERVER] Forgot password API error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Verify OTP endpoint
  app.post("/api/verify-otp", async (req, res) => {
    try {
      const { email, otp, newPassword } = req.body;
      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
      }

      // Ensure Firebase Service Account is configured
      const saPath = path.join(process.cwd(), "firebase-service-account.json");
      if (!fs.existsSync(saPath)) {
        return res.status(500).json({
          error: "The custom password reset system is currently unconfigured. Please contact an Administrator to upload the firebase-service-account.json file in the Admin Settings panel."
        });
      }

      const key = email.toLowerCase().trim();
      let otpCode: string | null = null;
      let record = resetsStore.get(key);

      if (record) {
        otpCode = record.otp;
      } else {
        // Fallback: check Firestore REST API
        try {
          const data = await readFromFirestoreREST(key);
          if (data) {
            otpCode = data.otp;
          }
        } catch (dbErr: any) {
          console.warn("[SERVER] Failed to read from Firestore REST:", dbErr.message);
        }
      }

      if (!otpCode) {
        return res.status(404).json({ error: "No active password reset request found for this email address." });
      }

      if (otpCode.trim() !== otp.trim()) {
        return res.status(400).json({ error: "Invalid 6-digit verification code. Please check and try again." });
      }

      // If newPassword is provided, finalize password reset safely!
      if (newPassword) {
        if (newPassword.length < 6) {
          return res.status(400).json({ error: "The new password must be at least 6 characters." });
        }

        // Get the UID from Firestore users collection
        let uid: string | null = null;
        try {
          const dbAdmin = getFirestore();
          const usersRef = dbAdmin.collection("users");
          const querySnapshot = await usersRef.where("email", "==", key).limit(1).get();
          if (!querySnapshot.empty) {
            uid = querySnapshot.docs[0].id;
          }
        } catch (dbErr: any) {
          console.error("[SERVER] Failed to lookup UID in Firestore:", dbErr.message);
        }

        // Fallback to fetch UID via createAuthUri if not found in Firestore
        if (!uid) {
          try {
            const config = getFirebaseConfig();
            const authUriRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${config.apiKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                identifier: key,
                continueUri: req.get('origin') || "http://localhost"
              })
            });
            const authUriData = await authUriRes.json().catch(() => ({}));
            // Note: createAuthUri doesn't return UID directly, but if we can't find UID, we can try using the email as a dummy UID or return error
            // However, in our app every user has a Firestore record. If they don't, we will return error.
          } catch (apiErr: any) {
            console.error("[SERVER] Fallback UID search error:", apiErr.message);
          }
        }

        if (!uid) {
          return res.status(404).json({ error: "No matching player account found to reset password." });
        }

        try {
          // 1. Create custom token locally (completely offline, requires no Google Cloud API enablement)
          const customToken = await getAuth().createCustomToken(uid);
          
          // 2. Exchange custom token for an ID Token using Firebase Auth public REST API
          const config = getFirebaseConfig();
          const signInRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${config.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: customToken,
              returnSecureToken: true
            })
          });

          const signInData = await signInRes.json().catch(() => ({}));
          if (!signInRes.ok) {
            console.error("[SERVER] Failed to exchange custom token for ID token:", signInData);
            return res.status(500).json({ error: "Authentication session exchange failed: " + (signInData.error?.message || "Unknown error") });
          }

          const idToken = signInData.idToken;

          // 3. Update the password via the standard public accounts:update REST API using the ID Token
          const updateRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${config.apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idToken: idToken,
              password: newPassword,
              returnSecureToken: true
            })
          });

          const updateData = await updateRes.json().catch(() => ({}));
          if (!updateRes.ok) {
            console.error("[SERVER] Failed to update password via Firebase REST API:", updateData);
            let errorMsg = "Failed to update your password in Firebase.";
            if (updateData.error?.message === "WEAK_PASSWORD") {
              errorMsg = "The new password is too weak. Please choose a password with at least 6 characters.";
            } else if (updateData.error?.message) {
              errorMsg = updateData.error.message;
            }
            return res.status(400).json({ error: errorMsg });
          }

          console.log(`[SERVER] Successfully updated password via Firebase REST API for user UID: ${uid} (email: ${key})`);
        } catch (err: any) {
          console.error("[SERVER] Failed to update user password:", err);
          return res.status(500).json({ error: "Failed to update your password in Firebase Authentication: " + err.message });
        }
      }

      // Mark verified in memory
      if (record) {
        record.status = 'verified';
        record.verifiedAt = new Date().toISOString();
        resetsStore.set(key, record);
      }

      // Automatically approve user status in Firestore by setting status to 'active' using Admin Firestore SDK (which is fully functional)
      try {
        const dbAdmin = getFirestore();
        const usersRef = dbAdmin.collection("users");
        const querySnapshot = await usersRef.where("email", "==", key).limit(1).get();
        if (!querySnapshot.empty) {
          const docId = querySnapshot.docs[0].id;
          await usersRef.doc(docId).update({
            status: 'active'
          });
          console.log(`[SERVER] Auto-approved user ${key} status by setting it to active in Firestore`);
        }
      } catch (dbErr: any) {
        console.warn("[SERVER] Non-blocking: failed to auto-approve status in Firestore:", dbErr.message);
      }

      // Write/update to Firestore REST API for logging/history
      try {
        await writeToFirestoreREST(key, {
          email: key,
          otp: otp,
          status: 'verified',
          createdAt: new Date().toISOString(),
          verifiedAt: new Date().toISOString()
        });
        console.log(`[SERVER] Successfully updated Firestore reset log for ${key} via REST API`);
      } catch (firestoreErr: any) {
        console.warn("[SERVER] Failed to write reset update to Firestore REST:", firestoreErr.message);
      }

      return res.json({ 
        success: true, 
        message: newPassword 
          ? "Your password has been updated successfully! You can now log in normally." 
          : "Verification successful! Code approved."
      });
    } catch (error: any) {
      console.error("[SERVER] Verify OTP API error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Admin resets endpoints
  app.get("/api/admin/resets", (req, res) => {
    const list = Array.from(resetsStore.values()).map(r => ({
      id: r.email,
      ...r
    }));
    return res.json(list);
  });

  app.delete("/api/admin/resets/:email", (req, res) => {
    const email = req.params.email.toLowerCase().trim();
    resetsStore.delete(email);
    return res.json({ success: true });
  });

  // Admin Firebase Service Account status check
  app.get("/api/admin/service-account/status", checkAdmin, (req, res) => {
    try {
      const saPath = path.join(process.cwd(), "firebase-service-account.json");
      const exists = fs.existsSync(saPath);
      let projectId = "Unknown";
      if (exists) {
        try {
          const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
          projectId = sa.project_id || "Loaded";
        } catch (e) {}
      }
      return res.json({ exists, projectId });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Admin Firebase Service Account save & SDK re-initialize
  app.post("/api/admin/service-account", checkAdmin, async (req, res) => {
    try {
      const { serviceAccountJson } = req.body;
      if (!serviceAccountJson) {
        return res.status(400).json({ error: "Service account JSON content is required" });
      }

      let parsed;
      try {
        parsed = JSON.parse(serviceAccountJson);
      } catch (err: any) {
        return res.status(400).json({ error: "Invalid JSON format: " + err.message });
      }

      if (!parsed.project_id || !parsed.private_key) {
        return res.status(400).json({ error: "Invalid Firebase Service Account JSON. Missing project_id or private_key fields." });
      }

      const saPath = path.join(process.cwd(), "firebase-service-account.json");
      fs.writeFileSync(saPath, JSON.stringify(parsed, null, 2), "utf8");

      console.log("[SERVER] Successfully saved firebase-service-account.json. Attempting Admin SDK re-initialization...");

      try {
        const apps = getApps();
        if (apps.length > 0) {
          await Promise.all(apps.map((app: any) => app?.delete()));
        }
        initializeApp({
          credential: cert(parsed),
          projectId: parsed.project_id
        });
        console.log("[SERVER] Firebase Admin SDK re-initialized successfully with updated service account!");
      } catch (reInitErr: any) {
        console.error("[SERVER] Failed to re-initialize Admin SDK:", reInitErr.message);
      }

      return res.json({ success: true, message: "Service account saved and Firebase Admin SDK re-initialized successfully!" });
    } catch (error: any) {
      console.error("[SERVER] Service account save endpoint error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // Admin middleware to verify JWT and check for admin role
  async function checkAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      let decodedToken: any = null;
      try {
        decodedToken = await getAuth().verifyIdToken(token);
      } catch (adminErr: any) {
        console.warn("[SERVER AUTH] Admin SDK verifyIdToken failed, trying REST API fallback...", adminErr.message);
        const restUser = await verifyIdTokenREST(token);
        if (restUser) {
          decodedToken = restUser;
        } else {
          throw adminErr;
        }
      }

      const email = decodedToken.email;
      const uid = decodedToken.uid;

      if (email === "chfpoint@gmail.com") {
        (req as any).user = decodedToken;
        return next();
      }

      // Check role in users collection in Firestore
      let isAdminRole = false;
      try {
        const dbAdmin = getFirestore();
        const userDoc = await dbAdmin.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data()?.role === "admin") {
          isAdminRole = true;
        }
      } catch (dbErr: any) {
        console.warn("[SERVER AUTH] Failed to check admin role using Admin Firestore SDK, trying REST API read fallback...", dbErr.message);
        const userDocRest = await readUserDocREST(uid);
        if (userDocRest && userDocRest.role === "admin") {
          isAdminRole = true;
        }
      }

      if (isAdminRole) {
        (req as any).user = decodedToken;
        return next();
      }

      return res.status(403).json({ error: "Forbidden: Admins only" });
    } catch (err: any) {
      console.error("[SERVER AUTH] Token verification failed:", err.message);
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  }

  // Admin announcement endpoints with full server privileges
  app.delete("/api/announcements/:id", checkAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const dbAdmin = getFirestore();
      await dbAdmin.collection("announcements").doc(id).delete();
      console.log(`[SERVER] Deleted announcement: ${id}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] Failed to delete announcement:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/announcements/:id", checkAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const annData = req.body;
      const dbAdmin = getFirestore();
      await dbAdmin.collection("announcements").doc(id).update(annData);
      console.log(`[SERVER] Updated announcement: ${id}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[SERVER] Failed to update announcement:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/announcements", checkAdmin, async (req, res) => {
    try {
      const annData = req.body;
      const dbAdmin = getFirestore();
      const docRef = await dbAdmin.collection("announcements").add(annData);
      console.log(`[SERVER] Added announcement: ${docRef.id}`);
      return res.json({ success: true, id: docRef.id });
    } catch (err: any) {
      console.error("[SERVER] Failed to add announcement:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
