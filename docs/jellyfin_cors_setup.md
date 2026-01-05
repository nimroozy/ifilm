# Jellyfin CORS Setup Guide

## What is CORS?

CORS (Cross-Origin Resource Sharing) is a security feature that prevents websites from making requests to different domains. When you try to access your Jellyfin server from the iFilm web application, the browser blocks these requests by default for security reasons.

## Why Do I Need to Configure CORS?

The iFilm web application runs in your browser and needs to communicate with your Jellyfin server. Without proper CORS configuration, your browser will block these requests, and you'll see errors like:

- "Cannot connect to Jellyfin server"
- "CORS Error: Your Jellyfin server is blocking requests"
- "Failed to fetch"

## How to Enable CORS on Jellyfin

### Method 1: Using Jellyfin Dashboard (Recommended)

1. **Open Jellyfin Dashboard**
   - Navigate to your Jellyfin server in a web browser
   - Login as an administrator
   - Click on the menu icon (☰) in the top left
   - Select "Dashboard"

2. **Navigate to Networking Settings**
   - In the Dashboard, click on "Networking" in the left sidebar
   - Scroll down to find the "CORS" section

3. **Add Allowed Origins**
   - In the "CORS allowed origins" field, add the URL of your iFilm application
   - Example: `https://your-ifilm-domain.com`
   - If running locally: `http://localhost:3000` or `http://localhost:5173`
   - You can add multiple origins separated by commas

4. **Save Settings**
   - Click "Save" at the bottom of the page
   - Restart your Jellyfin server if prompted

### Method 2: Editing Configuration File

If you prefer to edit the configuration file directly:

1. **Locate Jellyfin Configuration**
   - Linux: `/etc/jellyfin/network.xml`
   - Windows: `C:\ProgramData\Jellyfin\Server\config\network.xml`
   - Docker: Inside the container at `/config/network.xml`

2. **Edit the Configuration**
   Add or modify the `<RemoteIPFilter>` section:
   ```xml
   <NetworkConfiguration>
     <EnableRemoteAccess>true</EnableRemoteAccess>
     <RemoteIPFilter>
       <AllowedOrigins>
         <string>https://your-ifilm-domain.com</string>
         <string>http://localhost:3000</string>
       </AllowedOrigins>
     </RemoteIPFilter>
   </NetworkConfiguration>
   ```

3. **Restart Jellyfin**
   - Linux: `sudo systemctl restart jellyfin`
   - Windows: Restart the Jellyfin service from Services
   - Docker: `docker restart jellyfin`

## Security Considerations

### Important Security Notes:

1. **Don't Use Wildcards in Production**
   - Avoid using `*` as an allowed origin in production
   - This allows any website to access your Jellyfin server
   - Only use specific domains you trust

2. **Use HTTPS**
   - Always use HTTPS for your Jellyfin server in production
   - HTTP should only be used for local development

3. **Restrict Access**
   - Only add the domains that need access to your Jellyfin server
   - Remove any unused allowed origins

## Alternative Solutions

### Option 1: Backend Proxy (Recommended for Production)

Instead of allowing direct browser access to Jellyfin, use a backend proxy:

1. Set up a backend server (Node.js, Python, etc.)
2. The backend server communicates with Jellyfin
3. Your frontend communicates with your backend
4. This avoids CORS issues entirely and is more secure

**Advantages:**
- No CORS configuration needed
- Better security (API keys not exposed in browser)
- Can add additional authentication/authorization
- Can cache responses for better performance

### Option 2: Reverse Proxy

Use a reverse proxy like Nginx or Apache:

1. Configure the reverse proxy to serve both your frontend and proxy requests to Jellyfin
2. Since everything is on the same domain, CORS is not an issue

**Example Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
    }

    # Jellyfin API
    location /jellyfin/ {
        proxy_pass http://localhost:8096/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Still Getting CORS Errors?

1. **Clear Browser Cache**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
   - Or clear browser cache completely

2. **Check Browser Console**
   - Open Developer Tools (F12)
   - Look at the Console tab for detailed error messages
   - Check the Network tab to see the actual requests

3. **Verify Jellyfin Restart**
   - Make sure Jellyfin was properly restarted after configuration changes
   - Check Jellyfin logs for any errors

4. **Test with curl**
   ```bash
   curl -H "Origin: http://your-domain.com" \
        -H "X-Emby-Token: your-api-key" \
        http://your-jellyfin-server:8096/System/Info
   ```

5. **Check Firewall**
   - Ensure your firewall allows connections to Jellyfin
   - Port 8096 should be open (or your custom port)

### Connection Refused?

- Verify Jellyfin is running: `systemctl status jellyfin` (Linux)
- Check if the port is correct (default: 8096)
- Ensure the server URL is accessible from your browser

### Invalid API Key?

- Generate a new API key in Jellyfin Dashboard → API Keys
- Make sure you copied the entire key
- Check for extra spaces or characters

## Testing Your Configuration

After configuring CORS, test the connection:

1. Go to iFilm Admin Panel → Jellyfin Settings
2. Enter your server URL and API key
3. Click "Test Connection"
4. You should see "Successfully connected to Jellyfin server"

If successful, you can now browse movies and series from your Jellyfin library!

## Need Help?

If you're still experiencing issues:

1. Check Jellyfin logs: Dashboard → Logs
2. Check browser console for error messages
3. Verify your network configuration
4. Consider using a backend proxy for better security and reliability

## References

- [Jellyfin Documentation](https://jellyfin.org/docs/)
- [Jellyfin Networking Guide](https://jellyfin.org/docs/general/networking/)
- [CORS Explained (MDN)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)