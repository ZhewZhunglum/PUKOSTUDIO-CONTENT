export type SocialPlatform = {
  value: string;
  label: string;
  region: "overseas" | "mainland";
  hostPatterns: RegExp[];
};

export const OVERSEAS_SOCIAL_PLATFORMS: SocialPlatform[] = [
  { value: "tiktok", label: "TikTok", region: "overseas", hostPatterns: [/tiktok\.com/i] },
  { value: "youtube", label: "YouTube", region: "overseas", hostPatterns: [/youtube\.com|youtu\.be/i] },
  { value: "instagram", label: "Instagram", region: "overseas", hostPatterns: [/instagram\.com/i] },
  { value: "facebook", label: "Facebook", region: "overseas", hostPatterns: [/facebook\.com|fb\.watch/i] },
  { value: "x", label: "X", region: "overseas", hostPatterns: [/twitter\.com|x\.com/i] },
  { value: "threads", label: "Threads", region: "overseas", hostPatterns: [/threads\.net/i] },
  { value: "linkedin", label: "LinkedIn", region: "overseas", hostPatterns: [/linkedin\.com/i] },
  { value: "snapchat", label: "Snapchat", region: "overseas", hostPatterns: [/snapchat\.com/i] },
  { value: "pinterest", label: "Pinterest", region: "overseas", hostPatterns: [/pinterest\.com|pin\.it/i] },
  { value: "reddit", label: "Reddit", region: "overseas", hostPatterns: [/reddit\.com|redd\.it/i] },
  { value: "twitch", label: "Twitch", region: "overseas", hostPatterns: [/twitch\.tv/i] },
  { value: "vimeo", label: "Vimeo", region: "overseas", hostPatterns: [/vimeo\.com/i] },
  { value: "dailymotion", label: "Dailymotion", region: "overseas", hostPatterns: [/dailymotion\.com|dai\.ly/i] },
  { value: "kick", label: "Kick", region: "overseas", hostPatterns: [/kick\.com/i] },
  { value: "rumble", label: "Rumble", region: "overseas", hostPatterns: [/rumble\.com/i] },
  { value: "lemon8", label: "Lemon8", region: "overseas", hostPatterns: [/lemon8-app\.com|lemon8-app\.link/i] },
  { value: "bluesky", label: "Bluesky", region: "overseas", hostPatterns: [/bsky\.app|bsky\.social/i] },
  { value: "mastodon", label: "Mastodon", region: "overseas", hostPatterns: [/mastodon\.social|mstdn\.social/i] },
  { value: "tumblr", label: "Tumblr", region: "overseas", hostPatterns: [/tumblr\.com/i] },
  { value: "quora", label: "Quora", region: "overseas", hostPatterns: [/quora\.com/i] },
  { value: "medium", label: "Medium", region: "overseas", hostPatterns: [/medium\.com/i] },
  { value: "substack", label: "Substack", region: "overseas", hostPatterns: [/substack\.com/i] },
  { value: "whatsapp_channels", label: "WhatsApp Channels", region: "overseas", hostPatterns: [/whatsapp\.com|wa\.me/i] },
  { value: "telegram", label: "Telegram", region: "overseas", hostPatterns: [/t\.me|telegram\.me|telegram\.org/i] },
  { value: "discord", label: "Discord", region: "overseas", hostPatterns: [/discord\.com|discord\.gg/i] },
  { value: "spotify", label: "Spotify", region: "overseas", hostPatterns: [/spotify\.com/i] },
  { value: "apple_podcasts", label: "Apple Podcasts", region: "overseas", hostPatterns: [/podcasts\.apple\.com/i] },
  { value: "soundcloud", label: "SoundCloud", region: "overseas", hostPatterns: [/soundcloud\.com|snd\.sc/i] },
  { value: "patreon", label: "Patreon", region: "overseas", hostPatterns: [/patreon\.com/i] },
  { value: "amazon_live", label: "Amazon Live", region: "overseas", hostPatterns: [/amazon\.com\/live|amazonlive/i] },
  { value: "other_overseas", label: "Other Overseas", region: "overseas", hostPatterns: [] },
];

export const MAINLAND_SOCIAL_PLATFORMS: SocialPlatform[] = [
  { value: "douyin", label: "抖音", region: "mainland", hostPatterns: [/douyin\.com|iesdouyin\.com/i] },
  { value: "xiaohongshu", label: "小红书", region: "mainland", hostPatterns: [/xiaohongshu\.com|xhslink\.com/i] },
  { value: "bilibili", label: "哔哩哔哩", region: "mainland", hostPatterns: [/bilibili\.com|b23\.tv/i] },
  { value: "kuaishou", label: "快手", region: "mainland", hostPatterns: [/kuaishou\.com|gifshow\.com/i] },
  { value: "wechat_channels", label: "微信视频号", region: "mainland", hostPatterns: [/channels\.weixin\.qq\.com|weixin\.qq\.com/i] },
  { value: "weibo", label: "微博", region: "mainland", hostPatterns: [/weibo\.com/i] },
];

export const SOCIAL_PLATFORMS = [
  ...OVERSEAS_SOCIAL_PLATFORMS,
  ...MAINLAND_SOCIAL_PLATFORMS,
] as const;

export function platformLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return SOCIAL_PLATFORMS.find((platform) => platform.value === value)?.label ?? value;
}

export function detectPlatformByUrl(url: string): SocialPlatform | null {
  if (!url.trim()) return null;
  for (const platform of SOCIAL_PLATFORMS) {
    if (platform.hostPatterns.some((pattern) => pattern.test(url))) {
      return platform;
    }
  }
  return null;
}
