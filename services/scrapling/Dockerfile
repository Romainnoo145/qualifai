FROM ghcr.io/d4vinci/scrapling:latest

WORKDIR /app

RUN uv pip install fastapi

COPY app.py .

ENTRYPOINT []
CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "3010"]
