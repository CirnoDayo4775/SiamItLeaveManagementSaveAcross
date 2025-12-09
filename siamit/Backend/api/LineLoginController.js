const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration Check (Fail fast if missing)
if (!process.env.LINE_CHANNEL_ID || !process.env.LINE_BOT_REDIRECT_URI) {
  console.error('❌ Missing LINE Login configuration in .env');
}

class LineLoginController {

  /**
   * Helper: Render HTML for popup window communication
   */
  static renderHtmlResponse(res, type, payload) {
    const isSuccess = type === 'SUCCESS';
    const messageScript = isSuccess
      ? `window.opener.postMessage({ type: 'LINE_LINK_SUCCESS', ...${JSON.stringify(payload)} }, '*');`
      : `window.opener.postMessage({ type: 'LINE_LINK_ERROR', message: '${payload.error}' }, '*');`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>LINE Linking</title>
          <style>
              body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f5f5f5; margin: 0; }
              .container { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem; }
              .error { color: #e74c3c; margin-bottom: 1rem; font-weight: bold; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
      </head>
      <body>
          <div class="container">
              ${isSuccess ? '<div class="spinner"></div><p>Processing...</p>' : `<div class="error">❌ Error</div><p>${payload.error}</p>`}
          </div>
          <script>
              if (window.opener) { ${messageScript} }
              setTimeout(() => window.close(), ${isSuccess ? 1000 : 2500});
          </script>
      </body>
      </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // Get LINE Login URL for authenticated user
  static async getLoginUrl(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'User must be logged in first' });
      }

      // Encode state
      const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
      
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.LINE_CHANNEL_ID,
        redirect_uri: process.env.LINE_BOT_REDIRECT_URI,
        state: state,
        scope: 'profile openid'
      });

      const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
      
      res.json({
        success: true,
        loginUrl: loginUrl,
        message: 'LINE Login URL generated successfully'
      });

    } catch (error) {
      console.error('Error generating LINE login URL:', error);
   res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }

  // Handle LINE Login callback
  static async handleCallback(req, res) {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: 'Missing code or state parameter' });
      }

      // Decode state
      let userId;
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        userId = stateData.userId;
      } catch (e) {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: 'Invalid state parameter' });
      }

      if (!userId) {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: 'User ID missing in state' });
      }

      // Exchange code for token
      const tokenResponse = await LineLoginController.exchangeCodeForToken(code);
      if (!tokenResponse.success) {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: tokenResponse.error });
      }

      // Get Profile
      const profileResponse = await LineLoginController.getLineProfile(tokenResponse.accessToken);
      if (!profileResponse.success) {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: profileResponse.error });
      }

      // Link User
      const linkResult = await LineLoginController.linkLineUser(userId, profileResponse.userId, profileResponse.displayName);

      if (linkResult.success) {
        return LineLoginController.renderHtmlResponse(res, 'SUCCESS', {
          lineUserId: profileResponse.userId,
          displayName: profileResponse.displayName,
          pictureUrl: profileResponse.pictureUrl
        });
      } else {
        return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: linkResult.error });
      }

    } catch (error) {
      console.error('Error handling LINE callback:', error);
      return LineLoginController.renderHtmlResponse(res, 'ERROR', { error: error.message });
    }
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(code) {
    try {
      const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.LINE_BOT_REDIRECT_URI,
          client_id: process.env.LINE_CHANNEL_ID,
          client_secret: process.env.LINE_CHANNEL_SECRET,
        }),
      });

      const data = await response.json();
      if (data.access_token) {
        return { success: true, accessToken: data.access_token, idToken: data.id_token };
      }
      return { success: false, error: 'Failed to get access token', details: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Get LINE user profile
  static async getLineProfile(accessToken) {
    try {
      const response = await fetch('https://api.line.me/v2/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const data = await response.json();
      if (data.userId) {
        return {
          success: true,
          userId: data.userId,
          displayName: data.displayName,
          pictureUrl: data.pictureUrl,
          statusMessage: data.statusMessage
        };
      }
      return { success: false, error: 'Failed to get user profile', details: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Link LINE user to database user
  static async linkLineUser(databaseUserId, lineUserId, displayName) {
    try {
      const AppDataSource = global.AppDataSource;
      if (!AppDataSource) return { success: false, error: 'Database connection not available' };

      const userRepo = AppDataSource.getRepository('User');
      const user = await userRepo.findOneBy({ id: databaseUserId });
      
      if (!user) return { success: false, error: 'User not found in database' };

      // Check for duplicate link
      const existingLink = await userRepo.findOneBy({ lineUserId });
      if (existingLink && existingLink.id !== databaseUserId) {
        return { success: false, error: 'This LINE account is already linked to another user' };
      }

      user.lineUserId = lineUserId;
      await userRepo.save(user);

      return {
        success: true,
        message: 'LINE account linked successfully',
        user: { id: user.id, email: user.email, lineUserId, displayName }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Check if user is linked
  static async checkLinkStatus(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'User must be logged in' });

      const userRepo = global.AppDataSource.getRepository('User');
      const user = await userRepo.findOneBy({ id: userId });

      res.json({
        success: true,
        linked: !!(user && user.lineUserId),
        lineUserId: user?.lineUserId || null
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Unlink LINE account
  static async unlinkAccount(req, res) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, error: 'User must be logged in' });

      const userRepo = global.AppDataSource.getRepository('User');
      const user = await userRepo.findOneBy({ id: userId });

      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      if (!user.lineUserId) return res.status(400).json({ success: false, error: 'No LINE account linked' });

      user.lineUserId = null;
      await userRepo.save(user);

      res.json({ success: true, message: 'LINE account unlinked successfully' });
    } catch (error) {
      console.error('Unlink Error:', error.message);
   res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  }
}

module.exports = LineLoginController;