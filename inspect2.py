with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find exact bytes using repr
idx = content.find("Error searching videos by pgId")
chunk = content[idx-300:idx+600]
print(repr(chunk))
