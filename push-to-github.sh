#!/bin/bash
# Script to push Boostify project to GitHub
# Run this after creating the repository at https://github.com/convoycubano1-glitch/Boostify

echo "🚀 Pushing Boostify project to GitHub..."

# Navigate to project directory
cd "c:\Users\convo\OneDrive\Escritorio\BOOSTIFY 2025\BOOSTIFY-MUSIC_LAST\BOOSTIFY-MUSIC"

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git not initialized. Please run 'git init' first."
    exit 1
fi

# Set remote origin
echo "📡 Setting remote origin..."
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/convoycubano1-glitch/Boostify.git

# Rename branch to main
echo "🔄 Setting branch to main..."
git branch -M main

# Add all files
echo "📦 Adding all files..."
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "ℹ️  No changes to commit"
else
    echo "💾 Committing changes..."
    git commit -m "feat: initial commit - Boostify Music investor outreach system

- Complete investor outreach automation system
- Apify lead scraping integration
- Email templates with professional design
- Firebase Firestore database
- Resend email service integration
- Automated lead collection and outreach
- GitHub Actions for daily automation"
fi

# Push to GitHub
echo "⬆️  Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Successfully pushed to https://github.com/convoycubano1-glitch/Boostify.git"
    echo ""
    echo "🎉 Project uploaded successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://github.com/convoycubano1-glitch/Boostify/settings/secrets/actions"
    echo "2. Add these secrets:"
    echo "   - APIFY_API_KEY: apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq"
    echo "   - FIREBASE_PROJECT_ID: artist-boost"
    echo "   - FIREBASE_CLIENT_EMAIL: firebase-adminsdk-fbsvc@artist-boost.iam.gserviceaccount.com"
    echo "   - FIREBASE_PRIVATE_KEY: (the private key from .env)"
    echo "   - RESEND_API_KEY: re_KBRrLf8o_6CnSiPVBXuCGJ2tvnyxt5W3i"
    echo "3. Enable GitHub Actions in the repository"
else
    echo "❌ Failed to push. Please check:"
    echo "   - Repository exists at https://github.com/convoycubano1-glitch/Boostify"
    echo "   - You have push permissions"
    echo "   - Repository is not empty (if it exists)"
fi