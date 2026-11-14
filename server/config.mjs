// Public, read-only sources. No article bodies, repository archives or executable skills are downloaded.
export const feeds = [
  {id:'openai',name:'OpenAI News',url:'https://openai.com/news/rss.xml',evidence:'official-claim'},
  {id:'google-ai',name:'Google AI',url:'https://blog.google/technology/ai/rss/',evidence:'official-claim'},
  {id:'deepmind',name:'Google DeepMind',url:'https://deepmind.google/blog/rss.xml',evidence:'official-claim'},
  {id:'nvidia',name:'NVIDIA Blog',url:'https://blogs.nvidia.com/feed/',evidence:'official-claim'},
  {id:'nvidia-newsroom',name:'NVIDIA Newsroom',url:'https://nvidianews.nvidia.com/releases.xml',evidence:'official-claim'},
  {id:'anthropic',name:'Anthropic Newsroom',url:'https://www.anthropic.com/news',format:'newsroom',evidence:'official-claim'},
  {id:'huggingface',name:'Hugging Face Blog',url:'https://huggingface.co/blog/feed.xml',evidence:'publisher-claim'},
  {id:'microsoft-research',name:'Microsoft Research',url:'https://www.microsoft.com/en-us/research/feed/',evidence:'official-claim'},
  {id:'pytorch',name:'PyTorch Blog',url:'https://pytorch.org/feed/',evidence:'official-claim'},
  {id:'arxiv-neuro',name:'arXiv q-bio.NC',url:'https://rss.arxiv.org/rss/q-bio.NC',evidence:'preprint',collection:'medicine'},
];
export const searches = [
  {id:'agent-skills',query:'topic:agent-skills stars:>=50 archived:false fork:false'},
  {id:'research',query:'scientific research in:description stars:>=200 archived:false fork:false'},
  {id:'neuro',query:'neuroscience in:name,description stars:>=100 archived:false fork:false'},
  {id:'literature',query:'literature review in:description stars:>=100 archived:false fork:false'},
  {id:'medical',query:'medical imaging in:description stars:>=200 archived:false fork:false'},
];
export const limits={feedItems:60,discoveryPerQuery:10,enrichRepos:6,requestBytes:2_000_000,timeoutMs:15_000,digestItems:10,lookbackDays:30};
