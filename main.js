const { app, BrowserWindow, ipcMain } = require("electron/main");
const path = require("node:path");
const { fetchSchedule, SessionExpiredError } = require("./src/index");
const { loadSession, saveSession } = require("./src/sessionStore");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("index.html");
};
app.whenReady().then(() => {
  const sessionStoreDir = app.getPath("userData");

  ipcMain.handle("ping", () => "pong");
  ipcMain.handle("fetch-schedule", async () => {
    try {
      const session = loadSession(sessionStoreDir);
      return await fetchSchedule({ session });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        throw new Error("SESSION_EXPIRED");
      }
      throw error;
    }
  });

  ipcMain.handle("save-session", async (event, newSession) => {
    saveSession(sessionStoreDir, newSession);
    return true;
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
