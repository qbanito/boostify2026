file = r'c:\Users\convo\OneDrive\Escritorio\BOOSTIFY 2025\BOOSTIFY-MUSIC_LAST\BOOSTIFY-MUSIC\client\src\components\artist\artist-profile-card.tsx'

with open(file, 'rb') as f:
    raw = f.read()

text = raw.decode('utf-8')

def can_cp1252(ch):
    try:
        ch.encode('cp1252')
        return True
    except UnicodeEncodeError:
        return False

# Fix double-encoding via Windows-1252: PowerShell read UTF-8 as cp1252, then wrote as UTF-8
result = []
i = 0
fixed_count = 0

while i < len(text):
    c = text[i]
    if ord(c) > 127 and can_cp1252(c):
        # Collect maximal sequence of non-ASCII chars encodable as cp1252
        j = i
        while j < len(text) and can_cp1252(text[j]) and ord(text[j]) > 127:
            j += 1
        chunk = text[i:j]
        try:
            fixed_chunk = chunk.encode('cp1252').decode('utf-8')
            result.append(fixed_chunk)
            if fixed_chunk != chunk:
                fixed_count += 1
        except (UnicodeDecodeError, UnicodeEncodeError):
            result.append(chunk)
        i = j
    else:
        result.append(c)
        i += 1

fixed_text = ''.join(result)

with open(file, 'w', encoding='utf-8', newline='') as f:
    f.write(fixed_text)

print("Fixed {} double-encoded sequences".format(fixed_count))
print("Original bytes: {}, New bytes: {}".format(len(raw), len(fixed_text.encode('utf-8'))))
