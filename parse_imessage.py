#!/usr/bin/env python3
import re
import sys

# Read existing entries to check duplicates
existing = set()
try:
    with open('data.csv', 'r') as f:
        for line in f:
            if ',' in line and not line.startswith('user'):
                parts = line.strip().split(',')
                if len(parts) >= 2:
                    existing.add((parts[0].strip().lower(), parts[1].strip()))
except:
    pass

# iMessage text (provided by user)
imessage_text = """[The full iMessage text would go here - I'll parse it programmatically]"""

# Read from stdin or file
if len(sys.argv) > 1:
    with open(sys.argv[1], 'r') as f:
        imessage_text = f.read()
else:
    # For now, we'll parse the provided text
    pass

# Month mapping
month_map = {
    'january': '01', 'jan': '01',
    'february': '02', 'feb': '02',
    'march': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'may': '05',
    'june': '06', 'jun': '06',
    'july': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'october': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'december': '12', 'dec': '12'
}

def parse_imessage_data(text):
    """Parse iMessage data and extract MapTap scores"""
    new_rows = []
    
    # Split by lines and process
    lines = text.split('\n')
    current_user = None
    current_date = None
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            i += 1
            continue
        
        # Check for user name (before MapTap line)
        # User names appear as: "Stephen Alexander", "Ellie Alexander", etc.
        # Skip if it's Abigail or Joshua
        if 'abigail jenquist' in line.lower() or 'joshua jenquist' in line.lower():
            # Skip this user's entries
            i += 1
            # Skip until next user or MapTap line
            while i < len(lines) and 'maptap' not in lines[i].lower():
                i += 1
            continue
        
        # Check if this line contains a user name
        user_match = re.search(r'(Stephen Alexander|Ellie Alexander|David Ellis|Ashley Ellis|scott caskey)', line, re.IGNORECASE)
        if user_match:
            current_user = user_match.group(1).strip()
            i += 1
            continue
        
        # Look for MapTap date line: "www.MapTap.gg October 23" or "MapTap October 30"
        maptap_match = re.search(r'maptap.*?(october|november|december|oct|nov|dec)\s+(\d+)', line, re.IGNORECASE)
        if maptap_match:
            month_str = maptap_match.group(1).lower()
            day = maptap_match.group(2)
            month = month_map.get(month_str, '12')
            current_date = f"2025-{month}-{day.zfill(2)}"
            i += 1
            continue
        
        # Look for score line: "97! 94" 81# 65$ 35%" or similar
        # Pattern: number followed by emoji/symbol, repeated 5 times
        score_match = re.match(r'^(\d+[^\d\s]{0,3})\s+(\d+[^\d\s]{0,3})\s+(\d+[^\d\s]{0,3})\s+(\d+[^\d\s]{0,3})\s+(\d+[^\d\s]{0,3})', line)
        if score_match and current_user and current_date:
            scores = []
            for j in range(1, 6):
                score_str = score_match.group(j)
                # Extract number and emoji
                num_match = re.match(r'(\d+)(.*)', score_str)
                if num_match:
                    score = num_match.group(1)
                    emoji = num_match.group(2) if num_match.group(2) else ''
                    scores.append((score, emoji))
            
            # Look for final score on same or next line
            final_match = re.search(r'final\s+score:\s*(\d+)', line, re.IGNORECASE)
            if not final_match and i + 1 < len(lines):
                final_match = re.search(r'final\s+score:\s*(\d+)', lines[i + 1], re.IGNORECASE)
            
            if final_match and len(scores) == 5:
                final_score = final_match.group(1)
                user_key = current_user.lower()
                
                # Skip if duplicate
                if (user_key, current_date) not in existing:
                    for loc_num, (score, emoji) in enumerate(scores, 1):
                        new_rows.append(f"{current_user},{current_date},{loc_num},{score},{emoji},{final_score}")
                
                # Reset for next entry
                current_user = None
                current_date = None
        
        i += 1
    
    return new_rows

# For now, let's manually parse the provided data since it's complex
# I'll create entries based on the patterns I see

manual_entries = []

# October 23
manual_entries.append(("Stephen Alexander", "2025-10-23", [("99", "&"), ("91", "'"), ("87", "("), ("81", "#"), ("82", "#")], "853"))
manual_entries.append(("Ellie Alexander", "2025-10-23", [("99", "&"), ("98", "!"), ("91", "'"), ("79", "✨"), ("82", "#")], "862"))

# October 24
manual_entries.append(("Stephen Alexander", "2025-10-24", [("95", '"'), ("97", "!"), ("90", "'"), ("84", "+"), ("75", ".")], "849"))
manual_entries.append(("Ellie Alexander", "2025-10-24", [("95", '"'), ("95", '"'), ("89", "/"), ("450", ""), ("931", "")], "782"))
manual_entries.append(("Stephen Alexander", "2025-10-24", [("94", '"'), ("94", '"'), ("98", "&"), ("632", ""), ("81", "#")], "816"))

# October 25
manual_entries.append(("Stephen Alexander", "2025-10-25", [("100", "3"), ("100", "3"), ("94", '"'), ("96", "!"), ("83", "+")], "925"))
manual_entries.append(("Ellie Alexander", "2025-10-25", [("100", "3"), ("100", "3"), ("100", "&"), ("98", "&"), ("612", "")], "877"))
manual_entries.append(("Stephen Alexander", "2025-10-25", [("100", "3"), ("100", "3"), ("100", "&"), ("99", "&"), ("88", "/")], "961"))

# October 26
manual_entries.append(("Ellie Alexander", "2025-10-26", [("99", "&"), ("88", "/"), ("665", ""), ("616", ""), ("84", "+")], "754"))
manual_entries.append(("Stephen Alexander", "2025-10-26", [("99", "&"), ("87", "/"), ("79", "✨"), ("931", ""), ("767", "")], "851"))
manual_entries.append(("Stephen Alexander", "2025-10-26", [("99", "&"), ("96", "!"), ("68", "+"), ("558", ""), ("931", "")], "775"))

# October 27
manual_entries.append(("Stephen Alexander", "2025-10-27", [("96", "!"), ("100", "3"), ("97", "!"), ("65", "$"), ("94", '"')], "867"))
manual_entries.append(("Stephen Alexander", "2025-10-27", [("99", "&"), ("99", "&"), ("98", "&"), ("767", ""), ("95", '"')], "907"))
manual_entries.append(("Ellie Alexander", "2025-10-27", [("98", "!"), ("100", "3"), ("931", ""), ("450", ""), ("3", "<")], "528"))

# October 28
manual_entries.append(("Stephen Alexander", "2025-10-28", [("84", "+"), ("100", "3"), ("90", "'"), ("931", ""), ("777", "")], "874"))
manual_entries.append(("Ellie Alexander", "2025-10-28", [("94", '"'), ("100", "3"), ("97", "!"), ("96", "!"), ("82", "#")], "922"))

# October 29
manual_entries.append(("Stephen Alexander", "2025-10-29", [("98", "!"), ("99", "&"), ("99", "&"), ("33", "="), ("95", '"')], "779"))
manual_entries.append(("Ellie Alexander", "2025-10-29", [("98", "&"), ("99", "&"), ("99", "&"), ("16", ")"), ("665", "")], "641"))
manual_entries.append(("Ellie Alexander", "2025-10-29", [("99", "&"), ("931", ""), ("100", "&"), ("34", "="), ("49", "-")], "641"))

# October 30
manual_entries.append(("Stephen Alexander", "2025-10-30", [("97", "!"), ("100", "&"), ("931", ""), ("84", "+"), ("70", "?")], "845"))
manual_entries.append(("Ellie Alexander", "2025-10-30", [("97", "!"), ("99", "&"), ("97", "!"), ("589", ""), ("568", "")], "732"))
manual_entries.append(("Stephen Alexander", "2025-10-30", [("96", "!"), ("100", "3"), ("96", "!"), ("85", "+"), ("91", "'")], "916"))

# October 31
manual_entries.append(("Stephen Alexander", "2025-10-31", [("98", "&"), ("94", '"'), ("80", "✨"), ("95", '"'), ("95", '"')], "922"))
manual_entries.append(("Ellie Alexander", "2025-10-31", [("90", "'"), ("94", '"'), ("83", "+"), ("95", '"'), ("86", "(")], "893"))
manual_entries.append(("Ellie Alexander", "2025-10-31", [("89", "'"), ("921", ""), ("87", "/"), ("95", '"'), ("931", "")], "919"))

# November 1
manual_entries.append(("Stephen Alexander", "2025-11-01", [("921", ""), ("79", "✨"), ("85", "("), ("53", "@"), ("96", "!")], "788"))
manual_entries.append(("Stephen Alexander", "2025-11-01", [("98", "&"), ("84", "+"), ("74", "."), ("28", "A"), ("80", "#")], "654"))
manual_entries.append(("Ellie Alexander", "2025-11-01", [("91", "'"), ("80", "✨"), ("81", "#"), ("70", "?"), ("98", "!")], "837"))

# November 2
manual_entries.append(("Stephen Alexander", "2025-11-02", [("100", "3"), ("75", "."), ("95", '"'), ("97", "!"), ("52", ":")], "812"))
manual_entries.append(("Stephen Alexander", "2025-11-02", [("100", "3"), ("86", "("), ("921", ""), ("99", "&"), ("90", "'")], "937"))

# November 3
manual_entries.append(("Stephen Alexander", "2025-11-03", [("95", '"'), ("94", '"'), ("97", "!"), ("921", ""), ("74", ";")], "881"))
manual_entries.append(("Ellie Alexander", "2025-11-03", [("100", "&"), ("100", "&"), ("97", "!"), ("90", "'"), ("87", "/")], "925"))
manual_entries.append(("Ellie Alexander", "2025-11-03", [("931", ""), ("100", "&"), ("96", "!"), ("931", ""), ("98", "&")], "958"))

# November 4
manual_entries.append(("Stephen Alexander", "2025-11-04", [("97", "!"), ("95", '"'), ("921", ""), ("99", "&"), ("31", "C")], "766"))
manual_entries.append(("Stephen Alexander", "2025-11-04", [("89", "/"), ("98", "&"), ("83", "#"), ("89", "/"), ("65", "$")], "815"))
manual_entries.append(("Ellie Alexander", "2025-11-04", [("787", ""), ("94", '"'), ("76", "."), ("96", "!"), ("80", "✨")], "852"))

# November 5
manual_entries.append(("Stephen Alexander", "2025-11-05", [("99", "&"), ("921", ""), ("76", "."), ("50", ":"), ("82", "#")], "739"))
manual_entries.append(("Ellie Alexander", "2025-11-05", [("97", "!"), ("97", "!"), ("100", "3"), ("79", "✨"), ("921", "")], "907"))
manual_entries.append(("Ellie Alexander", "2025-11-05", [("87", "/"), ("95", '"'), ("100", "3"), ("606", ""), ("88", "/")], "826"))

# November 6
manual_entries.append(("Stephen Alexander", "2025-11-06", [("94", '"'), ("98", "&"), ("787", ""), ("90", "'"), ("931", "")], "897"))
manual_entries.append(("Ellie Alexander", "2025-11-06", [("86", "("), ("99", "&"), ("100", "3"), ("98", "!"), ("89", "/")], "946"))
manual_entries.append(("Stephen Alexander", "2025-11-06", [("95", '"'), ("96", "!"), ("70", "?"), ("72", ";"), ("95", '"')], "832"))

# November 7
manual_entries.append(("Stephen Alexander", "2025-11-07", [("95", '"'), ("98", "&"), ("579", ""), ("71", "?"), ("70", "?")], "730"))
manual_entries.append(("Ellie Alexander", "2025-11-07", [("99", "&"), ("98", "&"), ("97", "!"), ("90", "'"), ("622", "")], "847"))

# November 10
manual_entries.append(("Ellie Alexander", "2025-11-10", [("97", "!"), ("98", "!"), ("99", "&"), ("599", ""), ("596", "")], "747"))
manual_entries.append(("Stephen Alexander", "2025-11-10", [("99", "&"), ("98", "!"), ("95", '"'), ("74", "."), ("50", ":")], "759"))
manual_entries.append(("Stephen Alexander", "2025-11-10", [("97", "!"), ("97", "!"), ("921", ""), ("73", ";"), ("83", "+")], "846"))

# November 11
manual_entries.append(("Ellie Alexander", "2025-11-11", [("98", "!"), ("98", "!"), ("94", '"'), ("96", "!"), ("622", "")], "858"))

# November 12
manual_entries.append(("Stephen Alexander", "2025-11-12", [("98", "&"), ("99", "&"), ("82", "#"), ("98", "!"), ("86", "(")], "913"))
manual_entries.append(("Ellie Alexander", "2025-11-12", [("99", "&"), ("100", "&"), ("95", '"'), ("96", "!"), ("85", "(")], "932"))
manual_entries.append(("Ellie Alexander", "2025-11-12", [("99", "&"), ("96", "!"), ("98", "!"), ("94", '"'), ("89", "/")], "940"))

# November 13
manual_entries.append(("Stephen Alexander", "2025-11-13", [("100", "3"), ("94", '"'), ("99", "&"), ("100", "3"), ("616", "")], "875"))
manual_entries.append(("Ellie Alexander", "2025-11-13", [("100", "3"), ("94", '"'), ("94", '"'), ("82", "#"), ("42", "H")], "754"))
manual_entries.append(("Ellie Alexander", "2025-11-13", [("100", "3"), ("96", "!"), ("94", '"'), ("100", "3"), ("787", "")], "918"))

# November 14
manual_entries.append(("Stephen Alexander", "2025-11-14", [("99", "&"), ("91", "'"), ("99", "&"), ("30", "I"), ("51", ":")], "631"))
manual_entries.append(("Ellie Alexander", "2025-11-14", [("98", "&"), ("89", "'"), ("100", "&"), ("622", ""), ("50", ":")], "723"))

# November 15
manual_entries.append(("Stephen Alexander", "2025-11-15", [("97", "!"), ("99", "&"), ("65", "$"), ("83", "+"), ("70", "?")], "785"))
manual_entries.append(("Ellie Alexander", "2025-11-15", [("921", ""), ("99", "&"), ("612", ""), ("79", "✨"), ("777", "")], "781"))

# November 16
manual_entries.append(("Stephen Alexander", "2025-11-16", [("90", "'"), ("99", "&"), ("787", ""), ("70", "?"), ("49", "-")], "702"))
manual_entries.append(("Ellie Alexander", "2025-11-16", [("97", "!"), ("74", "."), ("88", "/"), ("665", ""), ("76", ".")], "773"))

# November 17
manual_entries.append(("Stephen Alexander", "2025-11-17", [("100", "&"), ("95", '"'), ("931", ""), ("99", "&"), ("71", "?")], "891"))
manual_entries.append(("Ellie Alexander", "2025-11-17", [("90", "'"), ("95", '"'), ("931", ""), ("98", "&"), ("931", "")], "944"))
manual_entries.append(("Ellie Alexander", "2025-11-17", [("98", "&"), ("98", "&"), ("931", ""), ("97", "!"), ("787", "")], "907"))

# November 18
manual_entries.append(("Stephen Alexander", "2025-11-18", [("921", ""), ("84", "+"), ("98", "!"), ("84", "+"), ("74", ".")], "846"))
manual_entries.append(("Ellie Alexander", "2025-11-18", [("89", "'"), ("81", "#"), ("95", '"'), ("82", "#"), ("46", ",")], "744"))

# November 19
manual_entries.append(("Stephen Alexander", "2025-11-19", [("94", '"'), ("99", "&"), ("86", "("), ("599", ""), ("50", ":")], "692"))
manual_entries.append(("Ellie Alexander", "2025-11-19", [("98", "&"), ("98", "&"), ("72", "?"), ("86", "("), ("87", "/")], "859"))
manual_entries.append(("Ellie Alexander", "2025-11-19", [("931", ""), ("98", "!"), ("82", "#"), ("43", "H"), ("71", "?")], "697"))

# November 20
manual_entries.append(("Stephen Alexander", "2025-11-20", [("99", "&"), ("99", "&"), ("94", '"'), ("5", "K"), ("589", "")], "575"))
manual_entries.append(("Ellie Alexander", "2025-11-20", [("97", "!"), ("98", "&"), ("100", "3"), ("4", "<"), ("74", ".")], "629"))
manual_entries.append(("Ellie Alexander", "2025-11-20", [("911", ""), ("99", "&"), ("100", "3"), ("22", "J"), ("89", "/")], "723"))

# November 21
manual_entries.append(("Stephen Alexander", "2025-11-21", [("100", "3"), ("96", '"'), ("579", ""), ("589", ""), ("94", '"')], "766"))
manual_entries.append(("Ellie Alexander", "2025-11-21", [("100", "3"), ("94", '"'), ("450", ""), ("75", "."), ("99", "&")], "806"))
manual_entries.append(("Stephen Alexander", "2025-11-21", [("100", "3"), ("99", "&"), ("777", ""), ("72", ";"), ("98", "&")], "863"))

# November 22
manual_entries.append(("Stephen Alexander", "2025-11-22", [("100", "3"), ("100", "&"), ("96", "!"), ("91", "'"), ("95", '"')], "950"))
manual_entries.append(("Stephen Alexander", "2025-11-22", [("100", "3"), ("100", "&"), ("99", "&"), ("94", '"'), ("921", "")], "956"))
manual_entries.append(("Ellie Alexander", "2025-11-22", [("100", "3"), ("100", "&"), ("921", ""), ("100", "&"), ("65", "$")], "879"))

# November 23
manual_entries.append(("Ellie Alexander", "2025-11-23", [("100", "3"), ("80", "✨"), ("28", "A"), ("97", "!"), ("0", "<")], "527"))
manual_entries.append(("Stephen Alexander", "2025-11-23", [("100", "3"), ("98", "!"), ("96", "!"), ("86", "("), ("23", "J")], "717"))
manual_entries.append(("Stephen Alexander", "2025-11-23", [("100", "3"), ("99", "&"), ("79", "✨"), ("78", "✨"), ("84", "")], "615"))

# November 24
manual_entries.append(("Ellie Alexander", "2025-11-24", [("91", "'"), ("931", ""), ("98", "&"), ("11", "N"), ("87", "(")], "674"))
manual_entries.append(("Stephen Alexander", "2025-11-24", [("96", "!"), ("921", ""), ("85", "("), ("98", "!"), ("96", "!")], "940"))
manual_entries.append(("Stephen Alexander", "2025-11-24", [("931", ""), ("84", "+"), ("921", ""), ("98", "&"), ("65", "$")], "850"))

# November 25
manual_entries.append(("Ellie Alexander", "2025-11-25", [("96", "!"), ("90", "'"), ("100", "3"), ("54", "@"), ("0", "<")], "548"))
manual_entries.append(("Stephen Alexander", "2025-11-25", [("97", "!"), ("931", ""), ("100", "3"), ("50", "-"), ("88", "/")], "804"))
manual_entries.append(("Stephen Alexander", "2025-11-25", [("98", "&"), ("90", "'"), ("100", "3"), ("3", "<"), ("0", "<")], "397"))

# November 26
manual_entries.append(("Stephen Alexander", "2025-11-26", [("96", "!"), ("921", ""), ("921", ""), ("98", "!"), ("97", "!")], "957"))
manual_entries.append(("Ellie Alexander", "2025-11-26", [("99", "&"), ("83", "+"), ("91", "'"), ("86", "("), ("94", '"')], "904"))
manual_entries.append(("Ellie Alexander", "2025-11-26", [("99", "&"), ("87", "("), ("97", "!"), ("96", "!"), ("97", "!")], "959"))

# November 27
manual_entries.append(("Stephen Alexander", "2025-11-27", [("99", "&"), ("96", "!"), ("95", '"'), ("95", '"'), ("579", "")], "841"))
manual_entries.append(("Ellie Alexander", "2025-11-27", [("96", "!"), ("96", '"'), ("98", "!"), ("96", "!"), ("11", "N")], "709"))

# November 28
manual_entries.append(("Stephen Alexander", "2025-11-28", [("75", "."), ("97", "!"), ("96", "!"), ("46", ","), ("19", "G")], "559"))
manual_entries.append(("Ellie Alexander", "2025-11-28", [("921", ""), ("95", '"'), ("97", "!"), ("931", ""), ("0", "<")], "660"))
manual_entries.append(("Ellie Alexander", "2025-11-28", [("95", '"'), ("94", '"'), ("98", "&"), ("75", "."), ("84", "+")], "862"))

# November 29
manual_entries.append(("Stephen Alexander", "2025-11-29", [("97", "!"), ("99", "&"), ("97", "!"), ("97", "!"), ("589", "")], "855"))
manual_entries.append(("Ellie Alexander", "2025-11-29", [("931", ""), ("99", "&"), ("90", "'"), ("99", "&"), ("921", "")], "945"))

# November 30
manual_entries.append(("Stephen Alexander", "2025-11-30", [("99", "&"), ("89", "'"), ("89", "'"), ("83", "+"), ("450", "")], "750"))
manual_entries.append(("Ellie Alexander", "2025-11-30", [("931", ""), ("100", "&"), ("65", "$"), ("70", "?"), ("65", "$")], "728"))
manual_entries.append(("Ellie Alexander", "2025-11-30", [("100", "&"), ("91", "'"), ("95", '"'), ("95", '"'), ("69", "+")], "873"))

# December 1
manual_entries.append(("Stephen Alexander", "2025-12-01", [("99", "&"), ("94", '"'), ("921", ""), ("91", "'"), ("91", "'")], "923"))
manual_entries.append(("Ellie Alexander", "2025-12-01", [("99", "&"), ("96", "!"), ("74", "."), ("787", ""), ("767", "")], "805"))

# December 2
manual_entries.append(("Ellie Alexander", "2025-12-02", [("94", '"'), ("921", ""), ("86", "("), ("83", "+"), ("90", "'")], "877"))
manual_entries.append(("Stephen Alexander", "2025-12-02", [("94", '"'), ("97", "!"), ("99", "&"), ("74", "."), ("440", "")], "743"))

# Generate CSV rows
new_rows = []
for user, date, scores, final_score in manual_entries:
    user_key = user.lower()
    if (user_key, date) not in existing:
        for loc_num, (score, emoji) in enumerate(scores, 1):
            new_rows.append(f"{user},{date},{loc_num},{score},{emoji},{final_score}")

# Output new rows
for row in new_rows:
    print(row)

