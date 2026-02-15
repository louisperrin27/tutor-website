# Accessing Server from iPhone

## ✅ Quick Setup

### Step 1: Make Sure Server Listens on Network
The server is now configured to listen on all network interfaces (`0.0.0.0`), which allows access from other devices on your local network.

### Step 2: Find Your Computer's IP Address
Your computer's local IP address is: **192.168.0.133**

### Step 3: Connect iPhone to Same WiFi
- Make sure your iPhone is connected to the **same WiFi network** as your computer
- Both devices must be on the same local network

### Step 4: Access from iPhone
Open Safari on your iPhone and go to:
```
http://192.168.0.133:3000
```

---

## 🔍 If It Doesn't Work

### Check 1: Verify IP Address
Your IP might change. To find it again:

**Windows (PowerShell):**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object IPAddress
```

**Or use:**
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.x.x.x)

### Check 2: Windows Firewall
Windows Firewall might be blocking the connection:

1. Open **Windows Defender Firewall**
2. Click **"Allow an app or feature through Windows Defender Firewall"**
3. Find **Node.js** or **Node** in the list
4. Make sure both **Private** and **Public** are checked
5. If Node.js isn't listed, click **"Allow another app"** and add Node.js

**Or temporarily disable firewall for testing:**
- Go to Windows Security → Firewall & network protection
- Turn off firewall for Private network (temporarily, for testing only)

### Check 3: Restart Server
After making changes, restart your server:
1. Stop server (Ctrl+C)
2. Start again: `npm start`

### Check 4: Verify Server is Running
Make sure the server is actually running and shows:
```
Server started
port: 3000
host: 0.0.0.0
```

---

## 📱 Testing from iPhone

### Test 1: Basic Connection
1. Open Safari on iPhone
2. Go to: `http://192.168.0.133:3000`
3. You should see your website

### Test 2: Password Reset
1. Go to: `http://192.168.0.133:3000/forgot-password.html`
2. Enter your email
3. Request password reset
4. Check server logs on your computer

---

## 🔒 Security Note

**Important:** The server is now accessible from any device on your local network. This is fine for development, but:

- ✅ **Safe for:** Local network (home/office WiFi)
- ⚠️ **Not safe for:** Public WiFi (coffee shops, etc.)
- ✅ **For production:** Use a proper hosting service (Render, Fly.io, etc.)

---

## 🌐 Alternative: Use Your Computer's Hostname

Instead of IP address, you can sometimes use your computer's name:

**Find your computer name:**
```powershell
$env:COMPUTERNAME
```

Then try:
```
http://YOUR-COMPUTER-NAME.local:3000
```

This might not work on all networks, so IP address is more reliable.

---

## 📋 Quick Checklist

- [ ] Server is running (`npm start`)
- [ ] Server shows `host: 0.0.0.0` in logs
- [ ] iPhone is on same WiFi network
- [ ] Windows Firewall allows Node.js
- [ ] Try accessing: `http://192.168.0.133:3000`
- [ ] If IP changed, find new IP and update URL

---

## 🐛 Troubleshooting

### "Safari can't connect to server"
- Check iPhone is on same WiFi
- Check Windows Firewall settings
- Verify server is running
- Try IP address again (might have changed)

### "Connection timed out"
- Windows Firewall is likely blocking
- Check firewall settings (see Check 2 above)
- Try temporarily disabling firewall for testing

### "This site can't be reached"
- Server might not be running
- Check server console for errors
- Verify IP address is correct

---

**Once connected, you can test the password reset feature from your iPhone!**
