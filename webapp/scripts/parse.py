import docx, json, re

d = docx.Document('/sessions/bold-gallant-maxwell/mnt/Cruzan/Crucian Dictionary, Grammar & Glossary.docx')
paras = [(p.style.name, p.text.strip()) for p in d.paragraphs if p.text.strip()]

# --- Split into top-level sections by Heading 2 ---
sections = []
cur = None
for style, text in paras:
    if style == 'Heading 2':
        cur = {'title': text, 'body': []}
        sections.append(cur)
    elif cur is not None:
        cur['body'].append((style, text))

grammar_section = next(s for s in sections if 'Grammar' in s['title'])
proverb_section = next(s for s in sections if 'Proverb' in s['title'])
dict_section = next(s for s in sections if 'Alphabetical Dictionary' in s['title'])

# --- Grammar notes (phonetic/linguistic characteristics) ---
grammar_notes = []
deh_notes = []
grammar_examples = []  # {group, pairs:[{crucian, standard}]}
mode = None
cur_group = None
for style, text in grammar_section['body']:
    if style == 'Heading 3':
        if 'Multipurpose' in text or 'Deh' in text:
            mode = 'deh'
        elif 'Pronoun System' in text:
            mode = 'pronoun-table'
        elif 'Grammar & Sentence' in text:
            mode = 'examples'
        else:
            mode = 'notes'
        continue
    if style == 'Heading 4':
        cur_group = text
        grammar_examples.append({'group': cur_group, 'pairs': []})
        continue
    if mode == 'notes':
        if text.endswith(':') :
            continue
        grammar_notes.append(text)
    elif mode == 'deh':
        deh_notes.append(text)
    elif mode == 'examples' and cur_group:
        # the docx used a dash/arrow glyph (lost on extraction) between the Crucian
        # example and the "Standard English (SE):" gloss, leaving a double space.
        parts = re.split(r'\s{2,}(?=Standard English \(SE\):|SE:)', text)
        if len(parts) == 2:
            crucian = parts[0].strip()
            standard = re.sub(r'^(Standard English \(SE\):|SE:)\s*', '', parts[1]).strip()
            grammar_examples[-1]['pairs'].append({'crucian': crucian, 'standard': standard})
        else:
            grammar_examples[-1]['pairs'].append({'crucian': text, 'standard': ''})

# --- Pronouns (hardcoded from known table; docx doesn't have an actual Word table for this) ---
pronouns = [
    {"person": "1st Singular", "subject": "I", "object": "Me", "possessive": "My", "reflexive": "Myself"},
    {"person": "2nd Singular", "subject": "Yu", "object": "Yu", "possessive": "Yo", "reflexive": "Yoself"},
    {"person": "3rd Male", "subject": "He", "object": "He", "possessive": "He/Hiz", "reflexive": "Heself"},
    {"person": "3rd Female", "subject": "She", "object": "She", "possessive": "She/Ha", "reflexive": "Sheself"},
    {"person": "3rd Inanimate", "subject": "Ih / Ain", "object": "Ih", "possessive": "Itz", "reflexive": "Ihself"},
    {"person": "1st Plural", "subject": "We", "object": "Allawe", "possessive": "Ow-a", "reflexive": "Weself"},
    {"person": "2nd Plural", "subject": "Ayo", "object": "Ayo", "possessive": "Yo", "reflexive": "Yoself"},
    {"person": "3rd Plural", "subject": "Dey", "object": "Dem", "possessive": "Dey", "reflexive": "Deyself"}
]

# --- Proverbs / sayings (3 subsections under Heading 2 'Proverbs') ---
CATEGORY_MAP = {}
proverbs = []
cur_cat_label = None
cur_entry = None
for style, text in proverb_section['body']:
    if style == 'Heading 3':
        # "1. Advice & Wisdom" / "2. Warnings, Disapproval & Expressions of Irritation" / "3. Greetings, Flirtation & Social Expressions"
        label = re.sub(r'^\d+\.\s*', '', text)
        if 'Advice' in label:
            cur_cat_label = 'Advice'
        elif 'Warning' in label:
            cur_cat_label = 'Warnings'
        else:
            cur_cat_label = 'Social'
        continue
    if text.startswith('"') or (cur_entry is None and not text.startswith(('Translation:', 'Meaning:'))):
        # new proverb/expression headline (kept in quotes in Normal style)
        if cur_entry:
            proverbs.append(cur_entry)
        cur_entry = {'text': text.strip('"'), 'translation': '', 'meaning': '', 'category': cur_cat_label}
        continue
    if text.startswith('Translation:'):
        cur_entry['translation'] = text[len('Translation:'):].strip()
    elif text.startswith('Meaning:'):
        cur_entry['meaning'] = text[len('Meaning:'):].strip()
if cur_entry:
    proverbs.append(cur_entry)

# --- Dictionary entries ---
ORIGIN_RULES = [
    ('Danish', re.compile(r'danish|skål|frikadeller|frickadella|apotek|dænsk', re.I)),
    ('Dutch Creole', re.compile(r'dutch|negerhollands|sinaasappel|pistarckle', re.I)),
    ('Spanish', re.compile(r'spanish|puerto rican|portuguese', re.I)),
    ('French', re.compile(r'\bfrench\b', re.I)),
    ('Rastafarian', re.compile(r'rastafarian|\brasta\b|\bjah\b', re.I)),
    ('Amerindian', re.compile(r'arawak|amerindian|ta[ií]no', re.I)),
    ('West African', re.compile(
        r'twi|yoruba|igbo|akan|ashanti|kongo|tshiluba|fon\b|fula|bantu|west african|'
        r'calque|reduplication', re.I)),
    ('English/Irish', re.compile(r'irish|metathesis|consonant reversal|archaic english|standard english shortening|urban slang', re.I)),
]

def tag_origin(definition_text, extra_text=""):
    combined = definition_text + " " + extra_text
    for label, rx in ORIGIN_RULES:
        if rx.search(combined):
            return label
    return 'Local / Undetermined'

dictionary = []
cur = None
for style, text in dict_section['body']:
    if style == 'Heading 3':
        if cur:
            dictionary.append(cur)
        cur = {'word': text.strip('"'), 'definition': '', 'pronunciation': '', 'altSpellings': '', 'example': ''}
        continue
    if cur is None:
        continue
    if text.startswith('Definition:'):
        cur['definition'] = text[len('Definition:'):].strip()
    elif text.startswith('Pronunciation:'):
        cur['pronunciation'] = text.strip('\\').replace('Pronunciation:', '').strip()
    elif text.startswith('Alternate Spelling:'):
        cur['altSpellings'] = text[len('Alternate Spelling:'):].strip()
    elif text.startswith('Alternate Spellings:'):
        cur['altSpellings'] = text[len('Alternate Spellings:'):].strip()
    elif text.startswith('Example Usage:'):
        cur['example'] = text[len('Example Usage:'):].strip()
    else:
        # continuation text, append to definition
        cur['definition'] = (cur['definition'] + ' ' + text).strip()
if cur:
    dictionary.append(cur)

# tag origins + drop empties + dedupe by word
seen = set()
clean_dict = []
for e in dictionary:
    if not e['word']:
        continue
    key = e['word'].lower()
    if key in seen:
        continue
    seen.add(key)
    e['origin'] = tag_origin(e['definition'], e.get('altSpellings',''))
    clean_dict.append(e)

clean_dict.sort(key=lambda e: re.sub(r'[^a-zA-Z]', '', e['word']).lower())

# origin distribution for chart
from collections import Counter
dist = Counter(e['origin'] for e in clean_dict)

data = {
    'meta': {
        'title': 'Crucian Heritage Archive',
        'wordCount': len(clean_dict),
        'proverbCount': len(proverbs),
    },
    'grammarNotes': grammar_notes,
    'grammarExamples': grammar_examples,
    'pronouns': pronouns,
    'proverbs': proverbs,
    'dictionary': clean_dict,
    'origins': {
        'labels': list(dist.keys()),
        'values': list(dist.values())
    }
}

# The source docx used a dash/arrow glyph between "before" and "after" forms
# (e.g. car -> cyar) that python-docx cannot extract; it left behind a double
# space. Restore a visible arrow so the meaning isn't lost.
def fix_arrows(obj):
    if isinstance(obj, str):
        return re.sub(r'  +', ' → ', obj)
    if isinstance(obj, list):
        return [fix_arrows(x) for x in obj]
    if isinstance(obj, dict):
        return {k: fix_arrows(v) for k, v in obj.items()}
    return obj

data = fix_arrows(data)

with open('/sessions/bold-gallant-maxwell/mnt/outputs/build/data/dictionary.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('dictionary entries:', len(clean_dict))
print('proverbs:', len(proverbs))
print('grammar notes:', len(grammar_notes))
print('grammar example groups:', len(grammar_examples))
print('origin distribution:', dict(dist))
print(json.dumps(clean_dict[:5], indent=2, ensure_ascii=False))
print(json.dumps(proverbs[:3], indent=2, ensure_ascii=False))
