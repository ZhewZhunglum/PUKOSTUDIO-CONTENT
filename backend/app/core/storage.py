import asyncio
import mimetypes
from pathlib import Path
from typing import Any

import boto3
from botocore.client import Config
from loguru import logger

from app.core.config import settings
from app.core.utils import utcnow


class StorageClient:
    def __init__(self) -> None:
        # Lazy: boto3 client is created on first use so the backend can start
        # even if S3 credentials are not yet configured (e.g. during initial
        # deploy before Cloudflare R2 is set up).
        self._client: Any = None
        self._presign_client: Any = None
        self.bucket = settings.s3_bucket

    def _build_client(self, endpoint_url: str) -> Any:
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )

    def _get_client(self) -> Any:
        if self._client is None:
            self._client = self._build_client(settings.s3_endpoint)
        return self._client

    def _get_presign_client(self) -> Any:
        if self._presign_client is None:
            endpoint = settings.s3_presigned_endpoint or settings.s3_endpoint
            self._presign_client = self._build_client(endpoint)
        return self._presign_client

    def build_key(self, asset_type: str, file_uuid: str, ext: str) -> str:
        date_prefix = utcnow().strftime("%Y/%m")
        return f"assets/{asset_type}/{date_prefix}/{file_uuid}.{ext.lstrip('.')}"

    def public_url(self, key: str) -> str:
        return f"{settings.s3_public_domain.rstrip('/')}/{key}"

    # ── Sync internals (called via run_in_executor) ────────────────────────────

    def _upload_file_sync(self, key: str, data: bytes, content_type: str) -> str:
        self._get_client().put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.debug(f"Uploaded {key} ({len(data)} bytes)")
        return self.public_url(key)

    def _upload_file_path_sync(self, key: str, path: str, content_type: str) -> str:
        self._get_client().upload_file(
            Filename=path,
            Bucket=self.bucket,
            Key=key,
            ExtraArgs={"ContentType": content_type},
        )
        logger.debug(f"Uploaded {key} from {Path(path).name}")
        return self.public_url(key)

    def _generate_presigned_upload_url_sync(
        self, key: str, content_type: str, expires_in: int
    ) -> str:
        return self._get_presign_client().generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=expires_in,
        )

    def _generate_presigned_download_url_sync(self, key: str, expires_in: int) -> str:
        return self._get_presign_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def _delete_object_sync(self, key: str) -> None:
        self._get_client().delete_object(Bucket=self.bucket, Key=key)
        logger.debug(f"Deleted {key}")

    def _get_object_metadata_sync(self, key: str) -> dict[str, Any] | None:
        try:
            resp = self._get_client().head_object(Bucket=self.bucket, Key=key)
            return {
                "content_length": resp.get("ContentLength"),
                "content_type": resp.get("ContentType"),
                "last_modified": resp.get("LastModified"),
                "etag": resp.get("ETag", "").strip('"'),
            }
        except Exception:
            return None

    def _get_object_bytes_sync(self, key: str) -> bytes:
        resp = self._get_client().get_object(Bucket=self.bucket, Key=key)
        return resp["Body"].read()

    # ── Async public API ───────────────────────────────────────────────────────

    async def upload_file(self, key: str, data: bytes, content_type: str | None = None) -> str:
        if content_type is None:
            content_type = mimetypes.guess_type(key)[0] or "application/octet-stream"
        return await asyncio.to_thread(self._upload_file_sync, key, data, content_type)

    async def upload_file_path(self, key: str, path: str, content_type: str | None = None) -> str:
        if content_type is None:
            content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
        return await asyncio.to_thread(self._upload_file_path_sync, key, path, content_type)

    async def generate_presigned_upload_url(
        self, key: str, content_type: str, expires_in: int = 3600
    ) -> str:
        return await asyncio.to_thread(
            self._generate_presigned_upload_url_sync, key, content_type, expires_in
        )

    async def generate_presigned_download_url(self, key: str, expires_in: int = 3600) -> str:
        return await asyncio.to_thread(
            self._generate_presigned_download_url_sync, key, expires_in
        )

    async def delete_object(self, key: str) -> None:
        await asyncio.to_thread(self._delete_object_sync, key)

    async def get_object_metadata(self, key: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_object_metadata_sync, key)

    async def get_object_bytes(self, key: str) -> bytes:
        return await asyncio.to_thread(self._get_object_bytes_sync, key)

    def _check_health_sync(self) -> bool:
        try:
            self._get_client().head_bucket(Bucket=self.bucket)
            return True
        except Exception:
            return False

    async def check_health(self) -> bool:
        """Async health check wrapper for the blocking boto3 client."""
        return await asyncio.to_thread(self._check_health_sync)


storage = StorageClient()
