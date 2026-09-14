const fs = require("node:fs");
const path = require("node:path");

const SESSION_FILE_NAME = "session.json";
const REQUIRED_FIELDS = ["jsessionid", "schoolname", "tenantId"];

function loadSession(storeDir) {
  const filePath = path.join(storeDir, SESSION_FILE_NAME);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return {
      jsessionid: typeof data.jsessionid === "string" ? data.jsessionid : null,
      schoolname: typeof data.schoolname === "string" ? data.schoolname : null,
      tenantId: typeof data.tenantId === "string" ? data.tenantId : null,
    };
  } catch (error) {
    return { jsessionid: null, schoolname: null, tenantId: null };
  }
}

function saveSession(storeDir, session) {
  const trimmed = {};
  for (const field of REQUIRED_FIELDS) {
    const value = session ? session[field] : undefined;
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`Invalid session: ${field} is required`);
    }
    trimmed[field] = value.trim();
  }

  fs.mkdirSync(storeDir, { recursive: true });
  const filePath = path.join(storeDir, SESSION_FILE_NAME);
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      { ...trimmed, updatedAt: new Date().toISOString() },
      null,
      2
    )
  );
}

module.exports = { loadSession, saveSession };
