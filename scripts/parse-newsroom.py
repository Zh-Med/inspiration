"""Extract dated newsroom cards; scripts are ignored, never evaluated.
A changed page that yields zero cards is a collector failure, not 'no news'.
"""
import json, re, sys
from html.parser import HTMLParser
from datetime import datetime
from urllib.parse import urljoin, urlparse

class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def walk(self):
        yield self
        for c in self.children:
            if isinstance(c, Node): yield from c.walk()
    def text(self):
        if self.tag in ('script', 'style', 'svg'): return ''
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children)

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()
    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.current)
        self.current.children.append(n)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):
            self.current = n
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)
    def handle_endtag(self, tag):
        n = self.current
        while n.parent:
            if n.tag == tag:
                self.current = n.parent
                return
            n = n.parent
    def handle_data(self, text):
        if self.current.tag not in ('script','style'): self.current.children.append(text)

def clean(s): return re.sub(r'\s+', ' ', s).strip()
def date_of(n):
    for t in n.walk():
        if t.tag != 'time': continue
        text = t.attrs.get('datetime') or clean(t.text())
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', text): return text
        for fmt in ('%b %d, %Y', '%B %d, %Y'):
            try: return datetime.strptime(text, fmt).date().isoformat()
            except ValueError: pass
    return None

raw = sys.stdin.buffer.read(2_000_001)
if len(raw) > 2_000_000: raise ValueError('Oversized newsroom')
base = sys.argv[1]
p = Parser(); p.feed(raw.decode('utf-8'))
if len(sys.argv) > 2 and sys.argv[2] == '--article':
    metas = {n.attrs.get('property') or n.attrs.get('name'): n.attrs.get('content','') for n in p.root.walk() if n.tag == 'meta'}
    excerpt = clean(metas.get('description') or metas.get('og:description') or '')
    print(json.dumps([{'excerpt': excerpt}], ensure_ascii=False))
    sys.exit(0)
items = {}
for a in p.root.walk():
    if a.tag != 'a': continue
    url = urljoin(base, a.attrs.get('href',''))
    if urlparse(url).netloc != urlparse(base).netloc: continue
    headings = [n for n in a.walk() if n.tag in ('h2','h3','h4')]
    if not headings: continue
    title = clean(headings[0].text())
    container = a
    date = None
    for _ in range(4):
        date = date_of(container)
        if date: break
        if not container.parent: break
        container = container.parent
        # Do not borrow a date from another card in a large section.
        if len([n for n in container.walk() if n.tag == 'time']) > 1: break
    if not date or not title: continue
    paras = [clean(n.text()) for n in a.walk() if n.tag == 'p']
    excerpt = next((x for x in paras if len(x) > 35 and x != title), '')
    item = dict(title=title, url=url, publishedAt=date, publishedPrecision='day', excerpt=excerpt)
    if url not in items or len(excerpt) > len(items[url]['excerpt']): items[url] = item
print(json.dumps(list(items.values())[:100], ensure_ascii=False))
