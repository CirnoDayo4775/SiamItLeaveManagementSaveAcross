# SuperAdmin Setup Guide

This guide explains how to create SuperAdmin accounts for the SiamIT Leave Management System.

## 🎯 Quick Start

### Create a Single SuperAdmin Account

```bash
cd Backend
node create-superadmin.js
```

This will:
- Generate a random Gmail address
- Generate a secure 12-character password
- Create a SuperAdmin account with default department (IT) and position (Super Admin)
- Display the credentials for you to save

### Create Multiple SuperAdmin Accounts

```bash
# Create 3 SuperAdmin accounts
node create-multiple-superadmins.js 3

# Create 1 SuperAdmin account (default)
node create-multiple-superadmins.js
```

## 📋 Generated Credentials Example

```
🎉 SuperAdmin Account Created Successfully!
===========================================
📧 Email: power.officer.773@gmail.com
🔑 Password: 7SWe&OFJmLiX
👤 Name: SuperAdmin_288
🆔 ID: fc8806f5-a0d1-46f5-af3a-dedd332c3088
🔐 Role: superadmin
🏢 Department: IT
💼 Position: Super Admin
===========================================
```

## 🔐 Security Notes

1. **Save Credentials Securely**: The generated credentials are only shown once. Make sure to save them in a secure location.

2. **Password Strength**: All generated passwords are 12 characters long and include:
   - Uppercase letters (A-Z)
   - Lowercase letters (a-z)
   - Numbers (0-9)
   - Special characters (!@#$%^&*)

3. **Email Format**: Generated emails follow the pattern: `adjective.noun.number@gmail.com`

## 🏢 Default Department and Position

When creating SuperAdmin accounts, the system automatically:
- Creates a default "IT" department if it doesn't exist
- Creates a default "Super Admin" position if it doesn't exist
- Assigns these defaults to the new SuperAdmin account

## 🚀 Login Instructions

1. Use the generated email and password to login
2. The account will have full SuperAdmin privileges
3. You can access all system features and manage other users

## 🔧 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Make sure your database is running
   - Check your `.env` file configuration
   - Verify database credentials

2. **Duplicate Email/Name Error**
   - The script automatically retries with new credentials
   - No action needed

3. **Permission Errors**
   - Make sure you have write permissions to the database
   - Check if the database user has proper privileges

### Manual Database Check

You can verify the created accounts by checking these tables:
- `superadmin` - SuperAdmin account details
- `process_check` - Login credentials and authentication

## 📞 Support

If you encounter any issues, please check:
1. Database connection settings
2. Environment variables in `.env` file
3. Database permissions
4. Network connectivity
