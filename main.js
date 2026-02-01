const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        icon: path.join(__dirname, 'public/favicon.ico'), // যদি আইকন থাকে
        webPreferences: {
            nodeIntegration: true
        }
    });

    // আপনার public ফোল্ডারের index.html লোড করা
    win.loadFile('public/index.html');
    
    // মেনু বার হাইড করতে চাইলে (ঐচ্ছিক)
    // win.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});