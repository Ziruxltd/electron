const { app, BrowserWindow, ipcMain } = require("electron/main");
const path = require("node:path");
const { processUserInput } = require("./src/index");

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  win.loadFile("index.html");
};
app.whenReady().then(() => {
  ipcMain.handle("ping", () => "pong");
  ipcMain.handle("process-user-input", async (event, userValue) => {
    console.log("userValue received in main process:", userValue);
    
    try {
      return await processUserInput(userValue);
    } catch (error) {
      throw error;
    }
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
