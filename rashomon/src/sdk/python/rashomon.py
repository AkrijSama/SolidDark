from __future__ import annotations

import json
import os
import urllib.request
from typing import Any, Dict


DEFAULT_PROXY_URL = f"http://127.0.0.1:{os.environ.get('RASHOMON_PROXY_PORT', '8888')}"


def configure_proxy(proxy_url: str = DEFAULT_PROXY_URL) -> Dict[str, str]:
    os.environ["HTTP_PROXY"] = proxy_url
    os.environ["HTTPS_PROXY"] = proxy_url
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
    )
    urllib.request.install_opener(opener)
    return {"proxy_url": proxy_url}


def check(url: str, body: str = "", agent_id: str = "python-sdk") -> Dict[str, Any]:
    request = urllib.request.Request(
        DEFAULT_PROXY_URL,
        data=body.encode("utf-8"),
        method="POST",
        headers={
            "Host": urllib.request.urlparse(url).netloc,
            "X-Rashomon-Agent-Id": agent_id,
            "X-Rashomon-Agent-Name": "python-sdk",
            "X-Rashomon-Process-Name": "python",
            "X-Rashomon-Agent-Pid": str(os.getpid()),
        },
    )
    with urllib.request.urlopen(request) as response:
        return {
            "status": response.status,
            "body": response.read().decode("utf-8"),
        }


def report(agent_id: str, action: str, metadata: Dict[str, Any] | None = None) -> str:
    payload = {
        "agent_id": agent_id,
        "action": action,
        "metadata": metadata or {},
    }
    return json.dumps(payload)
