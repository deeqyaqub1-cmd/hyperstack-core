// ══════════════════════════════════════════════════════════════
// OAUTH DEVICE FLOW — Add these actions to your existing auth.js
// 
// This implements OAuth 2.0 Device Authorization Grant (RFC 8628)
// Perfect for CLI/VPS/headless environments where users can't 
// do browser redirects. User runs `npx hyperstack-core login`,
// gets a URL + code, opens browser, approves, CLI gets token.
//
// HOW TO ADD: Paste these handlers into your existing auth.js
// before the final `return error(res, "Method not allowed", 405);`
// ══════════════════════════════════════════════════════════════

// In-memory store for device codes (use Redis in production if needed)
// Vercel serverless: this works because polling hits same instance within TTL
const deviceCodes = new Map();

// Clean expired codes every 5 min
if (typeof setInterval !== "undefined") {
  setInterval(function () {
    var now = Date.now();
    for (var entry of deviceCodes) {
      if (now > entry[1].expiresAt) deviceCodes.delete(entry[0]);
    }
  }, 300000);
}

function generateCode(len) {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1 for readability
  var code = "";
  var crypto = require("crypto");
  var bytes = crypto.randomBytes(len);
  for (var i = 0; i < len; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ── POST /api/auth?action=device-code ──
// CLI calls this to start the flow. Returns a user_code + device_code.
// Response: { device_code, user_code, verification_uri, expires_in, interval }
//
// Usage from CLI:
//   const res = await fetch(BASE + "/api/auth?action=device-code", { method: "POST" });
//   const { user_code, verification_uri } = await res.json();
//   console.log(`Open ${verification_uri} and enter code: ${user_code}`);

/*--- ACTION: device-code ---*/
  if (req.method === "POST" && req.query.action === "device-code") {
    var crypto = require("crypto");
    var deviceCode = crypto.randomBytes(32).toString("hex");
    var userCode = generateCode(4) + "-" + generateCode(4); // e.g. "ABCD-EF23"

    deviceCodes.set(deviceCode, {
      userCode: userCode,
      status: "pending", // pending | approved | denied
      userId: null,
      apiKey: null,
      expiresAt: Date.now() + 600000, // 10 minutes
      createdAt: Date.now(),
    });

    // Also index by user_code for the approval page
    deviceCodes.set("uc:" + userCode, deviceCode);

    return json(res, {
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: "https://cascadeai.dev/hyperstack/device",
      verification_uri_complete: "https://cascadeai.dev/hyperstack/device?code=" + userCode,
      expires_in: 600,
      interval: 5,
    });
  }

// ── POST /api/auth?action=device-approve ──
// Browser calls this after user logs in and enters the user_code.
// Requires JWT auth (user must be logged in on the website).
// Links the device_code to the user's account.
//
// Body: { user_code: "ABCD-EF23" }

/*--- ACTION: device-approve ---*/
  if (req.method === "POST" && req.query.action === "device-approve") {
    var user = await authenticate(req);
    if (!user) return error(res, "Login required to approve device", 401);

    var userCode = (req.body.user_code || "").trim().toUpperCase();
    if (!userCode) return error(res, "user_code required");

    var deviceCode = deviceCodes.get("uc:" + userCode);
    if (!deviceCode) return error(res, "Invalid or expired code", 404);

    var entry = deviceCodes.get(deviceCode);
    if (!entry || Date.now() > entry.expiresAt) {
      return error(res, "Code expired", 410);
    }
    if (entry.status !== "pending") {
      return error(res, "Code already used", 409);
    }

    // Approve: link to user's API key
    entry.status = "approved";
    entry.userId = user.id;
    entry.apiKey = user.apiKey;

    return json(res, {
      message: "Device approved",
      user_code: userCode,
    });
  }

// ── POST /api/auth?action=device-deny ──
// User explicitly denies the device code.
// Body: { user_code: "ABCD-EF23" }

/*--- ACTION: device-deny ---*/
  if (req.method === "POST" && req.query.action === "device-deny") {
    var user = await authenticate(req);
    if (!user) return error(res, "Login required", 401);

    var userCode = (req.body.user_code || "").trim().toUpperCase();
    var deviceCode = deviceCodes.get("uc:" + userCode);
    if (deviceCode) {
      var entry = deviceCodes.get(deviceCode);
      if (entry) entry.status = "denied";
    }

    return json(res, { message: "Device denied" });
  }

// ── POST /api/auth?action=device-token ──
// CLI polls this every 5 seconds until approved/denied/expired.
// Body: { device_code: "..." }
// Returns: 
//   Pending:  { error: "authorization_pending" } (HTTP 428)
//   Approved: { api_key, workspace, plan, user } (HTTP 200)
//   Denied:   { error: "access_denied" } (HTTP 403)
//   Expired:  { error: "expired_token" } (HTTP 410)

/*--- ACTION: device-token ---*/
  if (req.method === "POST" && req.query.action === "device-token") {
    var deviceCode = req.body.device_code || "";
    if (!deviceCode) return error(res, "device_code required");

    var entry = deviceCodes.get(deviceCode);
    if (!entry) return error(res, "expired_token", 410);

    if (Date.now() > entry.expiresAt) {
      deviceCodes.delete(deviceCode);
      return error(res, "expired_token", 410);
    }

    if (entry.status === "denied") {
      deviceCodes.delete(deviceCode);
      deviceCodes.delete("uc:" + entry.userCode);
      return error(res, "access_denied", 403);
    }

    if (entry.status === "pending") {
      return res.status(428).json({ error: "authorization_pending" });
    }

    if (entry.status === "approved") {
      // Fetch full user to get workspace info
      var approvedUser = await prisma.user.findUnique({ where: { id: entry.userId } });
      var workspaces = await prisma.workspaceMember.findMany({
        where: { userId: entry.userId },
        include: { workspace: true },
      });

      // Clean up
      deviceCodes.delete(deviceCode);
      deviceCodes.delete("uc:" + entry.userCode);

      return json(res, {
        api_key: entry.apiKey,
        user: {
          id: approvedUser.id,
          email: approvedUser.email,
          name: approvedUser.name,
          plan: approvedUser.plan,
        },
        workspaces: workspaces.map(function (wm) {
          return { slug: wm.workspace.slug, name: wm.workspace.name, role: wm.role };
        }),
      });
    }

    return error(res, "Unknown state", 500);
  }
