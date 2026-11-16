"""Read-only publisher HTML adapters. Scripts/styles are never evaluated.

Cover membership requires a link inside the publisher's actual cover description;
neither feed order, journal prestige, nor the word 'cover' in a title is evidence.
"""
import json
import re
import sys
from datetime import datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse


class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self):
        if self.tag in ('script', 'style', 'svg', 'nav', 'aside'):
            return ''
        return ' '.join(c.text() if isinstance(c, Node) else c for c in self.children)


class Parser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = self.current = Node()

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, text):
        if self.current.tag not in ('script', 'style'):
            self.current.children.append(text)


def clean(text):
    return re.sub(r'\s+', ' ', text).replace('\u200b', '').strip()


def strip_tldr_navigation(text):
    return re.sub(r'\s+Open article\s*(?:\u2192|->)\s*$', '', text, flags=re.IGNORECASE).strip()


def date_in(text):
    match = re.search(r'\b\d{4}-\d{2}-\d{2}\b', text)
    if match:
        return datetime.strptime(match[0], '%Y-%m-%d').date().isoformat()
    match = re.search(r'\b\d{1,2} [A-Za-z]+ \d{4}\b', text)
    if match:
        for fmt in ('%d %B %Y', '%d %b %Y'):
            try:
                return datetime.strptime(match[0], fmt).date().isoformat()
            except ValueError:
                pass
    return None


def kimi(root, base):
    rows = {}
    for card in root.walk():
        if 'menu-card' not in card.attrs.get('class', '').split():
            continue
        title = next((clean(n.text()) for n in card.walk() if n.tag in ('h2', 'h3', 'h4')), '')
        date = next((date_in(n.text()) for n in card.walk() if 'card-date' in n.attrs.get('class', '').split()), None)
        links = [urljoin(base, n.attrs.get('href', '')) for n in card.walk() if n.tag == 'a']
        url = next((u for u in links if urlparse(u).netloc == urlparse(base).netloc and urlparse(u).path.startswith('/en/blog/')), None)
        if title and date and url:
            rows[url] = dict(title=title, url=url, publishedAt=date, publishedPrecision='day', excerpt='')
    if not rows:
        raise ValueError('No dated Kimi research cards; source format needs review')
    return list(rows.values())


def deepseek(root, base):
    # Only the article body, never duplicated sidebar/table-of-contents entries.
    body = next((n for n in root.walk() if n.tag == 'div' and 'markdown' in n.attrs.get('class', '').split()), None)
    if body is None:
        raise ValueError('DeepSeek changelog body missing')
    rows, date, active = [], None, None
    for node in body.walk():
        if node.tag == 'h2':
            date, active = date_in(node.text()), None
        elif node.tag == 'h3':
            fragment = node.attrs.get('id', '')
            active = None
            if date and re.fullmatch(r'[a-zA-Z0-9_-]+', fragment):
                active = dict(title=clean(node.text()), url=base.rstrip('/') + '/#' + fragment, publishedAt=date, publishedPrecision='day', excerpt='')
                rows.append(active)
        elif active and node.tag == 'p' and not active['excerpt']:
            active['excerpt'] = clean(node.text())[:500]
    if not rows:
        raise ValueError('No dated DeepSeek changelog entries; source format needs review')
    return rows


def nature_cover(root, base):
    journal = urlparse(base).path.strip('/').split('/')[0]
    if journal not in ('nature', 'neuro', 'natmachintell'):
        raise ValueError('Unconfigured Nature journal')
    description = next((n for n in root.walk() if n.attrs.get('data-test') == 'issue-description'), None)
    if description is None:
        raise ValueError('Nature issue cover description missing; source format needs review')
    issue_url = next((n.attrs.get('href') for n in root.walk() if n.tag == 'link' and n.attrs.get('rel') == 'canonical'), None)
    if not issue_url or urlparse(issue_url).netloc != urlparse(base).netloc or not re.fullmatch(r'/' + journal + r'/volumes/\d+/issues/\d+', urlparse(issue_url).path):
        raise ValueError('Nature canonical issue URL missing')
    heading = next((n.text() for n in root.walk() if n.tag == 'h1'), '')
    issue_date = date_in(heading)
    month_match = re.search(r'\b((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4})\b', heading)
    issue_month = issue_date[:7] if issue_date else datetime.strptime(month_match[1], '%B %Y').strftime('%Y-%m') if month_match else None
    if not issue_date and not issue_month:
        raise ValueError('Nature issue publication date missing')
    cover_title = next((clean(n.text()) for n in description.walk() if n.tag == 'h2'), '')
    paragraphs = [n for n in description.walk() if n.tag == 'p' and n.attrs.get('data-test') != 'issue-image-credit']
    excerpt = clean(' '.join(n.text() for n in paragraphs))[:500]
    # Match only explicit article/DOI links in the descriptive text, excluding
    # cover image credits, subscription links, issue navigation and TOC entries.
    dois = set()
    for paragraph in paragraphs:
        for link in paragraph.walk():
            if link.tag != 'a':
                continue
            url = urlparse(urljoin(base, link.attrs.get('href', '')))
            if url.scheme != 'https':
                continue
            if url.netloc == 'doi.org' and re.fullmatch(r'/10\.1038/[\w.-]+', url.path):
                dois.add(url.path.removeprefix('/10.1038/'))
            elif url.netloc == urlparse(base).netloc and re.fullmatch(r'/articles/[\w.-]+', url.path):
                dois.add(url.path.removeprefix('/articles/'))
    rows = {}
    for card in root.walk():
        if card.tag != 'article':
            continue
        for heading in card.walk():
            if heading.tag not in ('h2', 'h3', 'h4'):
                continue
            for link in heading.walk():
                if link.tag != 'a':
                    continue
                url = urljoin(base, link.attrs.get('href', ''))
                parsed = urlparse(url)
                article_id = parsed.path.removeprefix('/articles/')
                if parsed.scheme != 'https' or parsed.netloc != urlparse(base).netloc or not parsed.path.startswith('/articles/') or article_id not in dois:
                    continue
                article_date = next((n.attrs.get('datetime') for n in card.walk() if n.tag == 'time'), None)
                if not issue_date and not article_date:
                    continue
                rows[url] = dict(title=clean(link.text()), url=url, publishedAt=issue_date or article_date, publishedPrecision='day', excerpt=excerpt,
                                 contentKind='journal-cover', coverConfirmed=True, coverTitle=cover_title,
                                 coverEvidenceUrl=issue_url, issuePublishedAt=issue_date, articlePublishedAt=article_date,
                                 issueMonth=issue_month, issuePrecision='day' if issue_date else 'month',
                                 doi='10.1038/' + article_id)
    return list(rows.values())


def nature_abstract(root, base):
    section = next((n for n in root.walk() if n.attrs.get('id') == 'Abs1-content'), None)
    metas = {n.attrs.get('name'): n.attrs.get('content', '') for n in root.walk() if n.tag == 'meta'}
    date = metas.get('citation_online_date', '').replace('/', '-')
    if section is None or not clean(section.text()) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date):
        raise ValueError('Public Nature Abstract or original online date missing')
    return [dict(excerpt=clean(section.text())[:1800], articlePublishedAt=date, excerptKind='abstract')]


def github_trending(root, base):
    rows = {}
    for card in root.walk():
        if card.tag != 'article' or 'Box-row' not in card.attrs.get('class', '').split():
            continue
        for heading in card.walk():
            if heading.tag != 'h2':
                continue
            for link in heading.walk():
                path = link.attrs.get('href', '') if link.tag == 'a' else ''
                if re.fullmatch(r'/[\w.-]+/[\w.-]+', path):
                    rows[path] = dict(fullName=path[1:])
    if not rows:
        raise ValueError('No GitHub Trending repository cards')
    return list(rows.values())


def tldr_home(root, base):
    rows = {}
    for card in root.walk():
        if card.tag != 'article' or card.attrs.get('data-click-target') != 'story':
            continue
        if 'kf-ad' in card.attrs.get('class', '').split():
            continue
        title_node = next((n for n in card.walk() if n.tag == 'h3' and 'kf-row-title' in n.attrs.get('class', '').split()), None)
        if title_node is None:
            continue
        article_url = next((urljoin(base, n.attrs.get('href', '')) for n in title_node.walk() if n.tag == 'a'), '')
        story_url = next((urljoin(base, n.attrs['href']) for n in card.walk() if n.tag == 'a' and re.fullmatch(r'/story/[a-f0-9-]{36}', n.attrs.get('href', ''))), '')
        title = clean(title_node.text())
        if title and story_url and urlparse(article_url).scheme == 'https':
            rows.setdefault(story_url, dict(title=title, url=story_url, originalUrl=article_url))
    if not rows:
        raise ValueError('TLDR story cards missing; review source format')
    return list(rows.values())


def tldr_story(root, base):
    body = next((n for n in root.walk() if n.tag == 'article' and 'kf-story-body' in n.attrs.get('class', '').split()), None)
    if body is None:
        raise ValueError('TLDR story body missing')
    title = next((clean(n.text()) for n in body.walk() if n.tag == 'h1'), '')
    # Only the publisher summary, never related-story text or social comments.
    summary = next((strip_tldr_navigation(clean(n.text())) for n in body.walk() if 'kf-row-summary' in n.attrs.get('class', '').split()), '')
    if not title or not summary:
        raise ValueError('TLDR story title or summary missing')
    # Keep the publisher's complete summary text; exclude only its trailing navigation label.
    return [dict(title=title, excerpt=summary, excerptTruncated=False)]


raw = sys.stdin.buffer.read(2_000_001)
if len(raw) > 2_000_000:
    raise ValueError('Oversized source page')
parser = Parser()
parser.feed(raw.decode('utf-8'))
adapters = {'kimi': kimi, 'deepseek': deepseek, 'nature-cover': nature_cover, 'nature-abstract': nature_abstract, 'github-trending': github_trending, 'tldr-home': tldr_home, 'tldr-story': tldr_story}
print(json.dumps(adapters[sys.argv[1]](parser.root, sys.argv[2]), ensure_ascii=False))
