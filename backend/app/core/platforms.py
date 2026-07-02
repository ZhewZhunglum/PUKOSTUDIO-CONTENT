import re
from dataclasses import dataclass

OVERSEAS_SOCIAL_PLATFORMS: tuple[str, ...] = (
    "tiktok",
    "youtube",
    "instagram",
    "facebook",
    "x",
    "threads",
    "linkedin",
    "snapchat",
    "pinterest",
    "reddit",
    "twitch",
    "vimeo",
    "dailymotion",
    "kick",
    "rumble",
    "lemon8",
    "bluesky",
    "mastodon",
    "tumblr",
    "quora",
    "medium",
    "substack",
    "whatsapp_channels",
    "telegram",
    "discord",
    "spotify",
    "apple_podcasts",
    "soundcloud",
    "patreon",
    "amazon_live",
    "other_overseas",
)

MAINLAND_SOCIAL_PLATFORMS: tuple[str, ...] = (
    "douyin",
    "xiaohongshu",
    "bilibili",
    "kuaishou",
    "wechat_channels",
    "weibo",
)

SUPPORTED_SOCIAL_PLATFORMS: tuple[str, ...] = (
    *OVERSEAS_SOCIAL_PLATFORMS,
    *MAINLAND_SOCIAL_PLATFORMS,
)
SUPPORTED_SOCIAL_PLATFORM_SET = set(SUPPORTED_SOCIAL_PLATFORMS)


def is_supported_social_platform(platform: str) -> bool:
    return platform in SUPPORTED_SOCIAL_PLATFORM_SET


@dataclass(frozen=True)
class ImportPlatform:
    key: str
    label: str
    tier: str
    patterns: tuple[str, ...]


FIRST_CLASS_IMPORT_PLATFORMS: tuple[ImportPlatform, ...] = (
    ImportPlatform("tiktok", "TikTok", "first_class", (r"tiktok\.com",)),
    ImportPlatform("youtube", "YouTube", "first_class", (r"youtube\.com", r"youtu\.be")),
    ImportPlatform("instagram", "Instagram", "first_class", (r"instagram\.com",)),
    ImportPlatform("facebook", "Facebook", "first_class", (r"facebook\.com", r"fb\.watch")),
    ImportPlatform("x", "X / Twitter", "first_class", (r"twitter\.com", r"x\.com")),
    ImportPlatform("threads", "Threads", "first_class", (r"threads\.net",)),
    ImportPlatform("reddit", "Reddit", "first_class", (r"reddit\.com", r"redd\.it")),
    ImportPlatform("twitch", "Twitch", "first_class", (r"twitch\.tv",)),
    ImportPlatform("vimeo", "Vimeo", "first_class", (r"vimeo\.com",)),
    ImportPlatform("dailymotion", "Dailymotion", "first_class", (r"dailymotion\.com", r"dai\.ly")),
    ImportPlatform("kick", "Kick", "first_class", (r"kick\.com",)),
    ImportPlatform("rumble", "Rumble", "first_class", (r"rumble\.com",)),
    ImportPlatform("pinterest", "Pinterest", "first_class", (r"pinterest\.com", r"pin\.it")),
    ImportPlatform("snapchat", "Snapchat", "first_class", (r"snapchat\.com",)),
    ImportPlatform("linkedin", "LinkedIn", "first_class", (r"linkedin\.com",)),
    ImportPlatform("spotify", "Spotify", "first_class", (r"spotify\.com",)),
    ImportPlatform("soundcloud", "SoundCloud", "first_class", (r"soundcloud\.com", r"snd\.sc")),
    ImportPlatform("apple_podcasts", "Apple Podcasts", "first_class", (r"podcasts\.apple\.com",)),
    ImportPlatform("amazon_live", "Amazon Live", "first_class", (r"amazon\.com/live", r"amazonlive")),
    ImportPlatform("lemon8", "Lemon8", "first_class", (r"lemon8-app\.com", r"lemon8-app\.link")),
    ImportPlatform("bluesky", "Bluesky", "first_class", (r"bsky\.app", r"bsky\.social")),
    ImportPlatform("mastodon", "Mastodon", "first_class", (r"mastodon\.", r"mstdn\.")),
    ImportPlatform("tumblr", "Tumblr", "first_class", (r"tumblr\.com",)),
    ImportPlatform("quora", "Quora", "first_class", (r"quora\.com",)),
    ImportPlatform("medium", "Medium", "first_class", (r"medium\.com",)),
    ImportPlatform("substack", "Substack", "first_class", (r"substack\.com",)),
    ImportPlatform("telegram", "Telegram", "first_class", (r"t\.me", r"telegram\.me", r"telegram\.org")),
    ImportPlatform("discord", "Discord", "first_class", (r"discord\.com", r"discord\.gg")),
    ImportPlatform("whatsapp_channels", "WhatsApp Channels", "first_class", (r"whatsapp\.com", r"wa\.me")),
)

MAINLAND_IMPORT_PLATFORMS: tuple[ImportPlatform, ...] = (
    ImportPlatform("douyin", "抖音", "mainland_compat", (r"douyin\.com", r"iesdouyin\.com")),
    ImportPlatform("bilibili", "哔哩哔哩", "mainland_compat", (r"bilibili\.com", r"b23\.tv")),
    ImportPlatform("weibo", "微博", "mainland_compat", (r"weibo\.com",)),
    ImportPlatform("kuaishou", "快手", "mainland_compat", (r"kuaishou\.com", r"gifshow\.com")),
    ImportPlatform("xiaohongshu", "小红书", "mainland_compat", (r"xiaohongshu\.com", r"xhslink\.com")),
    ImportPlatform("wechat_channels", "微信视频号", "mainland_compat", (r"channels\.weixin\.qq\.com",)),
)

DIRECT_FILE_IMPORT_PLATFORM = ImportPlatform("direct_file", "Direct File", "direct_file", ())
GENERIC_YTDLP_IMPORT_PLATFORM = ImportPlatform("generic_ytdlp", "Generic yt-dlp", "generic_ytdlp", ())

IMPORT_PLATFORM_REGISTRY: tuple[ImportPlatform, ...] = (
    *FIRST_CLASS_IMPORT_PLATFORMS,
    DIRECT_FILE_IMPORT_PLATFORM,
    GENERIC_YTDLP_IMPORT_PLATFORM,
    *MAINLAND_IMPORT_PLATFORMS,
)


def detect_import_platform(url: str, *, is_direct_file: bool = False) -> ImportPlatform:
    if is_direct_file:
        return DIRECT_FILE_IMPORT_PLATFORM
    for platform in (*FIRST_CLASS_IMPORT_PLATFORMS, *MAINLAND_IMPORT_PLATFORMS):
        if any(re.search(pattern, url, re.I) for pattern in platform.patterns):
            return platform
    return GENERIC_YTDLP_IMPORT_PLATFORM


def import_platforms_payload() -> list[dict[str, object]]:
    return [
        {
            "key": platform.key,
            "label": platform.label,
            "tier": platform.tier,
            "patterns": list(platform.patterns),
        }
        for platform in IMPORT_PLATFORM_REGISTRY
    ]
