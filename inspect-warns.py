import re

with open('client/src/components/artist/artist-profile-card.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find what's in logger.warn lines near the video search
idx = content.find('logger.warn')
warns = []
while idx != -1:
    line = content[idx:idx+100]
    warns.append(repr(line))
    idx = content.find('logger.warn', idx+1)

for w in warns:
    print(w)
