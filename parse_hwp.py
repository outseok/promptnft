import olefile, zlib, struct, re

path = r'C:\Users\h7144\OneDrive\ドキュメント\카카오톡 받은 파일\산단협력 리스트 정리용.hwp'
ole = olefile.OleFileIO(path)
header = ole.openstream('FileHeader').read()
flags = struct.unpack_from('<I', header, 36)[0]
compressed = flags & 1
data = ole.openstream('BodyText/Section0').read()
if compressed:
    data = zlib.decompress(data, -15)

text_parts = []
pos = 0
while pos < len(data):
    if pos + 4 > len(data):
        break
    rec_header = struct.unpack_from('<I', data, pos)[0]
    tag_id = rec_header & 0x3FF
    size = (rec_header >> 20) & 0xFFF
    if size == 0xFFF:
        if pos + 8 > len(data):
            break
        size = struct.unpack_from('<I', data, pos + 4)[0]
        pos += 8
    else:
        pos += 4
    if tag_id == 67:
        rec_data = data[pos:pos+size]
        txt = ''
        i = 0
        while i < len(rec_data) - 1:
            ch = struct.unpack_from('<H', rec_data, i)[0]
            if ch >= 32:
                txt += chr(ch)
            elif ch in (0, 10, 13):
                pass
            i += 2
        if txt.strip():
            text_parts.append(txt.strip())
    pos += size
ole.close()

# Build structured output
current_dept = ""
entries = []
i = 0
while i < len(text_parts):
    t = text_parts[i]
    if 'AI중심대학' in t:
        if entries:
            print(f"\n{'='*60}")
        current_dept = t
        print(f"\n## {current_dept}")
        print(f"{'번호':<5} {'회사명':<30} {'대표자':<10}")
        print("-" * 50)
        entries = []
        i += 1
        continue
    
    # Skip header row items
    if t in ['번호', '회사명', '대표자', '직원수', '회사의 사업 내용', '참여 전공 분야', '사업', '참여방법', '참여 방법', '요구 사항']:
        i += 1
        continue
    
    # Skip garbled chars
    if len(t) <= 2 and ord(t[0]) > 0x4E00:
        i += 1
        continue
    
    # Try to detect number
    if t.isdigit() and int(t) < 200:
        num = t
        company = text_parts[i+1] if i+1 < len(text_parts) else ""
        rep = text_parts[i+2] if i+2 < len(text_parts) else ""
        # Skip if company is a header keyword
        if company in ['회사명', '번호']:
            i += 1
            continue
        # Check for extra fields like business description
        skip = 3
        # Sometimes there are extra text fields (business content, etc)
        print(f"{num:<5} {company:<30} {rep:<10}")
        entries.append((num, company, rep))
        i += skip
        continue
    
    i += 1

print(f"\n{'='*60}")
print(f"\n총 기업 수: {sum(1 for _ in entries)}")
