// Public, read-only sources. Only short publisher excerpts are retained.
export const retiredSourceIds = ['arxiv-neuro'];
export const feeds = [
  {id:'openai',name:'OpenAI News',url:'https://openai.com/news/rss.xml',evidence:'official-claim'},
  {id:'google-ai',name:'Google AI',url:'https://blog.google/technology/ai/rss/',evidence:'official-claim'},
  {id:'deepmind',name:'Google DeepMind',url:'https://deepmind.google/blog/rss.xml',evidence:'official-claim'},
  {id:'nvidia',name:'NVIDIA Blog',url:'https://blogs.nvidia.com/feed/',evidence:'official-claim'},
  {id:'nvidia-newsroom',name:'NVIDIA Newsroom',url:'https://nvidianews.nvidia.com/releases.xml',evidence:'official-claim'},
  {id:'anthropic',name:'Anthropic Newsroom',url:'https://www.anthropic.com/news',format:'newsroom',evidence:'official-claim'},
  {id:'anthropic-engineering',name:'Anthropic Engineering Blog',url:'https://www.anthropic.com/engineering',format:'newsroom',evidence:'official-claim'},
  {id:'anthropic-research',name:'Anthropic Research Blog',url:'https://www.anthropic.com/research',format:'newsroom',evidence:'official-claim'},
  {id:'kimi',name:'Kimi Research Blog',url:'https://www.kimi.com/en/blog/',format:'kimi',evidence:'official-claim',enrichDescription:true},
  {id:'deepseek',name:'DeepSeek Updates',url:'https://api-docs.deepseek.com/updates/',format:'deepseek',evidence:'official-claim',preserveFragment:true},
  {id:'huggingface',name:'Hugging Face Blog',url:'https://huggingface.co/blog/feed.xml',evidence:'publisher-claim'},
  {id:'microsoft-research',name:'Microsoft Research',url:'https://www.microsoft.com/en-us/research/feed/',evidence:'official-claim'},
  {id:'pytorch',name:'PyTorch Blog',url:'https://pytorch.org/feed/',evidence:'official-claim'},
  {id:'nature-cover',name:'Nature Cover',url:'https://www.nature.com/nature/current-issue',format:'nature-cover',evidence:'publisher-curated',collection:'medicine',publicNatureRedirects:true},
  {id:'nature-neuroscience-cover',name:'Nature Neuroscience Cover',url:'https://www.nature.com/neuro/current-issue',format:'nature-cover',evidence:'publisher-curated',collection:'medicine',publicNatureRedirects:true,requireAbstract:true},
  {id:'nature-machine-intelligence-cover',name:'Nature Machine Intelligence Cover',url:'https://www.nature.com/natmachintell/current-issue',format:'nature-cover',evidence:'publisher-curated',collection:'medicine',publicNatureRedirects:true,requireAbstract:true},
  {id:'the-decoder',name:'The Decoder',url:'https://the-decoder.com/feed/',evidence:'media-report'},
  {id:'ars-ai',name:'Ars Technica AI',url:'https://arstechnica.com/ai/feed/',evidence:'media-report'},
  {id:'mit-technology-review',name:'MIT Technology Review AI',url:'https://www.technologyreview.com/topic/artificial-intelligence/feed',evidence:'media-report'},
  {id:'techcrunch-ai',name:'TechCrunch AI',url:'https://techcrunch.com/category/artificial-intelligence/feed/',evidence:'media-report'},
  {id:'simon-willison',name:'Simon Willison',url:'https://simonwillison.net/atom/everything/',evidence:'author-commentary'},
];
export const projectSources=[{id:'github-trending',name:'GitHub Trending',url:'https://github.com/trending',format:'github-trending'}];
// Direct requests failed; configured as inactive, never claimed as verified.
export const pendingSources=[
 {id:'hacker-news',url:'https://news.ycombinator.com/',evidence:'community-observation',status:'disabled-connect-timeout'},
 {id:'reddit-localllama',url:'https://www.reddit.com/r/LocalLLaMA/.rss',evidence:'community-observation',status:'disabled-connection-reset'},
 {id:'reddit-machinelearning',url:'https://www.reddit.com/r/MachineLearning/.rss',evidence:'community-observation',status:'disabled-connection-reset'},
];
// Disabled by user after direct access failures. Do not retry or enable fallback
// feeds automatically; an RSS listing alone never confirms cover membership.
export const journalWatchlist = [
  {id:'jama-cover',name:'JAMA',url:'https://jamanetwork.com/journals/jama/currentissue',feedUrl:'https://jamanetwork.com/rss/site_3/67.xml',status:'disabled-http-403'},
  {id:'science-cover',name:'Science',url:'https://www.science.org/toc/science/current',feedUrl:'https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=science',status:'disabled-http-403'},
  {id:'lancet-cover',name:'The Lancet',url:'https://www.thelancet.com/journals/lancet/issue/current',feedUrl:'https://rss.sciencedirect.com/publication/science/01406736',status:'disabled-http-403'},
  {id:'nejm-cover',name:'New England Journal of Medicine',url:'https://www.nejm.org/toc/nejm/current',feedUrl:'https://www.nejm.org/action/showFeed?jc=nejm&type=etoc&feed=rss',status:'disabled-access-failures'},
];
export const searches = [
  {id:'agent-skills',query:'topic:agent-skills stars:>=50 archived:false fork:false'},
  {id:'research',query:'scientific research in:description stars:>=200 archived:false fork:false'},
  {id:'neuro',query:'neuroscience in:name,description stars:>=100 archived:false fork:false'},
  {id:'literature',query:'literature review in:description stars:>=100 archived:false fork:false'},
  {id:'medical',query:'medical imaging in:description stars:>=200 archived:false fork:false'},
];
export const limits={feedItems:60,discoveryPerQuery:10,enrichRepos:6,requestBytes:2_000_000,timeoutMs:15_000,digestItems:5,lookbackDays:30};

// Separate daily shelf; never participates in News ranking or model summaries.
export const tldrSource={id:'tldr',name:'TLDR',url:'https://tldr.tech/'};
