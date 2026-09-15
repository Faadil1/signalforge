from __future__ import annotations

from fastapi import APIRouter

from services.evidence_service import build_negative_path_evidence

router = APIRouter(tags=["evidence"])


@router.get("/evidence/negative-path")
async def negative_path_evidence():
    """Return the real failure record plus a clearly labelled controlled refusal proof."""
    return build_negative_path_evidence()
