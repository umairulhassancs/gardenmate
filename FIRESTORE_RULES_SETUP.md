# Firestore Rules Setup Guide

## The Error You're Seeing
```
ERROR  Error fetching vendors: [FirebaseError: Missing or insufficient permissions.]
```

This means your Firestore security rules are blocking access to the vendors collection.

## Solution: Update Firestore Security Rules

### Option 1: Using Firebase Console (Recommended - Quickest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your **GardenMate** project
3. Navigate to **Firestore Database** → **Rules** tab
4. Copy the content from `firestore.rules` file in this project
5. Paste it into the Firebase Console Rules editor
6. Click **Publish** button
7. Wait for confirmation (takes a few seconds)

### Option 2: Using Firebase CLI

```bash
# Install Firebase CLI if you haven't already
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done already)
firebase init firestore

# Deploy the rules
firebase deploy --only firestore:rules
```

## Important Notes

### Security Rules Explained:

1. **Vendors Collection**:
   - Admins can read/write all vendor data
   - Vendors can only read and update their own data
   - Regular users cannot access vendor data

2. **Users Collection**:
   - All authenticated users can read user data
   - Users can only update their own profile or admins can update any

3. **Plants Collection**:
   - Anyone can read plants (public)
   - Only vendors and admins can create/update/delete plants

4. **Complaints Collection**:
   - All authenticated users can read and create complaints
   - Only admins can update/delete complaints

5. **Community Posts**:
   - All authenticated users can read and create posts
   - Users can only update/delete their own posts, or admins can update/delete any

## Testing After Deployment

After deploying the rules, test by:
1. Restart your Expo app
2. Login as an admin user
3. Navigate to the Admin Dashboard
4. Check if the vendors data loads without errors

## Troubleshooting

If you still get permission errors:

1. **Verify user role in Firestore**:
   - Go to Firebase Console → Firestore Database
   - Open the `users` collection
   - Find your admin user document
   - Make sure the `role` field is set to `"admin"`

2. **Check authentication**:
   - Make sure you're logged in
   - Check `auth.currentUser` is not null

3. **Clear app cache**:
   ```bash
   expo start --clear
   ```

4. **Check Firestore Rules in Console**:
   - Go to Rules tab
   - Make sure the rules are published (green checkmark)
   - Check the timestamp to confirm it's the latest version

## Development vs Production

The rules provided are secure for production. However, if you want to quickly test during development, you can temporarily use open rules (NOT RECOMMENDED for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Remember to switch back to secure rules before deploying to production!**
