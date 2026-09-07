from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

from services.errors import INTERNAL_ERROR

METADATA_HOSTS = {
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.azure.com",
    "instance-data.ec2.internal",
}


def validate_webhook_url(url: str) -> None:
    parsed = urlparse(url)

    if parsed.scheme not in ("https",):
        raise HTTPException(
            status_code=422,
            detail={
                "ok": False,
                "error": {"code": INTERNAL_ERROR, "message": "Webhook URL must use HTTPS"},
            },
        )

    hostname = parsed.hostname or ""
    if not hostname:
        raise HTTPException(
            status_code=422,
            detail={
                "ok": False,
                "error": {"code": INTERNAL_ERROR, "message": "Webhook URL has no hostname"},
            },
        )

    if hostname in METADATA_HOSTS:
        raise HTTPException(
            status_code=422,
            detail={
                "ok": False,
                "error": {"code": INTERNAL_ERROR, "message": "Webhook URL targets cloud metadata endpoint"},
            },
        )

    try:
        resolved = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC)
        for _family, _, _, _, sockaddr in resolved:
            addr = ipaddress.ip_address(sockaddr[0])
            if addr.is_loopback:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "ok": False,
                        "error": {"code": INTERNAL_ERROR, "message": "Webhook URL resolves to loopback"},
                    },
                )
            if addr.is_private:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "ok": False,
                        "error": {"code": INTERNAL_ERROR, "message": "Webhook URL resolves to private network"},
                    },
                )
            if addr.is_link_local:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "ok": False,
                        "error": {"code": INTERNAL_ERROR, "message": "Webhook URL resolves to link-local address"},
                    },
                )
            if addr.is_reserved:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "ok": False,
                        "error": {"code": INTERNAL_ERROR, "message": "Webhook URL resolves to reserved address"},
                    },
                )
            if addr.is_multicast:
                raise HTTPException(
                    status_code=422,
                    detail={
                        "ok": False,
                        "error": {"code": INTERNAL_ERROR, "message": "Webhook URL resolves to multicast address"},
                    },
                )
    except HTTPException:
        raise
    except Exception:
        pass


async def fire_webhook(url: str, payload: dict) -> None:
    validate_webhook_url(url)
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0),
        follow_redirects=False,
    ) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail={
                    "ok": False,
                    "error": {"code": INTERNAL_ERROR, "message": f"Webhook returned HTTP {resp.status_code}"},
                },
            )
