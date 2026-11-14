"""Bounded RSS 2 / Atom / RDF extraction using the standard XML parser, never executing markup."""
import json, re, sys
import xml.etree.ElementTree as ET
raw=sys.stdin.buffer.read(2_000_001)
if len(raw)>2_000_000 or re.search(br'<!\s*(DOCTYPE|ENTITY)',raw,re.I):
    raise ValueError('Unsupported or oversized XML')
root=ET.fromstring(raw)
def local(tag): return tag.rsplit('}',1)[-1].lower()
def value(el, names):
    for child in el:
        if local(child.tag) in names: return ''.join(child.itertext()).strip()
    return ''
items=[]
for el in root.iter():
    if local(el.tag) not in ('item','entry'): continue
    links=[c for c in el if local(c.tag)=='link']
    url=next((c.get('href') for c in links if c.get('href') and c.get('rel','alternate')=='alternate'),None)
    url=url or value(el,{'link'}) or value(el,{'guid','id'})
    items.append(dict(title=value(el,{'title'}),url=url,publishedAt=value(el,{'pubdate','published','date'}),updatedAt=value(el,{'updated'}),excerpt=value(el,{'description','summary','abstract','encoded'})))
    if len(items)>=200: break
if local(root.tag) not in ('rss','feed','rdf'): raise ValueError('Not a supported feed')
print(json.dumps(items,ensure_ascii=False))
