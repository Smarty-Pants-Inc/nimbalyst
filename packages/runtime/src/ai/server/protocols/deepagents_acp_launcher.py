"""Nimbalyst DeepAgents ACP launcher.

This is the product-owned Python entry point for DeepAgents ACP development
builds. It keeps project file reads/writes on ACP client filesystem callbacks
instead of using DeepAgents' direct local filesystem demo backend as the primary
edit path.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from acp.interfaces import Client
from acp.schema import (
    ClientCapabilities,
    FileSystemCapabilities,
    SessionMode,
    SessionModeState,
)
from deepagents import ProviderProfile, create_deep_agent, register_provider_profile
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from deepagents.backends.protocol import EditResult, FileData, ReadResult, WriteResult
from deepagents_acp.server import AgentServerACP, AgentSessionContext
from langgraph.checkpoint.memory import MemorySaver

FALLBACK_MODELS = [
    {"value": "openai:gpt-5.5", "name": "GPT-5.5"},
    {"value": "openai:gpt-5.4", "name": "GPT-5.4"},
    {"value": "openai:gpt-5.4-mini", "name": "GPT-5.4 Mini"},
    {"value": "openai:gpt-5.2", "name": "GPT-5.2"},
    {"value": "openai:claude-opus-4-7", "name": "Claude Opus 4.7"},
    {"value": "openai:claude-sonnet-4-6", "name": "Claude Sonnet 4.6"},
]

NIMBALYST_SYSTEM_PROMPT = """You are running inside Nimbalyst through ACP.

When a user asks you to create, write, edit, or verify a project file, you must use the filesystem tools. Do not claim a file was created or changed unless a read_file, write_file, or edit_file tool call has succeeded. For file creation requests, call write_file with the requested path and exact content before replying."""


class NimbalystACPFilesystemBackend(FilesystemBackend):
    """Filesystem backend that routes read/write/edit through ACP client FS."""

    def __init__(
        self,
        *,
        conn: Client,
        root_dir: str | Path,
        client_capabilities: ClientCapabilities,
        session_id: str,
    ) -> None:
        super().__init__(root_dir=root_dir, virtual_mode=True)
        fs_caps = client_capabilities.fs or FileSystemCapabilities()
        self._supports_read = bool(fs_caps.read_text_file)
        self._supports_write = bool(fs_caps.write_text_file)
        self._conn = conn
        self._session_id = session_id

    def _resolve_acp_path(self, file_path: str) -> str:
        path = Path(file_path)
        if path.is_absolute():
            resolved = path.resolve()
            try:
                resolved.relative_to(self.cwd)
            except ValueError:
                pass
            else:
                return str(resolved)
        return str(self._resolve_path(file_path))

    def read(self, file_path: str, offset: int = 0, limit: int = 2000) -> ReadResult:
        return ReadResult(error="ACP filesystem backend requires async read")

    def write(self, file_path: str, content: str) -> WriteResult:
        return WriteResult(error="ACP filesystem backend requires async write")

    def edit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        return EditResult(error="ACP filesystem backend requires async edit")

    async def aread(self, file_path: str, offset: int = 0, limit: int = 2000) -> ReadResult:
        if not self._supports_read:
            return ReadResult(error="ACP client did not advertise fs.readTextFile")

        response = await self._conn.read_text_file(
            session_id=self._session_id,
            path=self._resolve_acp_path(file_path),
            line=offset + 1,
            limit=limit,
        )
        return ReadResult(file_data=FileData(content=response.content, encoding="utf-8"))

    async def awrite(self, file_path: str, content: str) -> WriteResult:
        if not self._supports_write:
            return WriteResult(error="ACP client did not advertise fs.writeTextFile")

        resolved_path = self._resolve_acp_path(file_path)
        await self._conn.write_text_file(
            session_id=self._session_id,
            path=resolved_path,
            content=content,
        )
        return WriteResult(path=resolved_path)

    async def aedit(
        self,
        file_path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> EditResult:
        read_result = await self.aread(file_path)
        if read_result.error or read_result.file_data is None:
            return EditResult(error=read_result.error or f"Could not read {file_path}")

        content = read_result.file_data["content"]
        occurrences = content.count(old_string)
        if occurrences == 0:
            return EditResult(error=f"String not found in {file_path}")
        if not replace_all and occurrences != 1:
            return EditResult(error=f"String is not unique in {file_path}")

        new_content = content.replace(old_string, new_string, -1 if replace_all else 1)
        write_result = await self.awrite(file_path, new_content)
        if write_result.error:
            return EditResult(error=write_result.error)
        return EditResult(path=write_result.path, occurrences=occurrences if replace_all else 1)


class NimbalystDeepAgentsACPServer(AgentServerACP):
    """DeepAgents ACP server wrapper that captures client FS capabilities."""

    def __init__(self, agent: Any, **kwargs: Any) -> None:
        super().__init__(agent=agent, **kwargs)
        self.client_capabilities = ClientCapabilities()
        self._active_build_session_id: str | None = None

    async def initialize(
        self,
        protocol_version: int,
        client_capabilities: ClientCapabilities | None = None,
        **kwargs: Any,
    ):
        self.client_capabilities = client_capabilities or ClientCapabilities()
        return await super().initialize(
            protocol_version=protocol_version,
            client_capabilities=client_capabilities,
            **kwargs,
        )

    def make_backend(self, *, root_dir: str | Path, session_id: str) -> CompositeBackend:
        fs_caps = self.client_capabilities.fs or FileSystemCapabilities()
        if not fs_caps.read_text_file or not fs_caps.write_text_file:
            raise RuntimeError("DeepAgents ACP requires client fs.readTextFile and fs.writeTextFile")

        project_backend = NimbalystACPFilesystemBackend(
            conn=self._conn,
            root_dir=root_dir,
            client_capabilities=self.client_capabilities,
            session_id=session_id,
        )
        ephemeral_backend = StateBackend()
        return CompositeBackend(
            default=project_backend,
            routes={
                "/memories/": ephemeral_backend,
                "/conversation_history/": ephemeral_backend,
            },
        )

    def _reset_agent(self, session_id: str) -> None:
        self._active_build_session_id = session_id
        try:
            super()._reset_agent(session_id)
        finally:
            self._active_build_session_id = None


def _register_cli_proxy_profile() -> None:
    base_url = os.environ.get("NIMBALYST_CLI_PROXY_BASE_URL")
    api_key = os.environ.get("NIMBALYST_CLI_PROXY_API_KEY") or "nimbalyst"
    if not base_url:
        raise RuntimeError("NIMBALYST_CLI_PROXY_BASE_URL is required")

    register_provider_profile(
        "openai",
        ProviderProfile(
            init_kwargs={
                "base_url": base_url,
                "api_key": api_key,
                "use_responses_api": True,
            },
        ),
    )


def _format_model_name(model_id: str) -> str:
    if model_id.startswith("gpt-"):
        return model_id.upper().replace("-", " ")
    if model_id.startswith("claude-"):
        return "Claude " + model_id.removeprefix("claude-").replace("-", " ").title()
    return model_id


def _load_cli_proxy_models(base_url: str, api_key: str) -> list[dict[str, str]]:
    request = Request(
        f"{base_url.rstrip('/')}/models",
        headers={"Authorization": f"Bearer {api_key}"} if api_key else {},
    )
    try:
        with urlopen(request, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError):
        return FALLBACK_MODELS

    models: list[dict[str, str]] = []
    for entry in body.get("data", []):
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            continue
        model_id = entry["id"]
        models.append({"value": f"openai:{model_id}", "name": _format_model_name(model_id)})

    return models or FALLBACK_MODELS


async def main() -> None:
    _register_cli_proxy_profile()
    base_url = os.environ["NIMBALYST_CLI_PROXY_BASE_URL"]
    api_key = os.environ.get("NIMBALYST_CLI_PROXY_API_KEY") or "nimbalyst"
    checkpointer = MemorySaver()
    server_ref: dict[str, NimbalystDeepAgentsACPServer] = {}

    def build_agent(context: AgentSessionContext):
        server = server_ref["server"]
        session_id = server._active_build_session_id
        if not session_id:
            raise RuntimeError("DeepAgents ACP backend has no active session id")

        backend = server.make_backend(root_dir=context.cwd, session_id=session_id)
        return create_deep_agent(
            model=context.model or "openai:gpt-5.4",
            system_prompt=NIMBALYST_SYSTEM_PROMPT,
            checkpointer=checkpointer,
            backend=backend,
        )

    modes = SessionModeState(
        current_mode_id="ask_before_edits",
        available_modes=[
            SessionMode(id="ask_before_edits", name="Ask before edits"),
            SessionMode(id="accept_edits", name="Accept edits"),
            SessionMode(id="accept_everything", name="Accept everything"),
        ],
    )
    models = _load_cli_proxy_models(base_url, api_key)
    server = NimbalystDeepAgentsACPServer(agent=build_agent, modes=modes, models=models)
    server_ref["server"] = server

    from acp import run_agent

    await run_agent(server)


if __name__ == "__main__":
    asyncio.run(main())
