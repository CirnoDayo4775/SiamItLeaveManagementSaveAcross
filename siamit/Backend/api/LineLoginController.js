const bcrypt = require('bcryptjs');

class LineLoginController {

  // Get LINE Login URL for authenticated user
  static async getLoginUrl(req, res) {
    try {
      // Check if user is authenticated (you'll need to implement this based on your auth system)
      const userId = req.user?.userId; // Using userId from JWT token
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'User must be logged in first' 
        });
      }

      // Generate state parameter to link with user
      const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
      
             // Create LINE Login URL
      console.log('LINE Login Debug:');
      console.log('Channel ID:', process.env.LINE_CHANNEL_ID);
      console.log('Redirect URI:', process.env.LINE_REDIRECT_URI);
      
       const loginUrl = `https://access.line.me/oauth2/v2.1/authorize?` +
         `response_type=code&` +
         `client_id=${process.env.LINE_CHANNEL_ID}&` +
         `redirect_uri=${encodeURIComponent(process.env.LINE_REDIRECT_URI)}&` +
         `state=${state}&` +
         `scope=profile%20openid`;
      
      console.log('Generated Login URL:', loginUrl);

      res.json({
        success: true,
        loginUrl: loginUrl,
        message: 'LINE Login URL generated successfully'
      });

    } catch (error) {
      console.error('Error generating LINE login URL:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // Handle LINE Login callback
  static async handleCallback(req, res) {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing code or state parameter' 
        });
      }

      // Decode state to get user ID
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      const userId = stateData.userId;

      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid state parameter' 
        });
      }

      // Exchange code for access token
      const tokenResponse = await LineLoginController.exchangeCodeForToken(code);
      
      if (!tokenResponse.success) {
        return res.status(400).json(tokenResponse);
      }

      // Get LINE user profile
      const profileResponse = await LineLoginController.getLineProfile(tokenResponse.accessToken);
      
      if (!profileResponse.success) {
        return res.status(400).json(profileResponse);
      }

      // Link LINE user to database user
      const linkResult = await LineLoginController.linkLineUser(userId, profileResponse.userId, profileResponse.displayName);

      if (linkResult.success) {
        // Return HTML response directly with success data
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LINE Linking</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>
        <p>Processing LINE linking...</p>
    </div>

    <script>
        // Send success message to parent window
        if (window.opener) {
            window.opener.postMessage({
                type: 'LINE_LINK_SUCCESS',
                lineUserId: '${profileResponse.userId}',
                displayName: '${profileResponse.displayName}',
                pictureUrl: '${profileResponse.pictureUrl}'
            }, '*');
        }
        
        // Close the popup after a short delay
        setTimeout(() => {
            window.close();
        }, 1000);
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } else {
        // Return HTML response directly with error data
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LINE Linking</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .error {
            color: #e74c3c;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error">❌ Error</div>
        <p>${linkResult.error || 'Failed to link LINE account'}</p>
    </div>

    <script>
        // Send error message to parent window
        if (window.opener) {
            window.opener.postMessage({
                type: 'LINE_LINK_ERROR',
                message: '${linkResult.error || 'Failed to link LINE account'}'
            }, '*');
        }
        
        // Close the popup after a short delay
        setTimeout(() => {
            window.close();
        }, 2000);
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      }

    } catch (error) {
      console.error('Error handling LINE callback:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // Exchange authorization code for access token
  static async exchangeCodeForToken(code) {
    try {
      const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.LINE_REDIRECT_URI,
          client_id: process.env.LINE_CHANNEL_ID,
          client_secret: process.env.LINE_CHANNEL_SECRET,
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        return {
          success: true,
          accessToken: data.access_token,
          idToken: data.id_token
        };
      } else {
        return {
          success: false,
          error: 'Failed to get access token',
          details: data
        };
      }

    } catch (error) {
      console.error('Error exchanging code for token:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get LINE user profile
  static async getLineProfile(accessToken) {
    try {
      const response = await fetch('https://api.line.me/v2/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
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
      } else {
        return {
          success: false,
          error: 'Failed to get user profile',
          details: data
        };
      }

    } catch (error) {
      console.error('Error getting LINE profile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Link LINE user to database user
  static async linkLineUser(databaseUserId, lineUserId, displayName) {
    try {
      // Get AppDataSource (you'll need to pass this or make it global)
      const AppDataSource = global.AppDataSource;
      
      if (!AppDataSource) {
        return {
          success: false,
          error: 'Database connection not available'
        };
      }

      const userRepo = AppDataSource.getRepository('User');
      
      // Find the user in unified users table using id
      const user = await userRepo.findOneBy({ id: databaseUserId });
      
      if (!user) {
        return {
          success: false,
          error: 'User not found in database'
        };
      }

      // Check if LINE user ID is already linked to another user
      const existingLink = await userRepo.findOneBy({ lineUserId });
      if (existingLink && existingLink.id !== databaseUserId) {
        return {
          success: false,
          error: 'This LINE account is already linked to another user'
        };
      }

      // Link the LINE user ID
      user.lineUserId = lineUserId;
      await userRepo.save(user);

      return {
        success: true,
        message: 'LINE account linked successfully',
        user: {
          id: user.id,
          email: user.Email,
          lineUserId: lineUserId,
          displayName: displayName
        }
      };

    } catch (error) {
      console.error('Error linking LINE user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check if user is linked
  static async checkLinkStatus(req, res) {
    try {
      const userId = req.user?.userId; // This is the user ID from unified users table
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'User must be logged in first' 
        });
      }

      const AppDataSource = global.AppDataSource;
      const userRepo = AppDataSource.getRepository('User');
      
      // Find the user entry using id
      const user = await userRepo.findOneBy({ id: userId });
      
      if (user && user.lineUserId) {
        res.json({
          success: true,
          linked: true,
          lineUserId: user.lineUserId
        });
      } else {
        res.json({
          success: true,
          linked: false
        });
      }

    } catch (error) {
      console.error('Error checking link status:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }

  // Unlink LINE account
  static async unlinkAccount(req, res) {
    try {
      const userId = req.user?.userId; // This is the user ID from unified users table
      
      if (!userId) {
        return res.status(401).json({ 
          success: false, 
          error: 'User must be logged in first' 
        });
      }

      const AppDataSource = global.AppDataSource;
      const userRepo = AppDataSource.getRepository('User');
      
      // Find the user entry using id
      const user = await userRepo.findOneBy({ id: userId });
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'User not found' 
        });
      }

      if (!user.lineUserId) {
        return res.status(400).json({ 
          success: false, 
          error: 'No LINE account linked' 
        });
      }

      // Unlink the LINE account
      user.lineUserId = null;
      await userRepo.save(user);

      res.json({
        success: true,
        message: 'LINE account unlinked successfully'
      });

    } catch (error) {
      console.error('Error unlinking account:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
}

module.exports = LineLoginController; 