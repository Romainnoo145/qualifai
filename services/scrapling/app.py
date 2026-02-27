from fastapi import FastAPI
from pydantic import BaseModel
from scrapling.fetchers import StealthyFetcher, DynamicFetcher

app = FastAPI()


class FetchRequest(BaseModel):
    url: str


class FetchResponse(BaseModel):
    success: bool
    html: str
    status_code: int
    error: str | None = None


@app.post("/fetch", response_model=FetchResponse)
async def fetch_stealth(req: FetchRequest) -> FetchResponse:
    """
    StealthyFetcher: requests-based with fingerprint spoofing.
    Fast (~2s). Bypasses most bot detection without a browser.
    """
    try:
        fetcher = StealthyFetcher()
        page = fetcher.fetch(req.url)
        return FetchResponse(
            success=True,
            html=page.html_content or "",
            status_code=page.status or 200,
        )
    except Exception as e:
        return FetchResponse(success=False, html="", status_code=0, error=str(e))


@app.post("/fetch-dynamic", response_model=FetchResponse)
async def fetch_dynamic(req: FetchRequest) -> FetchResponse:
    """
    DynamicFetcher: full headless browser with stealth.
    Slower (~10s). Use for JS-heavy or heavily protected pages.
    """
    try:
        fetcher = DynamicFetcher()
        page = fetcher.fetch(req.url)
        return FetchResponse(
            success=True,
            html=page.html_content or "",
            status_code=page.status or 200,
        )
    except Exception as e:
        return FetchResponse(success=False, html="", status_code=0, error=str(e))


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
